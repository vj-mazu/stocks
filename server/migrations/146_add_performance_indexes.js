'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Adding performance indexes for millions of records...');
    
    try {
      // ============================================
      // LORRY TRANSIT DETAILS - CRITICAL INDEXES
      // ============================================
      
      // Index on placeStatus (most important - used in In-Transit and Band Malal Book filters)
      await queryInterface.addIndex('lorry_transit_details', ['place_status'], {
        name: 'idx_lorry_transit_details_place_status',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_place_status');
      
      // Index on wbStatus (used for filtering WB pending/approved entries)
      await queryInterface.addIndex('lorry_transit_details', ['wb_status'], {
        name: 'idx_lorry_transit_details_wb_status',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_wb_status');
      
      // Index on placeDate DESC (used for sorting in Band Malal Book)
      await queryInterface.addIndex('lorry_transit_details', ['place_date'], {
        name: 'idx_lorry_transit_details_place_date_desc',
        using: 'BTREE',
        order: [['place_date', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_place_date_desc');
      
      // Index on createdAt DESC (used for sorting in In-Transit)
      await queryInterface.addIndex('lorry_transit_details', ['created_at'], {
        name: 'idx_lorry_transit_details_created_desc',
        using: 'BTREE',
        order: [['created_at', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_created_desc');
      
      // Composite index on placeStatus + placeDate (optimizes Band Malal Book query)
      await queryInterface.addIndex('lorry_transit_details', ['place_status', 'place_date'], {
        name: 'idx_lorry_transit_details_place_status_date',
        using: 'BTREE',
        order: [['place_status', 'ASC'], ['place_date', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_place_status_date');
      
      // Composite index on placeStatus + createdAt (optimizes In-Transit query)
      await queryInterface.addIndex('lorry_transit_details', ['place_status', 'created_at'], {
        name: 'idx_lorry_transit_details_place_status_created',
        using: 'BTREE',
        order: [['place_status', 'ASC'], ['created_at', 'DESC']]
      });
      console.log('  ✅ idx_lorry_transit_details_place_status_created');
      
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
      
      await queryInterface.addIndex('lorry_transit_details', ['mill_wb_id'], {
        name: 'idx_lorry_transit_details_mill_wb_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_mill_wb_id');
      
      await queryInterface.addIndex('lorry_transit_details', ['place_kunchinittu_id'], {
        name: 'idx_lorry_transit_details_place_kunchinittu_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_place_kunchinittu_id');
      
      await queryInterface.addIndex('lorry_transit_details', ['place_warehouse_id'], {
        name: 'idx_lorry_transit_details_place_warehouse_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_place_warehouse_id');
      
      await queryInterface.addIndex('lorry_transit_details', ['outturn_id'], {
        name: 'idx_lorry_transit_details_outturn_id',
        using: 'BTREE'
      });
      console.log('  ✅ idx_lorry_transit_details_outturn_id');
      
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
        'idx_lorry_transit_details_outturn_id',
        'idx_lorry_transit_details_place_warehouse_id',
        'idx_lorry_transit_details_place_kunchinittu_id',
        'idx_lorry_transit_details_mill_wb_id',
        'idx_lorry_transit_details_sample_entry_id',
        'idx_lorry_transit_details_physical_inspection_id',
        'idx_lorry_transit_details_place_status_created',
        'idx_lorry_transit_details_place_status_date',
        'idx_lorry_transit_details_created_desc',
        'idx_lorry_transit_details_place_date_desc',
        'idx_lorry_transit_details_wb_status',
        'idx_lorry_transit_details_place_status'
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
