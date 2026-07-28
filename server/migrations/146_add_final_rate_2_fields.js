/**
 * Migration: Add Final Rate 2 fields to sample_entry_offerings
 * 
 * Adds columns for storing a second final rate (Final Rate 2) 
 * that can be set when closing a lot early.
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'sample_entry_offerings';
    
    const columns = [
      { name: 'final_base_rate_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'final_sute_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'final_sute_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'final_price_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'hamali_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'hamali_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'brokerage_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'brokerage_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'lf_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'lf_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'egb_value_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'egb_type_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'cd_value_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'cd_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'bank_loan_value_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'bank_loan_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'payment_condition_value_2', type: Sequelize.DECIMAL(10, 2), allowNull: true },
      { name: 'payment_condition_unit_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'final_remarks_2', type: Sequelize.TEXT, allowNull: true },
      { name: 'is_finalized_2', type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      { name: 'final_reported_by_2', type: Sequelize.STRING(100), allowNull: true },
      { name: 'final_reported_at_2', type: Sequelize.DATE, allowNull: true }
    ];

    for (const col of columns) {
      try {
        const tableInfo = await queryInterface.describeTable(tableName);
        if (!tableInfo[col.name]) {
          await queryInterface.addColumn(tableName, col.name, {
            type: col.type,
            allowNull: col.allowNull !== undefined ? col.allowNull : true,
            defaultValue: col.defaultValue
          });
          console.log(`✅ Added column ${col.name} to ${tableName}`);
        } else {
          console.log(`⏭️  Column ${col.name} already exists, skipping`);
        }
      } catch (err) {
        console.log(`⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableName = 'sample_entry_offerings';
    
    const columns = [
      'final_base_rate_2', 'final_sute_2', 'final_sute_unit_2', 'final_price_2',
      'hamali_2', 'hamali_unit_2', 'brokerage_2', 'brokerage_unit_2',
      'lf_2', 'lf_unit_2', 'egb_value_2', 'egb_type_2',
      'cd_value_2', 'cd_unit_2', 'bank_loan_value_2', 'bank_loan_unit_2',
      'payment_condition_value_2', 'payment_condition_unit_2',
      'final_remarks_2', 'is_finalized_2', 'final_reported_by_2', 'final_reported_at_2'
    ];

    for (const col of columns) {
      try {
        await queryInterface.removeColumn(tableName, col);
      } catch (err) {
        console.log(`⚠️  Error removing ${col}: ${err.message}`);
      }
    }
  }
};
