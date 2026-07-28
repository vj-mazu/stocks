'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('sample_entries', 'wbNo', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'grossWeight', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'tareWeight', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'netWeight', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeColumn('sample_entries', 'wbNo'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'grossWeight'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'tareWeight'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'netWeight'); } catch (e) {}
  }
};
