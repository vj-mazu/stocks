const PhysicalInspectionRepository = require('../repositories/PhysicalInspectionRepository');
const AuditService = require('./AuditService');
const WorkflowEngine = require('./WorkflowEngine');
const FileUploadService = require('./FileUploadService');

class PhysicalInspectionService {
  /**
   * Create physical inspection
   * @param {Object} inspectionData - Physical inspection data
   * @param {number} userId - User ID creating the inspection (physical supervisor)
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created physical inspection
   */
  async createPhysicalInspection(inspectionData, userId, userRole) {
    try {
      if (!inspectionData.sampleEntryId) {
        throw new Error('Sample entry ID is required');
      }

      const SampleEntryRepository = require('../repositories/SampleEntryRepository');
      const LotAllotmentRepository = require('../repositories/LotAllotmentRepository');

      const entry = await SampleEntryRepository.findById(inspectionData.sampleEntryId);
      if (!entry) {
        throw new Error('Sample entry not found');
      }

      const lotAllotment = await LotAllotmentRepository.findBySampleEntryId(inspectionData.sampleEntryId);
      if (!lotAllotment) {
        throw new Error('Lot allotment not found for this entry. Please have manager allot a supervisor first.');
      }

      const existingInspections = await PhysicalInspectionRepository.findBySampleEntryId(inspectionData.sampleEntryId);
      const totalAllottedBags = (lotAllotment.allottedBags && lotAllotment.allottedBags > 0) ? lotAllotment.allottedBags : (entry.bags || 0);

      if (!totalAllottedBags || totalAllottedBags <= 0) {
        throw new Error('Invalid bag count. Please contact manager to allot bags first.');
      }

      // If stage is not specified, run legacy flow
      if (!inspectionData.stage) {
        if (!inspectionData.inspectionDate || !inspectionData.lorryNumber ||
          !inspectionData.actualBags || inspectionData.cutting1 === undefined ||
          inspectionData.cutting2 === undefined || inspectionData.bend === undefined) {
          throw new Error('All required fields must be provided');
        }

        const totalInspected = existingInspections.reduce((sum, i) => sum + (i.bags || 0), 0);
        const remainingBags = totalAllottedBags - totalInspected;

        if (inspectionData.actualBags > remainingBags) {
          throw new Error(`Cannot inspect ${inspectionData.actualBags} bags. Only ${remainingBags} bags remaining.`);
        }

        const newInspectionData = {
          sampleEntryId: inspectionData.sampleEntryId,
          lotAllotmentId: lotAllotment.id,
          reportedByUserId: userId,
          inspectionDate: inspectionData.inspectionDate,
          lorryNumber: inspectionData.lorryNumber,
          bags: inspectionData.actualBags,
          cutting1: inspectionData.cutting1,
          cutting2: inspectionData.cutting2,
          bend: inspectionData.bend,
          bend2: inspectionData.bend2,
          remarks: inspectionData.remarks || null,
          isComplete: false
        };

        const newTotalInspected = totalInspected + inspectionData.actualBags;
        if (newTotalInspected >= totalAllottedBags) {
          newInspectionData.isComplete = true;
        }

        const inspection = await PhysicalInspectionRepository.create(newInspectionData);
        await AuditService.logCreate(userId, 'physical_inspections', inspection.id, inspection);

        const currentStatus = entry.workflowStatus;
        if (currentStatus !== 'PHYSICAL_INSPECTION' && ['LOT_ALLOTMENT', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'].includes(currentStatus)) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id, reason: 'New progressive lorry added (legacy flow)' }
          );
        } else if (existingInspections.length === 0) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id }
          );
        }
        return inspection;
      }

      // MULTI-STAGE FLOW
      const stage = inspectionData.stage.toLowerCase();
      if (!['lot_avg', 'half_lorry', 'nit_avg', 'full_avg'].includes(stage)) {
        throw new Error('Invalid sampling stage specified');
      }

      const lorryNumberClean = (inspectionData.lorryNumber || '').trim().toUpperCase();
      if (!lorryNumberClean) {
        throw new Error('Lorry number is required');
      }

      // Check if there is an existing record for this lorry
      let inspection = null;
      const existingLorryInspection = existingInspections.find(
        i => (i.lorryNumber || '').trim().toUpperCase() === lorryNumberClean
      );

      const stageData = {
        inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
        moisture: inspectionData.moisture !== undefined ? Number(inspectionData.moisture) : null,
        moistureRaw: inspectionData.moistureRaw || null,
        dryMoisture: inspectionData.dryMoisture !== undefined ? Number(inspectionData.dryMoisture) : null,
        dryMoistureRaw: inspectionData.dryMoistureRaw || null,
        grainsCount: inspectionData.grainsCount !== undefined ? Number(inspectionData.grainsCount) : null,
        grainsCountRaw: inspectionData.grainsCountRaw || null,
        cutting1: inspectionData.cutting1 !== undefined ? Number(inspectionData.cutting1) : null,
        cutting2: inspectionData.cutting2 !== undefined ? Number(inspectionData.cutting2) : null,
        bend1: inspectionData.bend1 !== undefined ? Number(inspectionData.bend1) : null,
        bend2: inspectionData.bend2 !== undefined ? Number(inspectionData.bend2) : null,
        mix: inspectionData.mix || null,
        mixRaw: inspectionData.mixRaw || null,
        smixEnabled: inspectionData.smixEnabled === 'true' || inspectionData.smixEnabled === true,
        mixS: inspectionData.mixS || null,
        mixSRaw: inspectionData.mixSRaw || null,
        lmixEnabled: inspectionData.lmixEnabled === 'true' || inspectionData.lmixEnabled === true,
        mixL: inspectionData.mixL || null,
        mixLRaw: inspectionData.mixLRaw || null,
        sk: inspectionData.sk || null,
        skRaw: inspectionData.skRaw || null,
        kandu: inspectionData.kandu || null,
        kanduRaw: inspectionData.kanduRaw || null,
        oil: inspectionData.oil || null,
        oilRaw: inspectionData.oilRaw || null,
        smellHas: inspectionData.smellHas === 'true' || inspectionData.smellHas === true,
        smellType: inspectionData.smellType || null,
        paddyWbEnabled: inspectionData.paddyWbEnabled === 'true' || inspectionData.paddyWbEnabled === true,
        paddyWb: inspectionData.paddyWb !== undefined ? Number(inspectionData.paddyWb) : null,
        paddyWbRaw: inspectionData.paddyWbRaw || null,
        reportedBy: inspectionData.reportedBy || 'System',
        reportedAt: new Date().toISOString(),
        imageUrl: null
      };

      if (!existingLorryInspection) {
        // Must start with lot_avg
        if (stage !== 'lot_avg') {
          throw new Error('Must submit Lot Avg Sampling first for this lorry');
        }

        const newInspectionData = {
          sampleEntryId: inspectionData.sampleEntryId,
          lotAllotmentId: lotAllotment.id,
          reportedByUserId: userId,
          inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
          lorryNumber: lorryNumberClean,
          bags: null,
          cutting1: stageData.cutting1 || 0,
          cutting2: stageData.cutting2 || 0,
          bend: stageData.bend1 || 0,
          bend2: stageData.bend2 || 0,
          remarks: inspectionData.remarks || null,
          isComplete: false,
          samplingStages: {
            [stage]: stageData
          }
        };

        inspection = await PhysicalInspectionRepository.create(newInspectionData);
        await AuditService.logCreate(userId, 'physical_inspections', inspection.id, inspection);

        const currentStatus = entry.workflowStatus;
        if (currentStatus !== 'PHYSICAL_INSPECTION' && ['LOT_ALLOTMENT', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'].includes(currentStatus)) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id, reason: 'New progressive lorry added' }
          );
        } else if (existingInspections.length === 0) {
          await WorkflowEngine.transitionTo(
            inspectionData.sampleEntryId,
            'PHYSICAL_INSPECTION',
            userId,
            userRole,
            { physicalInspectionId: inspection.id }
          );
        }
      } else {
        // Load existing record
        const currentInspection = await PhysicalInspectionRepository.findById(existingLorryInspection.id);
        const stages = currentInspection.samplingStages || {};
        
        if (stages[stage]) {
          throw new Error(`Sampling stage '${inspectionData.stage}' has already been submitted and is locked.`);
        }

        if (stage !== 'lot_avg') {
          if (!stages['lot_avg']) {
            throw new Error('Must submit Lot Avg Sampling first for this lorry');
          }
          if (stage === 'full_avg' && !stages['half_lorry'] && !stages['nit_avg']) {
            throw new Error('Must submit Half Lorry or Nit Avg Sampling first before Full Lorry');
          }
        }

        stages[stage] = stageData;
        const updates = {
          samplingStages: stages
        };

        if (stage === 'full_avg') {
          const actualBags = Number.parseInt(inspectionData.actualBags || '0');
          if (!actualBags || actualBags <= 0) {
            throw new Error('Please enter valid actual bags for Full Avg Lorry');
          }

          // Validate remaining bags
          const totalInspected = existingInspections
            .filter(i => i.id !== currentInspection.id)
            .reduce((sum, i) => sum + (i.bags || 0), 0);
          const remainingBags = totalAllottedBags - totalInspected;

          if (actualBags > remainingBags) {
            throw new Error(`Cannot inspect ${actualBags} bags. Only ${remainingBags} bags remaining.`);
          }

          updates.bags = actualBags;
          updates.cutting1 = stageData.cutting1 || 0;
          updates.cutting2 = stageData.cutting2 || 0;
          updates.bend = stageData.bend1 || 0;
          updates.bend2 = stageData.bend2 || 0;
          updates.remarks = inspectionData.remarks || null;

          const newTotalInspected = totalInspected + actualBags;
          if (newTotalInspected >= totalAllottedBags) {
            updates.isComplete = true;
          }
        }

        inspection = await PhysicalInspectionRepository.update(currentInspection.id, updates);
        await AuditService.logUpdate(userId, 'physical_inspections', currentInspection.id, currentInspection, inspection);
      }

      return inspection;
    } catch (error) {
      console.error('Error in multi-stage physical inspection creation:', error);
      throw error;
    }
  }

  /**
   * Get physical inspection by lot allotment ID
   * @param {number} lotAllotmentId - Lot allotment ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Physical inspection or null
   */
  async getPhysicalInspectionByLotAllotment(lotAllotmentId, options = {}) {
    return await PhysicalInspectionRepository.findByLotAllotmentId(lotAllotmentId, options);
  }

  /**
   * Update physical inspection
   * @param {number} id - Physical inspection ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated physical inspection or null
   */
  async updatePhysicalInspection(id, updates, userId) {
    try {
      const current = await PhysicalInspectionRepository.findById(id);
      if (!current) {
        throw new Error('Physical inspection not found');
      }

      const updated = await PhysicalInspectionRepository.update(id, updates);

      await AuditService.logUpdate(userId, 'physical_inspections', id, current, updated);

      return updated;

    } catch (error) {
      console.error('Error updating physical inspection:', error);
      throw error;
    }
  }

  /**
   * Upload inspection images
   * @param {number} inspectionId - Physical inspection ID
   * @param {Object} files - Uploaded files
   * @param {Object} files.halfLorryImage - Half lorry image file
   * @param {Object} files.fullLorryImage - Full lorry image file
   * @param {number} userId - User ID
   * @param {string} [stage] - Sampling stage
   * @returns {Promise<Object>} Updated inspection with image URLs
   */
  async uploadInspectionImages(inspectionId, files, userId, stage) {
    try {
      const updates = {};
      let imageUrl = null;

      const fileToUpload = files.stageImage 
        ? (files.stageImage[0] || files.stageImage) 
        : (files.halfLorryImage ? files.halfLorryImage[0] || files.halfLorryImage : null) || (files.fullLorryImage ? files.fullLorryImage[0] || files.fullLorryImage : null);

      if (fileToUpload) {
        const uploadResult = await FileUploadService.uploadFile(fileToUpload, { compress: true });
        imageUrl = uploadResult.fileUrl;
      }

      const current = await PhysicalInspectionRepository.findById(inspectionId);
      if (!current) {
        throw new Error('Physical inspection not found');
      }

      if (stage && imageUrl) {
        const cleanStage = stage.toLowerCase();
        const stages = current.samplingStages || {};
        if (stages[cleanStage]) {
          stages[cleanStage].imageUrl = imageUrl;
          updates.samplingStages = stages;
        }
      }

      if (files.halfLorryImage || (stage && stage.toLowerCase() === 'half_lorry' && imageUrl)) {
        updates.halfLorryImageUrl = imageUrl || (files.halfLorryImage ? (await FileUploadService.uploadFile(files.halfLorryImage, { compress: true })).fileUrl : null);
      }

      if (files.fullLorryImage || (stage && stage.toLowerCase() === 'full_avg' && imageUrl)) {
        updates.fullLorryImageUrl = imageUrl || (files.fullLorryImage ? (await FileUploadService.uploadFile(files.fullLorryImage, { compress: true })).fileUrl : null);
      }

      return await this.updatePhysicalInspection(inspectionId, updates, userId);
    } catch (error) {
      console.error('Error uploading inspection images:', error);
      throw error;
    }
  }

  /**
   * Get inspection progress for a sample entry
   * @param {string} sampleEntryId - Sample entry ID (UUID)
   * @returns {Promise<Object>} Inspection progress data
   */
  async getInspectionProgress(sampleEntryId) {
    try {
      const SampleEntryRepository = require('../repositories/SampleEntryRepository');
      const LotAllotmentRepository = require('../repositories/LotAllotmentRepository');

      // Get the sample entry to know total bags
      const entry = await SampleEntryRepository.findById(sampleEntryId);
      if (!entry) {
        throw new Error('Sample entry not found');
      }

      // Get lot allotment to check allottedBags
      const lotAllotment = await LotAllotmentRepository.findBySampleEntryId(sampleEntryId);

      // Use allottedBags if available and greater than 0, otherwise use total bags from entry
      const totalBags = (lotAllotment?.allottedBags && lotAllotment.allottedBags > 0) ? lotAllotment.allottedBags : (entry.bags || 0);

      // Get all inspections for this entry
      const inspections = await PhysicalInspectionRepository.findBySampleEntryId(sampleEntryId);

      // Calculate total inspected bags
      const inspectedBags = inspections.reduce((sum, inspection) => sum + (inspection.bags || 0), 0);
      const remainingBags = totalBags - inspectedBags;
      const progressPercentage = totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0;

      const previousInspections = inspections.map(inspection => ({
        id: inspection.id,
        inspectionDate: inspection.inspectionDate,
        lorryNumber: inspection.lorryNumber,
        bags: inspection.bags,
        cutting1: inspection.cutting1,
        cutting2: inspection.cutting2,
        bend: inspection.bend,
        bend2: inspection.bend2,
        reportedBy: inspection.reportedBy,
        samplingStages: inspection.samplingStages,
        lotAllotment: inspection.lotAllotment
      }));

      return {
        totalBags,
        inspectedBags,
        remainingBags,
        progressPercentage,
        previousInspections
      };

    } catch (error) {
      console.error('Error getting inspection progress:', error);
      throw error;
    }
  }
}

module.exports = new PhysicalInspectionService();
