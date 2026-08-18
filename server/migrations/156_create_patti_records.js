'use strict';

/**
 * Migration 156: Create patti_records table (for Completed Lots → Patti feature)
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
 * so it is safe on both fresh databases and existing ones where the table
 * may have been created without the lorry_packagings column.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Migration 156: Ensuring patti_records table exists...');

    // 1. Create table if it doesn't exist (covers fresh deploys)
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "patti_records" (
        "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
        "sample_entry_id" UUID NOT NULL UNIQUE,
        "hamali_rate"    DECIMAL(10,2) NOT NULL DEFAULT 12.00,
        "hamali_amount"  DECIMAL(12,2) NOT NULL,
        "brokerage_rate" DECIMAL(10,2) NOT NULL DEFAULT 11.00,
        "brokerage_amount" DECIMAL(12,2) NOT NULL,
        "less_df"        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        "less_wb"        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        "total_amount"   DECIMAL(15,2) NOT NULL,
        "grand_total"    DECIMAL(15,2) NOT NULL,
        "lorry_packagings" JSONB,
        "created_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY ("sample_entry_id") REFERENCES "sample_entries"("id") ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);

    // 2. Add any missing columns (covers existing tables that were created without them)
    const columns = [
      { name: 'lorry_packagings', type: 'JSONB' }
    ];

    for (const col of columns) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE "patti_records" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
        );
        console.log(`    + ${col.name}`);
      } catch (err) {
        console.log(`    ! ${col.name}: ${err.message.substring(0, 80)}`);
      }
    }

    // 3. Ensure index on sample_entry_id
    try {
      await queryInterface.addIndex('patti_records', ['sample_entry_id']);
    } catch (err) {
      // Index already exists — ignore
    }

    console.log('Migration 156: patti_records table ensured');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('patti_records');
  }
};
