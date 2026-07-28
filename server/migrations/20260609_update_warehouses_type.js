const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query(`CREATE TYPE "enum_warehouses_type" AS ENUM('mill', 'outside');`);
      console.log('✅ Created enum_warehouses_type ENUM successfully');
    } catch (e) {
      console.log('ℹ️ ENUM enum_warehouses_type might already exist, skipping creation: ', e.message);
    }

    try {
      await queryInterface.addColumn('warehouses', 'type', {
        type: Sequelize.ENUM('mill', 'outside'),
        allowNull: false,
        defaultValue: 'mill'
      });
      console.log('✅ Added type column to warehouses table');
    } catch (e) {
      console.log('ℹ️ type column might already exist, skipping: ', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('warehouses', 'type');
      console.log('✅ Removed type column from warehouses table');
    } catch (e) {
      console.log('Error removing type column:', e.message);
    }

    try {
      await queryInterface.sequelize.query(`DROP TYPE "enum_warehouses_type";`);
      console.log('✅ Dropped enum_warehouses_type ENUM');
    } catch (e) {
      console.log('Error dropping ENUM:', e.message);
    }
  }
};
