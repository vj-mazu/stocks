'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('physical_inspections', 'sampling_stages', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('physical_inspections', 'sampling_stages');
  }
};
