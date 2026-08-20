const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireApproverRole } = require('../middleware/roleAuth');
const {
  LorryTransitDetail,
  PhysicalInspection,
  SampleEntry,
  Arrival,
  User,
  Outturn,
  WeightBridge,
  Warehouse,
  Kunchinittu,
  InventoryQualityParameter
} = require('../models');
const cacheService = require('../services/cacheService');

// Initialize all associations globally
require('../models');

const router = express.Router();

/**
 * Helper function to search cutting in a single inspection
 */
const searchCuttingInInspection = (inspection) => {
  if (!inspection) return null;

  // 1. Check direct cutting field
  if (inspection.cutting && inspection.cutting !== '0' && inspection.cutting !== '0x0') {
    return inspection.cutting;
  }

  // 2. Check cutting1 and cutting2 fields
  if (inspection.cutting1 && inspection.cutting2) {
    const cutting = `${inspection.cutting1}x${inspection.cutting2}`;
    if (cutting !== '0x0') {
      return cutting;
    }
  }

  // 3. Check quality parameters
  if (inspection.qualityParameters) {
    const qp = inspection.qualityParameters;
    if (qp.cutting1 && qp.cutting2) {
      const cutting = `${qp.cutting1}x${qp.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
  }

  // 4. Check sampling stages
  if (inspection.samplingStages) {
    const stages = inspection.samplingStages;
    // Try full_avg first
    if (stages.full_avg && stages.full_avg.cutting && stages.full_avg.cutting !== '0' && stages.full_avg.cutting !== '0x0') {
      return stages.full_avg.cutting;
    }
    if (stages.full_avg && stages.full_avg.cutting1 && stages.full_avg.cutting2) {
      const cutting = `${stages.full_avg.cutting1}x${stages.full_avg.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
    // Try lot_avg
    if (stages.lot_avg && stages.lot_avg.cutting && stages.lot_avg.cutting !== '0' && stages.lot_avg.cutting !== '0x0') {
      return stages.lot_avg.cutting;
    }
    if (stages.lot_avg && stages.lot_avg.cutting1 && stages.lot_avg.cutting2) {
      const cutting = `${stages.lot_avg.cutting1}x${stages.lot_avg.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
    // Try individual stages
    const stageKeys = ['stage1', 'stage2', 'stage3'];
    for (const key of stageKeys) {
      if (stages[key]) {
        if (stages[key].cutting && stages[key].cutting !== '0' && stages[key].cutting !== '0x0') {
          return stages[key].cutting;
        }
        if (stages[key].cutting1 && stages[key].cutting2) {
          const cutting = `${stages[key].cutting1}x${stages[key].cutting2}`;
          if (cutting !== '0x0') {
            return cutting;
          }
        }
      }
    }
  }

  return null;
};

/**
 * Helper function to extract cutting values from inspection data
 * Searches through multiple possible locations for cutting data
 * Returns formatted string like "1x2" or null if not found
 * Enhanced to search previous trips when cutting is "0x0" or null (for balanced lots)
 */
const getCuttingFromInspection = async (inspection) => {
  if (!inspection) return null;

  // Search current inspection first
  let cutting = searchCuttingInInspection(inspection);

  // If cutting is found and not "0" or "0x0", return it
  if (cutting && cutting !== '0' && cutting !== '0x0') {
    return cutting;
  }

  // If cutting is "0", "0x0", or null, search previous trips
  try {
    const { Op } = require('sequelize');
    const whereClause = {
      id: { [Op.ne]: inspection.id }
    };

    if (inspection.sampleEntryId) {
      const isLorryPlaceholder = !inspection.lorryNumber ||
        ['lot_avg', 'balanced_lot'].includes(inspection.lorryNumber.toLowerCase().trim()) ||
        inspection.lorryNumber.toLowerCase().includes('next loading lorry');

      if (inspection.lorryNumber && !isLorryPlaceholder) {
        whereClause[Op.or] = [
          { sampleEntryId: inspection.sampleEntryId },
          { lorryNumber: inspection.lorryNumber }
        ];
      } else {
        whereClause.sampleEntryId = inspection.sampleEntryId;
      }
    } else if (inspection.lorryNumber) {
      whereClause.lorryNumber = inspection.lorryNumber;
    } else {
      return null;
    }

    // Query previous PhysicalInspections (ordered by date DESC)
    const previousInspections = await PhysicalInspection.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Search through each previous inspection
    for (const prevInspection of previousInspections) {
      const prevCutting = searchCuttingInInspection(prevInspection);
      if (prevCutting && prevCutting !== '0' && prevCutting !== '0x0') {
        return prevCutting;
      }
    }
  } catch (error) {
    console.error('Error searching previous trips for cutting:', error);
  }

  return null;
};

// Helper function to check if a PhysicalInspection has an APPROVED Full Lorry stage
const isFullLorryApprovedInspection = (inspection) => {
  if (!inspection || !inspection.samplingStages) return false;
  const stages = inspection.samplingStages;
  return Object.keys(stages).some(key => {
    const baseKey = key.replace(/_hold_\\d+$/, '').replace(/_reattempt_\\d+$/, '');
    if (baseKey === 'full_avg' || baseKey === 'full_lorry_avg') {
      const stageObj = stages[key];
      if (!stageObj) return false;
      const status = stageObj.approvalStatus || stageObj.status;
      return status === 'approved';
    }
    return false;
  });
};

// GET /in-transit - Fetch entries pending Place decisions
router.get('/in-transit', auth, async (req, res) => {
  try {
    const { limit = 200, search } = req.query;

    console.log('🔍 In-Transit: Fetching entries with placeStatus=none, pending, or placed');

    const where = {
      [Op.or]: [
        // Pending entries that are BMB edits (EDIT_PENDING:approved) belong in BMB, not In-Transit.
        // All other pending entries (including In-Transit edits EDIT_PENDING:placed) stay in In-Transit.
        { placeStatus: 'pending', placeRejectReason: { [Op.or]: [null, { [Op.notLike]: 'EDIT_PENDING:approved%' }] } },
        { placeStatus: 'none' },
        { placeStatus: null },
        { placeStatus: 'placed' }
      ]
    };

    // Fetch transit details with PhysicalInspection and SampleEntry associations
    const entries = await LorryTransitDetail.findAll({
      where,
      include: [
        {
          model: PhysicalInspection,
          as: 'physicalInspection',
          required: false
        },
        {
          model: SampleEntry,
          as: 'sampleEntry',
          required: false,
          include: [
            {
              association: 'offering',
              required: false
            }
          ]
        },
        {
          model: InventoryQualityParameter,
          as: 'inventoryQualityParameters',
          required: false,
          include: [
            { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] },
            { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    console.log(`✅ In-Transit: Found ${entries.length} transit detail entries`);

    // Map entries with sequential numbers
    const arrivals = await Promise.all(entries.map(async (detail, index) => {
      try {
        const inspection = detail.physicalInspection;
        const sampleEntry = detail.sampleEntry || {};

        // Fetch place kunchinittu and warehouse if selected
        const placeKunchinittu = detail.placeKunchinittuId
          ? await Kunchinittu.findByPk(detail.placeKunchinittuId, { attributes: ['id', 'name', 'code'] })
          : null;

        const placeWarehouse = detail.placeWarehouseId
          ? await Warehouse.findByPk(detail.placeWarehouseId, { attributes: ['id', 'name', 'code'] })
          : null;

        const outturn = detail.outturnId
          ? await Outturn.findByPk(detail.outturnId, { attributes: ['id', 'code', 'allottedVariety'] })
          : null;

        // Fetch Mill Weight Bridge if exists
        const millWb = detail.millWbId
          ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name', 'location'] })
          : null;

        // Resolve wbAddedBy user name
        const wbAddedByUser = detail.wbAddedBy
          ? await User.findByPk(detail.wbAddedBy, { attributes: ['id', 'username', 'fullName'] })
          : null;

        // Resolve placeAddedBy user name
        const placeAddedByUser = detail.placeAddedBy
          ? await User.findByPk(detail.placeAddedBy, { attributes: ['id', 'username', 'fullName'] })
          : null;

        // Resolve placeApprover user name
        const placeApproverUser = detail.placeApprovedBy
          ? await User.findByPk(detail.placeApprovedBy, { attributes: ['id', 'username', 'fullName'] })
          : null;

        // Resolve wbApprover user name
        const wbApproverUser = detail.wbApprovedBy
          ? await User.findByPk(detail.wbApprovedBy, { attributes: ['id', 'username', 'fullName', 'role'] })
          : null;

        return {
          id: detail.id,
          slNo: index + 1,
          date: detail.placeDate || detail.createdAt,
          movementType: 'purchase',
          broker: sampleEntry.brokerName || null,
          variety: sampleEntry.variety || null,
          bags: inspection?.bags || 0,
          packaging: parseFloat(sampleEntry.packaging) || 75,
          fromLocation: sampleEntry.location || null,
          entryDate: sampleEntry.entryDate || detail.placeDate || detail.createdAt,
          partyName: sampleEntry.partyName || null,
          toKunchinittu: placeKunchinittu ? {
            id: placeKunchinittu.id,
            name: placeKunchinittu.name,
            code: placeKunchinittu.code
          } : null,
          toWarehouse: placeWarehouse ? {
            id: placeWarehouse.id,
            name: placeWarehouse.name,
            code: placeWarehouse.code
          } : null,
          outturn: outturn ? {
            id: outturn.id,
            code: outturn.code,
            allottedVariety: outturn.allottedVariety
          } : null,
          moisture: inspection?.samplingStages?.full_avg?.moisture || inspection?.moisture || null,
          cutting: await getCuttingFromInspection(inspection),
          // Mill WB fields
          wbNo: detail.wbNo || null,
          grossWeight: detail.grossWeight || null,
          tareWeight: detail.tareWeight || null,
          netWeight: detail.netWeight || null,
          sute: detail.sute || null,
          suteNetWeight: detail.suteNetWeight || null,
          wbDate: detail.wbDate || null,
          wbStatus: detail.wbStatus || 'none',
          wbInputType: detail.wbInputType,
          millWbId: detail.millWbId,
          millWeightBridge: millWb,
          wbAddedBy: wbAddedByUser ? { id: wbAddedByUser.id, username: wbAddedByUser.username, fullName: wbAddedByUser.fullName } : null,
          wbAddedByUser: wbAddedByUser ? { id: wbAddedByUser.id, username: wbAddedByUser.username, fullName: wbAddedByUser.fullName } : null,
          wbAddedAt: detail.wbAddedAt || null,
          wbApprovedBy: detail.wbApprovedBy || null,
          wbApprover: wbApproverUser ? { id: wbApproverUser.id, username: wbApproverUser.username, fullName: wbApproverUser.fullName, role: wbApproverUser.role } : null,
          // Party WB fields
          partyWbEnabled: detail.partyWbEnabled || null,
          partyWbName: detail.partyWbName || null,
          partyWbNo: detail.partyWbNo || null,
          partyGrossWeight: detail.partyGrossWeight || null,
          partyTareWeight: detail.partyTareWeight || null,
          partyNetWeight: detail.partyNetWeight || null,
          partySute: detail.partySute || null,
          partySuteNetWeight: detail.partySuteNetWeight || null,
          partyWbDate: detail.partyWbDate || null,
          // Place fields
          lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A',
          placeStatus: detail.placeStatus,
          placeDate: detail.placeDate,
          placeApprovedAt: detail.placeApprovedAt || null,
          createdAt: detail.createdAt,
          placeType: detail.placeType,
          placeKunchinittuData: placeKunchinittu,
          placeWarehouse: placeWarehouse,
          placeAddedByUser: placeAddedByUser ? { id: placeAddedByUser.id, username: placeAddedByUser.username, fullName: placeAddedByUser.fullName } : null,
          placeApprover: placeApproverUser ? { id: placeApproverUser.id, username: placeApproverUser.username, fullName: placeApproverUser.fullName } : null,
          sampleEntry: sampleEntry,
          isInTransit: true,
          isFullLorryApproved: isFullLorryApprovedInspection(inspection),
          transitDetailId: detail.id
        };

      } catch (entryError) {
        console.error(`Error processing In-Transit entry ${detail.id}:`, entryError);
        return {
          id: detail.id,
          slNo: index + 1,
          date: detail.createdAt,
          placeStatus: detail.placeStatus,
          wbNo: detail.wbNo || 'PENDING',
          isInTransit: true,
          transitDetailId: detail.id
        };
      }
    }));

    console.log(`📤 In-Transit: Returning ${arrivals.length} formatted entries`);

    res.json({ arrivals });
  } catch (error) {
    console.error('Error fetching in-transit entries:', error);
    res.status(500).json({ error: 'Failed to fetch in-transit entries' });
  }
});

// POST /:id/approve-place - Move entry from In-Transit to Band Malal Book
router.post('/:id/approve-place', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const PhysicalInspection = require('../models/PhysicalInspection');
    const LorryTransitDetail = require('../models/LorryTransitDetail');
    const SampleEntry = require('../models/SampleEntry');
    const Sequelize = require('sequelize');

    // 1. Check if id is directly LorryTransitDetail ID
    let detail = await LorryTransitDetail.findByPk(id);

    if (!detail) {
      // 2. Check if id is PhysicalInspection ID
      detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });
    }

    if (detail) {
      if (detail.placeStatus === 'pending') {
        // Only admin / MD / owner can approve pending godown edits
        const approverRole = String(req.user.effectiveRole || req.user.role || '').toLowerCase();
        if (!['admin', 'md', 'owner'].includes(approverRole)) {
          return res.status(403).json({ error: 'Only admin, MD or owner can approve godown edits' });
        }
        // Godown EDIT approval - apply the edit
        const isBmbEdit = detail.placeRejectReason && detail.placeRejectReason.startsWith('EDIT_PENDING:approved');
        const restoreStatus = isBmbEdit ? 'approved' : 'placed';
        await detail.update({
          placeStatus: restoreStatus,
          placeRejectReason: null,
          placeApprovedBy: req.user.userId,
          placeApprovedAt: new Date()
        });
        ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
          cacheService.delPattern(pattern).catch(() => {});
        });
        return res.json({
          message: isBmbEdit ? 'Godown edit approved - entry restored to Band Malal Book' : 'Godown edit approved',
          detail,
          note: isBmbEdit ? 'Entry is back in Band Malal Book.' : 'Entry stays in In-Transit. Move to Band Malal Book when ready.'
        });
      }
      if (detail.placeStatus !== 'placed') {
        return res.status(400).json({ error: 'Place must be added before moving to Band Malal Book. Current status: ' + detail.placeStatus });
      }

      // Move to Band Malal Book (placeStatus='approved')
      // This is a MANUAL action - Place is already added directly, now moving to BMB
      await detail.update({
        placeStatus: 'approved',
        placeApprovedBy: req.user.userId,
        placeApprovedAt: new Date()
      });

      // Invalidate caches
      ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
        cacheService.delPattern(pattern).catch(() => {});
      });

      return res.json({
        message: 'Entry moved to Band Malal Book',
        detail,
        note: 'Entry is now in Band Malal Book.'
      });
    }

    // 3. Fallback: Check if it's an Arrival (only if id is numeric/integer)
    if (!isNaN(id) && Number.isInteger(Number(id))) {
      const arrival = await Arrival.findByPk(Number(id));
      if (arrival) {
        if (arrival.placeStatus === 'pending') {
          // Godown EDIT approval - apply the edit
          const isBmbEdit = arrival.placeRejectReason && arrival.placeRejectReason.startsWith('EDIT_PENDING:approved');
          const restoreStatus = isBmbEdit ? 'approved' : 'placed';
          await arrival.update({
            placeStatus: restoreStatus,
            placeRejectReason: null,
            placeApprovedBy: req.user.userId,
            placeApprovedAt: new Date()
          });
          return res.json({
            message: isBmbEdit ? 'Godown edit approved - entry restored to Band Malal Book' : 'Godown edit approved',
            arrival,
            note: isBmbEdit ? 'Entry is back in Band Malal Book.' : 'Entry stays in current state. Move to Band Malal Book when ready.'
          });
        }
        if (arrival.placeStatus !== 'placed') {
          return res.status(400).json({ error: 'Place must be added before moving to Band Malal Book' });
        }

        await arrival.update({
          placeStatus: 'approved',
          placeApprovedBy: req.user.userId,
          placeApprovedAt: new Date()
        });

        return res.json({ message: 'Entry moved to Band Malal Book', arrival });
      }
    }

    return res.status(404).json({ error: 'Entry not found' });
  } catch (error) {
    console.error('Error moving to Band Malal Book:', error);
    res.status(500).json({ error: 'Failed to move entry to Band Malal Book' });
  }
});

// POST /:id/reject-place - Remove place from entry (revert to In-Transit)
router.post('/:id/reject-place', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const PhysicalInspection = require('../models/PhysicalInspection');
    const LorryTransitDetail = require('../models/LorryTransitDetail');

    // 1. Check if id is directly LorryTransitDetail ID
    let detail = await LorryTransitDetail.findByPk(id);

    if (!detail) {
      // 2. Check if id is PhysicalInspection ID
      detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });
    }

    if (detail) {
      if (detail.placeStatus !== 'placed' && detail.placeStatus !== 'pending') {
        return res.status(400).json({ error: 'Cannot remove place from current status: ' + detail.placeStatus });
      }

      // If this is a pending EDIT, restore the previous values instead of wiping the place
      const editMarker = detail.placeRejectReason || '';
      if (detail.placeStatus === 'pending' && editMarker.startsWith('EDIT_PENDING:')) {
        // Only admin / MD / owner can reject pending godown edits
        const approverRole = String(req.user.effectiveRole || req.user.role || '').toLowerCase();
        if (!['admin', 'md', 'owner'].includes(approverRole)) {
          return res.status(403).json({ error: 'Only admin, MD or owner can reject godown edits' });
        }
        const parts = editMarker.split(':');
        const prevStatus = parts[1] || 'approved';
        let oldValues = {};
        try {
          const jsonPart = editMarker.substring(editMarker.indexOf('{', editMarker.indexOf(':')));
          oldValues = JSON.parse(jsonPart);
        } catch (e) {
          oldValues = {};
        }
        await detail.update({
          placeStatus: prevStatus === 'approved' ? 'approved' : 'placed',
          placeRejectReason: 'REJECTED_EDIT: ' + (reason || 'Edit rejected'),
          placeDate: oldValues.hasOwnProperty('placeDate') ? oldValues.placeDate : detail.placeDate,
          placeKunchinittuId: oldValues.hasOwnProperty('placeKunchinittuId') ? oldValues.placeKunchinittuId : detail.placeKunchinittuId,
          placeWarehouseId: oldValues.hasOwnProperty('placeWarehouseId') ? oldValues.placeWarehouseId : detail.placeWarehouseId,
          placeType: oldValues.hasOwnProperty('placeType') ? oldValues.placeType : detail.placeType,
          outturnId: oldValues.hasOwnProperty('outturnId') ? oldValues.outturnId : detail.outturnId
        });

        // Invalidate caches
        ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
          cacheService.delPattern(pattern).catch(() => {});
        });

        return res.json({
          message: prevStatus === 'approved' ? 'Godown edit rejected - entry restored to Band Malal Book' : 'Godown edit rejected',
          detail,
          note: prevStatus === 'approved' ? 'Entry restored to Band Malal Book with previous values.' : 'Entry restored to In-Transit with previous values.'
        });
      }

      await detail.update({
        placeStatus: 'none',
        placeRejectReason: reason || 'Removed',
        placeDate: null,
        placeKunchinittuId: null,
        placeWarehouseId: null,
        outturnId: null
      });

      // Invalidate caches
      ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
        cacheService.delPattern(pattern).catch(() => {});
      });

      return res.json({ message: 'Place removed, entry returned to In-Transit', detail });
    }

    // 3. Fallback: Check if it's an Arrival (only if id is numeric/integer)
    if (!isNaN(id) && Number.isInteger(Number(id))) {
      const arrival = await Arrival.findByPk(Number(id));
      if (arrival) {
        if (arrival.placeStatus !== 'placed' && arrival.placeStatus !== 'pending') {
          return res.status(400).json({ error: 'Cannot remove place from current status' });
        }

        // If this is a pending EDIT, restore the previous values instead of wiping the place
        const editMarker = arrival.placeRejectReason || '';
        if (arrival.placeStatus === 'pending' && editMarker.startsWith('EDIT_PENDING:')) {
          const parts = editMarker.split(':');
          const prevStatus = parts[1] || 'approved';
          let oldValues = {};
          try {
            const jsonPart = editMarker.substring(editMarker.indexOf('{', editMarker.indexOf(':')));
            oldValues = JSON.parse(jsonPart);
          } catch (e) {
            oldValues = {};
          }
          await arrival.update({
            placeStatus: prevStatus === 'approved' ? 'approved' : 'placed',
            placeRejectReason: 'REJECTED_EDIT: ' + (reason || 'Edit rejected'),
            placeDate: oldValues.hasOwnProperty('placeDate') ? oldValues.placeDate : arrival.placeDate,
            placeKunchinittuId: oldValues.hasOwnProperty('placeKunchinittuId') ? oldValues.placeKunchinittuId : arrival.placeKunchinittuId,
            placeWarehouseId: oldValues.hasOwnProperty('placeWarehouseId') ? oldValues.placeWarehouseId : arrival.placeWarehouseId,
            placeType: oldValues.hasOwnProperty('placeType') ? oldValues.placeType : arrival.placeType,
            outturnId: oldValues.hasOwnProperty('outturnId') ? oldValues.outturnId : arrival.outturnId
          });
          return res.json({
            message: prevStatus === 'approved' ? 'Godown edit rejected - entry restored to Band Malal Book' : 'Godown edit rejected',
            arrival,
            note: prevStatus === 'approved' ? 'Entry restored to Band Malal Book with previous values.' : 'Entry restored to In-Transit with previous values.'
          });
        }

        await arrival.update({
          placeStatus: 'none',
          placeRejectReason: reason || 'Removed',
          placeDate: null,
          placeKunchinittuId: null,
          placeWarehouseId: null
        });

        return res.json({ message: 'Place removed, entry returned to In-Transit', arrival });
      }
    }

    return res.status(404).json({ error: 'Entry not found' });
  } catch (error) {
    console.error('Error removing place:', error);
    res.status(500).json({ error: 'Failed to remove place' });
  }
});

// POST /:id/approve-wb - Approve weigh bridge for a lorry
router.post('/:id/approve-wb', auth, requireApproverRole, async (req, res) => {
  try {
    const { id } = req.params;
    const Sequelize = require('sequelize');

    const PhysicalInspection = require('../models/PhysicalInspection');
    const LorryTransitDetail = require('../models/LorryTransitDetail');

    let targetId = id;
    const transitDetail = await LorryTransitDetail.findByPk(id);

    if (transitDetail && transitDetail.physicalInspectionId) {
      targetId = transitDetail.physicalInspectionId;
    }

    // First check if id is a PhysicalInspection
    const inspection = await PhysicalInspection.findByPk(targetId);

    if (inspection) {
      const detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: targetId } });

      if (!detail || detail.wbStatus !== 'pending') {
        return res.status(400).json({ error: 'No pending WB to approve for this lorry' });
      }

      await detail.update({
        wbStatus: 'approved',
        wbApprovedBy: req.user.userId,
        wbApprovedAt: new Date()
      });

      // Update the auto-created Arrival weights
      const arrival = await Arrival.findOne({
        where: {
          lorryNumber: inspection.lorryNumber,
          remarks: { [Op.like]: `%inspection #${inspection.id}%` }
        }
      });

      if (arrival) {
        await arrival.update({
          wbStatus: 'approved',
          grossWeight: detail.grossWeight || arrival.grossWeight,
          tareWeight: detail.tareWeight || arrival.tareWeight,
          netWeight: detail.netWeight || arrival.netWeight
        });
      }

      // Invalidate caches
      ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
        cacheService.delPattern(pattern).catch(() => {});
      });

      return res.json({ message: 'Weigh Bridge approved', detail });
    }

    // Fallback: Check if it's an Arrival
    if (!isNaN(id) && Number.isInteger(Number(id))) {
      const arrival = await Arrival.findByPk(Number(id));
      if (arrival) {
        if (arrival.wbStatus !== 'pending') {
          return res.status(400).json({ error: 'No pending WB to approve' });
        }

        await arrival.update({
          wbStatus: 'approved',
          wbApprovedBy: req.user.userId,
          wbApprovedAt: new Date()
        });

        return res.json({ message: 'Weigh Bridge approved for arrival', arrival });
      }
    }

    return res.status(404).json({ error: 'Entry not found' });
  } catch (error) {
    console.error('Error approving WB:', error);
    res.status(500).json({ error: 'Failed to approve WB' });
  }
});

// POST /:id/reject-wb - Reject weigh bridge for a lorry
router.post('/:id/reject-wb', auth, requireApproverRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const PhysicalInspection = require('../models/PhysicalInspection');
    const LorryTransitDetail = require('../models/LorryTransitDetail');

    let targetId = id;
    const transitDetail = await LorryTransitDetail.findByPk(id);

    if (transitDetail && transitDetail.physicalInspectionId) {
      targetId = transitDetail.physicalInspectionId;
    }

    // First check if id is a PhysicalInspection
    const inspection = await PhysicalInspection.findByPk(targetId);

    if (inspection) {
      const detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: targetId } });

      if (!detail || detail.wbStatus !== 'pending') {
        return res.status(400).json({ error: 'No pending WB to reject for this lorry' });
      }

      await detail.update({
        wbStatus: 'rejected',
        wbRejectReason: reason || 'Rejected',
        wbInputType: null,
        millWbId: null,
        partyWbName: null,
        wbNo: null,
        grossWeight: null,
        tareWeight: null,
        netWeight: null,
        sute: null,
        suteNetWeight: null
      });

      // Update the auto-created Arrival weights if it exists
      const arrival = await Arrival.findOne({
        where: {
          lorryNumber: inspection.lorryNumber,
          remarks: { [Op.like]: `%inspection #${inspection.id}%` }
        }
      });

      if (arrival) {
        await arrival.update({
          wbStatus: 'rejected',
          wbRejectReason: reason || 'Rejected',
          wbInputType: null,
          millWbId: null,
          partyWbName: null,
          wbNo: null,
          grossWeight: null,
          tareWeight: null,
          netWeight: null,
          sute: null,
          suteNetWeight: null
        });
      }

      // Invalidate caches
      ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(pattern => {
        cacheService.delPattern(pattern).catch(() => {});
      });

      return res.json({ message: 'WB rejected', detail });
    }

    // Fallback: Check if it's an Arrival
    if (!isNaN(id) && Number.isInteger(Number(id))) {
      const arrival = await Arrival.findByPk(Number(id));
      if (arrival) {
        if (arrival.wbStatus !== 'pending') {
          return res.status(400).json({ error: 'No pending WB to reject' });
        }

        await arrival.update({
          wbStatus: 'rejected',
          wbRejectReason: reason || 'Rejected',
          wbInputType: null,
          millWbId: null,
          partyWbName: null,
          wbNo: null,
          grossWeight: null,
          tareWeight: null,
          netWeight: null,
          sute: null,
          suteNetWeight: null
        });

        return res.json({ message: 'WB rejected', arrival });
      }
    }

    return res.status(404).json({ error: 'Entry not found' });
  } catch (error) {
    console.error('Error rejecting WB:', error);
    res.status(500).json({ error: 'Failed to reject WB' });
  }
});

module.exports = router;

