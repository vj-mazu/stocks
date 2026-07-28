const { sequelize } = require('../config/database');

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const tableInfo = await queryInterface.describeTable(tableName);
  if (!tableInfo[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

module.exports = {
  async up(queryInterface = sequelize.getQueryInterface(), SequelizeLib = sequelize.Sequelize) {
    const columns = [
      ['pending_manager_value_approval_status', { type: SequelizeLib.STRING(20), allowNull: true }],
      ['pending_manager_value_approval_data', { type: SequelizeLib.JSONB, allowNull: true }],
      ['pending_manager_value_approval_requested_by', { type: SequelizeLib.INTEGER, allowNull: true }],
      ['pending_manager_value_approval_requested_at', { type: SequelizeLib.DATE, allowNull: true }],
      ['pending_manager_value_approval_approved_by', { type: SequelizeLib.INTEGER, allowNull: true }],
      ['pending_manager_value_approval_approved_at', { type: SequelizeLib.DATE, allowNull: true }]
    ];

    for (const [columnName, definition] of columns) {
      await ensureColumn(queryInterface, 'sample_entry_offerings', columnName, definition);
    }
  }
};
