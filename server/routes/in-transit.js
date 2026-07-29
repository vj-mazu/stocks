const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth } = require('../middleware/auth');
const LorryTransitDetail = require('../models/LorryTransitDetail');
const PhysicalInspection = require('../models/PhysicalInspection');
const SampleEntry = require('../models/SampleEntry');
const Arrival = require('../models/Arrival');
const User = require('../models/User');
const Outturn = require('../models/Outturn');
const WeightBridge = require('../models/WeightBridge');
const { Warehouse, Kunchinittu } = require('../models/Location');
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
        { placeStatus: 'pending' },
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
          attributes: ['id', 'serialNo', 'variety', 'brokerName', 'location', 'partyName', 'lorryNumber', 'entryDate', 'packaging', 'grossWeight', 'tareWeight', 'netWeight', 'wbNo', 'partyWbName']
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
          wbNo: detail.wbNo || 'PENDING',
          grossWeight: detail.grossWeight || 0,
          tareWeight: detail.tareWeight || 0,
          netWeight: detail.netWeight || 0,
          suteNetWeight: detail.suteNetWeight || null,
          lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A',
          placeStatus: detail.placeStatus,
          placeDate: detail.placeDate,
          createdAt: detail.createdAt,
          placeType: detail.placeType,
          wbStatus: detail.wbStatus || 'none',
          wbInputType: detail.wbInputType,
          millWbId: detail.millWbId,
          millWb: millWb,
          partyWbName: detail.partyWbName,
          placeKunchinittuData: placeKunchinittu,
          placeWarehouse: placeWarehouse,
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
router.post('/:id/approve-wb', auth, async (req, res) => {
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
router.post('/:id/reject-wb', auth, async (req, res) => {
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
        netWeight: null
      });

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
          wbRejectReason: reason || 'Rejected'
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
