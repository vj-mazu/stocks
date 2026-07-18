/**
 * Approvals API Routes
 * 
 * Handles pending approval counts and listing for the Inventory Transit workflow.
 * Only accessible by admin, manager, and ceo roles.
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { requireApproverRole } = require('../middleware/roleAuth');
const { sequelize } = require('../config/database');
const PhysicalInspection = require('../models/PhysicalInspection');
const LorryTransitDetail = require('../models/LorryTransitDetail');
const SampleEntry = require('../models/SampleEntry');
const Warehouse = require('../models/Location').Warehouse;
const Kunchinittu = require('../models/Location').Kunchinittu;
const Outturn = require('../models/Outturn');
const WeightBridge = require('../models/WeightBridge');

/**
 * GET /api/approvals/count
 * Get count of pending Place and WB approvals
 * Returns: { pendingPlace, pendingWb, total }
 */
router.get('/count', auth, requireApproverRole, async (req, res) => {
  try {
    const result = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (WHERE "placeStatus" = 'pending') as pending_place,
        COUNT(*) FILTER (WHERE "wbStatus" = 'pending') as pending_wb,
        COUNT(DISTINCT id) as total_pending
      FROM lorry_transit_details
      WHERE "placeStatus" = 'pending' OR "wbStatus" = 'pending'
    `, { type: sequelize.QueryTypes.SELECT });
    
    const counts = {
      pendingPlace: parseInt(result[0]?.pending_place) || 0,
      pendingWb: parseInt(result[0]?.pending_wb) || 0,
      total: parseInt(result[0]?.total_pending) || 0
    };
    
    res.json(counts);
  } catch (error) {
    console.error('❌ Get approval count error:', error);
    res.status(500).json({ 
      error: 'Failed to get approval count',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/approvals/pending
 * List all pending approvals with full details
 * Returns: { approvals: [...] }
 */
router.get('/pending', auth, requireApproverRole, async (req, res) => {
  try {
    const pendingDetails = await LorryTransitDetail.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { placeStatus: 'pending' },
          { wbStatus: 'pending' }
        ]
      },
      include: [
        {
          model: PhysicalInspection,
          as: 'physicalInspection',
          include: [
            { 
              model: SampleEntry, 
              as: 'sampleEntry',
              attributes: ['id', 'variety', 'brokerName', 'location', 'bags', 'entryDate', 'lorryNumber']
            }
          ]
        },
        {
          model: Warehouse,
          as: 'placeWarehouse',
          attributes: ['id', 'name', 'code']
        },
        {
          model: Kunchinittu,
          as: 'placeKunchinittuData',
          attributes: ['id', 'name', 'code']
        },
        {
          model: Outturn,
          as: 'outturn',
          attributes: ['id', 'code', 'allottedVariety']
        },
        {
          model: WeightBridge,
          as: 'millWeightBridge',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Format response with clear pending status indicators
    const formattedApprovals = pendingDetails.map(detail => ({
      id: detail.id,
      physicalInspectionId: detail.physicalInspectionId,
      sampleEntryId: detail.sampleEntryId,
      
      // Place information
      placeStatus: detail.placeStatus,
      placeDate: detail.placeDate,
      placeType: detail.placeType,
      placeKunchinittu: detail.placeKunchinittuData,
      placeWarehouse: detail.placeWarehouse,
      placeOutturn: detail.outturn,
      placeRejectReason: detail.placeRejectReason,
      
      // Weight Bridge information
      wbStatus: detail.wbStatus,
      wbInputType: detail.wbInputType,
      wbNo: detail.wbNo,
      millWeightBridge: detail.millWeightBridge,
      partyWbName: detail.partyWbName,
      grossWeight: detail.grossWeight,
      tareWeight: detail.tareWeight,
      netWeight: detail.netWeight,
      wbRejectReason: detail.wbRejectReason,
      
      // Physical inspection data
      physicalInspection: detail.physicalInspection,
      
      // Timestamps
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }));
    
    res.json({ 
      approvals: formattedApprovals,
      count: formattedApprovals.length
    });
  } catch (error) {
    console.error('❌ Get pending approvals error:', error);
    res.status(500).json({ 
      error: 'Failed to get pending approvals',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
