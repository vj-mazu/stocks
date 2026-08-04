/**
 * Migration: Add Final Rate 2 approval fields to sample_entry_offerings
 *
 * Mirrors the existing Final Rate 1 manager-value approval mechanism for
 * Final Rate 2, fully isolated with a `_2` suffix so the two flows never clash.
 * Manager-submitted FR2 values sit in a pending queue until an admin approves
 * or rejects them; only then are the final `*_2` fields written.
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'sample_entry_offerings';

    const columns = [
      { name: 'final_base_rate_type_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'pending_manager_value_approval_status_2', type: Sequelize.STRING(20), allowNull: true },
      { name: 'pending_manager_value_approval_data_2', type: Sequelize.JSONB, allowNull: true },
      { name: 'pending_manager_value_approval_queue_2', type: Sequelize.JSONB, allowNull: true },
      { name: 'pending_manager_value_approval_requested_by_2', type: Sequelize.INTEGER, allowNull: true },
      { name: 'pending_manager_value_approval_requested_at_2', type: Sequelize.DATE, allowNull: true },
      { name: 'pending_manager_value_approval_approved_by_2', type: Sequelize.INTEGER, allowNull: true },
      { name: 'pending_manager_value_approval_approved_at_2', type: Sequelize.DATE, allowNull: true }
    ];

    for (const col of columns) {
      try {
        const tableInfo = await queryInterface.describeTable(tableName);
        if (!tableInfo[col.name]) {
          await queryInterface.addColumn(tableName, col.name, {
            type: col.type,
            allowNull: col.allowNull !== undefined ? col.allowNull : true,
            defaultValue: col.defaultValue
          });
          console.log(`✅ Added column ${col.name} to ${tableName}`);
        } else {
          console.log(`⏭️  Column ${col.name} already exists, skipping`);
        }
      } catch (err) {
        console.log(`⚠️  Error adding ${col.name}: ${err.message}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableName = 'sample_entry_offerings';

    const columns = [
      'final_base_rate_type_2',
      'pending_manager_value_approval_status_2',
      'pending_manager_value_approval_data_2',
      'pending_manager_value_approval_queue_2',
      'pending_manager_value_approval_requested_by_2',
      'pending_manager_value_approval_requested_at_2',
      'pending_manager_value_approval_approved_by_2',
      'pending_manager_value_approval_approved_at_2'
    ];

    for (const col of columns) {
      try {
        await queryInterface.removeColumn(tableName, col);
        console.log(`✅ Removed column ${col.name} from ${tableName}`);
      } catch (err) {
        console.log(`⚠️  Error removing ${col.name}: ${err.message}`);
      }
    }
  }
};
