/**
 * Test to check if API endpoints include millWb data
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testApiIncludesMillWb() {
  try {
    console.log('🔍 Testing if API includes Mill WB data...\n');

    // Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('✅ Logged in as admin\n');

    // Test 1: Check /by-role endpoint (Physical Inspection status)
    console.log('Test 1: GET /api/sample-entries/by-role?status=PHYSICAL_INSPECTION');
    const byRoleRes = await axios.get(`${API_URL}/sample-entries/by-role`, {
      params: {
        status: 'PHYSICAL_INSPECTION',
        pageSize: 1
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    const entries = byRoleRes.data.entries || [];
    if (entries.length > 0) {
      const entry = entries[0];
      console.log('📊 Sample Entry ID:', entry.id);
      console.log('📊 Has millWb?', entry.millWb ? '✅ YES' : '❌ NO');
      console.log('📊 Has millWbId?', entry.millWbId ? '✅ YES' : '❌ NO');
      console.log('📊 Has wbNo?', entry.wbNo ? '✅ YES' : '❌ NO');
      
      if (entry.millWb) {
        console.log('📊 millWb.name:', entry.millWb.name);
        console.log('📊 millWb.location:', entry.millWb.location);
      } else {
        console.log('❌ Mill WB data is NOT included in the response!');
      }
    } else {
      console.log('⚠️ No entries found with status=PHYSICAL_INSPECTION');
    }

    console.log('\n');

    // Test 2: Check transit-approvals endpoint
    console.log('Test 2: GET /api/arrivals/transit-approvals/pending');
    const transitRes = await axios.get(`${API_URL}/arrivals/transit-approvals/pending`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const transitEntries = transitRes.data.arrivals || transitRes.data.data || [];
    if (transitEntries.length > 0) {
      const entry = transitEntries[0];
      console.log('📊 Transit Entry ID:', entry.id);
      console.log('📊 Has millWb?', entry.millWb ? '✅ YES' : '❌ NO');
      console.log('📊 Has millWeightBridge?', entry.millWeightBridge ? '✅ YES' : '❌ NO');
      console.log('📊 Has millWbId?', entry.millWbId ? '✅ YES' : '❌ NO');
      
      if (entry.millWb) {
        console.log('📊 millWb.name:', entry.millWb.name);
        console.log('📊 millWb.location:', entry.millWb.location);
      } else if (entry.millWeightBridge) {
        console.log('📊 millWeightBridge.name:', entry.millWeightBridge.name);
        console.log('📊 millWeightBridge.location:', entry.millWeightBridge.location);
      } else {
        console.log('❌ Mill WB data is NOT included in the response!');
      }
    } else {
      console.log('⚠️ No pending transit approvals found');
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('CONCLUSION:');
    console.log('If millWb data is missing, the API endpoint needs to be fixed.');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testApiIncludesMillWb();
