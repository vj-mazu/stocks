'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('weight_bridges', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            grossWeight: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: true,
                field: 'gross_weight',
            },
            tareWeight: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: true,
                field: 'tare_weight',
            },
            netWeight: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: true,
                field: 'net_weight',
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                field: 'is_active',
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                field: 'created_at',
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                field: 'updated_at',
            },
            createdBy: {
                type: Sequelize.INTEGER,
                allowNull: true,
                field: 'created_by',
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
        });

        await queryInterface.addIndex('weight_bridges', ['name'], {
            name: 'weight_bridges_name_idx',
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('weight_bridges');
    },
};
