const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth } = require('../middleware/auth');
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
 */
const getCuttingFromInspection = async (inspection) => {
  if (!inspection) return null;

  let cutting = searchCuttingInInspection(inspection);

  if (cutting && cutting !== '0' && cutting !== '0x0') {
    return cutting;
  }

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

    const previousInspections = await PhysicalInspection.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: 10
    });

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

// GET /band-malal-book - Fetch entries with approved Place decisions
router.get('/band-malal-book', auth, async (req, res) => {
  try {
    const { limit = 200, search } = req.query;

    console.log('🔍 Band Malal Book: Fetching entries with placeStatus=approved');

    const where = { placeStatus: 'approved' };

    // Get total count of approved entries for SL No calculation
    const totalApprovedCount = await LorryTransitDetail.count({ where });

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
        },
        {
          model: InventoryQualityParameter,
          as: 'inventoryQualityParameters',
          required: false,
          include: [
            { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] }
          ]
        }
      ],
      order: [['placeApprovedAt', 'ASC'], ['createdAt', 'ASC']],
      limit: parseInt(limit)
    });

    console.log(`✅ Band Malal Book: Found ${entries.length} transit detail entries (Total: ${totalApprovedCount})`);

    console.log("=== BMB ENTRY DIAGNOSTICS ===");
    entries.forEach((e, idx) => {
      console.log(`[BMB ${idx}] ID: ${e.id}`);
      console.log(`  - physicalInspectionId: ${e.physicalInspectionId}`);
      console.log(`  - physicalInspection association loaded: ${!!e.physicalInspection}`);
      if (e.physicalInspection) {
        console.log(`    * PI ID: ${e.physicalInspection.id}`);
        console.log(`    * PI Lorry: ${e.physicalInspection.lorryNumber}`);
      }
      console.log(`  - sampleEntryId: ${e.sampleEntryId}`);
      console.log(`  - sampleEntry association loaded: ${!!e.sampleEntry}`);
      if (e.sampleEntry) {
        console.log(`    * SE ID: ${e.sampleEntry.id}`);
        console.log(`    * SE Party: ${e.sampleEntry.partyName}`);
        console.log(`    * SE Lorry: ${e.sampleEntry.lorryNumber}`);
      }
    });
    console.log("===============================");

    // Map entries with sequential BMB numbers (counting UP from 1)
    const arrivals = await Promise.all(entries.map(async (detail, index) => {
      try {
        // Get physical inspection and sample entry from the already-loaded associations
        let inspection = detail.physicalInspection;
        let sampleEntry = detail.sampleEntry;

        // Auto-heal: Load physical inspection if missing from association
        if (!inspection && detail.physicalInspectionId) {
          inspection = await PhysicalInspection.findByPk(detail.physicalInspectionId);
        }

        // Auto-heal: If inspection is still not found, try to auto-match using wbNo or sampleEntryId
        if (!inspection) {
          console.log(`⚠️ Inspection not found for BMB detail ${detail.id}. Attempting auto-match...`);

          // 1. Try to find a PhysicalInspection that has the same sampleEntryId
          if (detail.sampleEntryId) {
            inspection = await PhysicalInspection.findOne({ where: { sampleEntryId: detail.sampleEntryId } });
          }

          // 2. Try to find by matching wbNo on SampleEntry
          if (!inspection && detail.wbNo && detail.wbNo !== 'PENDING' && detail.wbNo !== '-') {
            const matchedSample = await SampleEntry.findOne({ where: { wbNo: detail.wbNo } });
            if (matchedSample) {
              inspection = await PhysicalInspection.findOne({ where: { sampleEntryId: matchedSample.id } });
              if (inspection) {
                detail.sampleEntryId = matchedSample.id;
                detail.physicalInspectionId = inspection.id;
                await detail.save();
              }
            }
          }

          // 3. Try to find by matching netWeight or grossWeight on SampleEntry
          if (!inspection && detail.netWeight && parseFloat(detail.netWeight) > 0) {
            const matchedSample = await SampleEntry.findOne({ where: { netWeight: detail.netWeight } });
            if (matchedSample) {
              inspection = await PhysicalInspection.findOne({ where: { sampleEntryId: matchedSample.id } });
              if (inspection) {
                detail.sampleEntryId = matchedSample.id;
                detail.physicalInspectionId = inspection.id;
                await detail.save();
              }
            }
          }

          if (inspection) {
            console.log(`🎉 Auto-matched and linked physical inspection ${inspection.id} to detail ${detail.id}`);
          }
        }

        // Auto-heal: Backfill sampleEntryId on lorry_transit_details if it is missing
        if (inspection && (!detail.sampleEntryId || !sampleEntry)) {
          detail.sampleEntryId = inspection.sampleEntryId;
          await detail.save();
          sampleEntry = await SampleEntry.findByPk(inspection.sampleEntryId, {
            attributes: ['id', 'serialNo', 'variety', 'brokerName', 'location', 'partyName', 'lorryNumber', 'entryDate', 'packaging', 'grossWeight', 'tareWeight', 'netWeight', 'wbNo', 'partyWbName']
          });
        }

        if (!sampleEntry) {
          sampleEntry = {};
        }

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

        const millWb = detail.millWbId
          ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name', 'location'] })
          : null;

        // Fetch wbAddedBy user details
        const wbAddedByUser = detail.wbAddedBy
          ? await User.findByPk(detail.wbAddedBy, { attributes: ['id', 'username', 'fullName'] })
          : null;

        // Fetch placeApprovedBy user details
        const placeApproverUser = detail.placeApprovedBy
          ? await User.findByPk(detail.placeApprovedBy, { attributes: ['id', 'username', 'fullName'] })
          : null;

        // Fetch wbApprovedBy user details
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
          wbNo: detail.wbNo || 'PENDING',
          grossWeight: detail.grossWeight || 0,
          tareWeight: detail.tareWeight || 0,
          netWeight: detail.netWeight || 0,
          sute: detail.sute || null,
          suteNetWeight: detail.suteNetWeight || null,
          wbDate: detail.wbDate || null,
          wbStatus: detail.wbStatus || 'none',
          wbInputType: detail.wbInputType,
          millWbId: detail.millWbId,
          millWeightBridge: millWb,
          wbAddedBy: wbAddedByUser ? { id: wbAddedByUser.id, username: wbAddedByUser.username, fullName: wbAddedByUser.fullName } : null,
          wbAddedAt: detail.wbAddedAt || null,
          wbApprovedBy: detail.wbApprovedBy || null,
          wbApprover: wbApproverUser ? { id: wbApproverUser.id, username: wbApproverUser.username, fullName: wbApproverUser.fullName, role: wbApproverUser.role } : null,
          wbApprovedAt: detail.wbApprovedAt || null,
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
          // Place and other fields
          lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A',
          placeStatus: detail.placeStatus,
          placeDate: detail.placeDate,
          placeApprovedAt: detail.placeApprovedAt || null,
          placeApprover: placeApproverUser ? { id: placeApproverUser.id, username: placeApproverUser.username, fullName: placeApproverUser.fullName } : null,
          createdAt: detail.createdAt,
          placeType: detail.placeType,
          placeKunchinittuData: placeKunchinittu,
          placeWarehouse: placeWarehouse,
          sampleEntry: sampleEntry,
          physicalInspection: inspection,
          isBandMalal: true,
          transitDetailId: detail.id,
          inventoryQualityParameters: detail.inventoryQualityParameters || []
        };
      } catch (entryError) {
        console.error(`Error processing BMB entry ${detail.id}:`, entryError);
        return {
          id: detail.id,
          slNo: index + 1,
          date: detail.createdAt,
          placeStatus: detail.placeStatus,
          wbNo: detail.wbNo || 'PENDING',
          wbStatus: detail.wbStatus || 'none',
          isBandMalal: true,
          transitDetailId: detail.id
        };
      }
    }));

    console.log(`📤 Band Malal Book: Returning ${arrivals.length} formatted entries`);

    res.json({ arrivals });
  } catch (error) {
    console.error('Error fetching Band Malal Book entries:', error);
    res.status(500).json({ error: 'Failed to fetch Band Malal Book entries' });
  }
});

// POST /bmb/:transitDetailId/inventory-quality - Submit inventory quality parameters
router.post('/bmb/:transitDetailId/inventory-quality', auth, async (req, res) => {
  try {
    const { transitDetailId } = req.params;

    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;
    const staffType = req.user.staffType;

    // Authorization: Mill Staff, Location Staff, Inventory Staff, Inventory Head, Admin, Manager, Owner, CEO
    const canAdd =
      (userRole === 'staff' && (staffType === 'mill' || staffType === 'location')) ||
      userRole === 'inventory_staff' ||
      userRole === 'inventory_head' ||
      effectiveRole === 'inventory_head' ||
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canAdd) {
      return res.status(403).json({ error: 'Not authorized to add inventory quality parameters' });
    }

    // Validate transit detail exists (with auto-healing fallback if ID matches PhysicalInspection or SampleEntry)
    let transitDetail = await LorryTransitDetail.findByPk(transitDetailId);
    if (!transitDetail) {
      const { PhysicalInspection, SampleEntry } = require('../models');
      const inspection = await PhysicalInspection.findByPk(transitDetailId);
      if (inspection) {
        transitDetail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: transitDetailId } });
        if (!transitDetail) {
          transitDetail = await LorryTransitDetail.create({
            physicalInspectionId: transitDetailId,
            sampleEntryId: inspection.sampleEntryId,
            wbStatus: 'none',
            placeStatus: 'none'
          });
        }
      } else {
        const sampleEntry = await SampleEntry.findByPk(transitDetailId);
        if (sampleEntry) {
          transitDetail = await LorryTransitDetail.findOne({ where: { sampleEntryId: transitDetailId } });
          if (!transitDetail) {
            const sampleInspection = await PhysicalInspection.findOne({
              where: { sampleEntryId: transitDetailId },
              order: [['createdAt', 'DESC']]
            });
            if (sampleInspection) {
              transitDetail = await LorryTransitDetail.create({
                physicalInspectionId: sampleInspection.id,
                sampleEntryId: transitDetailId,
                wbStatus: 'none',
                placeStatus: 'none'
              });
            } else {
              return res.status(404).json({ error: 'Transit detail not found (no inspection found for sample entry)' });
            }
          }
        }
      }
    }

    if (!transitDetail) {
      return res.status(404).json({ error: 'Transit detail not found' });
    }

    const {
      type, moisture, dryMoisture, cutting, bend, grains, mix,
      sMix, lMix, kandu, oil, sk, wbR, wbBk, wbT,
      smell, paddyWb, pColor, remarks, kadiga
    } = req.body;

    // Validate type
    if (!['lot_avg', 'full_lorry_avg'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be lot_avg or full_lorry_avg' });
    }

    // Check for existing approved or pending record of same type
    const { Op } = require('sequelize');
    const existingRecord = await InventoryQualityParameter.findOne({
      where: {
        lorryTransitDetailId: transitDetail.id,
        type: type,
        status: { [Op.in]: ['approved', 'pending'] }
      }
    });

    if (existingRecord) {
      return res.status(400).json({
        error: `A ${existingRecord.status} ${type.replace('_', ' ')} record already exists for this entry`
      });
    }

    // Auto-approve if admin is submitting
    const isAutoApprove = String(userRole || '').toLowerCase() === 'admin';

    // Create the quality parameter record
    const qualityParam = await InventoryQualityParameter.create({
      lorryTransitDetailId: transitDetail.id,
      type,
      status: isAutoApprove ? 'approved' : 'pending',
      moisture: moisture || null,
      dryMoisture: dryMoisture || null,
      cutting: cutting || null,
      bend: bend || null,
      grains: grains || null,
      mix: mix || null,
      sMix: sMix || null,
      lMix: lMix || null,
      kandu: kandu || null,
      oil: oil || null,
      sk: sk || null,
      wbR: wbR || null,
      wbBk: wbBk || null,
      wbT: wbT || null,
      smell: smell || null,
      paddyWb: paddyWb || null,
      pColor: pColor || null,
      kadiga: kadiga || null,
      remarks: remarks || null,
      reportedByUserId: req.body.reportedByUserId || req.user.userId,
      approvedByUserId: isAutoApprove ? req.user.userId : null
    });

    // Invalidate cache
    cacheService.delPattern('arrivals/band-malal-book').catch(() => {});

    res.status(201).json({
      message: 'Mill quality parameters submitted successfully',
      qualityParam
    });
  } catch (error) {
    console.error('Error creating inventory quality parameter:', error);
    res.status(500).json({ error: 'Failed to create inventory quality parameter' });
  }
});

// POST /bmb/inventory-quality/:qualityId/approve - Approve inventory quality
router.post('/bmb/inventory-quality/:qualityId/approve', auth, async (req, res) => {
  try {
    const { qualityId } = req.params;

    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;

    // Authorization: Admin, Owner, Manager, CEO
    const canApprove =
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canApprove) {
      return res.status(403).json({ error: 'Not authorized to approve inventory quality parameters' });
    }

    const qualityParam = await InventoryQualityParameter.findByPk(qualityId);

    if (!qualityParam) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    if (qualityParam.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve ${qualityParam.status} record` });
    }

    // Check if approver is the same as reporter
    if (qualityParam.reportedByUserId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot approve your own submission' });
    }

    // Check for existing approved record of same type
    const { Op } = require('sequelize');
    const existingApproved = await InventoryQualityParameter.findOne({
      where: {
        lorryTransitDetailId: qualityParam.lorryTransitDetailId,
        type: qualityParam.type,
        status: 'approved',
        id: { [Op.ne]: qualityId }
      }
    });

    if (existingApproved) {
      return res.status(400).json({
        error: `An approved ${qualityParam.type.replace('_', ' ')} record already exists for this entry`
      });
    }

    await qualityParam.update({
      status: 'approved',
      approvedByUserId: req.user.userId
    });

    // Invalidate cache
    cacheService.delPattern('arrivals/band-malal-book').catch(() => {});

    return res.json({ message: 'Mill quality parameters approved successfully', qualityParam });
  } catch (error) {
    console.error('Error approving inventory quality parameter:', error);
    res.status(500).json({ error: 'Failed to approve inventory quality parameter' });
  }
});

// POST /bmb/inventory-quality/:qualityId/reject - Reject inventory quality
router.post('/bmb/inventory-quality/:qualityId/reject', auth, async (req, res) => {
  try {
    const { qualityId } = req.params;
    const { rejectReason } = req.body;

    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;

    // Authorization: Admin, Owner, Manager, CEO
    const canReject =
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canReject) {
      return res.status(403).json({ error: 'Not authorized to reject inventory quality parameters' });
    }

    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ error: 'Reject reason is required' });
    }

    const qualityParam = await InventoryQualityParameter.findByPk(qualityId);

    if (!qualityParam) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    if (qualityParam.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject ${qualityParam.status} record` });
    }

    await qualityParam.update({
      status: 'rejected',
      approvedByUserId: req.user.userId,
      rejectReason: rejectReason.trim()
    });

    // Invalidate cache
    cacheService.delPattern('arrivals/band-malal-book').catch(() => {});

    return res.json({ message: 'Mill quality parameters rejected', qualityParam });
  } catch (error) {
    console.error('Error rejecting inventory quality parameter:', error);
    res.status(500).json({ error: 'Failed to reject inventory quality parameter' });
  }
});

// POST /bmb/inventory-quality/:qualityId/recheck - Send inventory quality back for recheck
router.post('/bmb/inventory-quality/:qualityId/recheck', auth, async (req, res) => {
  try {
    const { qualityId } = req.params;
    const { rejectReason } = req.body; // use rejectReason as comments/notes for recheck

    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;

    // Authorization: Admin, Owner, Manager, CEO
    const canRecheck =
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canRecheck) {
      return res.status(403).json({ error: 'Not authorized to send inventory quality parameters for recheck' });
    }

    const qualityParam = await InventoryQualityParameter.findByPk(qualityId);

    if (!qualityParam) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    // Allow rechecking by setting status to rejected (conforming to ENUM) and prefixing reason
    await qualityParam.update({
      status: 'rejected',
      approvedByUserId: req.user.userId,
      rejectReason: rejectReason ? 'RECHECK: ' + rejectReason.trim() : 'RECHECK: Recheck requested'
    });

    // Invalidate cache
    cacheService.delPattern('arrivals/band-malal-book').catch(() => {});

    return res.json({ message: 'Mill quality parameters sent for recheck successfully', qualityParam });
  } catch (error) {
    console.error('Error sending inventory quality parameter for recheck:', error);
    res.status(500).json({ error: 'Failed to send inventory quality parameter for recheck' });
  }
});

// GET /bmb/inventory-quality/pending - Get pending inventory quality entries
router.get('/bmb/inventory-quality/pending', auth, async (req, res) => {
  try {
    const entries = await InventoryQualityParameter.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: LorryTransitDetail,
          as: 'lorryTransitDetail',
          required: false,
          include: [
            {
              model: SampleEntry,
              as: 'sampleEntry',
              attributes: ['id', 'brokerName', 'partyName', 'location', 'variety', 'entryDate', 'lotSelectionDecision']
            },
            {
              model: PhysicalInspection,
              as: 'physicalInspection',
              attributes: ['id', 'lorryNumber', 'bags', 'moisture']
            }
          ]
        },
        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching pending inventory quality:', error);
    res.status(500).json({ error: 'Failed to fetch pending inventory quality' });
  }
});

module.exports = router;
