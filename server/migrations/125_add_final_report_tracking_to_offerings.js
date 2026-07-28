/**
 * Migration 125: Add final report tracking fields to sample_entry_offerings
 */

const { sequelize } = require('../config/database');

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    console.log('🔄 Migration 125: Adding final report tracking fields to sample_entry_offerings...');
    
    // Check if columns already exist to prevent errors
    const tableInfo = await queryInterface.describeTable('sample_entry_offerings');
    
    if (!tableInfo.final_reported_by) {
      await queryInterface.addColumn('sample_entry_offerings', 'final_reported_by', {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true,
        comment: 'Name of person who reported the final price'
      });
    }

    if (!tableInfo.final_reported_at) {
      await queryInterface.addColumn('sample_entry_offerings', 'final_reported_at', {
        type: sequelize.Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when the price was finalized'
      });
    }
    
    console.log('✅ Migration 125 completed successfully');
    
  } catch (error) {
    console.error('❌ Migration 125 error:', error.message);
    throw error;
  }
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  
  try {
    console.log('🔄 Rolling back Migration 125...');
    await queryInterface.removeColumn('sample_entry_offerings', 'final_reported_by');
    await queryInterface.removeColumn('sample_entry_offerings', 'final_reported_at');
    console.log('✅ Migration 125 rolled back successfully');
  } catch (error) {
    console.error('❌ Migration 125 rollback error:', error.message);
    throw error;
  }
}

module.exports = { up, down };
