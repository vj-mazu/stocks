'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sample_entry_offerings', 'pending_manager_value_approval_queue', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sample_entry_offerings', 'pending_manager_value_approval_queue');
  }
};
