const { sequelize } = require('../config/database');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add 'md' enum value to users.role (PostgreSQL specific type alteration)
      const [results] = await sequelize.query(`
        SELECT count(*) 
        FROM pg_enum 
        WHERE enumlabel = 'md' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
      `);

      if (results && results[0] && parseInt(results[0].count) === 0) {
        // Run raw query because Sequelize migrations don't natively support enum alterations well
        await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE 'md'`);
        console.log('✅ Added "md" to enum_users_role type');
      } else {
        console.log('ℹ️ "md" already exists in enum_users_role');
      }
    } catch (error) {
      console.error('Migration error:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Note: Deleting enum values in PostgreSQL is complex, usually not done in down migrations
    console.log('ℹ️ Skipping down migration for enum_users_role md value');
  }
};
