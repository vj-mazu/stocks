const { sequelize } = require('../config/database');
const User = require('../models/User');

async function main() {
  try {
    await sequelize.authenticate();
    const user = await User.findOne({
      attributes: ['username', 'fullName'],
      raw: true
    });
    console.log('Result with raw: true:');
    console.log(user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
