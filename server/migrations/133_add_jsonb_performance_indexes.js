'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add GIN indexes for JSONB columns to optimize nested JSON query performance
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sample_entry_offerings_dispute_versions_gin ON sample_entry_offerings USING gin (dispute_versions);
      CREATE INDEX IF NOT EXISTS sample_entry_offerings_pending_mgr_queue_gin ON sample_entry_offerings USING gin (pending_manager_value_approval_queue);
      CREATE INDEX IF NOT EXISTS sample_entry_offerings_pending_mgr_data_gin ON sample_entry_offerings USING gin (pending_manager_value_approval_data);
      CREATE INDEX IF NOT EXISTS physical_inspections_sampling_stages_gin ON physical_inspections USING gin (sampling_stages);
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS sample_entry_offerings_dispute_versions_gin;
      DROP INDEX IF EXISTS sample_entry_offerings_pending_mgr_queue_gin;
      DROP INDEX IF EXISTS sample_entry_offerings_pending_mgr_data_gin;
      DROP INDEX IF EXISTS physical_inspections_sampling_stages_gin;
    `);
  }
};
