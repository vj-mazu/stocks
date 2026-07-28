const { sequelize } = require('./config/database');
const models = require('./models');
const LorryTransitDetail = models.LorryTransitDetail;
const PhysicalInspection = models.PhysicalInspection;
const SampleEntry = models.SampleEntry;
const Kunchinittu = models.Kunchinittu;
const Warehouse = models.Warehouse;
const Outturn = models.Outturn;
const User = models.User;
const WeightBridge = models.WeightBridge;

async function getCuttingFromInspection(inspection) {
  return '-';
}

async function main() {
  try {
    const limit = 200;
    const where = { placeStatus: 'approved' };
    
    const entries = await LorryTransitDetail.findAll({
      where,
      order: [['placeDate', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit)
    });
    
    const arrivals = await Promise.all(entries.map(async (detail, index) => {
      const inspection = detail.physicalInspectionId 
        ? await PhysicalInspection.findByPk(detail.physicalInspectionId, {
            include: [{ 
              model: SampleEntry, 
              as: 'sampleEntry',
              attributes: ['id', 'serialNo', 'variety', 'brokerName', 'location', 'partyName', 'entryDate', 'packaging', 'grossWeight', 'tareWeight', 'netWeight', 'wbNo', 'partyWbName']
            }]
          })
        : null;
      
      const sampleEntry = inspection?.sampleEntry || {};
      
      return {
        id: detail.id,
        slNo: index + 1,
        date: detail.placeDate || detail.createdAt,
        broker: sampleEntry.brokerName || null,
        variety: sampleEntry.variety || null,
        bags: inspection?.bags || 0,
        fromLocation: sampleEntry.location || null,
        partyName: sampleEntry.partyName || null,
        wbNo: detail.wbNo || 'PENDING',
        netWeight: detail.netWeight || 0,
        lorryNumber: inspection?.lorryNumber || 'N/A'
      };
    }));

    console.log(JSON.stringify(arrivals, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
