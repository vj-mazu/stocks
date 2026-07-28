const { sequelize } = require('../config/database');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const usersInfo = await queryInterface.describeTable('users');
      if (!usersInfo.sub_role) {
        await queryInterface.addColumn('users', 'sub_role', {
          type: Sequelize.STRING(50),
          allowNull: true
        });
        console.log('✅ Added sub_role column to users table');
      }
    } catch (error) {
      console.error('Migration 136 error:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('users', 'sub_role');
    } catch (error) {
      console.error('Migration rollback error:', error.message);
    }
  }
};
