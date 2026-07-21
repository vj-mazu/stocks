const express = require('express');

const { Op, Sequelize } = require('sequelize');

const { sequelize } = require('../config/database');

const { auth, authorize } = require('../middleware/auth');

const Arrival = require('../models/Arrival');

const { Warehouse, Kunchinittu, Variety } = require('../models/Location');

const User = require('../models/User');

const Outturn = require('../models/Outturn');

const WeightBridge = require('../models/WeightBridge');

const LorryTransitDetail = require('../models/LorryTransitDetail');

const PhysicalInspection = require('../models/PhysicalInspection');

const SampleEntry = require('../models/SampleEntry');

const { InventoryQualityParameter } = require('../models');

const queryOptimizationService = require('../services/queryOptimizationService');

const cacheService = require('../services/cacheService');

const YieldCalculationService = require('../services/YieldCalculationService');

// Initialize all associations globally

require('../models');



const router = express.Router();



// Generate next SL No

const generateSlNo = async () => {

  try {

    const lastArrival = await Arrival.findOne({

      order: [['createdAt', 'DESC']],

      attributes: ['slNo']

    });



    if (!lastArrival || !lastArrival.slNo) {

      return 'A01';

    }



    const lastNumber = parseInt(lastArrival.slNo.substring(1));

    const nextNumber = lastNumber + 1;

    return `A${nextNumber.toString().padStart(2, '0')}`;

  } catch (error) {

    console.error('Error generating SL No:', error);

    // Return default if there's an error

    return 'A01';

  }

};



// Get next SL No

router.get('/next-sl-no', auth, async (req, res) => {

  try {

    const slNo = await generateSlNo();

    res.json({ slNo });

  } catch (error) {

    console.error('Get next SL No error:', error);

    // Always return a default SL No even if there's an error

    res.json({ slNo: 'A01' });

  }

});



// Get stock locations for a variety - OPTIMIZED

router.get('/stock/variety-locations/:variety', auth, async (req, res) => {

  const startTime = Date.now();



  try {

    const { variety } = req.params;

    const { dateFrom, dateTo } = req.query;



    if (!variety) {

      return res.status(400).json({ error: 'Variety is required' });

    }



    // Use optimized query service

    const stockLocations = await queryOptimizationService.getStockByVariety(variety, {

      dateFrom,

      dateTo

    });



    const responseTime = Date.now() - startTime;



    // Cache for 1 minute (stock changes frequently)

    res.set('Cache-Control', 'public, max-age=60');

    res.json({

      locations: stockLocations,

      performance: {

        responseTime: `${responseTime}ms`

      }

    });

  } catch (error) {

    console.error('Error fetching variety stock locations:', error);

    res.status(500).json({ error: 'Failed to fetch stock locations' });

  }

});



// Create arrival

router.post('/', auth, async (req, res) => {

  try {

    const {

      date,

      movementType,

      purchaseType, // Add purchaseType to distinguish normal vs for-production

      broker,

      variety,

      bags,

      fromLocation,

      toKunchinintuId,

      toWarehouseId,

      fromKunchinintuId,

      fromWarehouseId,

      toWarehouseShiftId,

      outturnId,

      fromOutturnId,

      moisture,

      cutting,

      wbNo,

      grossWeight,

      tareWeight,

      lorryNumber,

      remarks

    } = req.body;



    // Validate required fields

    if (!date || !movementType || !wbNo || !grossWeight || !tareWeight || !lorryNumber) {

      return res.status(400).json({

        error: 'Required fields: date, movementType, wbNo, grossWeight, tareWeight, lorryNumber'

      });

    }



    // Calculate net weight

    const netWeight = parseFloat(grossWeight) - parseFloat(tareWeight);



    if (netWeight <= 0) {

      return res.status(400).json({ error: 'Net weight must be positive' });

    }



    // Normalize variety (trim and uppercase for consistent comparison)

    const normalizedVariety = variety ? variety.trim().toUpperCase() : null;



    // Validate movement type specific fields

    if (movementType === 'purchase') {

      // For normal purchase, require kunchinittu and warehouse

      // For production purchase, only require outturn (validated later)

      if (purchaseType !== 'for-production') {

        if (!normalizedVariety || !toKunchinintuId || !toWarehouseId) {

          return res.status(400).json({

            error: 'Purchase requires variety, toKunchinintuId and toWarehouseId'

          });

        }

      }



      // Check if purchase from outturn

      if (fromOutturnId) {

        // Validate outturn exists

        const outturn = await Outturn.findByPk(fromOutturnId, {

          attributes: ['id', 'code', 'allottedVariety']

        });



        if (!outturn) {

          return res.status(400).json({

            error: '❌ Invalid outturn selected for purchase from production'

          });

        }



        // Validate variety matches outturn

        const outturnVarietyNormalized = outturn.allottedVariety.trim().toUpperCase();

        if (outturnVarietyNormalized !== normalizedVariety) {

          return res.status(400).json({

            error: `❌ VARIETY MISMATCH\n\n` +

              `Problem: Outturn "${outturn.code}" is allotted to "${outturn.allottedVariety}" variety.\n` +

              `You are trying to purchase "${variety}" variety.\n\n` +

              `Solution: Change variety to "${outturn.allottedVariety}".`

          });

        }



        console.log(`✅ Purchase from outturn validation passed: ${normalizedVariety} from outturn ${outturn.code}`);

      }



      // Skip chain validation for for-production purchases (they go directly to outturn)

      if (purchaseType !== 'for-production') {

        // ═══════════════════════════════════════════════════════════════════════

        // PERFECT CHAIN VALIDATION: Variety → Kunchinittu → Warehouse

        // ═══════════════════════════════════════════════════════════════════════



        // STEP 1 & 2: Get Kunchinittu and Warehouse in parallel (PERFORMANCE OPTIMIZATION)

        const [kunchinittu, selectedWarehouse] = await Promise.all([

          Kunchinittu.findByPk(toKunchinintuId, {

            attributes: ['id', 'name', 'code', 'varietyId', 'warehouseId'],

            include: [

              {

                model: Variety,

                as: 'variety',

                attributes: ['id', 'name'],

                required: false

              },

              {

                model: Warehouse,

                as: 'warehouse',

                attributes: ['id', 'name', 'code'],

                required: false

              }

            ]

          }),

          Warehouse.findByPk(toWarehouseId, {

            attributes: ['id', 'name', 'code']

          })

        ]);



        if (!kunchinittu) {

          return res.status(400).json({

            error: '❌ Invalid Kunchinittu selected'

          });

        }



        if (!selectedWarehouse) {

          return res.status(400).json({

            error: '❌ Invalid Warehouse selected'

          });

        }



        if (kunchinittu.warehouseId !== toWarehouseId) {

          return res.status(400).json({

            error: `❌ WAREHOUSE MISMATCH\n\n` +

              `Problem: Kunchinittu "${kunchinittu.code}" belongs to warehouse "${kunchinittu.warehouse?.code}", not "${selectedWarehouse.code}".\n\n` +

              `Solution: Please select warehouse "${kunchinittu.warehouse?.code}" for Kunchinittu "${kunchinittu.code}".`

          });

        }



        // STEP 3: Validate Variety matches Kunchinittu's allotted variety

        if (kunchinittu.varietyId && kunchinittu.variety) {

          const allottedVarietyNormalized = kunchinittu.variety.name.trim().toUpperCase();



          if (allottedVarietyNormalized !== normalizedVariety) {

            return res.status(400).json({

              error: `❌ VARIETY MISMATCH\n\n` +

                `Problem: Kunchinittu "${kunchinittu.code}" is allotted to "${kunchinittu.variety.name}" variety ONLY.\n` +

                `You are trying to store "${variety}" variety.\n\n` +

                `Solution: Either:\n` +

                `1. Change variety to "${kunchinittu.variety.name}", OR\n` +

                `2. Select a different Kunchinittu that is allotted to "${variety}" variety.`

            });

          }



          console.log(`✅ Variety validation passed: ${normalizedVariety} matches Kunchinittu ${kunchinittu.code} allotted variety`);

        } else {

          // Kunchinittu has no allotted variety - check existing stock

          console.log(`⚠️ Kunchinittu ${kunchinittu.code} has no allotted variety - checking existing stock`);

        }



        // STEP 4: Check if Kunchinittu already has a DIFFERENT variety in stock

        const existingStock = await Arrival.findOne({

          where: {

            toKunchinintuId,

            status: 'approved',

            adminApprovedBy: { [Op.not]: null }, // Only admin-approved stock

            variety: { [Op.ne]: null }

          },

          attributes: ['variety'],

          order: [['createdAt', 'DESC']]

        });



        if (existingStock) {

          const existingVarietyNormalized = existingStock.variety.trim().toUpperCase();



          if (existingVarietyNormalized !== normalizedVariety) {

            return res.status(400).json({

              error: `❌ VARIETY CONFLICT\n\n` +

                `Problem: Kunchinittu "${kunchinittu.code}" already contains "${existingStock.variety}" variety in stock.\n` +

                `You are trying to store "${variety}" variety.\n` +

                `Cannot mix different varieties in the same Kunchinittu.\n\n` +

                `Solution: Either:\n` +

                `1. Change variety to "${existingStock.variety}" (existing variety), OR\n` +

                `2. Select a different Kunchinittu for "${variety}" variety.`

            });

          }



          console.log(`✅ Stock validation passed: ${normalizedVariety} matches existing stock in ${kunchinittu.code}`);

        } else {

          console.log(`✅ Empty location: ${normalizedVariety} can be stored in ${kunchinittu.code} (first stock)`);

        }



        // STEP 5: Final validation summary

        console.log(`✅ CHAIN VALIDATION PASSED: ${normalizedVariety} → ${kunchinittu.code} → ${selectedWarehouse.code}`);

      }



    } else if (movementType === 'shifting') {

      if (!fromKunchinintuId || !fromWarehouseId || !toKunchinintuId || !toWarehouseShiftId || !normalizedVariety) {

        return res.status(400).json({

          error: 'Shifting requires fromKunchinintuId, fromWarehouseId, toKunchinintuId, toWarehouseShiftId, and variety'

        });

      }



      // ═══════════════════════════════════════════════════════════════════════

      // PERFECT CHAIN VALIDATION FOR SHIFTING

      // ═══════════════════════════════════════════════════════════════════════



      // STEP 1: Validate SOURCE - Check if variety exists in source warehouse

      const sourceStock = await Arrival.findOne({

        where: {

          toKunchinintuId: fromKunchinintuId,

          [Op.or]: [

            { toWarehouseId: fromWarehouseId },      // Stock from Purchase

            { toWarehouseShiftId: fromWarehouseId }  // Stock from previous Shifting

          ],

          status: 'approved',

          adminApprovedBy: { [Op.not]: null },

          [Op.and]: [

            sequelize.where(

              sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

              normalizedVariety

            )

          ]

        }

      });



      if (!sourceStock) {

        const [fromKunchinittu, fromWarehouse] = await Promise.all([

          Kunchinittu.findByPk(fromKunchinintuId, {

            attributes: ['name', 'code']

          }),

          Warehouse.findByPk(fromWarehouseId, {

            attributes: ['name', 'code']

          })

        ]);



        return res.status(400).json({

          error: `❌ SOURCE STOCK NOT FOUND\n\n` +

            `Problem: Warehouse "${fromWarehouse?.code}" in Kunchinittu "${fromKunchinittu?.code}" does not contain "${normalizedVariety}" variety.\n` +

            `Cannot shift what doesn't exist in source.\n\n` +

            `Solution: Either:\n` +

            `1. Select a different source warehouse that has "${normalizedVariety}" variety, OR\n` +

            `2. Change the variety to match what's available in "${fromWarehouse?.code}".`

        });

      }



      console.log(`✅ Source validation passed: ${normalizedVariety} exists in source`);



      // STEP 1.5: Check if source has sufficient stock quantity (PARALLEL QUERIES)

      const [sourceStockTotal, sourceStockOut] = await Promise.all([

        Arrival.sum('bags', {

          where: {

            [Op.or]: [

              { toKunchinintuId: fromKunchinintuId, toWarehouseId: fromWarehouseId },

              { toKunchinintuId: fromKunchinintuId, toWarehouseShiftId: fromWarehouseId }

            ],

            status: 'approved',

            adminApprovedBy: { [Op.not]: null },

            [Op.and]: [

              sequelize.where(

                sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

                normalizedVariety

              )

            ]

          }

        }),

        Arrival.sum('bags', {

          where: {

            fromKunchinintuId,

            fromWarehouseId,

            status: 'approved',

            adminApprovedBy: { [Op.not]: null },

            movementType: { [Op.in]: ['shifting', 'production-shifting'] },

            [Op.and]: [

              sequelize.where(

                sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

                normalizedVariety

              )

            ]

          }

        })

      ]);



      const availableStock = (sourceStockTotal || 0) - (sourceStockOut || 0);



      if (availableStock < bags) {

        const [fromKunchinittu, fromWarehouse] = await Promise.all([

          Kunchinittu.findByPk(fromKunchinintuId, {

            attributes: ['name', 'code']

          }),

          Warehouse.findByPk(fromWarehouseId, {

            attributes: ['name', 'code']

          })

        ]);



        return res.status(400).json({

          error: `❌ INSUFFICIENT STOCK\n\n` +

            `Problem: Warehouse "${fromWarehouse?.code}" in Kunchinittu "${fromKunchinittu?.code}" has only ${availableStock} bags of "${normalizedVariety}" variety available.\n` +

            `You are trying to shift ${bags} bags.\n\n` +

            `Solution: Either:\n` +

            `1. Reduce the quantity to ${availableStock} bags or less, OR\n` +

            `2. Select a different source warehouse with more stock.`

        });

      }



      console.log(`✅ Stock quantity validation passed: ${bags} bags available (${availableStock} total)`);



      // STEP 2: Validate DESTINATION Kunchinittu's allotted variety

      const toKunchinittu = await Kunchinittu.findByPk(toKunchinintuId, {

        attributes: ['id', 'name', 'code', 'varietyId', 'warehouseId'],

        include: [

          {

            model: Variety,

            as: 'variety',

            attributes: ['id', 'name'],

            required: false

          }

        ]

      });



      if (!toKunchinittu) {

        return res.status(400).json({

          error: '❌ Invalid destination Kunchinittu selected'

        });

      }



      // Check if destination Kunchinittu has allotted variety

      if (toKunchinittu.varietyId && toKunchinittu.variety) {

        const destAllottedVarietyNormalized = toKunchinittu.variety.name.trim().toUpperCase();



        if (destAllottedVarietyNormalized !== normalizedVariety) {

          return res.status(400).json({

            error: `❌ DESTINATION VARIETY MISMATCH\n\n` +

              `Problem: Kunchinittu "${toKunchinittu.code}" is allotted to "${toKunchinittu.variety.name}" variety ONLY.\n` +

              `You are trying to shift "${normalizedVariety}" variety.\n\n` +

              `Solution: Select a destination Kunchinittu that is allotted to "${normalizedVariety}" variety.`

          });

        }



        console.log(`✅ Destination Kunchinittu validation passed: ${normalizedVariety} matches allotted variety`);

      }



      // STEP 3: Check if destination warehouse already has DIFFERENT variety

      const destinationStock = await Arrival.findOne({

        where: {

          toKunchinintuId,

          [Op.or]: [

            { toWarehouseId: toWarehouseShiftId },      // Stock from Purchase

            { toWarehouseShiftId: toWarehouseShiftId }  // Stock from previous Shifting

          ],

          status: 'approved',

          adminApprovedBy: { [Op.not]: null },

          variety: { [Op.ne]: null }

        },

        attributes: ['variety'],

        order: [['createdAt', 'DESC']]

      });



      if (destinationStock) {

        const destVarietyNormalized = destinationStock.variety.trim().toUpperCase();



        if (destVarietyNormalized !== normalizedVariety) {

          const toWarehouse = await Warehouse.findByPk(toWarehouseShiftId, {

            attributes: ['name', 'code']

          });



          return res.status(400).json({

            error: `❌ DESTINATION VARIETY CONFLICT\n\n` +

              `Problem: Warehouse "${toWarehouse?.code}" in Kunchinittu "${toKunchinittu.code}" already contains "${destinationStock.variety}" variety.\n` +

              `You are trying to shift "${normalizedVariety}" variety.\n` +

              `Cannot mix different varieties in the same warehouse.\n\n` +

              `Solution: Either:\n` +

              `1. Select a warehouse that already has "${normalizedVariety}" variety, OR\n` +

              `2. Select an empty warehouse in a Kunchinittu allotted to "${normalizedVariety}".`

          });

        }



        console.log(`✅ Destination stock validation passed: ${normalizedVariety} matches existing stock`);

      } else {

        console.log(`✅ Destination is empty: ${normalizedVariety} can be shifted to new location`);

      }



      console.log(`✅ SHIFTING CHAIN VALIDATION PASSED: ${normalizedVariety} from source to destination`);

    } else if (movementType === 'production-shifting') {

      if (!fromKunchinintuId || !fromWarehouseId || !outturnId || !normalizedVariety) {

        return res.status(400).json({

          error: 'Production shifting requires fromKunchinintuId, fromWarehouseId, outturnId, and variety'

        });

      }



      // ═══════════════════════════════════════════════════════════════════════

      // PERFECT CHAIN VALIDATION FOR PRODUCTION SHIFTING

      // ═══════════════════════════════════════════════════════════════════════



      // STEP 1: Validate Outturn exists and variety matches

      const outturn = await Outturn.findByPk(outturnId, {

        attributes: ['id', 'code', 'allottedVariety']

      });



      if (!outturn) {

        return res.status(400).json({

          error: '❌ Invalid outturn selected'

        });

      }



      const outturnVarietyNormalized = outturn.allottedVariety ? outturn.allottedVariety.trim().toUpperCase() : null;



      if (!outturnVarietyNormalized) {

        return res.status(400).json({

          error: `❌ Outturn "${outturn.code}" has no allotted variety. Cannot process production shifting.`

        });

      }



      if (outturnVarietyNormalized !== normalizedVariety) {

        return res.status(400).json({

          error: `❌ OUTTURN VARIETY MISMATCH\n\n` +

            `Problem: Outturn "${outturn.code}" is allotted to "${outturn.allottedVariety}" variety ONLY.\n` +

            `You are trying to process "${normalizedVariety}" variety.\n\n` +

            `Solution: Either:\n` +

            `1. Change variety to "${outturn.allottedVariety}" to match this outturn, OR\n` +

            `2. Select a different outturn that is allotted to "${normalizedVariety}" variety.`

        });

      }



      console.log(`✅ Outturn validation passed: ${normalizedVariety} matches outturn ${outturn.code}`);



      // STEP 2: Validate SOURCE Kunchinittu and Warehouse have the variety

      const fromKunchinittu = await Kunchinittu.findByPk(fromKunchinintuId, {

        attributes: ['id', 'name', 'code', 'varietyId', 'warehouseId'],

        include: [

          {

            model: Variety,

            as: 'variety',

            attributes: ['id', 'name'],

            required: false

          }

        ]

      });



      if (!fromKunchinittu) {

        return res.status(400).json({

          error: '❌ Invalid source Kunchinittu selected'

        });

      }



      // Check if source Kunchinittu's allotted variety matches

      if (fromKunchinittu.varietyId && fromKunchinittu.variety) {

        const sourceAllottedVarietyNormalized = fromKunchinittu.variety.name.trim().toUpperCase();



        if (sourceAllottedVarietyNormalized !== normalizedVariety) {

          return res.status(400).json({

            error: `❌ SOURCE VARIETY MISMATCH\n\n` +

              `Problem: Kunchinittu "${fromKunchinittu.code}" is allotted to "${fromKunchinittu.variety.name}" variety, not "${normalizedVariety}".\n` +

              `Cannot shift from this location.\n\n` +

              `Solution: Select a source Kunchinittu that is allotted to "${normalizedVariety}" variety.`

          });

        }

      }



      // STEP 3: Check source warehouse has the variety in stock

      const sourceStock = await Arrival.findOne({

        where: {

          toKunchinintuId: fromKunchinintuId,

          [Op.or]: [

            { toWarehouseId: fromWarehouseId },      // Stock from Purchase

            { toWarehouseShiftId: fromWarehouseId }  // Stock from previous Shifting

          ],

          status: 'approved',

          adminApprovedBy: { [Op.not]: null },

          [Op.and]: [

            sequelize.where(

              sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

              normalizedVariety

            )

          ]

        }

      });



      if (!sourceStock) {

        const fromWarehouse = await Warehouse.findByPk(fromWarehouseId, {

          attributes: ['name', 'code']

        });



        return res.status(400).json({

          error: `❌ SOURCE STOCK NOT FOUND\n\n` +

            `Problem: Warehouse "${fromWarehouse?.code}" in Kunchinittu "${fromKunchinittu.code}" does not contain "${normalizedVariety}" variety.\n` +

            `Cannot shift for production what doesn't exist in source.\n\n` +

            `Solution: Select a source warehouse that has "${normalizedVariety}" variety in stock.`

        });

      }



      console.log(`✅ Source stock validation passed: ${normalizedVariety} exists in source warehouse`);



      // STEP 3.5: Check if source has sufficient stock quantity for production

      const prodSourceStockTotal = await Arrival.sum('bags', {

        where: {

          [Op.or]: [

            { toKunchinintuId: fromKunchinintuId, toWarehouseId: fromWarehouseId },

            { toKunchinintuId: fromKunchinintuId, toWarehouseShiftId: fromWarehouseId }

          ],

          status: 'approved',

          adminApprovedBy: { [Op.not]: null },

          [Op.and]: [

            sequelize.where(

              sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

              normalizedVariety

            )

          ]

        }

      });



      const prodSourceStockOut = await Arrival.sum('bags', {

        where: {

          fromKunchinintuId,

          fromWarehouseId,

          status: 'approved',

          adminApprovedBy: { [Op.not]: null },

          movementType: { [Op.in]: ['shifting', 'production-shifting'] },

          [Op.and]: [

            sequelize.where(

              sequelize.fn('UPPER', sequelize.fn('TRIM', sequelize.col('variety'))),

              normalizedVariety

            )

          ]

        }

      });



      const prodAvailableStock = (prodSourceStockTotal || 0) - (prodSourceStockOut || 0);



      if (prodAvailableStock < bags) {

        const fromWarehouse = await Warehouse.findByPk(fromWarehouseId, {

          attributes: ['name', 'code']

        });



        return res.status(400).json({

          error: `❌ INSUFFICIENT STOCK FOR PRODUCTION\n\n` +

            `Problem: Warehouse "${fromWarehouse?.code}" in Kunchinittu "${fromKunchinittu.code}" has only ${prodAvailableStock} bags of "${normalizedVariety}" variety available.\n` +

            `You are trying to shift ${bags} bags for production.\n\n` +

            `Solution: Either:\n` +

            `1. Reduce the quantity to ${prodAvailableStock} bags or less, OR\n` +

            `2. Select a different source warehouse with more stock.`

        });

      }



      console.log(`✅ Stock quantity validation passed: ${bags} bags available for production (${prodAvailableStock} total)`);

      console.log(`✅ PRODUCTION SHIFTING CHAIN VALIDATION PASSED: ${normalizedVariety} → Outturn ${outturn.code}`);

    }



    // Handle "For Production" purchase type (saved as purchase but goes directly to outturn)

    if (movementType === 'purchase' && purchaseType === 'for-production') {

      if (!outturnId || !normalizedVariety) {

        return res.status(400).json({

          error: 'For Production requires outturnId and variety'

        });

      }



      // ═══════════════════════════════════════════════════════════════════════

      // VALIDATION FOR FOR-PRODUCTION (Direct to Outturn)

      // ═══════════════════════════════════════════════════════════════════════



      // STEP 1: Validate Outturn exists and variety matches

      const outturn = await Outturn.findByPk(outturnId, {

        attributes: ['id', 'code', 'allottedVariety']

      });



      if (!outturn) {

        return res.status(400).json({

          error: '❌ Invalid outturn selected'

        });

      }



      const outturnVarietyNormalized = outturn.allottedVariety ? outturn.allottedVariety.trim().toUpperCase() : null;



      if (!outturnVarietyNormalized) {

        return res.status(400).json({

          error: `❌ Outturn "${outturn.code}" has no allotted variety. Cannot process for production.`

        });

      }



      if (outturnVarietyNormalized !== normalizedVariety) {

        return res.status(400).json({

          error: `❌ OUTTURN VARIETY MISMATCH\n\n` +

            `Problem: Outturn "${outturn.code}" is allotted to "${outturn.allottedVariety}" variety ONLY.\n` +

            `You are trying to process "${normalizedVariety}" variety.\n\n` +

            `Solution: Either:\n` +

            `1. Change variety to "${outturn.allottedVariety}" to match this outturn, OR\n` +

            `2. Select a different outturn that is allotted to "${normalizedVariety}" variety.`

        });

      }



      console.log(`✅ Outturn validation passed: ${normalizedVariety} matches outturn ${outturn.code}`);

      console.log(`✅ FOR PRODUCTION VALIDATION PASSED: ${normalizedVariety} → Outturn ${outturn.code} (Direct)`);

    }



    // Generate SL No

    const slNo = await generateSlNo();



    // Set status based on user role

    // Staff → pending (needs manager + admin approval)

    // Manager → approved but needs admin approval for stock

    // Admin → approved + admin approved (goes directly to stock)

    const status = req.user.role === 'staff' ? 'pending' : 'approved';

    const approvedBy = req.user.role !== 'staff' ? req.user.userId : null;

    const approvedAt = req.user.role !== 'staff' ? new Date() : null;

    const adminApprovedBy = req.user.role === 'admin' ? req.user.userId : null;

    const adminApprovedAt = req.user.role === 'admin' ? new Date() : null;



    // FIXED: Enhanced debug logging for production environment

    console.log('👤 Creating arrival with user role:', {

      userId: req.user.userId,

      role: req.user.role,

      movementType,

      calculatedStatus: status,

      isAdminApproved: req.user.role === 'admin',

      adminApprovedBy,

      adminApprovedAt

    });



    // Debug logging for shifting

    if (movementType === 'shifting') {

      console.log('🔍 Creating shifting entry:');

      console.log('  fromKunchinintuId:', fromKunchinintuId);

      console.log('  toKunchinintuId:', toKunchinintuId);

      console.log('  toWarehouseShiftId:', toWarehouseShiftId);

    }



    // For production-shifting, capture the source kunchinittu's average rate as a snapshot

    // TEMPORARILY DISABLED until migration is run

    // let snapshotRate = null;

    // if (movementType === 'production-shifting' && fromKunchinintuId) {

    //   try {

    //     // Calculate source kunchinittu's average rate

    //     const { calculateKunchinintuAverageRate } = require('./purchase-rates');

    //     await calculateKunchinintuAverageRate(fromKunchinintuId);

    //     

    //     // Get the calculated rate

    //     const sourceKunchinittu = await Kunchinittu.findByPk(fromKunchinintuId);

    //     if (sourceKunchinittu && sourceKunchinittu.averageRate && sourceKunchinittu.averageRate > 0) {

    //       snapshotRate = sourceKunchinittu.averageRate;

    //       console.log(`📸 Snapshot rate captured: ₹${snapshotRate}/Q from kunchinittu ${fromKunchinintuId}`);

    //     }

    //   } catch (error) {

    //     console.error('Error capturing snapshot rate:', error);

    //     // Continue without snapshot rate

    //   }

    // }



    const arrival = await Arrival.create({

      slNo,

      date,

      movementType,

      broker: movementType === 'purchase' ? (broker || (fromOutturnId ? 'FROM PRODUCTION' : null)) : null,

      variety: normalizedVariety || null,

      bags,

      fromLocation: movementType === 'purchase' ? fromLocation : null,

      toKunchinintuId: (movementType === 'purchase' && purchaseType !== 'for-production') || movementType === 'shifting' ? toKunchinintuId : null, // For normal purchase AND shifting

      toWarehouseId: (movementType === 'purchase' && purchaseType !== 'for-production') ? toWarehouseId : null, // Only for normal purchase

      fromKunchinintuId: (movementType === 'shifting' || movementType === 'production-shifting') ? fromKunchinintuId : null,

      fromWarehouseId: (movementType === 'shifting' || movementType === 'production-shifting') ? fromWarehouseId : null,

      toWarehouseShiftId: movementType === 'shifting' ? toWarehouseShiftId : null,

      fromOutturnId: fromOutturnId || null, // For purchase from outturn

      outturnId: (movementType === 'production-shifting' || (movementType === 'purchase' && purchaseType === 'for-production')) ? outturnId : null,

      moisture,

      cutting,

      wbNo,

      grossWeight,

      tareWeight,

      netWeight,

      lorryNumber,

      // snapshotRate, // TEMPORARILY DISABLED until migration is run

      status,

      createdBy: req.user.userId,

      approvedBy,

      approvedAt,

      adminApprovedBy,

      adminApprovedAt,

      remarks

    });



    // Fetch the created arrival with associations

    const createdArrival = await Arrival.findByPk(arrival.id, {

      include: [

        { model: User, as: 'creator', attributes: ['username', 'role'] },

        { model: User, as: 'approver', attributes: ['username', 'role'] },

        { model: User, as: 'adminApprover', attributes: ['username', 'role'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] }

      ]

    });



    // Transfer average rate if admin creates a shifting (auto-approved)

    console.log('🔍 Checking if rate transfer needed:', {

      userRole: req.user.role,

      movementType,

      fromKunchinintuId,

      toKunchinintuId,

      willTransfer: req.user.role === 'admin' && movementType === 'shifting' && fromKunchinintuId && toKunchinintuId

    });



    if (req.user.role === 'admin' && movementType === 'shifting' && fromKunchinintuId && toKunchinintuId) {

      try {

        console.log('🔍 Admin created shifting - checking rate transfer:', {

          arrivalId: arrival.id,

          fromKunchinintuId,

          toKunchinintuId

        });



        // IMPORTANT: Calculate source kunchinittu's average rate FIRST before transferring

        const { calculateKunchinintuAverageRate } = require('./purchase-rates');

        await calculateKunchinintuAverageRate(fromKunchinintuId);

        console.log(`✅ Calculated source kunchinittu ${fromKunchinintuId} average rate before transfer`);



        // Retrieve source and destination kunchinittus (AFTER rate calculation)

        const sourceKunchinittu = await Kunchinittu.findByPk(fromKunchinintuId);

        const destKunchinittu = await Kunchinittu.findByPk(toKunchinintuId);



        console.log('🔍 Source kunchinittu:', {

          id: sourceKunchinittu?.id,

          code: sourceKunchinittu?.code,

          averageRate: sourceKunchinittu?.averageRate

        });

        console.log('🔍 Destination kunchinittu:', {

          id: destKunchinittu?.id,

          code: destKunchinittu?.code,

          averageRate: destKunchinittu?.averageRate

        });



        if (sourceKunchinittu && destKunchinittu && sourceKunchinittu.averageRate && sourceKunchinittu.averageRate > 0) {

          // SIMPLE DIRECT TRANSFER: Copy the source rate to destination

          const sourceRate = sourceKunchinittu.averageRate;

          const previousDestRate = destKunchinittu.averageRate || 0;



          // Update destination kunchinittu with source rate

          await destKunchinittu.update({

            averageRate: sourceRate,

            lastRateCalculation: new Date()

          });



          console.log(`✅ Rate transfer completed: ${sourceRate} → ${sourceRate} for kunchinittu ${toKunchinintuId}`);



          // Log the rate transfer for audit

          try {

            const { logRateTransfer } = require('../services/AuditService');

            await logRateTransfer({

              arrivalId: arrival.id,

              sourceKunchinintuId: sourceKunchinittu.id,

              destKunchinintuId: destKunchinittu.id,

              sourceRate: sourceRate,

              shiftedQuantity: netWeight / 100,

              previousDestRate: previousDestRate,

              newDestRate: sourceRate,

              timestamp: new Date(),

              performedBy: req.user.userId

            });

          } catch (auditError) {

            console.error('⚠️ Audit logging failed (non-critical):', auditError.message);

          }

        } else {

          console.log('⚠️ Rate transfer skipped:', {

            hasSource: !!sourceKunchinittu,

            hasDest: !!destKunchinittu,

            sourceHasRate: sourceKunchinittu?.averageRate > 0,

            sourceRate: sourceKunchinittu?.averageRate

          });

        }

      } catch (error) {

        console.error('❌ Error transferring kunchinittu rate on create:', error);

        // Don't fail the main operation

      }

    }



    // Transfer average rate if admin creates a production-shifting (auto-approved)

    if (req.user.role === 'admin' && movementType === 'production-shifting' && fromKunchinintuId && outturnId) {

      try {

        console.log('🔍 Admin created production-shifting - checking rate transfer:', {

          arrivalId: arrival.id,

          fromKunchinintuId,

          outturnId

        });



        // Calculate source kunchinittu's average rate FIRST

        const { calculateKunchinintuAverageRate } = require('./purchase-rates');

        await calculateKunchinintuAverageRate(fromKunchinintuId);

        console.log(`✅ Calculated source kunchinittu ${fromKunchinintuId} average rate before transfer to outturn`);



        // Retrieve source kunchinittu and outturn (AFTER rate calculation)

        const sourceKunchinittu = await Kunchinittu.findByPk(fromKunchinintuId);

        const outturn = await Outturn.findByPk(outturnId);



        console.log('🔍 Source kunchinittu:', {

          id: sourceKunchinittu?.id,

          code: sourceKunchinittu?.code,

          averageRate: sourceKunchinittu?.averageRate

        });

        console.log('🔍 Destination outturn:', {

          id: outturn?.id,

          code: outturn?.code,

          averageRate: outturn?.averageRate

        });



        if (sourceKunchinittu && outturn && sourceKunchinittu.averageRate && sourceKunchinittu.averageRate > 0) {

          // SIMPLE DIRECT TRANSFER: Copy the source kunchinittu rate to outturn

          const sourceRate = sourceKunchinittu.averageRate;

          const previousOutturnRate = outturn.averageRate || 0;



          // Update outturn with source kunchinittu's rate

          await outturn.update({

            averageRate: sourceRate,

            lastRateCalculation: new Date()

          });



          console.log(`✅ Rate transfer to outturn completed: ${sourceRate} → ${sourceRate} for outturn ${outturnId}`);



          // Log the rate transfer for audit

          try {

            const { logRateTransfer } = require('../services/AuditService');

            await logRateTransfer({

              arrivalId: arrival.id,

              sourceKunchinintuId: sourceKunchinittu.id,

              destKunchinintuId: outturnId, // Using outturnId as destination

              sourceRate: sourceRate,

              shiftedQuantity: netWeight / 100,

              previousDestRate: previousOutturnRate,

              newDestRate: sourceRate,

              timestamp: new Date(),

              performedBy: req.user.userId

            });

          } catch (auditError) {

            console.error('⚠️ Audit logging failed (non-critical):', auditError.message);

          }

        } else {

          console.log('⚠️ Rate transfer to outturn skipped:', {

            hasSource: !!sourceKunchinittu,

            hasOutturn: !!outturn,

            sourceHasRate: sourceKunchinittu?.averageRate > 0,

            sourceRate: sourceKunchinittu?.averageRate

          });

        }

      } catch (error) {

        console.error('❌ Error transferring kunchinittu rate to outturn on create:', error);

        // Don't fail the main operation

      }

    }



    // Invalidate dashboard cache after creating arrival

    await cacheService.delPattern('dashboard:*');

    await cacheService.delPattern('stock:*');



    // If this is a production-shifting or purchase arrival with an outturn, recalculate yield

    if (outturnId && (movementType === 'production-shifting' || movementType === 'purchase')) {

      try {

        await YieldCalculationService.calculateAndUpdateYield(outturnId);

        console.log(`✅ Yield percentage recalculated for outturn ID: ${outturnId}`);

      } catch (error) {

        console.error('Error recalculating yield:', error);

        // Don't fail the request if yield calculation fails

      }

    }



    res.status(201).json({

      message: 'Arrival created successfully',

      arrival: createdArrival

    });

  } catch (error) {

    console.error('Create arrival error:', error);

    res.status(500).json({ error: 'Failed to create arrival' });

  }

});



// GET OPENING BALANCE - Calculate stock totals before a given date

// This is critical for date-filtered views where we need to know the opening stock

router.get('/opening-balance', auth, async (req, res) => {

  const startTime = Date.now();



  try {

    const { beforeDate } = req.query;



    if (!beforeDate) {

      return res.status(400).json({ error: 'beforeDate is required (format: YYYY-MM-DD)' });

    }



    console.log(`📊 Calculating opening balance before ${beforeDate}...`);



    // WAREHOUSE STOCK: Calculate net stock by variety and location

    // Inflow: Purchase (+), Shifting IN (+)

    // Outflow: Shifting OUT (-), Production-Shifting OUT (-)

    // WAREHOUSE STOCK: Calculate net stock by variety and location

    // Consolidated approach: Union all movements (IN as +, OUT as -) then GROUP BY

    const warehouseStockQuery = `

      SELECT 

        UPPER(TRIM(activity.variety)) as variety,

        activity.location,

        SUM(activity.bags_change) as bags

      FROM (

        -- Purchases IN (+)

        -- Unified activity for warehouse stock

        SELECT

          TRIM(a.variety) as variety,

          COALESCE(tk.code, '') || ' - ' || COALESCE(tw.name, '') as location,

          a.bags as bags_change

        FROM arrivals a

        LEFT JOIN kunchinittus tk ON a."toKunchinintuId" = tk.id

        LEFT JOIN warehouses tw ON a."toWarehouseId" = tw.id

        WHERE a.date < $1

          AND a.status = 'approved'

          AND a."movementType" = 'purchase'

          AND a."outturnId" IS NULL -- Normal purchase to warehouse



        UNION ALL



        -- Loose Entries IN (+)

        SELECT

          TRIM(a.variety) as variety,

          COALESCE(tk.code, '') || ' - ' || COALESCE(tw.name, '') as location,

          a.bags as bags_change

        FROM arrivals a

        LEFT JOIN kunchinittus tk ON a."toKunchinintuId" = tk.id

        LEFT JOIN warehouses tw ON a."toWarehouseId" = tw.id

        WHERE a.date < $1

          AND a.status = 'approved'

          AND a."movementType" = 'loose'



        UNION ALL



        SELECT

          TRIM(a.variety) as variety,

          COALESCE(tk.code, '') || ' - ' || COALESCE(tw.name, '') as location,

          a.bags as bags_change

        FROM arrivals a

        LEFT JOIN kunchinittus tk ON a."toKunchinintuId" = tk.id

        LEFT JOIN warehouses tw ON a."toWarehouseShiftId" = tw.id

        WHERE a.date < $1

          AND a.status = 'approved'

          AND a."movementType" = 'shifting' -- Shifting IN to warehouse



        UNION ALL



        SELECT

          TRIM(a.variety) as variety,

          COALESCE(fk.code, '') || ' - ' || COALESCE(fw.name, '') as location,

          -a.bags as bags_change

        FROM arrivals a

        LEFT JOIN kunchinittus fk ON a."fromKunchinintuId" = fk.id

        LEFT JOIN warehouses fw ON a."fromWarehouseId" = fw.id

        WHERE a.date < $1

          AND a.status = 'approved'

          AND a."movementType" IN ('shifting', 'production-shifting') -- Shifting OUT or Production-Shifting OUT from warehouse

      ) activity

      GROUP BY UPPER(TRIM(activity.variety)), activity.location

      HAVING SUM(activity.bags_change) != 0

    `;



    // PRODUCTION STOCK: Calculate bags in outturns

    // Consolidated approach: Union all movements (IN as +, OUT as -) then GROUP BY

    const productionStockQuery = `

      SELECT

        UPPER(TRIM(activity.variety)) as variety,

        activity.outturn,

        SUM(activity.bags_change) as bags

      FROM (

        -- For-Production Purchase + Production-Shifting IN (+)

        SELECT

          TRIM(a.variety) as variety,

          COALESCE(o.code, 'OUT' || a."outturnId") as outturn,

          a.bags as bags_change

        FROM arrivals a

        LEFT JOIN outturns o ON a."outturnId" = o.id

        WHERE a.date < $1

          AND a.status = 'approved'

          AND (

            (a."movementType" = 'purchase' AND a."outturnId" IS NOT NULL)

            OR a."movementType" = 'production-shifting'

          )

          AND (o.id IS NULL OR o.is_cleared = false OR o.cleared_at IS NULL OR a.date <= DATE(o.cleared_at))



        UNION ALL



        -- Rice Production paddyBagsDeducted OUT (-)

        SELECT

          TRIM(o."allottedVariety") as variety,

          o.code as outturn,

          -SUM(COALESCE(rp."paddyBagsDeducted", ROUND(rp."quantityQuintals" * 3))) as bags_change

        FROM rice_productions rp

        JOIN outturns o ON rp."outturnId" = o.id

        WHERE rp.status = 'approved'

          AND rp.date < $1

          AND rp."productType" NOT IN ('Bran', 'Farm Bran', 'Faram', 'Farm')

          AND (o.is_cleared = false OR o.cleared_at IS NULL OR rp.date <= DATE(o.cleared_at))

        GROUP BY TRIM(o."allottedVariety"), o.code

      ) activity

      GROUP BY UPPER(TRIM(activity.variety)), activity.outturn

      HAVING SUM(activity.bags_change) != 0

    `;



    // Execute both queries

    const [warehouseStock, productionStock] = await Promise.all([

      sequelize.query(warehouseStockQuery, {

        bind: [beforeDate],

        type: Sequelize.QueryTypes.SELECT

      }),

      sequelize.query(productionStockQuery, {

        bind: [beforeDate],

        type: Sequelize.QueryTypes.SELECT

      })

    ]);



    // Convert to objects keyed by variety-location or variety-outturn

    const warehouseBalance = {};

    warehouseStock.forEach(row => {

      const key = `${row.variety}|${row.location}`;

      warehouseBalance[key] = {

        variety: row.variety,

        location: row.location,

        bags: parseInt(row.bags) || 0

      };

    });



    const productionBalance = {};

    productionStock.forEach(row => {

      const key = `${row.variety}|${row.outturn}`;

      productionBalance[key] = {

        variety: row.variety,

        outturn: row.outturn,

        bags: parseInt(row.bags) || 0

      };

    });



    const responseTime = Date.now() - startTime;

    console.log(`✅ Opening balance calculated in ${responseTime}ms: ${Object.keys(warehouseBalance).length} warehouse entries, ${Object.keys(productionBalance).length} production entries`);



    res.json({

      beforeDate,

      warehouseBalance,

      productionBalance,

      performance: {

        responseTime: `${responseTime}ms`

      }

    });

  } catch (error) {

    console.error('Error calculating opening balance:', error);

    console.error('Error details:', {

      message: error.message,

      stack: error.stack,

      beforeDate: req.query.beforeDate

    });

    res.status(500).json({

      error: 'Failed to calculate opening balance',

      message: error.message,

      beforeDate: req.query.beforeDate

    });

  }

});



// Get all arrivals with pagination and filters - OPTIMIZED WITH CACHING



router.get('/', auth, async (req, res) => {

  const startTime = Date.now();



  try {

    const {

      page = 1,

      limit = 50,

      movementType,

      status,

      placeStatus,

      dateFrom,

      dateTo,

      search

    } = req.query;



    const filters = {

      movementType,

      status,

      placeStatus,

      dateFrom,

      dateTo,

      search

    };



    // Staff can only see their own entries

    if (req.user.role === 'staff') {

      filters.createdBy = req.user.userId;

    }



    // Create cache key from filters

    const cacheKey = `arrivals:${req.user.role === 'staff' ? req.user.userId : 'all'}:${page}:${limit}:${movementType || ''}:${status || ''}:${dateFrom || ''}:${dateTo || ''}:${search || ''}`;



    // Try to get from cache first (60 second TTL)

    const cached = await cacheService.get(cacheKey);

    if (cached) {

      const responseTime = Date.now() - startTime;

      return res.json({

        ...cached,

        performance: {

          responseTime: `${responseTime}ms`,

          cached: true

        }

      });

    }



    // Use optimized query service

    const result = await queryOptimizationService.getArrivalsWithPagination(

      filters,

      parseInt(page),

      parseInt(limit)

    );



    // Cache the result for 60 seconds

    await cacheService.set(cacheKey, result, 60);



    const responseTime = Date.now() - startTime;



    res.json({

      ...result,

      performance: {

        responseTime: `${responseTime}ms`,

        cached: false

      }

    });

  } catch (error) {

    console.error('Get arrivals error:', error);



    // Handle timeout errors

    if (error.name === 'SequelizeTimeoutError') {

      return res.status(504).json({

        error: 'Query timeout - please refine your filters',

        suggestion: 'Try narrowing the date range or adding more specific filters'

      });

    }



    res.status(500).json({ error: 'Failed to fetch arrivals' });

  }

});



/**

 * Helper function to search cutting in a single inspection

 * Internal function used by getCuttingFromInspection

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

 * 

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



// NEW ENDPOINT: Get In-Transit entries (pending Place decisions)

// In-Transit shows entries from LorryTransitDetail where placeStatus='pending' or 'none'

router.get('/in-transit', auth, async (req, res) => {

  try {

    const { limit = 200, search } = req.query;

    

    console.log('🔍 In-Transit: Fetching entries with placeStatus=pending or none');

    

    const where = {

      [Op.or]: [

        { placeStatus: 'pending' },

        { placeStatus: 'none' },

        { placeStatus: null }

      ]

    };

    

    // Fetch transit details with PhysicalInspection and SampleEntry associations (SAME AS BAND MALAL BOOK)

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

    

    // Map entries with sequential numbers (same format as Band Malal Book)

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

          ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name'] })

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

          moisture: inspection?.samplingStages?.full_avg?.moisture || inspection?.moisture || null, // ✅ FIX: Read from Full Lorry Avg first (In-Transit)

          cutting: await getCuttingFromInspection(inspection),

          wbNo: detail.wbNo || 'PENDING',

          grossWeight: detail.grossWeight || 0,

          tareWeight: detail.tareWeight || 0,

          netWeight: detail.netWeight || 0,

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

    

    res.json({ arrivals, total: arrivals.length });

  } catch (error) {

    console.error('❌ In-Transit error:', error);

    console.error('Error details:', error.message);

    res.status(500).json({ 

      error: 'Failed to fetch In-Transit entries',

      details: error.message 

    });

  }

});



// NEW ENDPOINT: Get Band Malal Book entries (approved Place decisions)

// Band Malal Book shows entries from LorryTransitDetail where placeStatus='approved'

// These have NOT yet been finalized into Arrival records (stock)

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
          // 1. Try to find a PhysicalInspection that has the same sampleEntryId if it exists
          if (detail.sampleEntryId) {
            inspection = await PhysicalInspection.findOne({ where: { sampleEntryId: detail.sampleEntryId } });
          }
          // 2. Try to find by matching wbNo on SampleEntry if we have a wbNo
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

        

        // Calculate SL No starting from 1 for the oldest record at the top

        const slNo = index + 1;

        

        // DEBUG: Log what we're getting

        console.log(`Entry SL No ${slNo}: Physical Inspection ID=${detail.physicalInspectionId}, Sample Entry ID=${detail.sampleEntryId}`);

        console.log(`  - Inspection found: ${!!inspection}, Sample Entry found: ${!!detail.sampleEntry}`);

        console.log(`  - Party Name: ${sampleEntry.partyName || 'MISSING'}, Lorry: ${inspection?.lorryNumber || sampleEntry.lorryNumber || 'MISSING'}`);

        console.log(`  - Broker: ${sampleEntry.brokerName || 'MISSING'}, Variety: ${sampleEntry.variety || 'MISSING'}`);

        console.log(`  - Bags: ${inspection?.bags || 'MISSING'}, Moisture: ${inspection?.moisture || 'MISSING'}`);

        

        // Fetch place kunchinittu and warehouse

        const placeKunchinittu = detail.placeKunchinittuId 

          ? await Kunchinittu.findByPk(detail.placeKunchinittuId, { attributes: ['id', 'name', 'code'] })

          : null;

        

        const placeWarehouse = detail.placeWarehouseId 

          ? await Warehouse.findByPk(detail.placeWarehouseId, { attributes: ['id', 'name', 'code'] })

          : null;

        

        const outturn = detail.outturnId 

          ? await Outturn.findByPk(detail.outturnId, { attributes: ['id', 'code', 'allottedVariety'] })

          : null;

        

        // Fetch approvers

        const placeApprover = detail.placeApprovedBy

          ? await User.findByPk(detail.placeApprovedBy, { attributes: ['id', 'username', 'role'] })

          : null;

        

        const wbApprover = detail.wbApprovedBy

          ? await User.findByPk(detail.wbApprovedBy, { attributes: ['id', 'username', 'role'] })

          : null;

        

        // Fetch Mill Weight Bridge if exists

        const millWb = detail.millWbId

          ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name'] })

          : null;

        

        // Fetch Inventory Quality Parameters

        const inventoryQualityParams = await InventoryQualityParameter.findAll({

          where: { lorryTransitDetailId: detail.id },

          include: [

            { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName'] },

            { model: User, as: 'approver', attributes: ['id', 'username', 'fullName'] }

          ],

          order: [['createdAt', 'DESC']]

        });

        

        return {

          id: detail.id,

          slNo: slNo, // ✅ FIX: Use calculated SL No from total count (persistent across refreshes)

          date: detail.placeDate || detail.createdAt,

          movementType: 'purchase',

          broker: sampleEntry.brokerName || null,

          variety: sampleEntry.variety || null,

          bags: inspection?.bags || 0,

          packaging: parseFloat(sampleEntry.packaging) || 75, // Parse to number, default to 75

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

          moisture: inspection?.samplingStages?.full_avg?.moisture || inspection?.moisture || null, // ✅ FIX: Read from Full Lorry Avg first (Band Malal Book)

          cutting: await getCuttingFromInspection(inspection),

          wbNo: detail.wbNo || 'PENDING',

          grossWeight: detail.grossWeight || 0,

          tareWeight: detail.tareWeight || 0,

          netWeight: detail.netWeight || 0,

          lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A',

          placeStatus: detail.placeStatus,


          placeDate: detail.placeDate,

        createdAt: detail.createdAt,

          placeType: detail.placeType,

          wbStatus: detail.wbStatus || 'none',

          wbInputType: detail.wbInputType,

          millWbId: detail.millWbId,

          millWb: millWb, // Add Mill WB object

          partyWbName: detail.partyWbName,

          // Add these for frontend access

          placeKunchinittuData: placeKunchinittu,

          placeWarehouse: placeWarehouse,

          sampleEntry: sampleEntry, // Full sample entry for frontend

          placeApprover: placeApprover,

          wbApprover: wbApprover,

          inventoryQualityParameters: inventoryQualityParams, // Add inventory quality params

          // Mark as Band Malal Book entry

          isBandMalalBook: true,

          transitDetailId: detail.id

        };

      } catch (entryError) {

        console.error(`Error processing entry ${detail.id}:`, entryError);

        // ✅ FIX: Calculate SL No even in error case

        const slNo = totalApprovedCount - index;

        // Return minimal entry if error

        return {

          id: detail.id,

          slNo: slNo, // ✅ FIX: Use calculated SL No from total count

          date: detail.placeDate || detail.createdAt,

          placeStatus: detail.placeStatus,

          wbNo: detail.wbNo || 'PENDING',

          grossWeight: detail.grossWeight || 0,

          tareWeight: detail.tareWeight || 0,

          netWeight: detail.netWeight || 0,

          isBandMalalBook: true,

          transitDetailId: detail.id

        };

      }

    }));

    

    console.log(`📤 Band Malal Book: Returning ${arrivals.length} formatted entries`);

    if (arrivals.length > 0) {

      console.log('📊 Sample entry data:', JSON.stringify({

        slNo: arrivals[0].slNo,

        broker: arrivals[0].broker,

        variety: arrivals[0].variety,

        fromLocation: arrivals[0].fromLocation,

        cutting: arrivals[0].cutting,

        packaging: arrivals[0].packaging,

        bags: arrivals[0].bags

      }, null, 2));

    }

    

    res.json({ arrivals, total: arrivals.length });

  } catch (error) {

    console.error('❌ Band Malal Book error:', error);

    console.error('Error details:', error.message);

    res.status(500).json({ 

      error: 'Failed to fetch Band Malal Book entries',

      details: error.message 

    });

  }

});



// Approve/Reject arrival (Manager/Admin only)

router.patch('/:id/approve', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    const { status, remarks } = req.body;



    if (!['approved', 'rejected'].includes(status)) {

      return res.status(400).json({ error: 'Status must be approved or rejected' });

    }



    const arrival = await Arrival.findByPk(req.params.id);

    if (!arrival) {

      return res.status(404).json({ error: 'Arrival not found' });

    }



    if (arrival.status !== 'pending') {

      return res.status(400).json({ error: 'Arrival already processed' });

    }



    await arrival.update({

      status,

      approvedBy: req.user.userId,

      approvedAt: new Date(),

      remarks

    });



    const updatedArrival = await Arrival.findByPk(arrival.id, {

      include: [

        { model: User, as: 'creator', attributes: ['username', 'role'] },

        { model: User, as: 'approver', attributes: ['username', 'role'] },

        { model: User, as: 'adminApprover', attributes: ['username', 'role'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] }

      ]

    });



    res.json({

      message: `Arrival ${status} successfully`,

      arrival: updatedArrival

    });

  } catch (error) {

    console.error('Approve arrival error:', error);

    res.status(500).json({ error: 'Failed to process arrival' });

  }

});



// Admin final approval (Admin only) - for paddy stock

router.patch('/:id/admin-approve', auth, authorize('admin'), async (req, res) => {

  try {

    const arrival = await Arrival.findByPk(req.params.id);

    if (!arrival) {

      return res.status(404).json({ error: 'Arrival not found' });

    }



    if (arrival.status !== 'approved') {

      return res.status(400).json({ error: 'Arrival must be approved by manager first' });

    }



    if (arrival.adminApprovedBy) {

      return res.status(400).json({ error: 'Arrival already approved by admin' });

    }



    await arrival.update({

      adminApprovedBy: req.user.userId,

      adminApprovedAt: new Date()

    });



    const updatedArrival = await Arrival.findByPk(arrival.id, {

      include: [

        { model: User, as: 'creator', attributes: ['username', 'role'] },

        { model: User, as: 'approver', attributes: ['username', 'role'] },

        { model: User, as: 'adminApprover', attributes: ['username', 'role'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] }

      ]

    });



    // Automatically calculate kunchinittu average rate if this is a purchase going to a kunchinittu

    try {

      if (arrival.movementType === 'purchase' && arrival.toKunchinintuId) {

        // Import the function from purchase-rates route

        const { calculateKunchinintuAverageRate } = require('./purchase-rates');

        await calculateKunchinintuAverageRate(arrival.toKunchinintuId);

        console.log(`✅ Auto-calculated average rate for kunchinittu ${arrival.toKunchinintuId} after admin approval`);

      }

    } catch (error) {

      console.error('Error updating kunchinittu average rate after admin approval:', error);

      // Don't fail the main operation

    }



    // Transfer average rate for kunchinittu-to-kunchinittu shifting

    try {

      if (arrival.movementType === 'shifting' && arrival.fromKunchinintuId && arrival.toKunchinintuId) {

        console.log('🔍 Checking rate transfer for shifting:', {

          arrivalId: arrival.id,

          fromKunchinintuId: arrival.fromKunchinintuId,

          toKunchinintuId: arrival.toKunchinintuId

        });



        // IMPORTANT: Calculate source kunchinittu's average rate FIRST before transferring

        const { calculateKunchinintuAverageRate } = require('./purchase-rates');

        await calculateKunchinintuAverageRate(arrival.fromKunchinintuId);

        console.log(`✅ Calculated source kunchinittu ${arrival.fromKunchinintuId} average rate before transfer`);



        // Retrieve source and destination kunchinittus (AFTER rate calculation)

        const sourceKunchinittu = await Kunchinittu.findByPk(arrival.fromKunchinintuId);

        const destKunchinittu = await Kunchinittu.findByPk(arrival.toKunchinintuId);



        console.log('🔍 Source kunchinittu:', {

          id: sourceKunchinittu?.id,

          code: sourceKunchinittu?.code,

          averageRate: sourceKunchinittu?.averageRate

        });

        console.log('🔍 Destination kunchinittu:', {

          id: destKunchinittu?.id,

          code: destKunchinittu?.code,

          averageRate: destKunchinittu?.averageRate

        });



        if (sourceKunchinittu && destKunchinittu && sourceKunchinittu.averageRate && sourceKunchinittu.averageRate > 0) {

          // SIMPLE DIRECT TRANSFER: Copy the source rate to destination

          const sourceRate = sourceKunchinittu.averageRate;

          const previousDestRate = destKunchinittu.averageRate || 0;



          // Update destination kunchinittu with source rate

          await destKunchinittu.update({

            averageRate: sourceRate,

            lastRateCalculation: new Date()

          });



          console.log(`✅ Rate transfer completed: ${sourceRate} → ${sourceRate} for kunchinittu ${arrival.toKunchinintuId}`);

          console.log('🔍 Updated destination kunchinittu:', {

            id: destKunchinittu.id,

            code: destKunchinittu.code,

            newAverageRate: sourceRate

          });



          // Log the rate transfer for audit

          try {

            const { logRateTransfer } = require('../services/AuditService');

            await logRateTransfer({

              arrivalId: arrival.id,

              sourceKunchinintuId: sourceKunchinittu.id,

              destKunchinintuId: destKunchinittu.id,

              sourceRate: sourceRate,

              shiftedQuantity: arrival.netWeight / 100,

              previousDestRate: previousDestRate,

              newDestRate: sourceRate,

              timestamp: new Date(),

              performedBy: req.user.userId

            });

          } catch (auditError) {

            console.error('⚠️ Audit logging failed (non-critical):', auditError.message);

          }

        } else {

          console.log('⚠️ Rate transfer skipped:', {

            hasSource: !!sourceKunchinittu,

            hasDest: !!destKunchinittu,

            sourceHasRate: sourceKunchinittu?.averageRate > 0,

            sourceRate: sourceKunchinittu?.averageRate

          });

        }

      }

    } catch (error) {

      console.error('❌ Error transferring kunchinittu rate:', error);

      console.error('Error stack:', error.stack);

      // Don't fail the main operation

    }



    // Transfer average rate for production-shifting (kunchinittu to outturn)

    try {

      if (arrival.movementType === 'production-shifting' && arrival.fromKunchinintuId && arrival.outturnId) {

        console.log('🔍 Checking rate transfer for production-shifting:', {

          arrivalId: arrival.id,

          fromKunchinintuId: arrival.fromKunchinintuId,

          outturnId: arrival.outturnId

        });



        // Calculate source kunchinittu's average rate FIRST

        const { calculateKunchinintuAverageRate } = require('./purchase-rates');

        await calculateKunchinintuAverageRate(arrival.fromKunchinintuId);

        console.log(`✅ Calculated source kunchinittu ${arrival.fromKunchinintuId} average rate before transfer to outturn`);



        // Retrieve source kunchinittu and outturn (AFTER rate calculation)

        const sourceKunchinittu = await Kunchinittu.findByPk(arrival.fromKunchinintuId);

        const outturn = await Outturn.findByPk(arrival.outturnId);



        console.log('🔍 Source kunchinittu:', {

          id: sourceKunchinittu?.id,

          code: sourceKunchinittu?.code,

          averageRate: sourceKunchinittu?.averageRate

        });

        console.log('🔍 Destination outturn:', {

          id: outturn?.id,

          code: outturn?.code,

          averageRate: outturn?.averageRate

        });



        if (sourceKunchinittu && outturn && sourceKunchinittu.averageRate && sourceKunchinittu.averageRate > 0) {

          // SIMPLE DIRECT TRANSFER: Copy the source kunchinittu rate to outturn

          const sourceRate = sourceKunchinittu.averageRate;

          const previousOutturnRate = outturn.averageRate || 0;



          // Update outturn with source kunchinittu's rate

          await outturn.update({

            averageRate: sourceRate,

            lastRateCalculation: new Date()

          });



          console.log(`✅ Rate transfer to outturn completed: ${sourceRate} → ${sourceRate} for outturn ${arrival.outturnId}`);



          // Log the rate transfer for audit

          try {

            const { logRateTransfer } = require('../services/AuditService');

            await logRateTransfer({

              arrivalId: arrival.id,

              sourceKunchinintuId: sourceKunchinittu.id,

              destKunchinintuId: arrival.outturnId, // Using outturnId as destination

              sourceRate: sourceRate,

              shiftedQuantity: arrival.netWeight / 100,

              previousDestRate: previousOutturnRate,

              newDestRate: sourceRate,

              timestamp: new Date(),

              performedBy: req.user.userId

            });

          } catch (auditError) {

            console.error('⚠️ Audit logging failed (non-critical):', auditError.message);

          }

        } else {

          console.log('⚠️ Rate transfer to outturn skipped:', {

            hasSource: !!sourceKunchinittu,

            hasOutturn: !!outturn,

            sourceHasRate: sourceKunchinittu?.averageRate > 0,

            sourceRate: sourceKunchinittu?.averageRate

          });

        }

      }

    } catch (error) {

      console.error('❌ Error transferring rate to outturn:', error);

      console.error('Error stack:', error.stack);

      // Don't fail the main operation

    }



    res.json({

      message: 'Arrival approved by admin successfully',

      arrival: updatedArrival

    });

  } catch (error) {

    console.error('Admin approve arrival error:', error);

    res.status(500).json({ error: 'Failed to process admin approval' });

  }

});



// Update arrival (Manager and Admin only)

router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    const { id } = req.params;

    const {

      date,

      movementType,

      broker,

      fromLocation,

      toKunchinintuId,

      toWarehouseId,

      fromKunchinintuId,

      fromWarehouseId,

      toWarehouseShiftId,

      variety,

      bags,

      moisture,

      cutting,

      wbNo,

      grossWeight,

      tareWeight,

      netWeight,

      lorryNumber,

      byProducts

    } = req.body;



    // Find the arrival

    const arrival = await Arrival.findByPk(id);



    if (!arrival) {

      return res.status(404).json({ error: 'Arrival not found' });

    }



    // Only allow editing of approved records

    if (arrival.status !== 'approved' && arrival.status !== 'admin-approved') {

      return res.status(403).json({ error: 'Can only edit approved records' });

    }



    // Manager can edit their approved records, Admin can edit any approved record

    if (req.user.role === 'manager' && arrival.status !== 'approved') {

      return res.status(403).json({ error: 'Managers can only edit manager-approved records' });

    }



    // Update arrival data

    await arrival.update({

      date,

      movementType,

      broker,

      fromLocation,

      toKunchinintuId,

      toWarehouseId,

      fromKunchinintuId,

      fromWarehouseId,

      toWarehouseShiftId,

      variety,

      bags,

      moisture,

      cutting,

      wbNo,

      grossWeight,

      tareWeight,

      netWeight,

      lorryNumber

    });



    // Update by-products if provided

    if (byProducts && Array.isArray(byProducts)) {

      arrival.byProducts = byProducts;

      await arrival.save();

    }



    // Fetch updated arrival with associations

    const updatedArrival = await Arrival.findByPk(id, {

      include: [

        { model: User, as: 'creator', attributes: ['username'] },

        { model: User, as: 'approver', attributes: ['username'] },

        { model: User, as: 'adminApprover', attributes: ['username'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] }

      ]

    });



    // Invalidate dashboard stats cache on edit

    await cacheService.delPattern('dashboard:*');

    await cacheService.delPattern('stock:*');



    res.json({

      message: 'Arrival updated successfully',

      arrival: updatedArrival

    });

  } catch (error) {

    console.error('Update arrival error:', error);

    console.error('Error details:', error.message);

    console.error('Error stack:', error.stack);

    res.status(500).json({

      error: 'Failed to update arrival',

      details: process.env.NODE_ENV === 'development' ? error.message : undefined

    });

  }

});



// Delete arrival (Manager and Admin only)

router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    const { id } = req.params;



    // Find the arrival

    const arrival = await Arrival.findByPk(id);



    if (!arrival) {

      return res.status(404).json({ error: 'Arrival not found' });

    }



    // Only allow deleting of approved records

    if (arrival.status !== 'approved' && arrival.status !== 'admin-approved') {

      return res.status(403).json({ error: 'Can only delete approved records' });

    }



    // Manager can delete their approved records, Admin can delete any approved record

    if (req.user.role === 'manager' && arrival.status !== 'approved') {

      return res.status(403).json({ error: 'Managers can only delete manager-approved records' });

    }



    // Check if this arrival is linked to any outturn records

    if (arrival.outturnId) {

      return res.status(400).json({

        error: 'Cannot delete arrival that is linked to an outturn record. Please delete the outturn record first.'

      });

    }



    // Store outturnId before deletion for yield recalculation

    const outturnIdForYield = arrival.outturnId;

    const movementTypeForYield = arrival.movementType;



    // Soft delete by updating status

    await arrival.update({

      status: 'deleted',

      deletedBy: req.user.id,

      deletedAt: new Date()

    });



    // If this was a production-shifting or purchase arrival with an outturn, recalculate yield

    if (outturnIdForYield && (movementTypeForYield === 'production-shifting' || movementTypeForYield === 'purchase')) {

      try {

        await YieldCalculationService.calculateAndUpdateYield(outturnIdForYield);

        console.log(`✅ Yield percentage recalculated after deletion for outturn ID: ${outturnIdForYield}`);

      } catch (error) {

        console.error('Error recalculating yield after deletion:', error);

      }

    }



    // Invalidate dashboard stats cache on deletion

    await cacheService.delPattern('dashboard:*');

    await cacheService.delPattern('stock:*');



    res.json({

      message: 'Arrival deleted successfully',

      arrivalId: id

    });

  } catch (error) {

    console.error('Delete arrival error:', error);

    res.status(500).json({ error: 'Failed to delete arrival' });

  }

});



// Get pending approvals list (for managers and admins) - OPTIMIZED with CACHING

router.get('/pending-list', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    // Create cache key based on user role

    const cacheKey = `pending-list:${req.user.role}`;



    // Try to get from cache first (15 second TTL)

    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {

      return res.json({

        ...cachedData,

        fromCache: true

      });

    }



    const where = {};



    // Managers see pending records (awaiting manager approval)

    // Admins see approved records waiting for admin approval

    if (req.user.role === 'manager') {

      where.status = 'pending';

    } else if (req.user.role === 'admin') {

      where.status = 'approved';

      where.adminApprovedBy = null;

    }



    const arrivals = await Arrival.findAll({

      where,

      attributes: [

        'id', 'slNo', 'date', 'movementType', 'variety', 'bags', 'netWeight',

        'wbNo', 'lorryNumber', 'broker', 'fromLocation', 'grossWeight', 'tareWeight',

        'moisture', 'cutting', 'status', 'createdAt'

      ],

      include: [

        { model: User, as: 'creator', attributes: ['username', 'role'] },

        { model: User, as: 'approver', attributes: ['username', 'role'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] },

        { model: Outturn, as: 'outturn', attributes: ['code', 'allottedVariety'] },

        {

          model: require('../models/SampleEntry'),

          as: 'sampleEntry',

          attributes: ['id'],

          required: false,

          include: [

            {

              model: require('../models/LotAllotment'),

              as: 'lotAllotment',

              attributes: ['closedAt'],

              required: false

            }

          ]

        }

      ],

      order: [['date', 'ASC'], ['createdAt', 'ASC']],

      limit: 500 // Safety limit for 10 lakh record performance

    });



    const filteredArrivals = arrivals.filter(arrival => {

      if (arrival.sampleEntry?.lotAllotment?.closedAt) {

        return false;

      }

      return true;

    });



    const responseData = {

      count: filteredArrivals.length,

      approvals: filteredArrivals,

      role: req.user.role

    };



    // Cache for 45 seconds (ultra-fast subsequent requests, still fresh enough for approvals)

    await cacheService.set(cacheKey, responseData, 45);



    res.json(responseData);

  } catch (error) {

    console.error('Get pending list error:', error);

    res.status(500).json({ error: 'Failed to fetch pending approvals' });

  }

});



// Bulk approve arrivals - OPTIMIZED with batch processing

router.post('/bulk-approve', auth, authorize('manager', 'admin'), async (req, res) => {

  const startTime = Date.now();



  try {

    const { arrivalIds } = req.body;



    if (!arrivalIds || !Array.isArray(arrivalIds) || arrivalIds.length === 0) {

      return res.status(400).json({ error: 'arrivalIds array is required' });

    }



    // Use optimized bulk approval service

    const results = await queryOptimizationService.bulkApproveArrivals(

      arrivalIds,

      req.user.userId,

      req.user.role

    );



    const responseTime = Date.now() - startTime;



    // Invalidate dashboard stats cache on bulk approve

    await cacheService.delPattern('dashboard:*');

    await cacheService.delPattern('stock:*');



    res.json({

      message: `Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`,

      results,

      performance: {

        responseTime: `${responseTime}ms`,

        recordsProcessed: arrivalIds.length

      }

    });

  } catch (error) {

    console.error('Bulk approve error:', error);

    res.status(500).json({ error: 'Failed to bulk approve arrivals', details: error.message });

  }

});



// Bulk reject arrivals

router.post('/bulk-reject', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    const { arrivalIds, remarks } = req.body;



    if (!arrivalIds || !Array.isArray(arrivalIds) || arrivalIds.length === 0) {

      return res.status(400).json({ error: 'arrivalIds array is required' });

    }



    const results = {

      rejected: [],

      failed: []

    };



    for (const id of arrivalIds) {

      try {

        const arrival = await Arrival.findByPk(id);



        if (!arrival) {

          results.failed.push({ id, reason: 'Not found' });

          continue;

        }



        if (arrival.status !== 'pending' && !(arrival.status === 'approved' && !arrival.adminApprovedBy)) {

          results.failed.push({ id, reason: 'Cannot reject this record' });

          continue;

        }



        await arrival.update({

          status: 'rejected',

          remarks: remarks || arrival.remarks

        });



        results.rejected.push(id);

      } catch (error) {

        console.error(`Error rejecting arrival ${id}:`, error);

        results.failed.push({ id, reason: error.message });

      }

    }



    // Invalidate dashboard stats cache on bulk reject

    await cacheService.delPattern('dashboard:*');

    await cacheService.delPattern('stock:*');



    res.json({

      message: `Bulk rejection completed: ${results.rejected.length} rejected, ${results.failed.length} failed`,

      results

    });

  } catch (error) {

    console.error('Bulk reject error:', error);

    res.status(500).json({ error: 'Failed to bulk reject arrivals' });

  }

});



// Get pending Transit approvals (Place or WB) from LorryTransitDetail

router.get('/transit-approvals/pending', auth, async (req, res) => {

  try {

    const { Op } = require('sequelize');

    const entries = await LorryTransitDetail.findAll({

      where: {

        [Op.or]: [

          { placeStatus: 'pending' },

          { wbStatus: 'pending' }

        ]

      },

      include: [

        {

          model: PhysicalInspection,

          as: 'physicalInspection',

          required: false

        },

        {

          model: SampleEntry,

          as: 'sampleEntry',

          required: false

        }

      ],

      order: [['createdAt', 'DESC']]

    });



    const formatted = await Promise.all(entries.map(async (detail) => {

      const inspection = detail.physicalInspection;

      const sampleEntry = detail.sampleEntry || {};



      // Fetch place kunchinittu and warehouse

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

        ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name'] })

        : null;



      return {

        id: detail.id,

        date: detail.placeDate || detail.createdAt,

        entryDate: sampleEntry.entryDate || detail.createdAt,

        movementType: 'purchase',

        broker: sampleEntry.brokerName || null,

        variety: sampleEntry.variety || null,

        bags: inspection?.bags || 0,

        packaging: parseFloat(sampleEntry.packaging) || 75,

        fromLocation: sampleEntry.location || null,

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

        lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A',

        placeStatus: detail.placeStatus,


        placeDate: detail.placeDate,

        createdAt: detail.createdAt,

        placeType: detail.placeType,

        wbStatus: detail.wbStatus,

        wbInputType: detail.wbInputType,

        millWbId: detail.millWbId,

        millWb: millWb,

        partyWbName: detail.partyWbName,

        placeKunchinittuData: placeKunchinittu,

        placeWarehouse: placeWarehouse,

        sampleEntry: sampleEntry,

        isBandMalalBook: false,

        transitDetailId: detail.id

      };

    }));



    res.json({ arrivals: formatted });

  } catch (error) {

    console.error('Error fetching pending transit approvals:', error);

    res.status(500).json({ error: 'Failed to fetch pending transit approvals' });

  }

});



// Get single arrival by ID

router.get('/:id', auth, async (req, res) => {

  try {

    const { id } = req.params;



    const arrival = await Arrival.findByPk(id, {

      include: [

        { model: User, as: 'creator', attributes: ['username', 'role'] },

        { model: User, as: 'approver', attributes: ['username', 'role'] },

        { model: User, as: 'adminApprover', attributes: ['username', 'role'] },

        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },

        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },

        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] },

        { model: Outturn, as: 'outturn', attributes: ['code', 'allottedVariety'], required: false }

      ]

    });



    if (!arrival) {

      return res.status(404).json({ error: 'Arrival not found' });

    }



    res.json({ arrival });

  } catch (error) {

    console.error('Get arrival by ID error:', error);

    res.status(500).json({ error: 'Failed to fetch arrival' });

  }

});



// Create loose bags entry

router.post('/loose', auth, authorize('manager', 'admin'), async (req, res) => {

  try {

    const { kunchinintuId, date, bags } = req.body;



    // Validate required fields

    if (!kunchinintuId) {

      return res.status(400).json({ error: 'Kunchinittu is required' });

    }



    if (!date) {

      return res.status(400).json({ error: 'Date is required' });

    }



    if (!bags || bags <= 0) {

      return res.status(400).json({ error: 'Bags must be a positive number' });

    }



    // Validate kunchinittu exists and get warehouse/variety details

    const kunchinittu = await Kunchinittu.findByPk(kunchinintuId, {

      include: [

        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'] },

        { model: Variety, as: 'variety', attributes: ['id', 'name'] }

      ]

    });



    if (!kunchinittu) {

      return res.status(400).json({ error: 'Kunchinittu not found' });

    }



    if (!kunchinittu.warehouse) {

      return res.status(400).json({ error: 'Warehouse not found for this kunchinittu' });

    }



    // Generate SL No

    const slNo = await generateSlNo();



    // Get the variety from kunchinittu's allotted variety (for stock count queries)

    const variety = kunchinittu.variety?.name?.trim().toUpperCase() || null;



    // Create loose bags entry as an Arrival record

    const arrival = await Arrival.create({

      slNo,

      date,

      movementType: 'loose',

      variety: variety, // Include variety so loose bags are counted in stock queries

      bags: parseInt(bags),

      toKunchinintuId: kunchinintuId,

      toWarehouseId: kunchinittu.warehouse.id,

      status: 'approved',

      createdBy: req.user.userId,

      adminApprovedBy: req.user.userId,

      adminApprovedAt: new Date(),

      // Set required fields with dummy values for loose entries

      wbNo: `LOOSE-${slNo}`,

      grossWeight: 0,

      tareWeight: 0,

      netWeight: 0,

      lorryNumber: 'N/A'

    });



    res.status(201).json({

      message: 'Loose bags entry created successfully',

      arrival: {

        id: arrival.id,

        slNo: arrival.slNo,

        date: arrival.date,

        movementType: arrival.movementType,

        bags: arrival.bags,

        toKunchinintuId: arrival.toKunchinintuId,

        status: arrival.status,

        createdBy: arrival.createdBy

      }

    });

  } catch (error) {

    console.error('Create loose bags entry error:', error);

    res.status(500).json({ error: 'Failed to create loose bags entry' });

  }

});







// ═══════════════════════════════════════════════════════════════════════

// TRANSIT WORKFLOW: Place & Weight Bridge

// ═══════════════════════════════════════════════════════════════════════



const { requireInventoryRole } = require('../middleware/roleAuth');



// Submit Place selection for an arrival (Inventory Staff, Inventory Head, or Admin/Manager/CEO)

router.post('/:id/place', auth, requireInventoryRole, async (req, res) => {

  try {

    const { id } = req.params;

    const { placeDate, placeKunchinittuId, placeWarehouseId, placeType, outturnId } = req.body;



    if (!placeDate) {

      return res.status(400).json({ error: 'Place date is required' });

    }

    if (placeType === 'production') {

      if (!outturnId) {

        return res.status(400).json({ error: 'Outturn is required for Production' });

      }

    } else {

      if (!placeKunchinittuId || !placeWarehouseId) {

        return res.status(400).json({ error: 'Kunchinittu and Warehouse are required' });

      }

    }



    const PhysicalInspection = require('../models/PhysicalInspection');

    const LorryTransitDetail = require('../models/LorryTransitDetail');



    // First check if id is a PhysicalInspection

    const inspection = await PhysicalInspection.findByPk(id);

    if (inspection) {

      let detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });

      if (!detail) {

        detail = await LorryTransitDetail.create({

          physicalInspectionId: id,

          sampleEntryId: inspection.sampleEntryId,

          wbStatus: 'none',

          placeStatus: 'none'

        });

      }

      const isAllowedEdit = ['admin', 'manager', 'ceo'].includes(String(req.user.role || '').toLowerCase()) || ['ceo'].includes(String(req.user.effectiveRole || '').toLowerCase());

      if (detail.placeStatus === 'approved' && !isAllowedEdit) {

        return res.status(400).json({ error: 'Place already approved for this lorry' });

      }



      const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';

      const targetStatus = isAdmin ? 'approved' : 'pending';



      await detail.update({

        placeDate,

        placeKunchinittuId: placeType === 'kunchinittu' ? (placeKunchinittuId ? Number(placeKunchinittuId) : null) : null,

        placeWarehouseId: placeWarehouseId ? Number(placeWarehouseId) : null,

        placeType: placeType || null,

        outturnId: placeType === 'production' ? (outturnId ? Number(outturnId) : null) : null,

        placeStatus: targetStatus,

        placeRejectReason: null,

        // Set approval metadata when admin auto-approves

        ...(isAdmin ? { placeApprovedBy: req.user.userId, placeApprovedAt: new Date() } : {})

      });



      return res.json({ message: isAdmin ? 'Place updated and auto-approved' : 'Place updated and submitted for approval', detail });

    }



    // Fallback: Check if it's an Arrival

    const arrival = await Arrival.findByPk(id);

    if (!arrival) return res.status(404).json({ error: 'Inspection or Arrival not found' });

    if (arrival.placeStatus === 'approved') {

      return res.status(400).json({ error: 'Place already approved for this entry' });

    }



    await arrival.update({

      placeDate,

      placeKunchinittuId: placeType === 'kunchinittu' ? (placeKunchinittuId ? Number(placeKunchinittuId) : null) : null,

      placeWarehouseId: placeWarehouseId ? Number(placeWarehouseId) : null,

      placeType: placeType || null,

      outturnId: placeType === 'production' ? (outturnId ? Number(outturnId) : null) : null,

      placeStatus: 'pending',

      placeRejectReason: null

    });



    res.json({ message: 'Place submitted for approval', arrival });

  } catch (error) {

    console.error('Submit place error:', error);

    res.status(500).json({ error: 'Failed to submit place' });

  }

});



// Submit WB selection for an arrival (Inventory Staff, Inventory Head, or Admin/Manager/CEO)

router.post('/:id/wb', auth, requireInventoryRole, async (req, res) => {

  try {

    const { id } = req.params;

    const { wbInputType, millWbId, partyWbName, wbNo, grossWeight, tareWeight, netWeight } = req.body;



    if (!wbInputType) {

      return res.status(400).json({ error: 'WB input type is required (mill or party)' });

    }



    if (wbInputType === 'mill' && !millWbId) {

      return res.status(400).json({ error: 'Mill Weight Bridge selection is required' });

    }



    if (wbInputType === 'party' && !partyWbName) {

      return res.status(400).json({ error: 'Party Weight Bridge name is required' });

    }



    // Import cache invalidation

    const { invalidateCache } = require('../middleware/cache');



    // Use top-level imports (already imported at line 10-12)

    

    // First check if id is a LorryTransitDetail (from Band Malal Book)

    const transitDetail = await LorryTransitDetail.findByPk(id);

    if (transitDetail) {

      if (wbInputType === 'party') {

        // Keep pending/existing status if Mill WB is already present

        const targetWbStatus = (transitDetail.millWbId) ? (transitDetail.wbStatus || 'pending') : 'approved';



        // Party WB details go directly to the SampleEntry record (gate weights)

        const sampleEntry = await SampleEntry.findByPk(transitDetail.sampleEntryId);

        if (sampleEntry) {

          await sampleEntry.update({

            partyWbName,

            wbNo,

            grossWeight: grossWeight ? Number(grossWeight) : null,

            tareWeight: tareWeight ? Number(tareWeight) : null,

            netWeight: netWeight ? Number(netWeight) : null,

            wbStatus: targetWbStatus

          });

        }



        // Also update LorryTransitDetail to sync party name, wbStatus, wbNo, weights and wbInputType

        await transitDetail.update({

          partyWbName,

          wbNo,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus: targetWbStatus,

          wbInputType: 'party',

          wbApprovedBy: req.user.userId

        });



        // Invalidate cache to refresh In-Transit and Band Malal Book

        ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(invalidateCache);



        return res.json({ message: 'Party Weight Bridge added successfully', detail: transitDetail });

      } else {

        // Mill WB - check if already added (not just approved)

        const userRole = req.user.role;

        const effectiveRole = req.user.effectiveRole;

        const isAllowedEdit = ['admin', 'manager', 'ceo'].includes(String(userRole || '').toLowerCase()) || ['ceo'].includes(String(effectiveRole || '').toLowerCase());



        if (transitDetail.millWbId && transitDetail.wbStatus !== 'rejected' && !isAllowedEdit) {

          return res.status(400).json({ error: 'Mill WB already added for this lorry. Cannot add duplicate WB entry.' });

        }



        // Role-based approval logic - only admin is auto-approved

        const isAdmin = String(userRole || '').toLowerCase() === 'admin';

        const wbStatus = isAdmin ? 'approved' : 'pending';

        const wbApprovedBy = isAdmin ? req.user.userId : null;

        const wbApprovedAt = isAdmin ? new Date() : null;



        await transitDetail.update({

          wbInputType: 'mill',

          millWbId: Number(millWbId),

          wbNo: wbNo || null,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus,

          wbRejectReason: null,

          wbApprovedBy,

          wbApprovedAt

        });



        if (isAdmin) {

          // Find associated physical inspection

          const inspection = await PhysicalInspection.findByPk(transitDetail.physicalInspectionId);

          if (inspection) {

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

                wbNo: transitDetail.wbNo,

                wbInputType: transitDetail.wbInputType,

                millWbId: transitDetail.millWbId,

                grossWeight: transitDetail.grossWeight,

                tareWeight: transitDetail.tareWeight,

                netWeight: transitDetail.netWeight

              });

            }

          }

        }



        const message = isAdmin 

          ? 'Mill WB added and approved successfully' 

          : 'Mill WB submitted for approval';

        

        // Invalidate cache to refresh In-Transit and Band Malal Book

        ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(invalidateCache);



        // ✅ FIX: Return lightweight response instead of fetching complete entry data

        // The frontend will call fetchInTransitEntries() to refresh the table

        return res.json({ 

          message,

          transitDetailId: transitDetail.id,

          wbStatus: transitDetail.wbStatus,

          millWbId: transitDetail.millWbId,

          wbNo: transitDetail.wbNo,

          netWeight: transitDetail.netWeight

        });

      }

    }



    // Check if id is a SampleEntry (from In-Transit tab)

    const sampleEntry = await SampleEntry.findByPk(id);

    if (sampleEntry) {

      // Find the most recent PhysicalInspection for this Sample Entry

      const sampleInspection = await PhysicalInspection.findOne({

        where: { sampleEntryId: id },

        order: [['createdAt', 'DESC']]

      });

      

      if (!sampleInspection) {

        return res.status(404).json({ error: 'No inspection found for this sample entry' });

      }

      

      // Now process using the inspection's ID (redirect to PhysicalInspection logic below)

      // Find or create LorryTransitDetail

      let detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: sampleInspection.id } });

      if (!detail) {

        detail = await LorryTransitDetail.create({

          physicalInspectionId: sampleInspection.id,

          sampleEntryId: sampleInspection.sampleEntryId,

          wbStatus: 'none',

          placeStatus: 'none'

        });

      }



      if (wbInputType === 'party') {

        // Keep pending/existing status if Mill WB is already present

        const targetWbStatus = (detail.millWbId) ? (detail.wbStatus || 'pending') : 'approved';



        // Party WB details go directly to the SampleEntry record (gate weights)

        await sampleEntry.update({

          partyWbName,

          wbNo,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus: targetWbStatus

        });



        // Also update LorryTransitDetail to sync party name, wbStatus, wbNo, weights and wbInputType

        await detail.update({

          partyWbName,

          wbNo,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus: targetWbStatus,

          wbInputType: 'party',

          wbApprovedBy: req.user.userId

        });



        return res.json({ message: 'Party Weight Bridge added successfully', detail });

      } else {

        // Mill WB - check if already added (not just approved)

        if (detail.millWbId && detail.wbStatus !== 'rejected') {

          return res.status(400).json({ error: 'Mill WB already added for this lorry. Cannot add duplicate WB entry.' });

        }



        // Role-based approval logic

        const userRole = req.user.role;

        const isAutoApprove = userRole === 'admin' || userRole === 'owner';

        const wbStatus = isAutoApprove ? 'approved' : 'pending';

        const wbApprovedBy = isAutoApprove ? req.user.userId : null;

        const wbApprovedAt = isAutoApprove ? new Date() : null;



        await detail.update({

          wbInputType: 'mill',

          millWbId: Number(millWbId),

          wbNo: wbNo || null,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus,

          wbRejectReason: null,

          wbApprovedBy,

          wbApprovedAt

        });



        if (isAutoApprove) {

          // Update the auto-created Arrival weights

          const arrival = await Arrival.findOne({

            where: {

              lorryNumber: sampleInspection.lorryNumber,

              remarks: { [Op.like]: `%inspection #${sampleInspection.id}%` }

            }

          });

          if (arrival) {

            await arrival.update({

              wbStatus: 'approved',

              wbNo: detail.wbNo,

              wbInputType: detail.wbInputType,

              millWbId: detail.millWbId,

              grossWeight: detail.grossWeight,

              tareWeight: detail.tareWeight,

              netWeight: detail.netWeight

            });

          }

        }



        const message = isAutoApprove 

          ? 'Mill WB added and approved successfully' 

          : 'Mill WB submitted for approval';

        

        // Invalidate cache to refresh In-Transit and Band Malal Book

        ['sample-entries/by-role', 'arrivals/band-malal-book'].forEach(invalidateCache);



        // ✅ Return lightweight response with partyWbName (same as LorryTransitDetail branch)

        return res.json({ 

          message,

          transitDetailId: detail.id,

          wbStatus: detail.wbStatus,

          millWbId: detail.millWbId,

          wbNo: detail.wbNo,

          netWeight: detail.netWeight,

          partyWbName: sampleEntry.partyWbName || detail.partyWbName || null  // ✅ Include partyWbName

        });

      }

    }



    // Next check if id is a PhysicalInspection

    const inspection = await PhysicalInspection.findByPk(id);

    if (inspection) {

      let detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });

      if (!detail) {

        detail = await LorryTransitDetail.create({

          physicalInspectionId: id,

          sampleEntryId: inspection.sampleEntryId,

          wbStatus: 'none',

          placeStatus: 'none'

        });

      }



      if (wbInputType === 'party') {

        // Keep pending/existing status if Mill WB is already present

        const targetWbStatus = (detail.millWbId) ? (detail.wbStatus || 'pending') : 'approved';



        // Party WB details go directly to the SampleEntry record (gate weights)

        const sampleEntry = await SampleEntry.findByPk(inspection.sampleEntryId);

        if (sampleEntry) {

          await sampleEntry.update({

            partyWbName,

            wbNo,

            grossWeight: grossWeight ? Number(grossWeight) : null,

            tareWeight: tareWeight ? Number(tareWeight) : null,

            netWeight: netWeight ? Number(netWeight) : null,

            wbStatus: targetWbStatus

          });

        }



        // Also update LorryTransitDetail to sync party name, wbStatus, wbNo, weights and wbInputType

        await detail.update({

          partyWbName,

          wbNo,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus: targetWbStatus,

          wbInputType: 'party',

          wbApprovedBy: req.user.userId

        });



        return res.json({ message: 'Party Weight Bridge added successfully', detail });

      } else {

        // Mill WB - check if already added (not just approved)

        if (detail.millWbId && detail.wbStatus !== 'rejected') {

          return res.status(400).json({ error: 'Mill WB already added for this lorry. Cannot add duplicate WB entry.' });

        }



        // Role-based approval logic

        const userRole = req.user.role;

        const isAutoApprove = userRole === 'admin' || userRole === 'owner';

        const wbStatus = isAutoApprove ? 'approved' : 'pending';

        const wbApprovedBy = isAutoApprove ? req.user.userId : null;

        const wbApprovedAt = isAutoApprove ? new Date() : null;



        await detail.update({

          wbInputType: 'mill',

          millWbId: Number(millWbId),

          wbNo: wbNo || null,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus,

          wbRejectReason: null,

          wbApprovedBy,

          wbApprovedAt

        });



        if (isAutoApprove) {

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

              wbNo: detail.wbNo,

              wbInputType: detail.wbInputType,

              millWbId: detail.millWbId,

              grossWeight: detail.grossWeight,

              tareWeight: detail.tareWeight,

              netWeight: detail.netWeight

            });

          }

        }



        const message = isAutoApprove 

          ? 'Mill WB added and approved successfully' 

          : 'Mill WB submitted for approval';

        

        // Fetch complete entry data for frontend (same format as Band Malal Book)

        // Re-fetch the inspection to ensure we have the latest data

        const refreshedInspection = await PhysicalInspection.findByPk(id);

        

        const sampleEntry = detail.sampleEntryId

          ? await SampleEntry.findByPk(detail.sampleEntryId, {

              attributes: ['id', 'serialNo', 'variety', 'brokerName', 'location', 'partyName', 'lorryNumber', 'entryDate', 'packaging', 'grossWeight', 'tareWeight', 'netWeight', 'wbNo', 'partyWbName']

            })

          : null;

        

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

          ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name'] })

          : null;

        

        const wbApproverUser = wbApprovedBy

          ? await User.findByPk(wbApprovedBy, { attributes: ['id', 'username', 'role'] })

          : null;



        // Return complete entry (with full data matching Band Malal Book format)

        const completeEntry = {

          id: detail.id,

          date: detail.placeDate || detail.createdAt,

          movementType: 'purchase',

          broker: sampleEntry?.brokerName || null,

          variety: sampleEntry?.variety || null,

          bags: refreshedInspection?.bags || 0,

          packaging: parseFloat(sampleEntry?.packaging) || 75,

          fromLocation: sampleEntry?.location || null,

          entryDate: sampleEntry?.entryDate || detail.placeDate || detail.createdAt,

          partyName: sampleEntry?.partyName || null,

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

          moisture: refreshedInspection?.moisture || null,

          cutting: await getCuttingFromInspection(refreshedInspection),

          wbNo: detail.wbNo || 'PENDING',

          grossWeight: detail.grossWeight || 0,

          tareWeight: detail.tareWeight || 0,

          netWeight: detail.netWeight || 0,

          lorryNumber: refreshedInspection?.lorryNumber || sampleEntry?.lorryNumber || 'N/A',

          placeStatus: detail.placeStatus,


          placeDate: detail.placeDate,

        createdAt: detail.createdAt,

          placeType: detail.placeType,

          wbStatus: detail.wbStatus,

          wbInputType: detail.wbInputType,

          millWbId: detail.millWbId,

          millWb: millWb,

          partyWbName: detail.partyWbName,

          placeKunchinittuData: placeKunchinittu,

          placeWarehouse: placeWarehouse,

          sampleEntry: sampleEntry,

          wbApprover: wbApproverUser,

          physicalInspectionId: detail.physicalInspectionId,

          sampleEntryId: detail.sampleEntryId,

          wbRejectReason: detail.wbRejectReason,

          wbApprovedBy: detail.wbApprovedBy,

          wbApprovedAt: detail.wbApprovedAt,

          isBandMalalBook: false, // Mark as In-Transit

          transitDetailId: detail.id

        };

        

        return res.json({ message, entry: completeEntry });

      }

    }



    // Fallback: Check if it's an Arrival

    const arrival = await Arrival.findByPk(id);

    if (!arrival) return res.status(404).json({ error: 'Inspection or Arrival not found' });



    if (wbInputType === 'party') {

      // Find associated sample entry by lorryNumber

      const sampleEntry = await SampleEntry.findOne({ where: { lorryNumber: arrival.lorryNumber } });

      if (sampleEntry) {

        await sampleEntry.update({

          partyWbName,

          wbNo,

          grossWeight: grossWeight ? Number(grossWeight) : null,

          tareWeight: tareWeight ? Number(tareWeight) : null,

          netWeight: netWeight ? Number(netWeight) : null,

          wbStatus: 'approved'

        });

      }



      await arrival.update({

        partyWbName

      });



      return res.json({ message: 'Party Weight Bridge added successfully', arrival });

    } else {

      if (arrival.wbStatus === 'approved') {

        return res.status(400).json({ error: 'Mill WB already approved for this entry' });

      }



      // Role-based approval logic

      const userRole = req.user.role;

      const isAutoApprove = userRole === 'admin' || userRole === 'owner';

      const wbStatus = isAutoApprove ? 'approved' : 'pending';



      await arrival.update({

        wbInputType: 'mill',

        millWbId: Number(millWbId),

        wbNo: wbNo || arrival.wbNo,

        grossWeight: grossWeight ? Number(grossWeight) : arrival.grossWeight,

        tareWeight: tareWeight ? Number(tareWeight) : arrival.tareWeight,

        netWeight: netWeight ? Number(netWeight) : arrival.netWeight,

        wbStatus,

        wbRejectReason: null

      });



      const message = isAutoApprove 

        ? 'Mill WB added and approved successfully' 

        : 'Mill WB submitted for approval';

      return res.json({ message, arrival });

    }

  } catch (error) {

    console.error('Submit WB error:', error);

    console.error('Error stack:', error.stack);

    res.status(500).json({ 

      error: 'Failed to submit WB',

      details: error.message,

      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined

    });

  }

});



// Approve Place (CEO / Inventory Head)

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

      if (detail.placeStatus !== 'pending') {

        return res.status(400).json({ error: 'No pending place to approve for this lorry' });

      }



      // CRITICAL FIX: Do NOT create Arrival record yet!

      // Entry should ONLY move to Band Malal Book (placeStatus='approved')

      // Arrival record (stock connection) should only be created when finalized

      await detail.update({ 

        placeStatus: 'approved',

        placeApprovedBy: req.user.userId,

        placeApprovedAt: new Date()

      });



      return res.json({ 

        message: 'Place approved — entry moved to Band Malal Book', 

        detail,

        note: 'Entry is now in Band Malal Book. Stock record will be created upon finalization.'

      });

    }



    // 3. Fallback: Check if it's an Arrival (only if id is numeric/integer)

    if (!isNaN(id) && Number.isInteger(Number(id))) {

      const arrival = await Arrival.findByPk(Number(id));

      if (arrival) {

        if (arrival.placeStatus !== 'pending') {

          return res.status(400).json({ error: 'No pending place to approve' });

        }



        await arrival.update({ 

          placeStatus: 'approved',

          placeApprovedBy: req.user.userId,

          placeApprovedAt: new Date()

        });

        return res.json({ message: 'Place approved — entry moved to Band Malal Book', arrival });

      }

    }



    return res.status(404).json({ error: 'Inspection, Transit Detail, or Arrival not found' });

  } catch (error) {

    console.error('Approve place error:', error);

    res.status(500).json({ error: 'Failed to approve place' });

  }

});



// Reject Place (CEO / Inventory Head)

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

      if (detail.placeStatus !== 'pending') {

        return res.status(400).json({ error: 'No pending place to reject for this lorry' });

      }



      await detail.update({

        placeStatus: 'rejected',

        placeRejectReason: reason || 'Rejected',

        placeDate: null,

        placeKunchinittuId: null,

        placeWarehouseId: null,

        outturnId: null

      });



      return res.json({ message: 'Place rejected', detail });

    }



    // 3. Fallback: Check if it's an Arrival (only if id is numeric/integer)

    if (!isNaN(id) && Number.isInteger(Number(id))) {

      const arrival = await Arrival.findByPk(Number(id));

      if (arrival) {

        if (arrival.placeStatus !== 'pending') {

          return res.status(400).json({ error: 'No pending place to reject' });

        }



        await arrival.update({

          placeStatus: 'rejected',

          placeRejectReason: reason || 'Rejected',

          placeDate: null,

          placeKunchinittuId: null,

          placeWarehouseId: null,

          outturnId: null

        });

        return res.json({ message: 'Place rejected', arrival });

      }

    }



    return res.status(404).json({ error: 'Inspection, Transit Detail, or Arrival not found' });

  } catch (error) {

    console.error('Reject place error:', error);

    res.status(500).json({ error: 'Failed to reject place' });

  }

});



// Approve WB (CEO / Inventory Head)

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

          wbNo: detail.wbNo,

          wbInputType: detail.wbInputType,

          millWbId: detail.millWbId,

          partyWbName: detail.partyWbName,

          grossWeight: detail.grossWeight,

          tareWeight: detail.tareWeight,

          netWeight: detail.netWeight

        });

      }



      return res.json({ message: 'WB approved', detail });

    }



    // Fallback: Check if it's an Arrival

    const arrival = await Arrival.findByPk(targetId);

    if (!arrival) return res.status(404).json({ error: 'Inspection or Arrival not found' });

    if (arrival.wbStatus !== 'pending') {

      return res.status(400).json({ error: 'No pending WB to approve' });

    }



    await arrival.update({ wbStatus: 'approved' });

    res.json({ message: 'WB approved', arrival });

  } catch (error) {

    console.error('Approve WB error:', error);

    res.status(500).json({ error: 'Failed to approve WB' });

  }

});



// Reject WB (CEO / Inventory Head)

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



      return res.json({ message: 'WB rejected', detail });

    }



    // Fallback: Check if it's an Arrival

    const arrival = await Arrival.findByPk(targetId);

    if (!arrival) return res.status(404).json({ error: 'Inspection or Arrival not found' });

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

      netWeight: null

    });

    res.json({ message: 'WB rejected', arrival });

  } catch (error) {

    console.error('Reject WB error:', error);

    res.status(500).json({ error: 'Failed to reject WB' });

  }

});



// Get active weight bridges for dropdown

router.get('/weight-bridges', auth, async (req, res) => {

  try {

    const weightBridges = await WeightBridge.findAll({

      where: { isActive: true },

      attributes: ['id', 'name'],

      order: [['name', 'ASC']]

    });

    res.json({ weightBridges });

  } catch (error) {

    console.error('Get weight bridges error:', error);

    res.status(500).json({ error: 'Failed to fetch weight bridges' });

  }

});



// ============================================================================

// INVENTORY QUALITY PARAMETERS ENDPOINTS

// ============================================================================



// Add Inventory Quality Parameters (Inventory Staff, Mill Staff, Location Staff, Inventory Head)

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



    // Validate transit detail exists

    const transitDetail = await LorryTransitDetail.findByPk(transitDetailId);

    if (!transitDetail) {

      return res.status(404).json({ error: 'Transit detail not found' });

    }



    const {

      type,

      moisture,

      dryMoisture,

      cutting,

      bend,

      grains,

      mix,

      sMix,

      lMix,

      kandu,

      oil,

      sk,

      wbR,

      wbBk,

      wbT,

      smell,

      paddyWb,

      pColor,

      remarks,

      kadiga

    } = req.body;



    // Validate type

    if (!['lot_avg', 'full_lorry_avg'].includes(type)) {

      return res.status(400).json({ error: 'Invalid type. Must be lot_avg or full_lorry_avg' });

    }



    // Check for existing approved or pending record of same type

    const { Op } = require('sequelize');

    const existingRecord = await InventoryQualityParameter.findOne({

      where: {

        lorryTransitDetailId: transitDetailId,

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



    // Create new quality parameter

    const qualityParam = await InventoryQualityParameter.create({

      lorryTransitDetailId: transitDetailId,

      type,

      status: isAutoApprove ? 'approved' : 'pending',

      moisture,

      dryMoisture,

      cutting,

      bend,

      grains,

      mix,

      sMix,

      lMix,

      kandu,

      oil,

      sk,

      wbR,

      wbBk,

      wbT,

      smell,

      paddyWb,

      pColor,

      remarks,

      kadiga: kadiga || 'N',

      reportedByUserId: req.user.userId,

      approvedByUserId: isAutoApprove ? req.user.userId : null

    });



    // Fetch with associations

    const result = await InventoryQualityParameter.findByPk(qualityParam.id, {

      include: [

        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] }

      ]

    });



    res.status(201).json({ 

      message: isAutoApprove ? 'Inventory quality parameters auto-approved' : 'Inventory quality parameters submitted for approval',

      data: result

    });

  } catch (error) {

    console.error('Error adding inventory quality parameters:', error);

    res.status(500).json({ error: 'Failed to add inventory quality parameters' });

  }

});



// Approve Inventory Quality Parameters (Admin, Owner, Manager, CEO)

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

        error: `An approved ${qualityParam.type.replace('_', ' ')} record already exists` 

      });

    }



    await qualityParam.update({

      status: 'approved',

      approvedByUserId: req.user.userId

    });



    const result = await InventoryQualityParameter.findByPk(qualityId, {

      include: [

        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] },

        { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] }

      ]

    });



    res.json({ 

      message: 'Inventory quality parameters approved successfully',

      data: result

    });

  } catch (error) {

    console.error('Error approving inventory quality parameters:', error);

    res.status(500).json({ error: 'Failed to approve inventory quality parameters' });

  }

});



// Reject Inventory Quality Parameters (Admin, Owner, Manager, CEO)

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



    const result = await InventoryQualityParameter.findByPk(qualityId, {

      include: [

        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] },

        { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] }

      ]

    });



    res.json({ 

      message: 'Inventory quality parameters rejected',

      data: result

    });

  } catch (error) {

    console.error('Error rejecting inventory quality parameters:', error);

    res.status(500).json({ error: 'Failed to reject inventory quality parameters' });

  }

});



// Get pending BMB Inventory Quality approvals

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



    const formatted = entries.map((entry) => ({

      id: entry.id,

      type: entry.type,

      status: entry.status,

      moisture: entry.moisture,

      dryMoisture: entry.dryMoisture,

      cutting: entry.cutting,

      bend: entry.bend,

      grains: entry.grains,

      mix: entry.mix,

      sMix: entry.sMix,

      lMix: entry.lMix,

      kandu: entry.kandu,

      oil: entry.oil,

      sk: entry.sk,

      smell: entry.smell,

      paddyWb: entry.paddyWb,

      pColor: entry.pColor, kadiga: entry.kadiga,

      remarks: entry.remarks,

      reportedBy: entry.reporter ? {

        id: entry.reporter.id,

        username: entry.reporter.username,

        fullName: entry.reporter.fullName,

        role: entry.reporter.role

      } : null,

      reportedAt: entry.createdAt,

      lorryTransitDetail: entry.lorryTransitDetail ? {

        id: entry.lorryTransitDetail.id,

        placeDate: entry.lorryTransitDetail.placeDate,

        placeStatus: entry.lorryTransitDetail.placeStatus,

        lorryNumber: entry.lorryTransitDetail.lorryNumber,

        wbNo: entry.lorryTransitDetail.wbNo,

        sampleEntry: entry.lorryTransitDetail.sampleEntry ? {

          id: entry.lorryTransitDetail.sampleEntry.id,

          brokerName: entry.lorryTransitDetail.sampleEntry.brokerName,

          partyName: entry.lorryTransitDetail.sampleEntry.partyName,

          location: entry.lorryTransitDetail.sampleEntry.location,

          variety: entry.lorryTransitDetail.sampleEntry.variety,

          entryDate: entry.lorryTransitDetail.sampleEntry.entryDate

        } : null,

        physicalInspection: entry.lorryTransitDetail.physicalInspection ? {

          id: entry.lorryTransitDetail.physicalInspection.id,

          lorryNumber: entry.lorryTransitDetail.physicalInspection.lorryNumber,

          bags: entry.lorryTransitDetail.physicalInspection.bags,

          moisture: entry.lorryTransitDetail.physicalInspection.moisture

        } : null

      } : null

    }));



    res.json({ entries: formatted, count: formatted.length });

  } catch (error) {

    console.error('Error fetching pending Arrivals inventory quality approvals:', error);

    res.status(500).json({ error: 'Failed to fetch pending Arrivals inventory quality approvals' });

  }

});



module.exports = router;