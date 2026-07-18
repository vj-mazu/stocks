const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');


const WeightBridge = sequelize.define('WeightBridge', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    grossWeight: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'gross_weight',
    },
    tareWeight: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'tare_weight',
    },
    netWeight: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: 'net_weight',
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
    },
}, {
    tableName: 'weight_bridges',
    timestamps: true,
    underscored: true,
    indexes: [
        { name: 'weight_bridges_name_idx', fields: ['name'] },
    ],
});

WeightBridge.associate = (models) => {
    WeightBridge.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
};

module.exports = WeightBridge;
