const { sequelize } = require('./config/database');

async function main() {
  try {
    const results = await sequelize.query(`
      SELECT id, physical_inspection_id, sample_entry_id, "wbNo", "grossWeight", "tareWeight", "netWeight", "placeStatus", "wbStatus"
      FROM lorry_transit_details
      WHERE "placeStatus" = 'approved'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log(JSON.stringify(results[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
