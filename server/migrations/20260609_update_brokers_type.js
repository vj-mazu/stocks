const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Create ENUM type first in postgres
      await queryInterface.sequelize.query(`CREATE TYPE "enum_brokers_type" AS ENUM('paddy', 'rice', 'both');`);
      console.log('✅ Created enum_brokers_type ENUM successfully');
    } catch (e) {
      console.log('ℹ️ ENUM enum_brokers_type might already exist, skipping creation: ', e.message);
    }
    
    // Add column type
    try {
      await queryInterface.addColumn('brokers', 'type', {
        type: Sequelize.ENUM('paddy', 'rice', 'both'),
        allowNull: false,
        defaultValue: 'both'
      });
      console.log('✅ Added type column to brokers table');
    } catch (e) {
      console.log('ℹ️ type column might already exist, skipping: ', e.message);
    }

    // Remove description column
    try {
      await queryInterface.removeColumn('brokers', 'description');
      console.log('✅ Removed description column from brokers table');
    } catch (e) {
      console.log('ℹ️ description column might not exist or already removed: ', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Add description back
    try {
      await queryInterface.addColumn('brokers', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Added description column back to brokers table');
    } catch (e) {
      console.log('Error adding description column back:', e.message);
    }

    // Remove column type
    try {
      await queryInterface.removeColumn('brokers', 'type');
      console.log('✅ Removed type column from brokers table');
    } catch (e) {
      console.log('Error removing type column:', e.message);
    }

    // Drop ENUM type
    try {
      await queryInterface.sequelize.query(`DROP TYPE "enum_brokers_type";`);
      console.log('✅ Dropped enum_brokers_type ENUM');
    } catch (e) {
      console.log('Error dropping ENUM:', e.message);
    }
  }
};
