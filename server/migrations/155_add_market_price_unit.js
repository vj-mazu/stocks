'use strict';

/**
 * Migration 155: Add market_price_unit column to sample_entry_offerings
 *
 * market_price_unit stores the unit chosen for the Market Price
 * informational field (per_quintal / per_kg / lumps). Default: lumps.
 * It is NEVER used in any calculation, patti linking, dispute, or revision logic.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Migration 155: Adding market_price_unit column...');

    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE sample_entry_offerings ADD COLUMN IF NOT EXISTS "market_price_unit" VARCHAR(20) DEFAULT 'lumps'`
      );
      console.log('    + market_price_unit');
    } catch (err) {
      console.log(`    ! market_price_unit: ${err.message.substring(0, 80)}`);
    }

    console.log('Migration 155: Done');
  },

  down: async () => {}
};
