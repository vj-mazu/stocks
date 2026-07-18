const { Sequelize } = require('sequelize');
require('dotenv').config();

const sanitizeDatabaseUrl = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

let dbUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);

const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      }
    })
  : new Sequelize({
      database: process.env.DB_NAME || 'mother_india',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '12345',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgresql',
      logging: false
    });

async function main() {
  try {
    const results = await sequelize.query(`
      SELECT pi.id, pi.lorry_number, pi.cutting1, pi.cutting2, pi.sample_entry_id,
             se.cutting as se_cutting, se.variety, se.party_name
      FROM physical_inspections pi
      LEFT JOIN sample_entries se ON pi.sample_entry_id = se.id
      ORDER BY pi.created_at DESC
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
