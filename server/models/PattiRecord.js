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
  hamaliUnit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'per_bag',
    field: 'hamali_unit'
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
  brokerageUnit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'per_qtl',
    field: 'brokerage_unit'
  },
  brokerageAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'brokerage_amount'
  },
  lfRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'lf_rate'
  },
  lfUnit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'per_bag',
    field: 'lf_unit'
  },
  lfAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'lf_amount'
  },
  customAdditions: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    field: 'custom_additions'
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
  customDeductions: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    field: 'custom_deductions'
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
  avgWbPerBag: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'avg_wb_per_bag'
  },
  avgRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'avg_rate'
  },
  lorryPackagings: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'lorry_packagings'
  },
  pattiMode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'mill',
    field: 'patti_mode'
  },
  partyPatti: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
    field: 'party_patti'
  }
}, {
  tableName: 'patti_records',
  underscored: true
});

// Auto-migration helper for new columns
const runPattiAutoMigration = async () => {
  try {
    const queries = [
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS hamali_unit VARCHAR(20) DEFAULT 'per_bag';`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS brokerage_unit VARCHAR(20) DEFAULT 'per_qtl';`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS lf_rate DECIMAL(10, 2) DEFAULT 0.00;`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS lf_unit VARCHAR(20) DEFAULT 'per_bag';`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS lf_amount DECIMAL(12, 2) DEFAULT 0.00;`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS custom_additions JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS custom_deductions JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS avg_wb_per_bag DECIMAL(10, 2);`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS avg_rate DECIMAL(10, 2);`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS patti_mode VARCHAR(20) DEFAULT 'mill';`,
      `ALTER TABLE patti_records ADD COLUMN IF NOT EXISTS party_patti JSONB;`
    ];
    for (const q of queries) {
      await sequelize.query(q).catch(() => {});
    }
  } catch (err) {
    console.error('PattiRecord migration notice:', err?.message || err);
  }
};

setTimeout(() => {
  runPattiAutoMigration();
}, 2000);

PattiRecord.associate = (models) => {
  PattiRecord.belongsTo(models.SampleEntry, {
    foreignKey: 'sampleEntryId',
    as: 'sampleEntry'
  });
};

module.exports = PattiRecord;
