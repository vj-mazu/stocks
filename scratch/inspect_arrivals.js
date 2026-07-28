const { Arrival, LorryTransitDetail } = require('../server/models');
const { sequelize } = require('../server/config/database');

async function check() {
  try {
    await sequelize.authenticate();
    const arrivals = await Arrival.findAll({
      include: [{ model: LorryTransitDetail, as: 'lorryTransitDetail' }]
    });
    console.log("Total arrivals in DB:", arrivals.length);
    arrivals.forEach(a => {
      console.log(`Arrival ID: ${a.id}, Lorry: ${a.lorryNumber}, PlaceStatus: ${a.lorryTransitDetail?.placeStatus}, PlaceType: ${a.lorryTransitDetail?.placeType}, isApproved: ${a.status}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
