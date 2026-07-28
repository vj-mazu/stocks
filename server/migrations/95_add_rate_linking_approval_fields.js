'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add pending rate linking fields
    await queryInterface.addColumn('sample_entry_offerings', 'pending_rate_linking_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('sample_entry_offerings', 'pending_rate_linking_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sample_entry_offerings', 'pending_rate_linking_status');
    await queryInterface.removeColumn('sample_entry_offerings', 'pending_rate_linking_data');
  }
};
