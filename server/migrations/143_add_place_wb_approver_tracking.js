'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add place approver tracking fields
    await queryInterface.addColumn('lorry_transit_details', 'place_approved_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('lorry_transit_details', 'place_approved_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add WB approver tracking fields
    await queryInterface.addColumn('lorry_transit_details', 'wb_approved_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('lorry_transit_details', 'wb_approved_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    console.log('✅ Added place_approved_by, place_approved_at, wb_approved_by, wb_approved_at to lorry_transit_details');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lorry_transit_details', 'wb_approved_at');
    await queryInterface.removeColumn('lorry_transit_details', 'wb_approved_by');
    await queryInterface.removeColumn('lorry_transit_details', 'place_approved_at');
    await queryInterface.removeColumn('lorry_transit_details', 'place_approved_by');
    
    console.log('✅ Removed approver tracking columns from lorry_transit_details');
  }
};
