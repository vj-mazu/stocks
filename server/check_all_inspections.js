const db = require('./models');

async function run() {
  try {
    await db.sequelize.authenticate();
    const inspections = await db.PhysicalInspection.findAll({
      include: [
        {
          model: db.LotAllotment,
          as: 'lotAllotment',
          include: [
            {
              model: db.SampleEntry,
              as: 'sampleEntry'
            }
          ]
        }
      ]
    });
    console.log(JSON.stringify(inspections.map(i => ({
      id: i.id,
      lorryNumber: i.lorryNumber,
      sampleEntryId: i.lotAllotment?.sampleEntry?.id,
      variety: i.lotAllotment?.sampleEntry?.variety,
      partyName: i.lotAllotment?.sampleEntry?.partyName,
      samplingStages: i.samplingStages
    })), null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
