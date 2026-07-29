'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Migration 148: Adding all missing columns...');

    // ── lorry_transit_details: columns present in model but missing from migration 142 ──
    const ltdColumns = [
      { name: 'sute', type: 'DECIMAL(15, 2)' },
      { name: 'suteNetWeight', type: 'DECIMAL(15, 2)' },
      { name: 'partyWbEnabled', type: 'VARCHAR(10)' },
      { name: 'wbDate', type: 'DATE' },
      { name: 'wb_added_by', type: 'INTEGER' },
      { name: 'wb_added_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'place_approved_by', type: 'INTEGER' },
      { name: 'place_approved_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'wb_approved_by', type: 'INTEGER' },
      { name: 'wb_approved_at', type: 'TIMESTAMP WITH TIME ZONE' }
    ];

    console.log('  ── lorry_transit_details ──');
    for (const col of ltdColumns) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE lorry_transit_details ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        );
        console.log(`    + ${col.name}`);
      } catch (err) {
        console.log(`    ! ${col.name}: ${err.message.substring(0, 80)}`);
      }
    }

    // ── sample_entry_offerings: Final Rate 2 columns ──
    const seoColumns = [
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

    console.log('  ── sample_entry_offerings ──');
    for (const col of seoColumns) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE sample_entry_offerings ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        );
        console.log(`    + ${col.name}`);
      } catch (err) {
        console.log(`    ! ${col.name}: ${err.message.substring(0, 80)}`);
      }
    }

    console.log('Migration 148: Done');
  },

  down: async () => {}
};
