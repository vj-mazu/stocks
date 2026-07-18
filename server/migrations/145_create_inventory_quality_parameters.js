'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Creating inventory_quality_parameters table...');
    
    try {
      await queryInterface.createTable('inventory_quality_parameters', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        lorry_transit_detail_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'lorry_transit_details',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.STRING(50), // We will use String to store 'lot_avg' and 'full_lorry_avg' safely
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50), // We will use String to store status ('pending', 'approved', 'rejected') safely
          defaultValue: 'pending',
          allowNull: false
        },
        moisture: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        dry_moisture: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        cutting: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        bend: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        grains: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        mix: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        s_mix: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        l_mix: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        kandu: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        oil: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        sk: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        wb_r: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        wb_bk: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        wb_t: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        smell: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        paddy_wb: {
          type: Sequelize.STRING(30),
          allowNull: true
        },
        p_color: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        remarks: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        reported_by_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        approved_by_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        reject_reason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE
        }
      });
      console.log('✅ inventory_quality_parameters table created successfully!');
    } catch (error) {
      console.error('❌ Failed to create inventory_quality_parameters table:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⏪ Dropping inventory_quality_parameters table...');
    try {
      await queryInterface.dropTable('inventory_quality_parameters');
      console.log('✅ inventory_quality_parameters table dropped successfully!');
    } catch (error) {
      console.error('❌ Failed to drop inventory_quality_parameters table:', error);
      throw error;
    }
  }
};
