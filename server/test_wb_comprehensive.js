/**
 * Comprehensive Test Suite for WB Endpoint
 * Tests all scenarios: Mill WB only, Party WB only, Both together
 */

const axios = require('axios');
const models = require('./models');
const { sequelize } = require('./config/database');
const PhysicalInspection = models.PhysicalInspection;
const LorryTransitDetail = models.LorryTransitDetail;
const SampleEntry = models.SampleEntry;
const WeightBridge = models.WeightBridge;

const API_URL = 'http://localhost:5000/api';
let authToken = null;

// Helper function to login
async function login() {
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    authToken = loginRes.data.token;
    console.log('✅ Logged in as admin\n');
    return true;
  } catch (err) {
    console.log('❌ Login failed:', err.response?.data?.error || err.message);
    return false;
  }
}

// Helper function to create a test entry
async function createTestEntry() {
  const inspection = await PhysicalInspection.findOne({
    where: {},
    order: [['createdAt', 'DESC']],
    include: [{
      model: SampleEntry,
      as: 'sampleEntry',
      required: true
    }]
  });

  if (!inspection) {
    throw new Error('No PhysicalInspection found');
  }

  // Delete existing LorryTransitDetail to start fresh
  await LorryTransitDetail.destroy({
    where: { physicalInspectionId: inspection.id }
  });

  // Create new LorryTransitDetail
  const detail = await LorryTransitDetail.create({
    physicalInspectionId: inspection.id,
    sampleEntryId: inspection.sampleEntryId,
    placeStatus: 'none',
    wbStatus: 'none'
  });

  return { inspection, detail };
}

// Helper function to get Mill WB
async function getMillWb() {
  const millWb = await WeightBridge.findOne({
    order: [['id', 'ASC']]
  });
  if (!millWb) {
    throw new Error('No Weight Bridge found');
  }
  return millWb;
}

// Test 1: Mill WB Only (Party WB = NO)
async function testMillWbOnly() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 1: Mill WB Only (partyWbEnabled = "no")');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { inspection, detail } = await createTestEntry();
  const millWb = await getMillWb();

  const testData = {
    wbInputType: 'mill',
    millWbId: millWb.id,
    wbNo: 'MILL-ONLY-' + Date.now(),
    grossWeight: 50000,
    tareWeight: 8000,
    netWeight: 42000,
    sute: 500,
    wbDate: new Date().toISOString().split('T')[0],
    partyWbEnabled: 'no'  // NO Party WB
  };

  console.log('📤 Sending Mill WB only (partyWbEnabled=no)');

  try {
    const response = await axios.post(
      `${API_URL}/arrivals/${detail.id}/wb`,
      testData,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Response:', response.data.message);
  } catch (error) {
    console.log('❌ Request failed:', error.response?.data?.error || error.message);
    return false;
  }

  // Verify
  await detail.reload();

  const millWbSaved = detail.millWbId && detail.grossWeight && detail.wbNo === testData.wbNo;
  const partyWbNotSaved = !detail.partyWbName && !detail.partyGrossWeight;

  console.log('\n📊 Verification:');
  console.log('   Mill WB Saved:', millWbSaved ? '✅ YES' : '❌ NO');
  console.log('   - millWbId:', detail.millWbId);
  console.log('   - wbNo:', detail.wbNo);
  console.log('   - grossWeight:', detail.grossWeight);
  console.log('   Party WB Not Saved:', partyWbNotSaved ? '✅ YES (correct)' : '❌ NO (wrong)');
  console.log('   - partyWbName:', detail.partyWbName || 'null');
  console.log('   - partyGrossWeight:', detail.partyGrossWeight || 'null');

  if (millWbSaved && partyWbNotSaved) {
    console.log('\n🎉 TEST 1 PASSED\n');
    return true;
  } else {
    console.log('\n❌ TEST 1 FAILED\n');
    return false;
  }
}

// Test 2: Mill WB + Party WB Together (Party WB = YES)
async function testMillAndPartyWbTogether() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Mill WB + Party WB Together (partyWbEnabled = "yes")');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { inspection, detail } = await createTestEntry();
  const millWb = await getMillWb();

  const testData = {
    wbInputType: 'mill',
    millWbId: millWb.id,
    wbNo: 'MILL-' + Date.now(),
    grossWeight: 50000,
    tareWeight: 8000,
    netWeight: 42000,
    sute: 500,
    wbDate: new Date().toISOString().split('T')[0],
    
    partyWbEnabled: 'yes',  // YES Party WB
    partyWbName: 'Party WB Test',
    partyWbNo: 'PARTY-' + Date.now(),
    partyGrossWeight: 51000,
    partyTareWeight: 8500,
    partyNetWeight: 42500,
    partySute: 600,
    partyWbDate: new Date().toISOString().split('T')[0]
  };

  console.log('📤 Sending Mill WB + Party WB (partyWbEnabled=yes)');
  console.log('   Mill WB No:', testData.wbNo);
  console.log('   Party WB No:', testData.partyWbNo);

  try {
    const response = await axios.post(
      `${API_URL}/arrivals/${detail.id}/wb`,
      testData,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Response:', response.data.message);
  } catch (error) {
    console.log('❌ Request failed:', error.response?.data?.error || error.message);
    return false;
  }

  // Verify LorryTransitDetail
  await detail.reload();

  const millWbSaved = detail.millWbId && detail.wbNo === testData.wbNo && detail.grossWeight == testData.grossWeight;
  const partyWbSaved = detail.partyWbName === testData.partyWbName && 
                       detail.partyWbNo === testData.partyWbNo &&
                       detail.partyGrossWeight == testData.partyGrossWeight;

  // Verify SampleEntry
  const sampleEntry = await SampleEntry.findByPk(detail.sampleEntryId);
  const partyWbSynced = sampleEntry.partyWbName === testData.partyWbName &&
                        sampleEntry.wbNo === testData.partyWbNo &&
                        sampleEntry.grossWeight == testData.partyGrossWeight;

  console.log('\n📊 Verification - LorryTransitDetail:');
  console.log('   Mill WB Saved:', millWbSaved ? '✅ YES' : '❌ NO');
  console.log('   - millWbId:', detail.millWbId, '(expected:', millWb.id, ')');
  console.log('   - wbNo:', detail.wbNo, '(expected:', testData.wbNo, ')');
  console.log('   - grossWeight:', detail.grossWeight, '(expected:', testData.grossWeight, ')');
  
  console.log('\n   Party WB Saved:', partyWbSaved ? '✅ YES' : '❌ NO');
  console.log('   - partyWbName:', detail.partyWbName, '(expected:', testData.partyWbName, ')');
  console.log('   - partyWbNo:', detail.partyWbNo, '(expected:', testData.partyWbNo, ')');
  console.log('   - partyGrossWeight:', detail.partyGrossWeight, '(expected:', testData.partyGrossWeight, ')');
  console.log('   - partyTareWeight:', detail.partyTareWeight, '(expected:', testData.partyTareWeight, ')');
  console.log('   - partySute:', detail.partySute, '(expected:', testData.partySute, ')');

  console.log('\n📊 Verification - SampleEntry Sync:');
  console.log('   Party WB Synced:', partyWbSynced ? '✅ YES' : '❌ NO');
  console.log('   - partyWbName:', sampleEntry.partyWbName, '(expected:', testData.partyWbName, ')');
  console.log('   - wbNo:', sampleEntry.wbNo, '(expected:', testData.partyWbNo, ')');
  console.log('   - grossWeight:', sampleEntry.grossWeight, '(expected:', testData.partyGrossWeight, ')');

  if (millWbSaved && partyWbSaved && partyWbSynced) {
    console.log('\n🎉 TEST 2 PASSED\n');
    return true;
  } else {
    console.log('\n❌ TEST 2 FAILED\n');
    return false;
  }
}

// Test 3: Party WB Only (wbInputType = 'party')
async function testPartyWbOnly() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Party WB Only (wbInputType = "party")');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { inspection, detail } = await createTestEntry();

  const testData = {
    wbInputType: 'party',
    partyWbName: 'Party Only WB',
    wbNo: 'PARTY-ONLY-' + Date.now(),
    grossWeight: 51000,
    tareWeight: 8500,
    netWeight: 42500,
    sute: 600,
    wbDate: new Date().toISOString().split('T')[0]
  };

  console.log('📤 Sending Party WB only (wbInputType=party)');

  try {
    const response = await axios.post(
      `${API_URL}/arrivals/${detail.id}/wb`,
      testData,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Response:', response.data.message);
  } catch (error) {
    console.log('❌ Request failed:', error.response?.data?.error || error.message);
    return false;
  }

  // Verify
  await detail.reload();
  const sampleEntry = await SampleEntry.findByPk(detail.sampleEntryId);

  const partyWbSavedInDetail = detail.partyWbName === testData.partyWbName && 
                                detail.wbNo === testData.wbNo;
  const partyWbSavedInSample = sampleEntry.partyWbName === testData.partyWbName &&
                                sampleEntry.wbNo === testData.wbNo;
  const millWbNotSaved = !detail.millWbId;

  console.log('\n📊 Verification:');
  console.log('   Party WB Saved in LorryTransitDetail:', partyWbSavedInDetail ? '✅ YES' : '❌ NO');
  console.log('   - partyWbName:', detail.partyWbName);
  console.log('   - wbNo:', detail.wbNo);
  console.log('   Party WB Saved in SampleEntry:', partyWbSavedInSample ? '✅ YES' : '❌ NO');
  console.log('   - partyWbName:', sampleEntry.partyWbName);
  console.log('   Mill WB Not Saved:', millWbNotSaved ? '✅ YES (correct)' : '❌ NO (wrong)');
  console.log('   - millWbId:', detail.millWbId || 'null');

  if (partyWbSavedInDetail && partyWbSavedInSample && millWbNotSaved) {
    console.log('\n🎉 TEST 3 PASSED\n');
    return true;
  } else {
    console.log('\n❌ TEST 3 FAILED\n');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     WB ENDPOINT COMPREHENSIVE TEST SUITE                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Login first
    const loggedIn = await login();
    if (!loggedIn) {
      console.log('❌ Cannot run tests without authentication');
      return;
    }

    const results = [];

    // Run all tests
    results.push({ name: 'Mill WB Only', passed: await testMillWbOnly() });
    results.push({ name: 'Mill + Party WB Together', passed: await testMillAndPartyWbTogether() });
    results.push({ name: 'Party WB Only', passed: await testPartyWbOnly() });

    // Summary
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    results.forEach((result, index) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`Test ${index + 1}: ${result.name} - ${status}`);
    });

    const allPassed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    console.log('\n' + '═'.repeat(63));
    if (allPassed) {
      console.log(`🎉 ALL TESTS PASSED (${passedCount}/${totalCount})`);
    } else {
      console.log(`⚠️  SOME TESTS FAILED (${passedCount}/${totalCount} passed)`);
    }
    console.log('═'.repeat(63) + '\n');

  } catch (error) {
    console.error('❌ Test suite failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Run the tests
runAllTests();
