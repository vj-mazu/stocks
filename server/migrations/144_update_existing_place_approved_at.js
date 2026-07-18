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
      // Update LorryTransitDetail records where placeStatus is approved but place_approved_at is NULL
      const [affectedRows] = await queryInterface.sequelize.query(`
        UPDATE lorry_transit_details 
        SET place_approved_at = COALESCE(place_approved_at, updated_at, created_at)
        WHERE "placeStatus" = 'approved' 
          AND place_approved_at IS NULL;
      `);
      
      console.log(`✅ Updated ${affectedRows} lorry transit detail records with placeApprovedAt`);
      
      const [arrivalColumns] = await queryInterface.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'arrivals'
          AND column_name = 'placeApprovedAt';
      `);

      if (arrivalColumns.length > 0) {
        const [affectedArrivals] = await queryInterface.sequelize.query(`
          UPDATE arrivals
          SET "placeApprovedAt" = COALESCE("placeApprovedAt", "updatedAt", "createdAt")
          WHERE "placeStatus" = 'approved'
            AND "placeApprovedAt" IS NULL;
        `);

        console.log(`✅ Updated ${affectedArrivals} arrival records with placeApprovedAt`);
      } else {
        console.log('ℹ️ arrivals.placeApprovedAt does not exist; skipped legacy arrivals timestamp backfill');
      }
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
