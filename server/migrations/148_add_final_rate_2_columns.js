'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration 148: Ensuring all Final Rate 2 columns exist...');

    const columns = [
      { name: 'final_base_rate_2', type: 'DECIMAL(10, 2)' },
      { name: 'final_sute_2', type: 'DECIMAL(10, 2)' },
      { name: 'final_sute_unit_2', type: 'VARCHAR(20)' },
      { name: 'final_price_2', type: 'DECIMAL(10, 2)' },
      { name: 'hamali_2', type: 'DECIMAL(10, 2)' },
      { name: 'hamali_unit_2', type: 'VARCHAR(20)' },
      { name: 'brokerage_2', type: 'DECIMAL(10, 2)' },
      { name: 'brokerage_unit_2', type: 'VARCHAR(20)' },
      { name: 'lf_2', type: 'DECIMAL(10, 2)' },
      { name: 'lf_unit_2', type: 'VARCHAR(20)' },
      { name: 'egb_value_2', type: 'DECIMAL(10, 2)' },
      { name: 'egb_type_2', type: 'VARCHAR(20)' },
      { name: 'cd_value_2', type: 'DECIMAL(10, 2)' },
      { name: 'cd_unit_2', type: 'VARCHAR(20)' },
      { name: 'bank_loan_value_2', type: 'DECIMAL(10, 2)' },
      { name: 'bank_loan_unit_2', type: 'VARCHAR(20)' },
      { name: 'payment_condition_value_2', type: 'DECIMAL(10, 2)' },
      { name: 'payment_condition_unit_2', type: 'VARCHAR(20)' },
      { name: 'final_remarks_2', type: 'TEXT' },
      { name: 'is_finalized_2', type: 'BOOLEAN DEFAULT false' },
      { name: 'final_reported_by_2', type: 'VARCHAR(100)' },
      { name: 'final_reported_at_2', type: 'TIMESTAMP WITH TIME ZONE' }
    ];

    for (const col of columns) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE sample_entry_offerings ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        );
        console.log(`  ✅ ${col.name}`);
      } catch (err) {
        console.log(`  ⚠️  ${col.name}: ${err.message}`);
      }
    }

    console.log('✅ Migration 148: Final Rate 2 columns ensured');
  },

  down: async (queryInterface, Sequelize) => {
  }
};
