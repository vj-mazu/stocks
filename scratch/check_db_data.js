const { Outturn, Kunchinittu, Warehouse } = require('../server/models');
const { sequelize } = require('../server/config/database');

async function check() {
  try {
    await sequelize.authenticate();
    console.log("DB connected");
    const outturns = await Outturn.findAll({ where: { isCleared: false } });
    console.log("Active Outturns:", outturns.map(o => ({ id: o.id, code: o.code, variety: o.allottedVariety })));
    
    const kunchinittus = await Kunchinittu.findAll({ where: { isClosed: false } });
    console.log("Active Kunchinittus:", kunchinittus.map(k => ({ id: k.id, name: k.name, code: k.code })));

    const warehouses = await Warehouse.findAll();
    console.log("Warehouses:", warehouses.map(w => ({ id: w.id, name: w.name, code: w.code })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
