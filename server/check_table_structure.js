const { sequelize } = require('./config/database');

async function checkTable() {
  try {
    const result = await sequelize.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'lorry_transit_details' 
       ORDER BY ordinal_position`,
      { type: require('sequelize').QueryTypes.SELECT }
    );
    console.log('All columns in lorry_transit_details:');
    result.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTable();
