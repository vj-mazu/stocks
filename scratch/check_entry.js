const db = require('../server/models');
const { Op } = require('sequelize');

async function run() {
  try {
    await db.sequelize.authenticate();
    const entries = await db.SampleEntry.findAll({
      where: {
        variety: { [Op.like]: '%Sum25%' }
      },
      include: [
        {
          model: db.LotAllotment,
          as: 'lotAllotment',
          include: [
            {
              model: db.PhysicalInspection,
              as: 'physicalInspections'
            }
          ]
        }
      ]
    });
    console.log(JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
