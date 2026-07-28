/**
 * Migration 999: Make Weight Bridge Fields Optional
 * 
 * Makes wbNo, grossWeight, tareWeight, and netWeight nullable in arrivals table
 * to support workflow where Place approval can happen without Weight Bridge submission.
 * 
 * This fixes the critical bug where Place approval fails when Weight Bridge is not submitted.
 * The workflow requires WB to be optional in In-Transit stage but mandatory in Band Malal Book stage.
 */

const { sequelize } = require('../config/database');

async function up() {
  try {
    console.log('🔄 Migration 999: Making Weight Bridge fields optional in arrivals...');

    // 1. Make wbNo nullable with default 'PENDING'
    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "wbNo" DROP NOT NULL
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "wbNo" SET DEFAULT 'PENDING'
    `);

    console.log('✅ wbNo column now allows NULL with default "PENDING"');

    // 2. Make grossWeight nullable with default 0
    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "grossWeight" DROP NOT NULL
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "grossWeight" SET DEFAULT 0
    `);

    console.log('✅ grossWeight column now allows NULL with default 0');

    // 3. Make tareWeight nullable with default 0
    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "tareWeight" DROP NOT NULL
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "tareWeight" SET DEFAULT 0
    `);

    console.log('✅ tareWeight column now allows NULL with default 0');

    // 4. Make netWeight nullable with default 0
    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "netWeight" DROP NOT NULL
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "netWeight" SET DEFAULT 0
    `);

    console.log('✅ netWeight column now allows NULL with default 0');

    // 5. Update existing NULL or empty records with defaults
    const updateResult = await sequelize.query(`
      UPDATE arrivals 
      SET 
        "wbNo" = COALESCE(NULLIF("wbNo", ''), 'PENDING'),
        "grossWeight" = COALESCE("grossWeight", 0),
        "tareWeight" = COALESCE("tareWeight", 0),
        "netWeight" = COALESCE("netWeight", 0)
      WHERE "wbNo" IS NULL 
         OR "wbNo" = ''
         OR "grossWeight" IS NULL 
         OR "tareWeight" IS NULL 
         OR "netWeight" IS NULL
    `);

    console.log(`✅ Updated ${updateResult[1]?.rowCount || 0} existing records with defaults`);

    console.log('✅ Migration 999: Weight Bridge fields are now optional');

  } catch (error) {
    console.error('❌ Migration 999 error:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

async function down() {
  try {
    console.log('🔄 Rolling back Migration 999...');
    console.log('⚠️  Warning: This will fail if any records have NULL Weight Bridge values');

    // Ensure no NULL values exist before making fields required
    const nullCheck = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM arrivals
      WHERE "wbNo" IS NULL 
         OR "grossWeight" IS NULL 
         OR "tareWeight" IS NULL 
         OR "netWeight" IS NULL
    `, { type: sequelize.QueryTypes.SELECT });

    if (nullCheck[0].count > 0) {
      throw new Error(
        `Cannot rollback: ${nullCheck[0].count} records have NULL Weight Bridge values. ` +
        'Update or delete these records before rolling back.'
      );
    }

    // 1. Remove defaults and make fields required again
    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "wbNo" DROP DEFAULT
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "wbNo" SET NOT NULL
    `);

    console.log('✅ wbNo column is now required (NOT NULL)');

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "grossWeight" DROP DEFAULT
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "grossWeight" SET NOT NULL
    `);

    console.log('✅ grossWeight column is now required (NOT NULL)');

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "tareWeight" DROP DEFAULT
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "tareWeight" SET NOT NULL
    `);

    console.log('✅ tareWeight column is now required (NOT NULL)');

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "netWeight" DROP DEFAULT
    `);

    await sequelize.query(`
      ALTER TABLE arrivals
      ALTER COLUMN "netWeight" SET NOT NULL
    `);

    console.log('✅ netWeight column is now required (NOT NULL)');

    console.log('✅ Migration 999: Rolled back successfully');

  } catch (error) {
    console.error('❌ Migration 999 rollback error:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = { up, down };
