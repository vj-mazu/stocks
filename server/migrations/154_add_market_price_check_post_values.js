'use strict';

/**
 * Migration 154: Add value columns to sample_entry_offerings
 *
 * market_price_value & check_post_value store the typed-in values
 * for the Market Price / Check Post informational fields.
 * They are NEVER used in any calculation, patti linking, dispute, or revision logic.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Migration 154: Adding market_price_value & check_post_value columns...');

    const columns = [
      { name: 'market_price_value', type: 'DECIMAL(10, 2)' },
      { name: 'check_post_value', type: 'VARCHAR(255)' }
    ];

    for (const col of columns) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE sample_entry_offerings ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        );
        console.log(`    + ${col.name}`);
      } catch (err) {
        console.log(`    ! ${col.name}: ${err.message.substring(0, 80)}`);
      }
    }

    console.log('Migration 154: Done');
  },

  down: async () => {}
};
