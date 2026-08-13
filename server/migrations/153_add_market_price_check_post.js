'use strict';

/**
 * Migration 153: Add informational columns to sample_entry_offerings
 *
 * market_price & check_post are stored for reference only —
 * they are NEVER used in any calculation, patti linking, dispute, or revision logic.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Migration 153: Adding market_price & check_post columns...');

    const columns = [
      { name: 'market_price', type: 'BOOLEAN DEFAULT false' },
      { name: 'check_post', type: 'BOOLEAN DEFAULT false' }
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

    console.log('Migration 153: Done');
  },

  down: async () => {}
};
