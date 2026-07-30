'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Running database repair migration 149...');
    
    // 1. Fix lorry_transit_details columns (add missing sute, weights, and tracking columns)
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE lorry_transit_details 
        ADD COLUMN IF NOT EXISTS sute DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "suteNetWeight" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partyWbEnabled" VARCHAR(10),
        ADD COLUMN IF NOT EXISTS "wbDate" DATE,
        ADD COLUMN IF NOT EXISTS wb_added_by INTEGER REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS wb_added_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "partyGrossWeight" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partyTareWeight" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partyNetWeight" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partySute" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partySuteNetWeight" DECIMAL(15, 2),
        ADD COLUMN IF NOT EXISTS "partyWbNo" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "partyWbDate" DATE;
      `);
      console.log('✅ Added sute, weights, and party columns to lorry_transit_details');
    } catch (err) {
      console.log('⚠️ Error altering lorry_transit_details columns:', err.message);
    }

    // 2. Fix inventory_quality_parameters columns (rename transit_detail_id to lorry_transit_detail_id if needed)
    try {
      const [results] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_quality_parameters' AND column_name = 'transit_detail_id';
      `);
      if (results && results.length > 0) {
        await queryInterface.sequelize.query(`
          ALTER TABLE inventory_quality_parameters 
          RENAME COLUMN transit_detail_id TO lorry_transit_detail_id;
        `);
        console.log('✅ Renamed transit_detail_id to lorry_transit_detail_id in inventory_quality_parameters');
      }
    } catch (err) {
      console.log('⚠️ Error renaming column in inventory_quality_parameters:', err.message);
    }

    // 3. Fix primary key ID type in inventory_quality_parameters (recreate as UUID if it is currently INTEGER)
    try {
      const [results] = await queryInterface.sequelize.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_quality_parameters' AND column_name = 'id';
      `);
      if (results && results.length > 0 && results[0].data_type === 'integer') {
        console.log('⚠️ inventory_quality_parameters.id is INTEGER. Recreating table to use UUID format...');
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS inventory_quality_parameters;`);
        
        // Recreate correctly using the proper migration file
        const createMigration = require('./145_create_inventory_quality_parameters');
        await createMigration.up(queryInterface, Sequelize);
        
        // Re-apply June 9 additions as well
        const June9Additions = require('./146_add_missing_quality_columns');
        await June9Additions.up(queryInterface, Sequelize);
        console.log('✅ Recreated inventory_quality_parameters table with UUID format');
      }
    } catch (err) {
      console.log('⚠️ Error fixing primary key ID type in inventory_quality_parameters:', err.message);
    }
    
    console.log('✅ Migration 149 completed successfully');
  },

  down: async (queryInterface, Sequelize) => {}
};
