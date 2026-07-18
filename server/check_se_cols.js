const { sequelize } = require('./config/database');

async function main() {
  try {
    const tableDesc = await sequelize.getQueryInterface().describeTable('sample_entries');
    console.log(JSON.stringify(Object.keys(tableDesc), null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
