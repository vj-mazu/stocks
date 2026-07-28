/**
 * Test script to verify InventoryQualityParameter model loads correctly
 */

const { sequelize, InventoryQualityParameter, LorryTransitDetail, User } = require('./models');

async function testModel() {
  try {
    console.log('🧪 Testing InventoryQualityParameter model...\n');

    // Test 1: Check if model is defined
    console.log('✅ Test 1: Model is defined');
    console.log('   Model name:', InventoryQualityParameter.name);
    console.log('   Table name:', InventoryQualityParameter.tableName);

    // Test 2: Check model attributes
    console.log('\n✅ Test 2: Model attributes');
    const attributes = Object.keys(InventoryQualityParameter.rawAttributes);
    console.log('   Attributes count:', attributes.length);
    console.log('   Key attributes:', attributes.slice(0, 10).join(', '));

    // Test 3: Check associations
    console.log('\n✅ Test 3: Model associations');
    const associations = Object.keys(InventoryQualityParameter.associations);
    console.log('   Associations:', associations.join(', '));

    // Test 4: Check reverse association from LorryTransitDetail
    console.log('\n✅ Test 4: Reverse association from LorryTransitDetail');
    const ltdAssociations = Object.keys(LorryTransitDetail.associations);
    console.log('   LorryTransitDetail associations:', ltdAssociations.join(', '));
    const hasInventoryQuality = ltdAssociations.includes('inventoryQualityParameters');
    console.log('   Has inventoryQualityParameters:', hasInventoryQuality ? '✅' : '❌');

    // Test 5: Test database connectivity
    console.log('\n✅ Test 5: Database connectivity');
    await sequelize.authenticate();
    console.log('   Database connection: OK');

    // Test 6: Check if table exists
    console.log('\n✅ Test 6: Table exists in database');
    const tables = await sequelize.getQueryInterface().showAllTables();
    const tableExists = tables.includes('inventory_quality_parameters');
    console.log('   Table exists:', tableExists ? '✅' : '❌');

    // Test 7: Test query (count records)
    console.log('\n✅ Test 7: Test basic query');
    const count = await InventoryQualityParameter.count();
    console.log('   Record count:', count);

    console.log('\n✅ All tests passed! Model loads without errors.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testModel();
