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
