const { sequelize } = require('./config/database');

async function checkColumns() {
  try {
    const cols = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'sample_entries' 
       AND (column_name LIKE '%serial%' OR column_name LIKE '%sl%')`,
      { type: require('sequelize').QueryTypes.SELECT }
    );
    console.log('SL/Serial columns:', cols);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkColumns();
