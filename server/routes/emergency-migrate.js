/**
 * Emergency Migration Endpoint
 * ONE-TIME USE - Creates missing lorry_transit_details table
 * DELETE THIS FILE AFTER USE
 */

const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

router.post('/run-142-migration', async (req, res) => {
    try {
        console.log('🚨 EMERGENCY: Running Band Malal schema repair...');

        // Step 1: Add missing columns to sample_entries
        console.log('Step 1: Adding columns to sample_entries...');
        await sequelize.query(`
            ALTER TABLE sample_entries
                ADD COLUMN IF NOT EXISTS "wbInputType" VARCHAR(50),
                ADD COLUMN IF NOT EXISTS "millWbId" INTEGER,
                ADD COLUMN IF NOT EXISTS "partyWbName" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "wbStatus" VARCHAR(50) DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS "wbRejectReason" TEXT,
                ADD COLUMN IF NOT EXISTS "placeType" VARCHAR(50),
                ADD COLUMN IF NOT EXISTS "placeWarehouseId" INTEGER,
                ADD COLUMN IF NOT EXISTS "placeKunchinittuId" INTEGER,
                ADD COLUMN IF NOT EXISTS "placeDate" DATE,
                ADD COLUMN IF NOT EXISTS "placeStatus" VARCHAR(50) DEFAULT 'none',
                ADD COLUMN IF NOT EXISTS "placeRejectReason" TEXT,
                ADD COLUMN IF NOT EXISTS "outturnId" INTEGER,
                ADD COLUMN IF NOT EXISTS "wbNo" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "grossWeight" DECIMAL(15, 2),
                ADD COLUMN IF NOT EXISTS "tareWeight" DECIMAL(15, 2),
                ADD COLUMN IF NOT EXISTS "netWeight" DECIMAL(15, 2);
        `);
        console.log('✅ sample_entries columns added');

        // Step 2: Create lorry_transit_details table
        console.log('Step 2: Creating lorry_transit_details table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS lorry_transit_details (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                physical_inspection_id UUID NOT NULL,
                sample_entry_id UUID NOT NULL,
                "wbInputType" VARCHAR(50),
                "millWbId" INTEGER,
                "partyWbName" VARCHAR(255),
                "wbNo" VARCHAR(100),
                "grossWeight" DECIMAL(15, 2),
                "tareWeight" DECIMAL(15, 2),
                "netWeight" DECIMAL(15, 2),
                "wbStatus" VARCHAR(50) NOT NULL DEFAULT 'none',
                "wbRejectReason" TEXT,
                "placeType" VARCHAR(50),
                "placeWarehouseId" INTEGER,
                "placeKunchinittuId" INTEGER,
                "placeDate" DATE,
                "placeStatus" VARCHAR(50) NOT NULL DEFAULT 'none',
                "placeRejectReason" TEXT,
                "outturnId" INTEGER,
                place_approved_by INTEGER,
                place_approved_at TIMESTAMP,
                wb_approved_by INTEGER,
                wb_approved_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ lorry_transit_details table created');

        // Step 3: Create indexes for lorry_transit_details
        console.log('Step 3: Creating indexes for lorry_transit_details...');
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_lorry_transit_physical_inspection ON lorry_transit_details(physical_inspection_id)`);
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_lorry_transit_sample_entry ON lorry_transit_details(sample_entry_id)`);
        console.log('✅ lorry_transit_details indexes created');

        // Step 4: Create inventory_quality_parameters table
        console.log('Step 4: Creating inventory_quality_parameters table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS inventory_quality_parameters (
                id SERIAL PRIMARY KEY,
                lorry_transit_detail_id UUID NOT NULL,
                type VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                moisture VARCHAR(30),
                dry_moisture VARCHAR(30),
                cutting VARCHAR(30),
                bend VARCHAR(30),
                grains VARCHAR(30),
                mix VARCHAR(30),
                s_mix VARCHAR(30),
                l_mix VARCHAR(30),
                kandu VARCHAR(30),
                oil VARCHAR(30),
                sk VARCHAR(30),
                wb_r VARCHAR(30),
                wb_bk VARCHAR(30),
                wb_t VARCHAR(30),
                smell VARCHAR(30),
                paddy_wb VARCHAR(30),
                p_color VARCHAR(50),
                remarks TEXT,
                reported_by_user_id INTEGER NOT NULL,
                approved_by_user_id INTEGER,
                reject_reason TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ inventory_quality_parameters table created');

        // Step 5: Create indexes for inventory_quality_parameters
        console.log('Step 5: Creating indexes for inventory_quality_parameters...');
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_quality_transit_detail ON inventory_quality_parameters(lorry_transit_detail_id)`);
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_quality_status ON inventory_quality_parameters(status)`);
        await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_quality_type ON inventory_quality_parameters(type)`);
        console.log('✅ inventory_quality_parameters indexes created');

        // Step 6: Track migrations
        console.log('Step 6: Tracking migrations...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
                name VARCHAR(255) PRIMARY KEY
            );
        `);
        
        await sequelize.query(`
            INSERT INTO "SequelizeMeta" (name)
            VALUES
                ('139_add_transit_approval_fields_to_sample_entries.js'),
                ('140_add_outturn_id_to_sample_entries.js'),
                ('141_add_wb_weights_to_sample_entries.js'),
                ('142_create_lorry_transit_details.js'),
                ('143_add_place_wb_approver_tracking.js'),
                ('144_update_existing_place_approved_at.js'),
                ('145_create_inventory_quality_parameters.js')
            ON CONFLICT (name) DO NOTHING;
        `);
        console.log('✅ Migrations tracked');

        // Step 7: Verify tables exist
        console.log('Step 7: Verifying tables...');
        const [verification] = await sequelize.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('lorry_transit_details', 'inventory_quality_parameters', 'sample_entries')
            ORDER BY table_name;
        `);
        
        const tableNames = verification.map(row => row.table_name);
        console.log('✅ Tables verified:', tableNames);

        res.json({
            success: true,
            message: '✅ Band Malal schema repaired successfully. All tables and columns created.',
            tables: tableNames,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Emergency migration failed:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            name: error.name
        });
        
        res.status(500).json({
            success: false,
            error: error.message,
            errorCode: error.code,
            errorName: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Verify endpoint - check if columns exist
router.get('/verify-columns', async (req, res) => {
    try {
        console.log('🔍 Verifying sample_entries columns...');
        
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sample_entries' 
            AND column_name IN ('wbInputType', 'millWbId', 'partyWbName', 'wbStatus', 'placeType', 'placeWarehouseId', 'placeKunchinittuId', 'placeDate', 'placeStatus', 'outturnId', 'wbNo', 'grossWeight', 'tareWeight', 'netWeight')
            ORDER BY column_name;
        `);
        
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sample_entries', 'lorry_transit_details', 'inventory_quality_parameters')
            ORDER BY table_name;
        `);
        
        res.json({
            success: true,
            message: 'Column and table verification complete',
            sample_entries_columns: columns,
            tables_exist: tables.map(t => t.table_name),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Verification failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// OLD CODE BELOW - KEEPING FOR REFERENCE
router.post('/run-142-migration-OLD', async (req, res) => {
    try {
        const queryInterface = sequelize.getQueryInterface();
        
        console.log('🚨 EMERGENCY: Running migration 142...');

        // Create lorry_transit_details table
        await queryInterface.createTable('lorry_transit_details', {
            id: {
                type: sequelize.Sequelize.UUID,
                defaultValue: sequelize.Sequelize.UUIDV4,
                primaryKey: true
            },
            physical_inspection_id: {
                type: sequelize.Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'physical_inspections',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            sample_entry_id: {
                type: sequelize.Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'sample_entries',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            wbInputType: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: true,
                field: 'wbInputType'
            },
            millWbId: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'millWbId',
                references: {
                    model: 'weight_bridges',
                    key: 'id'
                }
            },
            partyWbName: {
                type: sequelize.Sequelize.STRING(255),
                allowNull: true,
                field: 'partyWbName'
            },
            wbNo: {
                type: sequelize.Sequelize.STRING(100),
                allowNull: true,
                field: 'wbNo'
            },
            grossWeight: {
                type: sequelize.Sequelize.DECIMAL(15, 2),
                allowNull: true,
                field: 'grossWeight'
            },
            tareWeight: {
                type: sequelize.Sequelize.DECIMAL(15, 2),
                allowNull: true,
                field: 'tareWeight'
            },
            netWeight: {
                type: sequelize.Sequelize.DECIMAL(15, 2),
                allowNull: true,
                field: 'netWeight'
            },
            wbStatus: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'none',
                field: 'wbStatus'
            },
            wbRejectReason: {
                type: sequelize.Sequelize.TEXT,
                allowNull: true,
                field: 'wbRejectReason'
            },
            placeType: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: true,
                field: 'placeType'
            },
            placeWarehouseId: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'placeWarehouseId',
                references: {
                    model: 'warehouses',
                    key: 'id'
                }
            },
            placeKunchinittuId: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'placeKunchinittuId',
                references: {
                    model: 'kunchinittus',
                    key: 'id'
                }
            },
            placeDate: {
                type: sequelize.Sequelize.DATEONLY,
                allowNull: true,
                field: 'placeDate'
            },
            placeStatus: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'none',
                field: 'placeStatus'
            },
            placeRejectReason: {
                type: sequelize.Sequelize.TEXT,
                allowNull: true,
                field: 'placeRejectReason'
            },
            outturnId: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'outturnId',
                references: {
                    model: 'outturns',
                    key: 'id'
                }
            },
            wbApprovedBy: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'wbApprovedBy',
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            wbApprovedAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: true,
                field: 'wbApprovedAt'
            },
            wbRejectedBy: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'wbRejectedBy',
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            wbRejectedAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: true,
                field: 'wbRejectedAt'
            },
            placeApprovedBy: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'placeApprovedBy',
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            placeApprovedAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: true,
                field: 'placeApprovedAt'
            },
            placeRejectedBy: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                field: 'placeRejectedBy',
                references: {
                    model: 'users',
                    key: 'id'
                }
            },
            placeRejectedAt: {
                type: sequelize.Sequelize.DATE,
                allowNull: true,
                field: 'placeRejectedAt'
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        }).catch(err => {
            if (err.message.includes('already exists')) {
                console.log('✅ Table already exists, skipping');
            } else {
                throw err;
            }
        });

        console.log('✅ lorry_transit_details table created');

        // Create indexes
        await queryInterface.addIndex('lorry_transit_details', ['physical_inspection_id']).catch(() => {});
        await queryInterface.addIndex('lorry_transit_details', ['sample_entry_id']).catch(() => {});

        console.log('✅ Indexes created');

        // Create inventory_quality_parameters table
        await queryInterface.createTable('inventory_quality_parameters', {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            transit_detail_id: {
                type: sequelize.Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'lorry_transit_details',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            type: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: false
            },
            moisture: { type: sequelize.Sequelize.STRING(50) },
            dry_moisture: { type: sequelize.Sequelize.STRING(50) },
            cutting: { type: sequelize.Sequelize.STRING(50) },
            bend: { type: sequelize.Sequelize.STRING(50) },
            grains: { type: sequelize.Sequelize.STRING(50) },
            mix: { type: sequelize.Sequelize.STRING(50) },
            s_mix: { type: sequelize.Sequelize.STRING(50) },
            l_mix: { type: sequelize.Sequelize.STRING(50) },
            kandu: { type: sequelize.Sequelize.STRING(50) },
            oil: { type: sequelize.Sequelize.STRING(50) },
            sk: { type: sequelize.Sequelize.STRING(50) },
            wb_r: { type: sequelize.Sequelize.STRING(50) },
            wb_bk: { type: sequelize.Sequelize.STRING(50) },
            wb_t: { type: sequelize.Sequelize.STRING(50) },
            smell: { type: sequelize.Sequelize.STRING(50) },
            paddy_wb: { type: sequelize.Sequelize.STRING(50) },
            p_color: { type: sequelize.Sequelize.STRING(50) },
            remarks: { type: sequelize.Sequelize.TEXT },
            reported_by: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' }
            },
            status: {
                type: sequelize.Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'pending'
            },
            approved_by: {
                type: sequelize.Sequelize.INTEGER,
                references: { model: 'users', key: 'id' }
            },
            approved_at: { type: sequelize.Sequelize.DATE },
            rejected_by: {
                type: sequelize.Sequelize.INTEGER,
                references: { model: 'users', key: 'id' }
            },
            rejected_at: { type: sequelize.Sequelize.DATE },
            reject_reason: { type: sequelize.Sequelize.TEXT },
            created_at: { type: sequelize.Sequelize.DATE, allowNull: false },
            updated_at: { type: sequelize.Sequelize.DATE, allowNull: false }
        }).catch(err => {
            if (err.message.includes('already exists')) {
                console.log('✅ inventory_quality_parameters already exists, skipping');
            } else {
                throw err;
            }
        });

        console.log('✅ inventory_quality_parameters table created');

        // Create indexes for inventory_quality_parameters
        await queryInterface.addIndex('inventory_quality_parameters', ['transit_detail_id']).catch(() => {});
        await queryInterface.addIndex('inventory_quality_parameters', ['status']).catch(() => {});
        await queryInterface.addIndex('inventory_quality_parameters', ['type']).catch(() => {});

        console.log('✅ inventory_quality_parameters indexes created');

        // Track migration
        await queryInterface.createTable('SequelizeMeta', {
            name: {
                type: sequelize.Sequelize.STRING,
                allowNull: false,
                unique: true,
                primaryKey: true
            }
        }).catch(() => {});

        await sequelize.query(
            `INSERT INTO "SequelizeMeta" (name) VALUES ('142_create_lorry_transit_details.js'), ('143_add_place_wb_approver_tracking.js'), ('145_create_inventory_quality_parameters.js') ON CONFLICT (name) DO NOTHING`
        );

        console.log('✅ Migration tracking updated');

        res.json({
            success: true,
            message: '✅ Migration 142, 143, 145 completed successfully! Tables created.',
            tables: ['lorry_transit_details', 'inventory_quality_parameters']
        });

    } catch (error) {
        console.error('❌ Emergency migration failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
