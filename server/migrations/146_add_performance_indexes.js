'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Adding performance indexes for millions of records...');
    
    try {
      // ============================================
      // LORRY TRANSIT DETAILS - CRITICAL INDEXES
      // ============================================
      
      // Index on placeStatus (most important - used in In-Transit and Band Malal Book filters)
      await queryInterface.addIndex('lorry_transit_details', ['placeStatus'], {
        name: 'idx_lorry_transit_details_placeStatus',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_placeStatus');
      
      await queryInterface.addIndex('lorry_transit_details', ['wbStatus'], {
        name: 'idx_lorry_transit_details_wbStatus',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_wbStatus');
      
      await queryInterface.addIndex('lorry_transit_details', ['placeDate'], {
        name: 'idx_lorry_transit_details_placeDate_desc',
        using: 'BTREE',
        order: [['placeDate', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_placeDate_desc');
      
      // Index on createdAt DESC (used for sorting in In-Transit)
      await queryInterface.addIndex('lorry_transit_details', ['created_at'], {
        name: 'idx_lorry_transit_details_created_desc',
        using: 'BTREE',
        order: [['created_at', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_created_desc');
      
      // Composite index on placeStatus + placeDate (optimizes Band Malal Book query)
      await queryInterface.addIndex('lorry_transit_details', ['placeStatus', 'placeDate'], {
        name: 'idx_lorry_transit_details_placeStatus_date',
        using: 'BTREE',
        order: [['placeStatus', 'ASC'], ['placeDate', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_placeStatus_date');
      
      await queryInterface.addIndex('lorry_transit_details', ['placeStatus', 'created_at'], {
        name: 'idx_lorry_transit_details_placeStatus_created',
        using: 'BTREE',
        order: [['placeStatus', 'ASC'], ['created_at', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_placeStatus_created');
      
      // Foreign key indexes for JOIN optimization
      await queryInterface.addIndex('lorry_transit_details', ['physical_inspection_id'], {
        name: 'idx_lorry_transit_details_physical_inspection_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_physical_inspection_id');
      
      await queryInterface.addIndex('lorry_transit_details', ['sample_entry_id'], {
        name: 'idx_lorry_transit_details_sample_entry_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_sample_entry_id');
      
      await queryInterface.addIndex('lorry_transit_details', ['millWbId'], {
        name: 'idx_lorry_transit_details_millWbId',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_millWbId');
      
      await queryInterface.addIndex('lorry_transit_details', ['placeKunchinittuId'], {
        name: 'idx_lorry_transit_details_placeKunchinittuId',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_placeKunchinittuId');
      
      await queryInterface.addIndex('lorry_transit_details', ['placeWarehouseId'], {
        name: 'idx_lorry_transit_details_placeWarehouseId',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_placeWarehouseId');
      
      await queryInterface.addIndex('lorry_transit_details', ['outturnId'], {
        name: 'idx_lorry_transit_details_outturnId',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_outturnId');
      
      // ============================================
      // INVENTORY QUALITY PARAMETERS - INDEXES
      // ============================================
      
      await queryInterface.addIndex('inventory_quality_parameters', ['lorry_transit_detail_id'], {
        name: 'idx_inventory_quality_lorry_transit_detail_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_inventory_quality_lorry_transit_detail_id');
      
      await queryInterface.addIndex('inventory_quality_parameters', ['status'], {
        name: 'idx_inventory_quality_status',
        using: 'BTREE'
      });
      console.log('  ✅ idx_inventory_quality_status');
      
      await queryInterface.addIndex('inventory_quality_parameters', ['created_at'], {
        name: 'idx_inventory_quality_created_desc',
        using: 'BTREE',
        order: [['created_at', 'DESC']]
      });
      console.log('  ✅ idx_inventory_quality_created_desc');
      
      console.log('✅ All performance indexes added successfully!');
      
    } catch (error) {
      // If index already exists, log warning but continue
      if (error.message && error.message.includes('already exists')) {
        console.log('⚠️  Some indexes already exist, skipping...');
      } else {
        console.error('❌ Error adding indexes:', error.message);
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing performance indexes...');
    
    try {
      // Remove all indexes in reverse order
      const indexes = [
        'idx_inventory_quality_created_desc',
        'idx_inventory_quality_status',
        'idx_inventory_quality_lorry_transit_detail_id',
        'idx_lorry_transit_details_outturnId',
        'idx_lorry_transit_details_placeWarehouseId',
        'idx_lorry_transit_details_placeKunchinittuId',
        'idx_lorry_transit_details_millWbId',
        'idx_lorry_transit_details_sample_entry_id',
        'idx_lorry_transit_details_physical_inspection_id',
        'idx_lorry_transit_details_placeStatus_created',
        'idx_lorry_transit_details_placeStatus_date',
        'idx_lorry_transit_details_created_desc',
        'idx_lorry_transit_details_placeDate_desc',
        'idx_lorry_transit_details_wbStatus',
        'idx_lorry_transit_details_placeStatus'
      ];
      
      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('lorry_transit_details', indexName);
          console.log(`  ✅ Removed ${indexName}`);
        } catch (err) {
          // Index might not exist, continue
          console.log(`  ⚠️  ${indexName} not found, skipping...`);
        }
      }
      
      // Remove inventory quality indexes
      const iqIndexes = ['idx_inventory_quality_created_desc', 'idx_inventory_quality_status', 'idx_inventory_quality_lorry_transit_detail_id'];
      for (const indexName of iqIndexes) {
        try {
          await queryInterface.removeIndex('inventory_quality_parameters', indexName);
          console.log(`  ✅ Removed ${indexName}`);
        } catch (err) {
          console.log(`  ⚠️  ${indexName} not found, skipping...`);
        }
      }
      
      console.log('✅ All indexes removed successfully!');
      
    } catch (error) {
      console.error('❌ Error removing indexes:', error.message);
      throw error;
    }
  }
};
