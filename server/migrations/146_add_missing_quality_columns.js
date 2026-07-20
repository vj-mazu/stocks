'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Checking and adding missing columns in inventory_quality_parameters...');
    
    // Add missing columns if they don't exist
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_quality_parameters 
      ADD COLUMN IF NOT EXISTS wb_r VARCHAR(30),
      ADD COLUMN IF NOT EXISTS wb_bk VARCHAR(30),
      ADD COLUMN IF NOT EXISTS wb_t VARCHAR(30),
      ADD COLUMN IF NOT EXISTS reject_reason TEXT
    `);
    
    console.log('✅ Columns checked/added successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Optional down migration
  }
};
