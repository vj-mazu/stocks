const { sequelize } = require('../config/database');

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
  const tableInfo = await queryInterface.describeTable(tableName);
  if (!tableInfo[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
    console.log(`✅ Added column: ${columnName} to ${tableName}`);
  } else {
    console.log(`⏩ Column already exists: ${columnName} in ${tableName}`);
  }
};

module.exports = {
  async up(queryInterface = sequelize.getQueryInterface(), SequelizeLib = sequelize.Sequelize) {
    const columns = [
      ['dispute_base_rate', { type: SequelizeLib.DECIMAL(10, 2), allowNull: true }],
      ['dispute_base_rate_type', { type: SequelizeLib.STRING(20), allowNull: true }],
      ['revised_hamali', { type: SequelizeLib.DECIMAL(10, 2), allowNull: true }],
      ['revised_lf', { type: SequelizeLib.DECIMAL(10, 2), allowNull: true }]
    ];

    for (const [columnName, definition] of columns) {
      await ensureColumn(queryInterface, 'sample_entry_offerings', columnName, definition);
    }
  },

  async down(queryInterface = sequelize.getQueryInterface()) {
    const columns = ['dispute_base_rate', 'dispute_base_rate_type', 'revised_hamali', 'revised_lf'];
    for (const col of columns) {
      await queryInterface.removeColumn('sample_entry_offerings', col).catch(() => {});
    }
  }
};
