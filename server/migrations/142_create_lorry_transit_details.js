'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lorry_transit_details', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      physical_inspection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'physical_inspections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sample_entry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'sample_entries',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      wbInputType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        field: 'wbInputType'
      },
      millWbId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'millWbId',
        references: {
          model: 'weight_bridges',
          key: 'id'
        }
      },
      partyWbName: {
        type: Sequelize.STRING(255),
        allowNull: true,
        field: 'partyWbName'
      },
      wbNo: {
        type: Sequelize.STRING(100),
        allowNull: true,
        field: 'wbNo'
      },
      grossWeight: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        field: 'grossWeight'
      },
      tareWeight: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        field: 'tareWeight'
      },
      netWeight: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        field: 'netWeight'
      },
      wbStatus: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'none',
        field: 'wbStatus'
      },
      wbRejectReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'wbRejectReason'
      },
      placeType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        field: 'placeType'
      },
      placeWarehouseId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'placeWarehouseId',
        references: {
          model: 'warehouses',
          key: 'id'
        }
      },
      placeKunchinittuId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'placeKunchinittuId',
        references: {
          model: 'kunchinittus',
          key: 'id'
        }
      },
      placeDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        field: 'placeDate'
      },
      placeStatus: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'none',
        field: 'placeStatus'
      },
      placeRejectReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'placeRejectReason'
      },
      outturnId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'outturnId',
        references: {
          model: 'outturns',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('lorry_transit_details', ['physical_inspection_id']);
    await queryInterface.addIndex('lorry_transit_details', ['sample_entry_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('lorry_transit_details');
  }
};
