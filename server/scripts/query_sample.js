const { sequelize } = require('../config/database');
const SampleEntry = require('../models/SampleEntry');
const User = require('../models/User');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    const id = '673bd56a-ba06-4d7a-a62f-db6a4993b27d';
    const entry = await SampleEntry.findByPk(id);
    if (!entry) {
      console.log(`Entry with ID ${id} not found in this database.`);
      const count = await SampleEntry.count();
      console.log(`Total sample entries in database: ${count}`);
      return;
    }

    console.log('--- Sample Entry Details ---');
    console.log(JSON.stringify(entry.toJSON(), null, 2));

    // Also look up users
    const users = await User.findAll({ attributes: ['id', 'username', 'fullName', 'role', 'staffType'] });
    console.log('\n--- Users in database ---');
    console.log(JSON.stringify(users, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
