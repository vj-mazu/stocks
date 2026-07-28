const models = require('./models');
const LorryTransitDetail = models.LorryTransitDetail;
const PhysicalInspection = models.PhysicalInspection;
const SampleEntry = models.SampleEntry;
const Kunchinittu = models.Kunchinittu;
const Warehouse = models.Warehouse;
const Outturn = models.Outturn;
const User = models.User;
const WeightBridge = models.WeightBridge;
const InventoryQualityParameter = models.InventoryQualityParameter;

// Helper from arrivals.js
const searchCuttingInInspection = (inspection) => {
  if (!inspection) return null;
  
  // 1. Check direct cutting field
  if (inspection.cutting && inspection.cutting !== '0' && inspection.cutting !== '0x0') {
    return inspection.cutting;
  }
  
  // 2. Check cutting1 and cutting2 fields
  if (inspection.cutting1 && inspection.cutting2) {
    const cutting = `${inspection.cutting1}x${inspection.cutting2}`;
    if (cutting !== '0x0') {
      return cutting;
    }
  }
  
  // 3. Check quality parameters
  if (inspection.qualityParameters) {
    const qp = inspection.qualityParameters;
    if (qp.cutting1 && qp.cutting2) {
      const cutting = `${qp.cutting1}x${qp.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
  }
  
  // 4. Check sampling stages
  if (inspection.samplingStages) {
    const stages = inspection.samplingStages;
    // Try full_avg first
    if (stages.full_avg && stages.full_avg.cutting && stages.full_avg.cutting !== '0' && stages.full_avg.cutting !== '0x0') {
      return stages.full_avg.cutting;
    }
    if (stages.full_avg && stages.full_avg.cutting1 && stages.full_avg.cutting2) {
      const cutting = `${stages.full_avg.cutting1}x${stages.full_avg.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
    // Try lot_avg
    if (stages.lot_avg && stages.lot_avg.cutting && stages.lot_avg.cutting !== '0' && stages.lot_avg.cutting !== '0x0') {
      return stages.lot_avg.cutting;
    }
    if (stages.lot_avg && stages.lot_avg.cutting1 && stages.lot_avg.cutting2) {
      const cutting = `${stages.lot_avg.cutting1}x${stages.lot_avg.cutting2}`;
      if (cutting !== '0x0') {
        return cutting;
      }
    }
    // Try individual stages
    const stageKeys = ['stage1', 'stage2', 'stage3'];
    for (const key of stageKeys) {
      if (stages[key]) {
        if (stages[key].cutting && stages[key].cutting !== '0' && stages[key].cutting !== '0x0') {
          return stages[key].cutting;
        }
        if (stages[key].cutting1 && stages[key].cutting2) {
          const cutting = `${stages[key].cutting1}x${stages[key].cutting2}`;
          if (cutting !== '0x0') {
            return cutting;
          }
        }
      }
    }
  }
  
  return null;
};

const getCuttingFromInspection = async (inspection) => {
  if (!inspection) return null;
  
  // Search current inspection first
  let cutting = searchCuttingInInspection(inspection);
  
  // If cutting is found and not "0" or "0x0", return it
  if (cutting && cutting !== '0' && cutting !== '0x0') {
    return cutting;
  }
  
  return null;
};

(async () => {
  try {
    await models.sequelize.authenticate();
    console.log('✅ DB connected\n');
    
    // Fetch one Band Malal Book entry
    const detail = await LorryTransitDetail.findOne({
      where: { placeStatus: 'approved' },
      order: [['placeDate', 'DESC'], ['createdAt', 'DESC']]
    });
    
    if (!detail) {
      console.log('❌ No Band Malal Book entries found');
      process.exit(0);
    }
    
    console.log('📋 LorryTransitDetail ID:', detail.id);
    console.log('   Physical Inspection ID:', detail.physicalInspectionId);
    console.log('   Sample Entry ID:', detail.sampleEntryId);
    console.log('');
    
    // Fetch physical inspection
    const inspection = detail.physicalInspectionId 
      ? await PhysicalInspection.findByPk(detail.physicalInspectionId, {
          include: [{ 
            model: SampleEntry, 
            as: 'sampleEntry',
            attributes: ['id', 'serialNo', 'variety', 'brokerName', 'location', 'partyName', 'lorryNumber', 'entryDate', 'packaging', 'grossWeight', 'tareWeight', 'netWeight', 'wbNo', 'partyWbName']
          }]
        })
      : null;
    
    const sampleEntry = inspection?.sampleEntry || {};
    
    console.log('🔍 PhysicalInspection Data:');
    console.log('   bags:', inspection?.bags);
    console.log('   moisture:', inspection?.moisture);
    console.log('   cutting1:', inspection?.cutting1);
    console.log('   cutting2:', inspection?.cutting2);
    console.log('   lorryNumber:', inspection?.lorryNumber);
    console.log('');
    
    console.log('📦 SampleEntry Data:');
    console.log('   brokerName:', sampleEntry.brokerName);
    console.log('   variety:', sampleEntry.variety);
    console.log('   partyName:', sampleEntry.partyName);
    console.log('   location:', sampleEntry.location);
    console.log('   packaging:', sampleEntry.packaging);
    console.log('   wbNo:', sampleEntry.wbNo);
    console.log('   netWeight:', sampleEntry.netWeight);
    console.log('');
    
    // Test cutting extraction
    const cutting = await getCuttingFromInspection(inspection);
    console.log('🔪 Cutting:', cutting);
    console.log('');
    
    // Build the return object as done in endpoint
    const result = {
      id: detail.id,
      broker: sampleEntry.brokerName || null,
      variety: sampleEntry.variety || null,
      bags: inspection?.bags || 0,
      packaging: parseFloat(sampleEntry.packaging) || 75,
      fromLocation: sampleEntry.location || null,
      partyName: sampleEntry.partyName || null,
      moisture: inspection?.moisture || null,
      cutting: await getCuttingFromInspection(inspection),
      wbNo: detail.wbNo || 'PENDING',
      netWeight: detail.netWeight || 0,
      lorryNumber: inspection?.lorryNumber || sampleEntry.lorryNumber || 'N/A'
    };
    
    console.log('📤 Result object:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
  
  process.exit(0);
})();
