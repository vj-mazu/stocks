const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Migration: Adding linked_patti_rate columns and details to physical_inspections...');
      
      const tableInfo = await queryInterface.describeTable('physical_inspections');

      if (!tableInfo.linked_patti_rate) {
        await queryInterface.addColumn('physical_inspections', 'linked_patti_rate', {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: null
        });
        console.log('✅ Added linked_patti_rate column to physical_inspections');
      }

      const columnsToAdd = [
        { name: 'final_base_rate', type: DataTypes.DECIMAL(10, 2) },
        { name: 'final_base_rate_type', type: DataTypes.STRING(20) },
        { name: 'final_sute', type: DataTypes.DECIMAL(10, 2) },
        { name: 'final_sute_unit', type: DataTypes.STRING(20) },
        { name: 'moisture', type: DataTypes.DECIMAL(5, 2) },
        { name: 'revised_hamali', type: DataTypes.DECIMAL(10, 2) },
        { name: 'hamali_unit', type: DataTypes.STRING(20) },
        { name: 'revised_lf', type: DataTypes.DECIMAL(10, 2) },
        { name: 'lf_unit', type: DataTypes.STRING(20) }
      ];

      for (const col of columnsToAdd) {
        if (!tableInfo[col.name]) {
          await queryInterface.addColumn('physical_inspections', col.name, {
            type: col.type,
            allowNull: true,
            defaultValue: null
          });
          console.log(`✅ Added ${col.name} column to physical_inspections`);
        }
      }
    } catch (error) {
      console.error('⚠️ Error adding linked patti columns:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Optional rollback
  }
};
