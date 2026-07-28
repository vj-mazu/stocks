const { sequelize } = require('../config/database');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 1. Warehouses: Add short_cut_name
      const warehousesInfo = await queryInterface.describeTable('warehouses');
      if (!warehousesInfo.short_cut_name) {
        await queryInterface.addColumn('warehouses', 'short_cut_name', {
          type: Sequelize.STRING(50),
          allowNull: true
        });
        console.log('✅ Added short_cut_name column to warehouses');
      }

      // 2. Brokers: Add phone_number
      const brokersInfo = await queryInterface.describeTable('brokers');
      if (!brokersInfo.phone_number) {
        await queryInterface.addColumn('brokers', 'phone_number', {
          type: Sequelize.STRING(20),
          allowNull: true
        });
        console.log('✅ Added phone_number column to brokers');
      }

      // 3. User Role: Add 'ceo' enum value (PostgreSQL specific type alteration)
      // Check if enum value exists first using pg_enum
      const [results] = await sequelize.query(`
        SELECT count(*) 
        FROM pg_enum 
        WHERE enumlabel = 'ceo' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
      `);

      if (results && results[0] && parseInt(results[0].count) === 0) {
        // Run raw query because Sequelize migrations don't natively support enum alterations well
        await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE 'ceo'`);
        console.log('✅ Added "ceo" to enum_users_role type');
      } else {
        console.log('ℹ️ "ceo" already exists in enum_users_role');
      }
    } catch (error) {
      console.error('Migration error:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Note: Deleting enum values in PostgreSQL is complex, usually not done in down migrations
    try {
      await queryInterface.removeColumn('warehouses', 'short_cut_name');
      await queryInterface.removeColumn('brokers', 'phone_number');
    } catch (error) {
      console.error('Migration rollback error:', error.message);
    }
  }
};
