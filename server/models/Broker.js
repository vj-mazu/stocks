const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Broker = sequelize.define('Broker', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('paddy', 'rice', 'both'),
    allowNull: false,
    defaultValue: 'both'
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'brokers',
  underscored: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['is_active'] }
  ]
});

module.exports = Broker;
