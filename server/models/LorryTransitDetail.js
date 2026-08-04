const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LorryTransitDetail = sequelize.define('LorryTransitDetail', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  physicalInspectionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'physical_inspection_id'
  },
  sampleEntryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'sample_entry_id'
  },
  wbInputType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'wbInputType'
  },
  millWbId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'millWbId'
  },
  partyWbName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'partyWbName'
  },
  wbNo: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'wbNo'
  },
  grossWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'grossWeight'
  },
  tareWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'tareWeight'
  },
  netWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'netWeight'
  },
  sute: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'sute'
  },
  suteNetWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'suteNetWeight'
  },
  partyWbEnabled: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'partyWbEnabled'
  },
  wbDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'wbDate'
  },
  partyGrossWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'partyGrossWeight'
  },
  partyTareWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'partyTareWeight'
  },
  partyNetWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'partyNetWeight'
  },
  partySute: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'partySute'
  },
  partySuteNetWeight: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    field: 'partySuteNetWeight'
  },
  partyWbNo: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'partyWbNo'
  },
  partyWbDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'partyWbDate'
  },
  wbAddedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'wb_added_by'
  },
  wbAddedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'wb_added_at'
  },
  wbStatus: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'none',
    field: 'wbStatus'
  },
  wbRejectReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'wbRejectReason'
  },
  placeType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'placeType'
  },
  placeWarehouseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'placeWarehouseId'
  },
  placeKunchinittuId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'placeKunchinittuId'
  },
  placeDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'placeDate'
  },
  placeStatus: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'none',
    field: 'placeStatus'
  },
  placeApprovedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'place_approved_by'
  },
  placeApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'place_approved_at'
  },
  placeRejectReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'placeRejectReason'
  },
  wbApprovedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'wb_approved_by'
  },
  wbApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'wb_approved_at'
  },
  outturnId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'outturnId'
  }
}, {
  tableName: 'lorry_transit_details',
  underscored: true
});

LorryTransitDetail.associate = (models) => {
  LorryTransitDetail.belongsTo(models.PhysicalInspection, {
    foreignKey: 'physicalInspectionId',
    as: 'physicalInspection'
  });
  LorryTransitDetail.belongsTo(models.SampleEntry, {
    foreignKey: 'sampleEntryId',
    as: 'sampleEntry'
  });
  LorryTransitDetail.belongsTo(models.Warehouse, {
    foreignKey: 'placeWarehouseId',
    as: 'placeWarehouse'
  });
  LorryTransitDetail.belongsTo(models.Kunchinittu, {
    foreignKey: 'placeKunchinittuId',
    as: 'placeKunchinittuData'
  });
  LorryTransitDetail.belongsTo(models.WeightBridge, {
    foreignKey: 'millWbId',
    as: 'millWeightBridge'
  });
  LorryTransitDetail.belongsTo(models.Outturn, {
    foreignKey: 'outturnId',
    as: 'outturn'
  });
  LorryTransitDetail.belongsTo(models.User, {
    foreignKey: 'placeApprovedBy',
    as: 'placeApprover'
  });
  LorryTransitDetail.belongsTo(models.User, {
    foreignKey: 'wbApprovedBy',
    as: 'wbApprover'
  });
  LorryTransitDetail.belongsTo(models.User, {
    foreignKey: 'wbAddedBy',
    as: 'wbAddedByUser'
  });
  if (models.InventoryQualityParameter) {
    LorryTransitDetail.hasMany(models.InventoryQualityParameter, {
      foreignKey: 'lorryTransitDetailId',
      as: 'inventoryQualityParameters'
    });
  }
};

module.exports = LorryTransitDetail;
