'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add pending Weight Bridge columns
    await queryInterface.addColumn('arrivals', 'wbInputType', {
      type: Sequelize.ENUM('mill', 'party'),
      allowNull: true
    });
    await queryInterface.addColumn('arrivals', 'millWbId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'weight_bridges', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('arrivals', 'partyWbName', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn('arrivals', 'wbStatus', {
      type: Sequelize.ENUM('none', 'pending', 'approved', 'rejected'),
      defaultValue: 'none',
      allowNull: false
    });
    await queryInterface.addColumn('arrivals', 'wbRejectReason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Add pending Place columns
    await queryInterface.addColumn('arrivals', 'placeType', {
      type: Sequelize.ENUM('production', 'kunchinittu'),
      allowNull: true
    });
    await queryInterface.addColumn('arrivals', 'placeWarehouseId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'warehouses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('arrivals', 'placeKunchinittuId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'kunchinittus', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('arrivals', 'placeDate', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('arrivals', 'placeStatus', {
      type: Sequelize.ENUM('none', 'pending', 'approved', 'rejected'),
      defaultValue: 'none',
      allowNull: false
    });
    await queryInterface.addColumn('arrivals', 'placeRejectReason', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('arrivals', 'wbInputType');
    await queryInterface.removeColumn('arrivals', 'millWbId');
    await queryInterface.removeColumn('arrivals', 'partyWbName');
    await queryInterface.removeColumn('arrivals', 'wbStatus');
    await queryInterface.removeColumn('arrivals', 'wbRejectReason');

    await queryInterface.removeColumn('arrivals', 'placeType');
    await queryInterface.removeColumn('arrivals', 'placeWarehouseId');
    await queryInterface.removeColumn('arrivals', 'placeKunchinittuId');
    await queryInterface.removeColumn('arrivals', 'placeDate');
    await queryInterface.removeColumn('arrivals', 'placeStatus');
    await queryInterface.removeColumn('arrivals', 'placeRejectReason');
  }
};
