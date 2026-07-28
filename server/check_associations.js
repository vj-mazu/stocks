const { sequelize } = require('./config/database');
const models = require('./models');
const LorryTransitDetail = models.LorryTransitDetail;
const PhysicalInspection = models.PhysicalInspection;
const SampleEntry = models.SampleEntry;

async function main() {
  try {
    const detail = await LorryTransitDetail.findByPk('214b4383-3fb0-43f5-9c4d-f9214eee7075');
    console.log('LorryTransitDetail object:');
    console.log({
      id: detail.id,
      physicalInspectionId: detail.physicalInspectionId,
      sampleEntryId: detail.sampleEntryId
    });

    const inspection = await PhysicalInspection.findByPk(detail.physicalInspectionId, {
      include: [{ 
        model: SampleEntry, 
        as: 'sampleEntry'
      }]
    });

    console.log('Inspection object exists:', !!inspection);
    if (inspection) {
      console.log('Inspection details:', {
        id: inspection.id,
        lorryNumber: inspection.lorryNumber,
        sampleEntryId: inspection.sampleEntryId,
        sampleEntryExists: !!inspection.sampleEntry
      });
      if (inspection.sampleEntry) {
        console.log('SampleEntry details:', {
          id: inspection.sampleEntry.id,
          partyName: inspection.sampleEntry.partyName,
          brokerName: inspection.sampleEntry.brokerName
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

main();
