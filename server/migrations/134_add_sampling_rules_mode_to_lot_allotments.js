'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add sampling_rules_mode column to lot_allotments table if it does not exist
    const tableInfo = await queryInterface.describeTable('lot_allotments');
    if (!tableInfo.sampling_rules_mode) {
      await queryInterface.addColumn('lot_allotments', 'sampling_rules_mode', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'old'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('lot_allotments');
    if (tableInfo.sampling_rules_mode) {
      await queryInterface.removeColumn('lot_allotments', 'sampling_rules_mode');
    }
  }
};
