/**
 * Migration 147: Add missing indexes for inventory_quality_parameters and pg_trgm coverage
 *
 * Fixes gaps identified in architecture review:
 * 1. inventory_quality_parameters has zero indexes - full table scans on every query
 * 2. sample_entries.location and sample_entries.sample_collected_by use ILIKE '%value%'
 *    but lack pg_trgm GIN indexes (broker_name, variety, party_name already covered by migration 94)
 *
 * Safe to run multiple times (IF NOT EXISTS).
 */
const { sequelize } = require('../config/database');

module.exports = {
    async up() {
        const indexes = [
            `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

            `CREATE INDEX IF NOT EXISTS idx_sample_entries_location_trgm
       ON sample_entries USING gin (location gin_trgm_ops)`,

            `CREATE INDEX IF NOT EXISTS idx_sample_entries_collected_by_trgm
       ON sample_entries USING gin (sample_collected_by gin_trgm_ops)`,

            `CREATE INDEX IF NOT EXISTS idx_inv_quality_ltd_id
       ON inventory_quality_parameters (lorry_transit_detail_id)`,

            `CREATE INDEX IF NOT EXISTS idx_inv_quality_reported_by
       ON inventory_quality_parameters (reported_by_user_id)`,

            `CREATE INDEX IF NOT EXISTS idx_inv_quality_status
       ON inventory_quality_parameters (status)`,

            `CREATE INDEX IF NOT EXISTS idx_inv_quality_type_status
       ON inventory_quality_parameters (type, status)`,

            `CREATE INDEX IF NOT EXISTS idx_inv_quality_ltd_status
       ON inventory_quality_parameters (lorry_transit_detail_id, status)`
        ];

        for (const sql of indexes) {
            try {
                await sequelize.query(sql);
            } catch (err) {
                console.log(`  Index skip: ${err.message.substring(0, 80)}`);
            }
        }

        console.log('Migration 147: Missing indexes added (inventory_quality_parameters + pg_trgm coverage)');
    }
};
