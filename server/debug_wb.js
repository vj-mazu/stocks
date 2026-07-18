const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { sequelize } = require('./config/database');
const PhysicalInspection = require('./models/PhysicalInspection');
const LorryTransitDetail = require('./models/LorryTransitDetail');
const SampleEntry = require('./models/SampleEntry');
const Arrival = require('./models/Arrival');

async function testWbSubmit() {
  const id = '214b4383-3fb0-43f5-9c4d-f9214eee7075';
  const body = {
    wbInputType: 'party',
    partyWbName: 'Test Party WB',
    wbNo: '12345',
    grossWeight: 50000,
    tareWeight: 15000,
    netWeight: 35000
  };
  
  try {
    const inspection = await PhysicalInspection.findByPk(id);
    console.log('Inspection found:', !!inspection);
    if (inspection) {
      let detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });
      console.log('Transit detail found:', !!detail);
      const sampleEntry = await SampleEntry.findByPk(inspection.sampleEntryId);
      console.log('Sample entry found:', !!sampleEntry);
    }
  } catch (error) {
    console.error('Error in WB Submit:', error.stack || error);
  }
}

async function testWbApprove() {
  const id = 'c9ea172a-6013-4d1e-9567-a7b860dda62f';
  try {
    const inspection = await PhysicalInspection.findByPk(id);
    console.log('Inspection for approve found:', !!inspection);
    if (inspection) {
      const detail = await LorryTransitDetail.findOne({ where: { physicalInspectionId: id } });
      console.log('Transit detail for approve found:', !!detail);
      
      const { Op } = require('sequelize');
      const arrival = await Arrival.findOne({
        where: {
          lorryNumber: inspection.lorryNumber,
          remarks: { [Op.like]: `%inspection #${inspection.id}%` }
        }
      });
      console.log('Arrival for approve found:', !!arrival);
    }
  } catch (error) {
    console.error('Error in WB Approve:', error.stack || error);
  }
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    await testWbSubmit();
    await testWbApprove();
  } catch (e) {
    console.error('Database connection failed:', e);
  } finally {
    await sequelize.close();
  }
}

run();
