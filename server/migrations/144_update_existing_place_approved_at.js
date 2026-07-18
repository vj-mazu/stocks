/**
 * Migration: Update existing place approved entries to set placeApprovedAt
 * 
 * This migration updates all existing entries that have placeStatus='approved'
 * but are missing placeApprovedAt timestamp.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Updating existing place approved entries with missing timestamps...');
    
    try {
      // Update LorryTransitDetail records where placeStatus is approved but placeApprovedAt is NULL
      const [affectedRows] = await queryInterface.sequelize.query(`
        UPDATE lorry_transit_details 
        SET "placeApprovedAt" = COALESCE("placeApprovedAt", "updatedAt", "createdAt")
        WHERE "placeStatus" = 'approved' 
          AND "placeApprovedAt" IS NULL;
      `);
      
      console.log(`✅ Updated ${affectedRows} lorry transit detail records with placeApprovedAt`);
      
      // Also update Arrival records if they exist (for backward compatibility)
      const [affectedArrivals] = await queryInterface.sequelize.query(`
        UPDATE arrivals 
        SET "placeApprovedAt" = COALESCE("placeApprovedAt", "updatedAt", "createdAt")
        WHERE "placeStatus" = 'approved' 
          AND "placeApprovedAt" IS NULL;
      `);
      
      console.log(`✅ Updated ${affectedArrivals} arrival records with placeApprovedAt`);
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⏪ Reverting place approved timestamp updates...');
    // This migration is a data fix, no need to revert
    console.log('✅ No revert needed for this migration');
  }
};
