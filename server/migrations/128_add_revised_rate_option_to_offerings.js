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
    await ensureColumn(
      queryInterface,
      'sample_entry_offerings',
      'revised_rate_option',
      { type: SequelizeLib.STRING(20), allowNull: true, defaultValue: 'final' }
    );
  },

  async down(queryInterface = sequelize.getQueryInterface()) {
    await queryInterface.removeColumn('sample_entry_offerings', 'revised_rate_option').catch(() => {});
  }
};
