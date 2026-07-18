const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryQualityParameter = sequelize.define('InventoryQualityParameter', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  lorryTransitDetailId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'lorry_transit_detail_id',
    references: {
      model: 'lorry_transit_details',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('lot_avg', 'full_lorry_avg'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  moisture: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  dryMoisture: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'dry_moisture'
  },
  cutting: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  bend: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  grains: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  mix: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  sMix: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 's_mix'
  },
  lMix: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'l_mix'
  },
  kandu: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  oil: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  sk: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  wbR: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'wb_r'
  },
  wbBk: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'wb_bk'
  },
  wbT: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'wb_t'
  },
  smell: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  paddyWb: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'paddy_wb'
  },
  pColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'p_color'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reportedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'reported_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'approved_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  rejectReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'reject_reason'
  }
}, {
  tableName: 'inventory_quality_parameters',
  underscored: true
});

InventoryQualityParameter.associate = (models) => {
  InventoryQualityParameter.belongsTo(models.LorryTransitDetail, {
    foreignKey: 'lorryTransitDetailId',
    as: 'lorryTransitDetail'
  });

  InventoryQualityParameter.belongsTo(models.User, {
    foreignKey: 'reportedByUserId',
    as: 'reporter'
  });

  InventoryQualityParameter.belongsTo(models.User, {
    foreignKey: 'approvedByUserId',
    as: 'approver'
  });
};

module.exports = InventoryQualityParameter;
