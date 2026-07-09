const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { Warehouse, Kunchinittu, Variety } = require('../models/Location');
const RiceStockLocation = require('../models/RiceStockLocation');
const RiceVariety = require('../models/RiceVariety');
const Broker = require('../models/Broker');
const User = require('../models/User');
const { sequelize } = require('../config/database');

const router = express.Router();

// In-memory cache for location data (changes rarely, queried constantly)
const locationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = locationCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  locationCache.delete(key);
  return null;
}

function setCache(key, data) {
  locationCache.set(key, { data, time: Date.now() });
}

function invalidateCache(prefix) {
  for (const key of locationCache.keys()) {
    if (key.startsWith(prefix)) locationCache.delete(key);
  }
}

// ===== WAREHOUSES =====

// Get all warehouses
router.get('/warehouses', auth, async (req, res) => {
  try {
    const warehouses = await Warehouse.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code', 'location', 'type', 'shortCutName'],
      order: [['name', 'ASC']],
      include: [{
        model: Kunchinittu,
        as: 'kunchinittus',
        attributes: ['id', 'name', 'code'],
        required: false
      }],
      raw: false,
      nest: true
    });

    const warehousesWithInUse = await Promise.all(warehouses.map(async (w) => {
      const kCount = await Kunchinittu.count({
        where: { warehouseId: w.id, isActive: true }
      });
      const wJson = w.toJSON();
      wJson.inUse = kCount > 0;
      return wJson;
    }));

    const result = { warehouses: warehousesWithInUse };
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(result);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// Create warehouse (Manager/Admin only)
router.post('/warehouses', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, location, capacity, type, shortCutName } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    if (type === 'outside' && (!location || !location.trim())) {
      return res.status(400).json({ error: 'Location is required for outside warehouses' });
    }

    // Check for duplicate
    const existing = await Warehouse.findOne({
      where: { code }
    });

    if (existing) {
      return res.status(400).json({ error: 'Warehouse code already exists' });
    }

    invalidateCache('warehouses');
    const warehouse = await Warehouse.create({
      name: name.trim(),
      code,
      location: location ? location.trim() : null,
      capacity,
      type: type || 'mill',
      shortCutName: shortCutName ? shortCutName.trim() : null
    });

    res.status(201).json({
      message: 'Warehouse created successfully',
      warehouse
    });
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// Update warehouse (Manager/Admin only)
router.put('/warehouses/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const { name, code, location, capacity, type, shortCutName } = req.body;

    if (type === 'outside' && (!location || !location.trim())) {
      return res.status(400).json({ error: 'Location is required for outside warehouses' });
    }

    // Check for duplicate code (excluding current warehouse)
    if (code && code !== warehouse.code) {
      const existing = await Warehouse.findOne({
        where: { code, id: { [require('sequelize').Op.ne]: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Warehouse code already exists' });
      }
    }

    invalidateCache('warehouses');
    await warehouse.update({
      name: name ? name.trim() : warehouse.name,
      code: code ? code.trim() : warehouse.code,
      location: location !== undefined ? (location ? location.trim() : null) : warehouse.location,
      capacity,
      type: type || warehouse.type,
      shortCutName: shortCutName !== undefined ? (shortCutName ? shortCutName.trim() : null) : warehouse.shortCutName
    });

    res.json({
      message: 'Warehouse updated successfully',
      warehouse
    });
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// Delete warehouse (Manager/Admin only)
router.delete('/warehouses/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Check if referenced/in-use by any active Kunchinittu
    const kunchinittuCount = await Kunchinittu.count({
      where: { warehouseId: req.params.id }
    });

    // Check if referenced/in-use by any Arrival
    const Arrival = require('../models/Arrival');
    const { Op } = require('sequelize');
    const arrivalCount = await Arrival.count({
      where: {
        [Op.or]: [
          { toWarehouseId: req.params.id },
          { fromWarehouseId: req.params.id },
          { toWarehouseShiftId: req.params.id }
        ]
      }
    });

    if (kunchinittuCount > 0 || arrivalCount > 0) {
      return res.status(400).json({ error: 'Cannot delete warehouse because it is in use' });
    }

    // Hard delete - destroy from database so code/name are freed up
    invalidateCache('warehouses');
    await warehouse.destroy();

    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

// ===== KUNCHINITTUS =====

// Get all kunchinittus (for dropdowns - excludes closed by default)
router.get('/kunchinittus', auth, async (req, res) => {
  try {
    const { includeClosed } = req.query;

    const where = { isActive: true };
    if (includeClosed !== 'true') {
      where.isClosed = false;
    }

    const kunchinittus = await Kunchinittu.findAll({
      where,
      attributes: ['id', 'name', 'code', 'warehouseId', 'varietyId', 'isClosed'],
      order: [['name', 'ASC']],
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
        { model: Variety, as: 'variety', attributes: ['id', 'name', 'code'], required: false }
      ],
      raw: false,
      nest: true
    });

    const InventoryData = require('../models/InventoryData');
    const kunchinittusWithInUse = await Promise.all(kunchinittus.map(async (k) => {
      const invCount = await InventoryData.count({
        where: { kunchinittuId: k.id }
      });
      const kJson = k.toJSON();
      kJson.inUse = invCount > 0;
      return kJson;
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ kunchinittus: kunchinittusWithInUse });
  } catch (error) {
    console.error('Get kunchinittus error:', error);
    res.status(500).json({ error: 'Failed to fetch kunchinittus' });
  }
});

// Create kunchinittu (Manager/Admin only)
router.post('/kunchinittus', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, warehouseId, varietyId, capacity } = req.body;

    if (!name || !code || !warehouseId) {
      return res.status(400).json({ error: 'Name, code, and warehouseId are required' });
    }

    // Check if warehouse exists
    const warehouse = await Warehouse.findByPk(warehouseId);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Check for duplicate name (must be unique globally)
    const existingName = await Kunchinittu.findOne({
      where: { name: name.trim() }
    });

    if (existingName) {
      return res.status(400).json({
        error: `Kunchinittu name '${name}' already exists. Please use a unique name.`
      });
    }

    // Check for duplicate code (can be same across warehouses, but not within same warehouse)
    const existingCode = await Kunchinittu.findOne({
      where: {
        code,
        warehouseId
      }
    });

    if (existingCode) {
      return res.status(400).json({
        error: `Kunchinittu code '${code}' already exists in this warehouse. You can use the same code in different warehouses.`
      });
    }

    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    const kunchinittu = await Kunchinittu.create({
      name: name.trim(),
      code,
      warehouseId,
      varietyId: varietyId || null,
      capacity
    });

    // Fetch with warehouse and variety data
    const createdKunchinittu = await Kunchinittu.findByPk(kunchinittu.id, {
      include: [
        { model: Warehouse, as: 'warehouse' },
        { model: Variety, as: 'variety' }
      ]
    });

    res.status(201).json({
      message: 'Kunchinittu created successfully',
      kunchinittu: createdKunchinittu
    });
  } catch (error) {
    console.error('Create kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to create kunchinittu' });
  }
});

// Update kunchinittu (Manager/Admin only)
router.put('/kunchinittus/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const kunchinittu = await Kunchinittu.findByPk(req.params.id);
    if (!kunchinittu) {
      return res.status(404).json({ error: 'Kunchinittu not found' });
    }

    const { name, code, warehouseId, varietyId, capacity } = req.body;

    const { Op } = require('sequelize');

    // Check for duplicate name (excluding current kunchinittu)
    if (name && name.trim() !== kunchinittu.name) {
      const existingName = await Kunchinittu.findOne({
        where: {
          name: name.trim(),
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existingName) {
        return res.status(400).json({
          error: `Kunchinittu name '${name}' already exists. Please use a unique name.`
        });
      }
    }

    // Check for duplicate code in the same warehouse (excluding current kunchinittu)
    if ((code && code !== kunchinittu.code) || (warehouseId && warehouseId !== kunchinittu.warehouseId)) {
      const existingCode = await Kunchinittu.findOne({
        where: {
          code: code || kunchinittu.code,
          warehouseId: warehouseId || kunchinittu.warehouseId,
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existingCode) {
        return res.status(400).json({
          error: `Kunchinittu code '${code || kunchinittu.code}' already exists in this warehouse. You can use the same code in different warehouses.`
        });
      }
    }

    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    await kunchinittu.update({ 
      name: name ? name.trim() : kunchinittu.name, 
      code: code ? code.trim() : kunchinittu.code, 
      warehouseId, 
      varietyId, 
      capacity 
    });

    const updatedKunchinittu = await Kunchinittu.findByPk(kunchinittu.id, {
      include: [
        { model: Warehouse, as: 'warehouse' },
        { model: Variety, as: 'variety' }
      ]
    });

    res.json({
      message: 'Kunchinittu updated successfully',
      kunchinittu: updatedKunchinittu
    });
  } catch (error) {
    console.error('Update kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to update kunchinittu' });
  }
});

// Delete kunchinittu (Manager/Admin only)
router.delete('/kunchinittus/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const kunchinittu = await Kunchinittu.findByPk(req.params.id);
    if (!kunchinittu) {
      return res.status(404).json({ error: 'Kunchinittu not found' });
    }

    // Check if referenced/in-use by InventoryData
    const InventoryData = require('../models/InventoryData');
    const invCount = await InventoryData.count({
      where: { kunchinittuId: req.params.id }
    });

    // Check if referenced/in-use by Arrivals
    const Arrival = require('../models/Arrival');
    const { Op } = require('sequelize');
    const arrivalCount = await Arrival.count({
      where: {
        [Op.or]: [
          { toKunchinintuId: req.params.id },
          { fromKunchinintuId: req.params.id }
        ]
      }
    });

    if (invCount > 0 || arrivalCount > 0) {
      return res.status(400).json({ error: 'Cannot delete KanchiNittu because it is in use' });
    }

    // Hard delete
    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    await kunchinittu.destroy();

    res.json({ message: 'Kunchinittu deleted successfully' });
  } catch (error) {
    console.error('Delete kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to delete kunchinittu' });
  }
});

// ===== VARIETIES =====

const { cacheMiddleware } = require('../middleware/cache');

// Get all varieties
router.get('/varieties', auth, cacheMiddleware(300), async (req, res) => {
  try {
    const varieties = await Variety.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
      raw: true
    });

    const Arrival = require('../models/Arrival');
    const SampleEntry = require('../models/SampleEntry');
    const InventoryData = require('../models/InventoryData');
    const Outturn = require('../models/Outturn');

    const varietiesWithInUse = await Promise.all(varieties.map(async (v) => {
      const lowerName = v.name.trim().toLowerCase();
      
      const sCount = await SampleEntry.count({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
      });
      const aCount = await Arrival.count({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
      });
      const iCount = await InventoryData.count({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
      });
      const oCount = await Outturn.count({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('allottedVariety')), lowerName)
      });
      const kCount = await Kunchinittu.count({
        where: { varietyId: v.id, isActive: true }
      });

      v.inUse = (sCount > 0 || aCount > 0 || iCount > 0 || oCount > 0 || kCount > 0);
      return v;
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ varieties: varietiesWithInUse });
  } catch (error) {
    console.error('Get varieties error:', error);
    res.status(500).json({ error: 'Failed to fetch varieties' });
  }
});

// Create variety (Manager/Admin only)
router.post('/varieties', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const { Op } = require('sequelize');

    // Check for duplicate name or code (case-insensitive)
    const existing = await Variety.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('code')), code.trim().toLowerCase()),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.trim().toLowerCase())
        ]
      }
    });

    if (existing) {
      if (existing.name.toLowerCase() === name.trim().toLowerCase()) {
        return res.status(400).json({ error: `Variety name '${name}' already exists` });
      }
      return res.status(400).json({ error: `Variety code '${code}' already exists` });
    }

    invalidateCache('varieties');
    const variety = await Variety.create({
      name: name.trim(),
      code: code.trim(),
      description
    });

    res.status(201).json({
      message: 'Variety created successfully',
      variety
    });
  } catch (error) {
    console.error('Create variety error:', error);
    res.status(500).json({ error: 'Failed to create variety' });
  }
});

// Update variety (Manager/Admin only)
router.put('/varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await Variety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }

    const { name, code, description } = req.body;
    const oldName = variety.name; // Store old name for cascade update

    // Check for duplicate code (excluding current variety)
    if (code && code.trim() !== variety.code) {
      const { Op } = require('sequelize');
      const existing = await Variety.findOne({
        where: { 
          code: code.trim(), 
          id: { [Op.ne]: req.params.id } 
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Variety code already exists' });
      }
    }

    invalidateCache('varieties');
    const normalizedName = name ? name.trim() : variety.name;
    const normalizedCode = code ? code.trim() : variety.code;
    await variety.update({ name: normalizedName, code: normalizedCode, description });

    // CASCADE UPDATE: If variety name changed, update all Arrivals, SampleEntries, InventoryData, and Outturns
    if (normalizedName !== oldName) {
      const Arrival = require('../models/Arrival');
      const SampleEntry = require('../models/SampleEntry');
      const InventoryData = require('../models/InventoryData');
      const Outturn = require('../models/Outturn');
      const { fn, col, where: sqlWhere } = require('sequelize');

      const updatedCount = await Arrival.update(
        { variety: normalizedName },
        {
          where: sqlWhere(
            fn('TRIM', fn('LOWER', col('variety'))),
            oldName.trim().toLowerCase()
          )
        }
      );
      console.log(`✅ Cascade update: Updated ${updatedCount[0]} arrivals from variety "${oldName}" to "${normalizedName}"`);

      // Cascade to SampleEntry (case-insensitive match)
      const entryUpdated = await SampleEntry.update(
        { variety: normalizedName },
        {
          where: sqlWhere(
            fn('TRIM', fn('LOWER', col('variety'))),
            oldName.trim().toLowerCase()
          )
        }
      );
      console.log(`✅ Cascade update: Updated ${entryUpdated[0]} sample entries from variety "${oldName}" to "${normalizedName}"`);

      // Cascade to InventoryData
      const inventoryUpdated = await InventoryData.update(
        { variety: normalizedName },
        {
          where: sqlWhere(
            fn('TRIM', fn('LOWER', col('variety'))),
            oldName.trim().toLowerCase()
          )
        }
      );
      console.log(`✅ Cascade update: Updated ${inventoryUpdated[0]} inventory records from variety "${oldName}" to "${normalizedName}"`);

      // Cascade to Outturn
      const outturnUpdated = await Outturn.update(
        { allottedVariety: normalizedName },
        {
          where: sqlWhere(
            fn('TRIM', fn('LOWER', col('allottedVariety'))),
            oldName.trim().toLowerCase()
          )
        }
      );
      console.log(`✅ Cascade update: Updated ${outturnUpdated[0]} outturn records from variety "${oldName}" to "${normalizedName}"`);
    }

    res.json({
      message: 'Variety updated successfully',
      variety
    });
  } catch (error) {
    console.error('Update variety error:', error);
    res.status(500).json({ error: 'Failed to update variety' });
  }
});

// Delete variety (Manager/Admin only)
router.delete('/varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await Variety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }

    const lowerName = variety.name.trim().toLowerCase();
    const Arrival = require('../models/Arrival');
    const SampleEntry = require('../models/SampleEntry');
    const InventoryData = require('../models/InventoryData');
    const Outturn = require('../models/Outturn');

    const sCount = await SampleEntry.count({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
    });
    const aCount = await Arrival.count({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
    });
    const iCount = await InventoryData.count({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('variety')), lowerName)
    });
    const oCount = await Outturn.count({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('allottedVariety')), lowerName)
    });
    const kCount = await Kunchinittu.count({
      where: { varietyId: req.params.id, isActive: true }
    });

    if (sCount > 0 || aCount > 0 || iCount > 0 || oCount > 0 || kCount > 0) {
      return res.status(400).json({ error: 'Cannot delete variety because it is in use' });
    }

    // Hard delete variety
    invalidateCache('varieties');
    await variety.destroy();

    res.json({ message: 'Variety deleted successfully' });
  } catch (error) {
    console.error('Delete variety error:', error);
    res.status(500).json({ error: 'Failed to delete variety' });
  }
});

// ===== RICE STOCK LOCATIONS =====

// Get all rice stock locations
router.get('/rice-stock-locations', auth, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    // Fetch locations without User association to avoid circular dependency issues
    const locations = await RiceStockLocation.findAll({
      where,
      attributes: ['id', 'code', 'name', 'isActive', 'is_direct_load', 'createdAt', 'createdBy'],
      order: [['code', 'ASC']],
      raw: true
    });



    // Manually fetch creator usernames if needed
    if (locations.length > 0) {
      const creatorIds = [...new Set(locations.map(l => l.createdBy))];
      const creators = await User.findAll({
        where: { id: creatorIds },
        attributes: ['id', 'username'],
        raw: true
      });

      const creatorMap = {};
      creators.forEach(c => {
        creatorMap[c.id] = c.username;
      });

      // Add creator username to each location
      locations.forEach(loc => {
        loc.creator = { username: creatorMap[loc.createdBy] || 'Unknown' };
      });
    }

    // Cache headers for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ locations });
  } catch (error) {
    console.error('❌ Get rice stock locations error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch rice stock locations' });
  }
});

// Create rice stock location (Manager/Admin only)
router.post('/rice-stock-locations', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    console.log('📍 Creating rice stock location...');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { code, name } = req.body;

    if (!code) {
      console.log('❌ No code provided');
      return res.status(400).json({ error: 'Location code is required' });
    }

    // Check if code already exists
    const existing = await RiceStockLocation.findOne({
      where: { code: code.trim().toUpperCase() }
    });

    if (existing) {
      console.log('❌ Code already exists:', code);
      return res.status(400).json({ error: 'Location code already exists' });
    }

    console.log('Creating location with:', {
      code: code.trim().toUpperCase(),
      name: name ? name.trim() : null,
      createdBy: req.user.userId
    });

    const location = await RiceStockLocation.create({
      code: code.trim().toUpperCase(),
      name: name ? name.trim() : null,
      createdBy: req.user.userId
    });

    console.log('✅ Location created:', location.id);

    const created = await RiceStockLocation.findByPk(location.id, {
      attributes: ['id', 'code', 'name', 'isActive', 'createdAt', 'createdBy'],
      raw: true
    });

    // Manually add creator username
    const creator = await User.findByPk(req.user.userId, {
      attributes: ['username'],
      raw: true
    });

    created.creator = { username: creator ? creator.username : 'Unknown' };

    console.log('✅ Returning location:', created);

    res.status(201).json({
      message: 'Rice stock location created successfully',
      location: created
    });
  } catch (error) {
    console.error('❌ Create rice stock location error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to create rice stock location' });
  }
});

// Update rice stock location (Manager/Admin only)
router.put('/rice-stock-locations/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { code, name, isActive } = req.body;

    const location = await RiceStockLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Rice stock location not found' });
    }

    // Check if new code already exists (if code is being changed)
    if (code && code.trim().toUpperCase() !== location.code) {
      const { Op } = require('sequelize');
      const existing = await RiceStockLocation.findOne({
        where: {
          code: code.trim().toUpperCase(),
          id: { [Op.ne]: req.params.id }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Location code already exists' });
      }
    }

    await location.update({
      code: code ? code.trim().toUpperCase() : location.code,
      name: name !== undefined ? (name ? name.trim() : null) : location.name,
      isActive: isActive !== undefined ? isActive : location.isActive
    });

    const updated = await RiceStockLocation.findByPk(location.id, {
      include: [
        { model: User, as: 'creator', attributes: ['username'] }
      ]
    });

    res.json({
      message: 'Rice stock location updated successfully',
      location: updated
    });
  } catch (error) {
    console.error('Update rice stock location error:', error);
    res.status(500).json({ error: 'Failed to update rice stock location' });
  }
});

// Delete rice stock location (Admin only)
router.delete('/rice-stock-locations/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const location = await RiceStockLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Rice stock location not found' });
    }

    // Check if referenced in RiceProduction
    const RiceProduction = require('../models/RiceProduction');
    const rCount = await RiceProduction.count({
      where: { locationId: req.params.id }
    });

    if (rCount > 0) {
      return res.status(400).json({ error: 'Cannot delete location because it is in use in production records' });
    }

    // Hard delete
    await location.destroy();

    res.json({ message: 'Rice stock location deleted successfully' });
  } catch (error) {
    console.error('Delete rice stock location error:', error);
    res.status(500).json({ error: 'Failed to delete rice stock location' });
  }
});

// ===== RICE VARIETIES =====

// Get all rice varieties
router.get('/rice-varieties', auth, async (req, res) => {
  try {
    const varieties = await RiceVariety.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
      raw: true
    });

    const RiceStockLocation = require('../models/RiceStockLocation');
    // Check if rice variety is referenced elsewhere (e.g. check if name is in use in rice stock management or similar if models exist)
    // For now, let's return inUse: false or write a placeholder check if there's a table
    const varietiesWithInUse = varieties.map(v => {
      v.inUse = false; // Add specific usage checks if required
      return v;
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ varieties: varietiesWithInUse });
  } catch (error) {
    console.error('Get rice varieties error:', error);
    res.status(500).json({ error: 'Failed to fetch rice varieties' });
  }
});

// Create rice variety (Manager/Admin only)
router.post('/rice-varieties', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check for duplicate (case-insensitive)
    const existing = await RiceVariety.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('code')), code.trim().toLowerCase())
    });

    if (existing) {
      return res.status(400).json({ error: 'Rice variety code already exists' });
    }

    const variety = await RiceVariety.create({
      name: name.trim(),
      code: code.trim().toUpperCase()
    });

    res.status(201).json({
      message: 'Rice variety created successfully',
      variety
    });
  } catch (error) {
    console.error('Create rice variety error:', error);
    res.status(500).json({ error: 'Failed to create rice variety' });
  }
});

// Update rice variety (Manager/Admin only)
router.put('/rice-varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await RiceVariety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Rice variety not found' });
    }

    const { name, code, isActive } = req.body;

    // Check for duplicate code if changed
    if (code && code.trim().toUpperCase() !== variety.code) {
      const { Op } = require('sequelize');
      const existing = await RiceVariety.findOne({
        where: {
          code: code.trim().toUpperCase(),
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Rice variety code already exists' });
      }
    }

    await variety.update({
      name: name ? name.trim() : variety.name,
      code: code ? code.trim().toUpperCase() : variety.code,
      isActive: isActive !== undefined ? isActive : variety.isActive
    });

    res.json({
      message: 'Rice variety updated successfully',
      variety
    });
  } catch (error) {
    console.error('Update rice variety error:', error);
    res.status(500).json({ error: 'Failed to update rice variety' });
  }
});

// Delete rice variety (Admin only)
router.delete('/rice-varieties/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const variety = await RiceVariety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Rice variety not found' });
    }

    // Hard delete
    await variety.destroy();
    res.json({ message: 'Rice variety deleted successfully' });
  } catch (error) {
    console.error('Delete rice variety error:', error);
    res.status(500).json({ error: 'Failed to delete rice variety' });
  }
});

// ===== BROKERS =====

// Get all brokers
router.get('/brokers', auth, async (req, res) => {
  try {
    const { includeInactive, type } = req.query;
    const { Op } = require('sequelize');
    const where = {};
    
    if (includeInactive !== 'true') {
      where.isActive = true;
    }
    
    if (type === 'paddy') {
      where.type = { [Op.in]: ['paddy', 'both'] };
    } else if (type === 'rice') {
      where.type = { [Op.in]: ['rice', 'both'] };
    } else if (type) {
      where.type = type;
    }

    const brokers = await Broker.findAll({
      where,
      attributes: ['id', 'name', 'type', 'isActive', 'phoneNumber'],
      order: [['name', 'ASC']],
      raw: true
    });

    const SampleEntry = require('../models/SampleEntry');

    const brokersWithInUse = await Promise.all(brokers.map(async (b) => {
      const lowerName = b.name.trim().toLowerCase();
      const sCount = await SampleEntry.count({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('broker_name')), lowerName)
      });
      b.inUse = sCount > 0;
      return b;
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ brokers: brokersWithInUse });
  } catch (error) {
    console.error('Get brokers error:', error);
    res.status(500).json({ error: 'Failed to fetch brokers' });
  }
});

// Create broker (Manager/Admin only)
router.post('/brokers', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, type, phoneNumber } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Broker name is required' });
    }

    if (phoneNumber && !/^\d{10}$/.test(phoneNumber.trim())) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    const validTypes = ['paddy', 'rice', 'both'];
    const brokerType = validTypes.includes(type) ? type : 'both';

    // Check for duplicate name (case-insensitive)
    const existingName = await Broker.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.trim().toLowerCase())
    });

    if (existingName) {
      if (existingName.isActive) {
        return res.status(400).json({ error: 'Broker name already exists' });
      }

      await existingName.update({
        isActive: true,
        type: brokerType,
        phoneNumber: phoneNumber ? phoneNumber.trim() : null
      });

      return res.status(201).json({
        message: 'Broker reactivated successfully',
        broker: existingName
      });
    }

    const broker = await Broker.create({
      name: name.trim(),
      type: brokerType,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      isActive: true
    });

    res.status(201).json({
      message: 'Broker created successfully',
      broker
    });
  } catch (error) {
    console.error('Create broker error:', error);
    res.status(500).json({ error: 'Failed to create broker' });
  }
});

// Update broker (Manager/Admin only)
router.put('/brokers/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ error: 'Broker not found' });
    }

    const { name, type, isActive, phoneNumber } = req.body;
    const { Op } = require('sequelize');

    const trimmedName = name ? name.trim() : null;
    const oldName = broker.name;

    // Check for duplicate name (excluding current broker)
    if (trimmedName && trimmedName.toLowerCase() !== broker.name.toLowerCase()) {
      const existingName = await Broker.findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
        id: { [Op.ne]: req.params.id },
        isActive: true
      });
      if (existingName) {
        return res.status(400).json({ error: 'Broker name already exists' });
      }
    }

    const updateData = {};
    if (trimmedName) updateData.name = trimmedName;
    if (type) {
      const validTypes = ['paddy', 'rice', 'both'];
      if (validTypes.includes(type)) {
        updateData.type = type;
      }
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (phoneNumber !== undefined) {
      const trimmedPhone = phoneNumber ? phoneNumber.trim() : null;
      if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
        return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
      }
      updateData.phoneNumber = trimmedPhone;
    }

    await broker.update(updateData);

    // CASCADE UPDATE: If broker name changed, update all SampleEntries
    if (trimmedName && trimmedName !== oldName) {
      const SampleEntry = require('../models/SampleEntry');
      const { fn, col, where: sqlWhere } = require('sequelize');

      // Cascade to SampleEntry (case-insensitive match)
      const entryUpdated = await SampleEntry.update(
        { brokerName: trimmedName },
        {
          where: sqlWhere(
            fn('TRIM', fn('LOWER', col('broker_name'))),
            oldName.trim().toLowerCase()
          )
        }
      );
      console.log(`✅ Cascade update: Updated ${entryUpdated[0]} sample entries from broker "${oldName}" to "${trimmedName}"`);
    }

    res.json({
      message: 'Broker updated successfully',
      broker
    });
  } catch (error) {
    console.error('Update broker error:', error);
    res.status(500).json({ error: 'Failed to update broker' });
  }
});

// Delete broker (Admin only)
router.delete('/brokers/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ error: 'Broker not found' });
    }

    // Check if referenced in SampleEntries
    const SampleEntry = require('../models/SampleEntry');
    const sCount = await SampleEntry.count({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('broker_name')), broker.name.trim().toLowerCase())
    });

    if (sCount > 0) {
      return res.status(400).json({ error: 'Cannot delete broker because they are referenced in sample entries' });
    }

    // Hard delete
    await broker.destroy();

    res.json({ message: 'Broker deleted successfully' });
  } catch (error) {
    console.error('Delete broker error:', error);
    res.status(500).json({ error: 'Failed to delete broker' });
  }
});

module.exports = router;
