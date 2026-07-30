/**
 * Test script for WB endpoint - Testing Mill WB + Party WB together
 * Tests the POST /:id/wb endpoint with both Mill and Party WB data
 */

const axios = require('axios');
const models = require('./models');
const { sequelize } = require('./config/database');
const PhysicalInspection = models.PhysicalInspection;
const LorryTransitDetail = models.LorryTransitDetail;
const SampleEntry = models.SampleEntry;
const WeightBridge = models.WeightBridge;

const API_URL = 'http://localhost:5000/api';

async function testWbBoth() {
  try {
    console.log('🔍 Testing WB Endpoint - Mill WB + Party WB Together...\n');

    // 1. Find a PhysicalInspection record
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
      console.log('❌ No PhysicalInspection found. Create one first.');
      return;
    }

    console.log('✅ Found PhysicalInspection:', inspection.id);
    console.log('   Sample Entry ID:', inspection.sampleEntryId);
    console.log('   Lorry Number:', inspection.lorryNumber);

    // 2. Check if LorryTransitDetail exists, create if not
    let detail = await LorryTransitDetail.findOne({ 
      where: { physicalInspectionId: inspection.id } 
    });

    if (!detail) {
      console.log('📝 Creating LorryTransitDetail...');
      detail = await LorryTransitDetail.create({
        physicalInspectionId: inspection.id,
        sampleEntryId: inspection.sampleEntryId,
        placeStatus: 'none'
      });
      console.log('✅ LorryTransitDetail created:', detail.id);
    } else {
      console.log('✅ LorryTransitDetail exists:', detail.id);
    }

    // 3. Get a Mill Weight Bridge
    const millWb = await WeightBridge.findOne({
      order: [['id', 'ASC']]
    });

    if (!millWb) {
      console.log('❌ No Mill Weight Bridge found. Create one first.');
      return;
    }

    console.log('✅ Found Mill Weight Bridge:', millWb.id, '-', millWb.name);

    // 4. Prepare test data - BOTH Mill WB AND Party WB
    const testData = {
      // Mill WB data
      wbInputType: 'mill',
      millWbId: millWb.id,
      wbNo: 'TEST-WB-' + Date.now(),
      grossWeight: 50000,
      tareWeight: 8000,
      netWeight: 42000,
      sute: 500,
      wbDate: new Date().toISOString().split('T')[0],
      
      // Party WB flag and data
      partyWbEnabled: 'yes',
      partyWbName: 'Test Party WB',
      partyWbNo: 'PARTY-WB-' + Date.now(),
      partyGrossWeight: 51000,
      partyTareWeight: 8500,
      partyNetWeight: 42500,
      partySute: 600,
      partyWbDate: new Date().toISOString().split('T')[0]
    };

    console.log('\n📤 Sending request with data:');
    console.log('   Mill WB ID:', testData.millWbId);
    console.log('   Mill WB No:', testData.wbNo);
    console.log('   Mill Gross:', testData.grossWeight);
    console.log('   Mill Tare:', testData.tareWeight);
    console.log('   Mill Net:', testData.netWeight);
    console.log('   Mill Sute:', testData.sute);
    console.log('   Party WB Enabled:', testData.partyWbEnabled);
    console.log('   Party WB Name:', testData.partyWbName);
    console.log('   Party WB No:', testData.partyWbNo);
    console.log('   Party Gross:', testData.partyGrossWeight);
    console.log('   Party Tare:', testData.partyTareWeight);
    console.log('   Party Net:', testData.partyNetWeight);
    console.log('   Party Sute:', testData.partySute);

    // 5. Get auth token (assuming admin user exists)
    let token;
    try {
      const loginRes = await axios.post(`${API_URL}/auth/login`, {
        username: 'admin',
        password: 'admin123'
      });
      token = loginRes.data.token;
      console.log('\n✅ Logged in as admin');
    } catch (err) {
      console.log('❌ Login failed. Using test without auth...');
    }

    // 6. Test the WB endpoint
    console.log('\n🚀 Calling POST /api/arrivals/' + detail.id + '/wb');
    
    try {
      const response = await axios.post(
        `${API_URL}/arrivals/${detail.id}/wb`,
        testData,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      console.log('\n✅ SUCCESS Response:');
      console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
      console.log('\n❌ ERROR Response:');
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('   Error:', error.message);
      }
      
      // Continue to check database anyway
    }

    // 7. Check database to see what was actually saved
    console.log('\n📊 Checking database after save...');
    
    await detail.reload();
    
    console.log('\n🔍 LorryTransitDetail values:');
    console.log('   wbInputType:', detail.wbInputType);
    console.log('   millWbId:', detail.millWbId);
    console.log('   wbNo:', detail.wbNo);
    console.log('   grossWeight:', detail.grossWeight);
    console.log('   tareWeight:', detail.tareWeight);
    console.log('   netWeight:', detail.netWeight);
    console.log('   sute:', detail.sute);
    console.log('   suteNetWeight:', detail.suteNetWeight);
    console.log('   wbStatus:', detail.wbStatus);
    console.log('   ---');
    console.log('   partyWbEnabled:', detail.partyWbEnabled);
    console.log('   partyWbName:', detail.partyWbName);
    console.log('   partyWbNo:', detail.partyWbNo);
    console.log('   partyGrossWeight:', detail.partyGrossWeight);
    console.log('   partyTareWeight:', detail.partyTareWeight);
    console.log('   partyNetWeight:', detail.partyNetWeight);
    console.log('   partySute:', detail.partySute);
    console.log('   partySuteNetWeight:', detail.partySuteNetWeight);

    // 8. Check SampleEntry to see if Party WB was synced
    const sampleEntry = await SampleEntry.findByPk(inspection.sampleEntryId);
    
    console.log('\n🔍 SampleEntry values (should have Party WB):');
    console.log('   partyWbName:', sampleEntry.partyWbName);
    console.log('   wbNo:', sampleEntry.wbNo);
    console.log('   grossWeight:', sampleEntry.grossWeight);
    console.log('   tareWeight:', sampleEntry.tareWeight);
    console.log('   netWeight:', sampleEntry.netWeight);
    console.log('   wbStatus:', sampleEntry.wbStatus);

    // 9. Validation
    console.log('\n✅ VALIDATION RESULTS:');
    
    const millWbSaved = detail.millWbId && detail.grossWeight && detail.tareWeight;
    const partyWbSaved = detail.partyWbName && detail.partyGrossWeight && detail.partyTareWeight;
    const partyWbSyncedToSampleEntry = sampleEntry.partyWbName && sampleEntry.grossWeight;
    
    console.log('   Mill WB Saved:', millWbSaved ? '✅ YES' : '❌ NO');
    console.log('   Party WB Saved in LorryTransitDetail:', partyWbSaved ? '✅ YES' : '❌ NO');
    console.log('   Party WB Synced to SampleEntry:', partyWbSyncedToSampleEntry ? '✅ YES' : '❌ NO');
    
    if (millWbSaved && partyWbSaved && partyWbSyncedToSampleEntry) {
      console.log('\n🎉 TEST PASSED - Both Mill WB and Party WB saved correctly!');
    } else {
      console.log('\n❌ TEST FAILED - Something is not saving properly:');
      if (!millWbSaved) console.log('   - Mill WB data is missing');
      if (!partyWbSaved) console.log('   - Party WB data is missing in LorryTransitDetail');
      if (!partyWbSyncedToSampleEntry) console.log('   - Party WB data is missing in SampleEntry');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testWbBoth();
