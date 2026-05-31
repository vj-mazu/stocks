const PhysicalInspection = require('../models/PhysicalInspection');
const InventoryData = require('../models/InventoryData');

class PhysicalInspectionRepository {
  /**
   * Create physical inspection
   * @param {Object} inspectionData - Physical inspection data
   * @returns {Promise<Object>} Created physical inspection
   */
  async create(inspectionData) {
    const inspection = await PhysicalInspection.create(inspectionData);
    return inspection.toJSON();
  }

  /**
   * Find physical inspection by lot allotment ID
   * @param {number} lotAllotmentId - Lot allotment ID
   * @param {Object} options - Query options
   * @param {boolean} options.includeInventory - Include inventory data
   * @returns {Promise<Object|null>} Physical inspection or null
   */
  async findByLotAllotmentId(lotAllotmentId, options = {}) {
    const include = [];
    
    if (options.includeInventory) {
      include.push({ model: InventoryData, as: 'inventoryData' });
    }
    
    const inspection = await PhysicalInspection.findOne({
      where: { lotAllotmentId },
      include
    });
    return inspection ? inspection.toJSON() : null;
  }

  /**
   * Find physical inspection by ID
   * @param {number} id - Physical inspection ID
   * @returns {Promise<Object|null>} Physical inspection or null
   */
  async findById(id) {
    const inspection = await PhysicalInspection.findByPk(id);
    return inspection ? inspection.toJSON() : null;
  }

  /**
   * Update physical inspection
   * @param {number} id - Physical inspection ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated physical inspection or null
   */
  async update(id, updates) {
    const inspection = await PhysicalInspection.findByPk(id);
    if (!inspection) return null;
    
    if (updates && updates.samplingStages) {
      inspection.changed('samplingStages', true);
    }
    await inspection.update(updates);
    return inspection.toJSON();
  }

  /**
   * Update physical inspection by lot allotment ID
   * @param {number} lotAllotmentId - Lot allotment ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated physical inspection or null
   */
  async updateByLotAllotmentId(lotAllotmentId, updates) {
    const inspection = await PhysicalInspection.findOne({
      where: { lotAllotmentId }
    });
    if (!inspection) return null;
    
    if (updates && updates.samplingStages) {
      inspection.changed('samplingStages', true);
    }
    await inspection.update(updates);
    return inspection.toJSON();
  }

  /**
   * Find all physical inspections by sample entry ID
   * @param {string} sampleEntryId - Sample entry ID (UUID)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of physical inspections
   */
  async findBySampleEntryId(sampleEntryId, options = {}) {
    const User = require('../models/User');
    const LotAllotment = require('../models/LotAllotment');
    
    const inspections = await PhysicalInspection.findAll({
      where: { sampleEntryId },
      include: [
        {
          model: User,
          as: 'reportedBy',
          attributes: ['id', 'username', 'fullName']
        },
        {
          model: LotAllotment,
          as: 'lotAllotment',
          required: false,
          include: [
            {
              model: User,
              as: 'manager',
              attributes: ['id', 'username', 'fullName']
            },
            {
              model: User,
              as: 'supervisor',
              attributes: ['id', 'username', 'fullName']
            }
          ]
        }
      ],
      order: [
        ['inspectionDate', 'ASC'],
        ['id', 'ASC']
      ]
    });
    
    return inspections.map(i => i.toJSON());
  }
}

module.exports = new PhysicalInspectionRepository();
