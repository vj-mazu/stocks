'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('sample_entries', 'outturnId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'outturns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('sample_entries', 'outturnId');
    } catch (e) {}
  }
};
