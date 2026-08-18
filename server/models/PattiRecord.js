const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PattiRecord = sequelize.define('PattiRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sampleEntryId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'sample_entry_id',
    references: {
      model: 'sample_entries',
      key: 'id'
    }
  },
  hamaliRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 12.00,
    field: 'hamali_rate'
  },
  hamaliAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'hamali_amount'
  },
  brokerageRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 11.00,
    field: 'brokerage_rate'
  },
  brokerageAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'brokerage_amount'
  },
  lessDf: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'less_df'
  },
  lessWb: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'less_wb'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    field: 'total_amount'
  },
  grandTotal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    field: 'grand_total'
  },
  lorryPackagings: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'lorry_packagings'
  }
}, {
  tableName: 'patti_records',
  underscored: true
});

PattiRecord.associate = (models) => {
  PattiRecord.belongsTo(models.SampleEntry, {
    foreignKey: 'sampleEntryId',
    as: 'sampleEntry'
  });
};

module.exports = PattiRecord;
