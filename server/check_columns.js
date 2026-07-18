const { sequelize } = require('./config/database');

async function checkColumns() {
  try {
    const cols = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'lorry_transit_details' 
       AND column_name IN ('place_approved_by', 'place_approved_at', 'wb_approved_by', 'wb_approved_at')`,
      { type: require('sequelize').QueryTypes.SELECT }
    );
    console.log('Columns found:', cols);
    if (cols.length === 4) {
      console.log('✅ All 4 columns exist!');
    } else {
      console.log(`❌ Only ${cols.length} columns found, expected 4`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkColumns();
