'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('lorry_transit_details', 'place_added_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    console.log('✅ Added place_added_by to lorry_transit_details');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lorry_transit_details', 'place_added_by');
    console.log('✅ Removed place_added_by from lorry_transit_details');
  }
};
