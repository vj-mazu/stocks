'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add pending Weight Bridge columns to sample_entries
    try {
      await queryInterface.addColumn('sample_entries', 'wbInputType', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'millWbId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'weight_bridges', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'partyWbName', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'wbStatus', {
        type: Sequelize.STRING(50),
        defaultValue: 'none',
        allowNull: false
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'wbRejectReason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    } catch (e) {}

    // Add pending Place columns to sample_entries
    try {
      await queryInterface.addColumn('sample_entries', 'placeType', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'placeWarehouseId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'placeKunchinittuId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'kunchinittus', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'placeDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'placeStatus', {
        type: Sequelize.STRING(50),
        defaultValue: 'none',
        allowNull: false
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('sample_entries', 'placeRejectReason', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try { await queryInterface.removeColumn('sample_entries', 'wbInputType'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'millWbId'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'partyWbName'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'wbStatus'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'wbRejectReason'); } catch (e) {}

    try { await queryInterface.removeColumn('sample_entries', 'placeType'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'placeWarehouseId'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'placeKunchinittuId'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'placeDate'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'placeStatus'); } catch (e) {}
    try { await queryInterface.removeColumn('sample_entries', 'placeRejectReason'); } catch (e) {}
  }
};
