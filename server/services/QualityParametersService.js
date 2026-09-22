const QualityParametersRepository = require('../repositories/QualityParametersRepository');
const ValidationService = require('../services/ValidationService');
const AuditService = require('../services/AuditService');
const SampleEntryRepository = require('../repositories/SampleEntryRepository');
const WorkflowEngine = require('../services/WorkflowEngine');
const { attachLoadingLotsHistories } = require('../utils/historyUtil');

const isResampleWorkflowEntry = (entry = {}) => {
  const decision = String(entry.lotSelectionDecision || '').toUpperCase();
  const originDecision = String(entry.resampleOriginDecision || '').toUpperCase();
  const hasResampleCollectorTimeline =
    (Array.isArray(entry.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0)
    || (Array.isArray(entry.resampleCollectedHistory) && entry.resampleCollectedHistory.length > 0);
  return decision === 'FAIL'
    || originDecision === 'PASS_WITH_COOKING'
    || originDecision === 'PASS_WITHOUT_COOKING'
    || Boolean(entry.resampleTriggerRequired)
    || Boolean(entry.resampleTriggeredAt)
    || Boolean(entry.resampleDecisionAt)
    || Boolean(entry.resampleAfterFinal)
    || Boolean(entry.resampleStartAt)
    || hasResampleCollectorTimeline
    || Number(entry.qualityReportAttempts || 0) > 1;
};

const shouldMoveResampleToLotSelection = (entry = {}) => {
  if (!isResampleWorkflowEntry(entry)) return false;
  if (entry.resampleDecisionAt) return false;
  if (entry.resampleTriggerRequired) {
    return Boolean(entry.resampleTriggeredAt);
  }
  return true;
};

const normalizeAttemptValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value);
};

const areQualityAttemptsEquivalent = (left, right) => {
  const keys = [
    'reportedBy',
    'moistureRaw', 'moisture',
    'dryMoistureRaw', 'dryMoisture',
    'cutting1Raw', 'cutting1', 'cutting2Raw', 'cutting2',
    'bend1Raw', 'bend1', 'bend2Raw', 'bend2',
    'grainsCountRaw', 'grainsCount',
    'mixRaw', 'mix', 'mixSRaw', 'mixS', 'mixLRaw', 'mixL',
    'kanduRaw', 'kandu', 'oilRaw', 'oil', 'skRaw', 'sk',
    'wbRRaw', 'wbR', 'wbBkRaw', 'wbBk', 'wbTRaw', 'wbT',
    'paddyWbRaw', 'paddyWb',
    'gramsReport', 'smellHas', 'smellType'
  ];
  return keys.every((key) => normalizeAttemptValue(left?.[key]) === normalizeAttemptValue(right?.[key]));
};

const buildQualityAttemptSnapshot = (quality = {}) => ({
  sourceQualityId: quality.id || null,
  reportedBy: quality.reportedBy || '',
  reportedByUserId: quality.reportedByUserId || null,
  moisture: quality.moisture,
  moistureRaw: quality.moistureRaw || '',
  dryMoisture: quality.dryMoisture,
  dryMoistureRaw: quality.dryMoistureRaw || '',
  cutting1: quality.cutting1,
  cutting1Raw: quality.cutting1Raw || '',
  cutting2: quality.cutting2,
  cutting2Raw: quality.cutting2Raw || '',
  bend1: quality.bend1,
  bend1Raw: quality.bend1Raw || '',
  bend2: quality.bend2,
  bend2Raw: quality.bend2Raw || '',
  mix: quality.mix,
  mixRaw: quality.mixRaw || '',
  mixS: quality.mixS,
  mixSRaw: quality.mixSRaw || '',
  mixL: quality.mixL,
  mixLRaw: quality.mixLRaw || '',
  kandu: quality.kandu,
  kanduRaw: quality.kanduRaw || '',
  oil: quality.oil,
  oilRaw: quality.oilRaw || '',
  sk: quality.sk,
  skRaw: quality.skRaw || '',
  grainsCount: quality.grainsCount,
  grainsCountRaw: quality.grainsCountRaw || '',
  wbR: quality.wbR,
  wbRRaw: quality.wbRRaw || '',
  wbBk: quality.wbBk,
  wbBkRaw: quality.wbBkRaw || '',
  wbT: quality.wbT,
  wbTRaw: quality.wbTRaw || '',
  paddyWb: quality.paddyWb,
  paddyWbRaw: quality.paddyWbRaw || '',
  smellHas: !!quality.smellHas,
  smellType: quality.smellType || '',
  gramsReport: quality.gramsReport || '',
  uploadFileUrl: quality.uploadFileUrl || null,
  gpsCoordinates: quality.gpsCoordinates || '',
  createdAt: quality.createdAt || null,
  updatedAt: quality.updatedAt || null
});

const syncQualityAttemptSnapshots = async (sampleEntryId, currentQualityBeforeUpdate, updatedQuality, isNewAttempt = false) => {
  const sampleEntry = await SampleEntryRepository.findById(sampleEntryId);
  if (!sampleEntry || !updatedQuality) return;

  const existingAttempts = Array.isArray(sampleEntry.qualityAttemptDetails)
    ? [...sampleEntry.qualityAttemptDetails].filter(Boolean)
    : [];

  const updatedSnapshot = buildQualityAttemptSnapshot(updatedQuality);

  if (isNewAttempt) {
    const firstAttempt = existingAttempts[0] || (currentQualityBeforeUpdate ? { ...buildQualityAttemptSnapshot(currentQualityBeforeUpdate), attemptNo: 1 } : null);
    const secondAttempt = { ...updatedSnapshot, attemptNo: 2 };
    const newAttempts = firstAttempt ? [firstAttempt, secondAttempt] : [secondAttempt];

    await SampleEntryRepository.update(sampleEntryId, {
      qualityAttemptDetails: newAttempts.slice(0, 2),
      qualityReportAttempts: Math.min(2, newAttempts.length)
    });
  } else {
    if (existingAttempts.length >= 2) {
      existingAttempts[1] = {
        ...existingAttempts[1],
        ...updatedSnapshot,
        attemptNo: 2
      };
    } else if (existingAttempts.length === 1) {
      existingAttempts[0] = {
        ...existingAttempts[0],
        ...updatedSnapshot,
        attemptNo: 1
      };
    } else {
      existingAttempts.push({
        ...updatedSnapshot,
        attemptNo: 1
      });
    }

    const finalAttempts = existingAttempts.slice(0, 2);
    await SampleEntryRepository.update(sampleEntryId, {
      qualityAttemptDetails: finalAttempts,
      qualityReportAttempts: Math.min(2, finalAttempts.length)
    });
  }
};

const hydrateSampleEntryWorkflowState = async (entry) => {
  if (!entry) return entry;
  await attachLoadingLotsHistories([entry]);
  return entry;
};

class QualityParametersService {
  /**
   * Reset all quality parameter fields (for recheck)
   * @param {number} sampleEntryId - Sample entry ID
   * @param {number} userId - User ID performing the reset
   * @returns {Promise<boolean>} Success status
   */
  async resetQualityParameters(sampleEntryId, userId) {
    try {
      const current = await QualityParametersRepository.findBySampleEntryId(sampleEntryId);
      if (!current) return false;

      const emptyFields = {
        moisture: 0,
        tempMoisture: 0,
        dryMoisture: 0,
        cutting1: 0,
        cutting2: 0,
        bend1: 0,
        bend2: 0,
        mix: '',
        mixS: '',
        mixL: '',
        kandu: '',
        oil: '',
        sk: '',
        grainsCount: 0,
        wbR: 0,
        wbBk: 0,
        wbT: 0,
        paddyWb: 0,
        reportedBy: '', // non-null constraint
        smellHas: false,
        smellType: '',
        smixEnabled: false,
        lmixEnabled: false,
        paddyWbEnabled: false,
        wbEnabled: false,
        dryMoistureEnabled: false,
        is100Grams: false,
        uploadFileUrl: null,
        // Raw fields
        moistureRaw: '',
        dryMoistureRaw: '',
        cutting1Raw: '',
        cutting2Raw: '',
        bend1Raw: '',
        bend2Raw: '',
        mixRaw: '',
        mixSRaw: '',
        mixLRaw: '',
        kanduRaw: '',
        oilRaw: '',
        skRaw: '',
        grainsCountRaw: '',
        wbRRaw: '',
        wbBkRaw: '',
        wbTRaw: '',
        paddyWbRaw: ''
      };

      const updated = await QualityParametersRepository.update(current.id, emptyFields);
      if (updated) {
        await AuditService.logUpdate(userId, 'quality_parameters', current.id, current, updated);
      }
      return !!updated;
    } catch (error) {
      console.error('Error resetting quality parameters:', error);
      throw error;
    }
  }

  /**
   * Add quality parameters to a sample entry
   * @param {Object} qualityData - Quality parameters data
   * @param {number} userId - User ID adding the parameters
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created quality parameters
   */
  async addQualityParameters(qualityData, userId, userRole) {
    try {
      // Validate input data
      const validation = ValidationService.validateQualityParameters(qualityData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Auto-fill reportedBy with current user
      qualityData.reportedByUserId = userId;

      // Create quality parameters
      const quality = await QualityParametersRepository.create(qualityData);

      // Log audit trail
      await AuditService.logCreate(userId, 'quality_parameters', quality.id, quality);

      // Sync initial quality attempt snapshot
      await syncQualityAttemptSnapshots(qualityData.sampleEntryId, null, quality, false);

      const sampleEntry = await SampleEntryRepository.findById(qualityData.sampleEntryId);
      await hydrateSampleEntryWorkflowState(sampleEntry);
      const workflowStatus = String(sampleEntry?.workflowStatus || '').toUpperCase();
      const lotSelectionDecision = String(sampleEntry?.lotSelectionDecision || '').toUpperCase();

      // Auto-fail logic for smell (Medium, Dark, Orange ONLY)
      const shouldAutoFail = qualityData.smellHas && ['MEDIUM', 'DARK', 'ORANGE'].includes(String(qualityData.smellType).toUpperCase());
      if (shouldAutoFail && sampleEntry && lotSelectionDecision !== 'FAIL') {
        console.log(`[QUALITY] Auto-failing entry ${qualityData.sampleEntryId} due to smell: ${qualityData.smellType}`);
        await SampleEntryRepository.update(qualityData.sampleEntryId, {
          workflowStatus: 'FAILED',
          lotSelectionDecision: 'FAIL',
          lotSelectionAt: new Date(),
          lotSelectionByUserId: userId,
          failRemarks: `Failed: ${String(qualityData.smellType || 'Yes').charAt(0).toUpperCase()}${String(qualityData.smellType || 'Yes').slice(1).toLowerCase()} Smell`,
          smellHas: true,
          smellType: qualityData.smellType
        });
      } else if (sampleEntry) {
        // Sync smell data regardless of type (but don't auto-fail if it's Light)
        await SampleEntryRepository.update(qualityData.sampleEntryId, {
          smellHas: !!qualityData.smellHas,
          smellType: qualityData.smellType || null
        });
      }

      // Transition workflow to LOT_SELECTION (from STAFF_ENTRY) once quality is added
      if (sampleEntry && !shouldAutoFail) {
        let transitioned = false;
        if (workflowStatus === 'STAFF_ENTRY') {
          const nextStatus = 'LOT_SELECTION';
          console.log(`[QUALITY] Transitioning fresh entry ${qualityData.sampleEntryId} from STAFF_ENTRY to ${nextStatus}`);
          await WorkflowEngine.transitionTo(
            qualityData.sampleEntryId,
            nextStatus,
            userId,
            userRole
          );
          transitioned = true;
        } else if (workflowStatus === 'QUALITY_CHECK') {
          // Auto-transition logic for rechecks
          try {
            const SampleEntryAuditLog = require('../models/SampleEntryAuditLog');
            const transitions = await SampleEntryAuditLog.findAll({
              where: {
                tableName: 'sample_entries',
                actionType: 'WORKFLOW_TRANSITION',
                recordId: qualityData.sampleEntryId
              },
              order: [['createdAt', 'DESC']],
              limit: 50,
              raw: true
            });

            const latestRecheck = transitions.find(log => log?.metadata?.recheckRequested === true);
             
            if (latestRecheck?.metadata?.recheckType === 'both') {
              console.log(`[QUALITY] Auto-transitioning 'BOTH' recheck lot ${sampleEntry.id} to COOKING_REPORT`);
              await WorkflowEngine.transitionTo(
                qualityData.sampleEntryId,
                'COOKING_REPORT',
                userId,
                userRole,
                { recheckType: 'both', qualityParametersId: quality.id, autoTransitionFromBoth: true }
              );
              transitioned = true;
            } else if (latestRecheck?.metadata?.recheckType === 'quality' || latestRecheck?.metadata?.recheckType === 'standard_recheck') {
              console.log(`[QUALITY] Auto-transitioning 'QUALITY' recheck lot ${qualityData.sampleEntryId} from QUALITY_CHECK to LOT_SELECTION`);
              await WorkflowEngine.transitionTo(
                qualityData.sampleEntryId,
                'LOT_SELECTION',
                userId,
                userRole
              );
              transitioned = true;
            }
          } catch (auditErr) {
            console.log(`[QUALITY] Skipping auto-transition: ${auditErr.message}`);
          }
        }

        if (!transitioned && shouldMoveResampleToLotSelection(sampleEntry) && ['QUALITY_CHECK', 'FINAL_REPORT', 'LOT_ALLOTMENT', 'STAFF_ENTRY'].includes(workflowStatus)) {
          // Only transition if we haven't logged this resample completion yet (prevents 3rd sample duplication)
          const history = await AuditService.getRecordHistory('sample_entries', qualityData.sampleEntryId);
          const alreadyLogged = (history || []).some(log => 
            log.actionType === 'WORKFLOW_TRANSITION' && 
            log.newValues?.workflowStatus === 'LOT_SELECTION' && 
            log.metadata?.resampleQualitySaved === true
          );

          if (!alreadyLogged) {
            console.log(`[QUALITY] Transitioning resample entry ${qualityData.sampleEntryId} from ${workflowStatus} to LOT_SELECTION`);
            await WorkflowEngine.transitionTo(
              qualityData.sampleEntryId,
              'LOT_SELECTION',
              userId,
              userRole,
              { resampleQualitySaved: true }
            );
          } else {
            console.log(`[QUALITY] Resample quality already logged for ${qualityData.sampleEntryId}, skipping transition`);
          }
          transitioned = true;
        }

        if (!transitioned) {
          console.log(`[QUALITY] Skipping transition for ${qualityData.sampleEntryId}: current status is ${sampleEntry?.workflowStatus}`);
        }
      }

      return quality;
    } catch (error) {
      console.error('Error adding quality parameters:', error);
      throw error;
    }
  }

  /**
   * Get quality parameters by sample entry ID
   * @param {number} sampleEntryId - Sample entry ID
   * @returns {Promise<Object|null>} Quality parameters or null
   */
  async getQualityParametersBySampleEntry(sampleEntryId) {
    return await QualityParametersRepository.findBySampleEntryId(sampleEntryId);
  }

  /**
   * Update quality parameters
   * @param {number} id - Quality parameters ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated quality parameters or null
   */
  async updateQualityParameters(id, updates, userId, userRole, options = {}) {
    try {
      // Get current quality parameters
      const current = await QualityParametersRepository.findBySampleEntryId(updates.sampleEntryId);
      if (!current) {
        throw new Error('Quality parameters not found');
      }

      // Validate updates
      const validation = ValidationService.validateQualityParameters(updates);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Update quality parameters
      const updated = await QualityParametersRepository.update(id, updates);

      // Sync attempt snapshots (ensures attempt 2 is accurately updated with latest fields without inheriting attempt 1 cutting/bend)
      await syncQualityAttemptSnapshots(updates.sampleEntryId, current, updated, options.createNewAttempt === true);

      // Auto-fail logic for smell (Medium, Dark, Orange ONLY) - sync to SampleEntry
      const shouldAutoFailPostUpdate = updates.smellHas && ['MEDIUM', 'DARK', 'ORANGE'].includes(String(updates.smellType).toUpperCase());
      if (shouldAutoFailPostUpdate) {
        await SampleEntryRepository.update(updates.sampleEntryId, {
          workflowStatus: 'FAILED',
          lotSelectionDecision: 'FAIL',
          lotSelectionAt: new Date(),
          lotSelectionByUserId: userId,
          failRemarks: `Failed: ${String(updates.smellType || 'Yes').charAt(0).toUpperCase()}${String(updates.smellType || 'Yes').slice(1).toLowerCase()} Smell`,
          smellHas: true,
          smellType: updates.smellType
        });
      } else if (updates.smellHas !== undefined) {
        // Sync smell even if not auto-failing
        await SampleEntryRepository.update(updates.sampleEntryId, {
          smellHas: !!updates.smellHas,
          smellType: updates.smellType || null
        });
      }

      // Log audit trail
      await AuditService.logUpdate(userId, 'quality_parameters', id, current, updated);

      // If upgrading from 100g to full quality (is100Grams=false), transition workflow
      if (userRole) {
        try {
          const sampleEntry = await SampleEntryRepository.findById(updates.sampleEntryId);
          await hydrateSampleEntryWorkflowState(sampleEntry);
          const workflowStatus = String(sampleEntry?.workflowStatus || '').toUpperCase();
          const lotSelectionDecision = String(sampleEntry?.lotSelectionDecision || '').toUpperCase();
          if (
            sampleEntry
            && !shouldAutoFailPostUpdate
            && (
              workflowStatus === 'STAFF_ENTRY'
              || (shouldMoveResampleToLotSelection(sampleEntry) && ['QUALITY_CHECK', 'FINAL_REPORT', 'LOT_ALLOTMENT'].includes(workflowStatus))
            )
          ) {
            // Only transition if we haven't logged this resample completion yet
            const history = await AuditService.getRecordHistory('sample_entries', updates.sampleEntryId);
            const alreadyLogged = (history || []).some(log => 
              log.actionType === 'WORKFLOW_TRANSITION' && 
              log.newValues?.workflowStatus === 'LOT_SELECTION' && 
              log.metadata?.resampleQualitySaved === true
            );

            if (!alreadyLogged) {
              let targetStatus = 'LOT_SELECTION';
              await WorkflowEngine.transitionTo(
                updates.sampleEntryId,
                targetStatus,
                userId,
                userRole,
                isResampleWorkflowEntry(sampleEntry) ? { resampleQualitySaved: true } : {}
              );
            } else {
              console.log(`[QUALITY] Resample quality already logged for ${updates.sampleEntryId}, skipping redundant transition`);
            }
          }
        } catch (weErr) {
          console.log(`[QUALITY] WE transition failed: ${weErr.message}`);
        }
      }

      return updated;
    } catch (error) {
      console.error('Error updating quality parameters:', error);
      throw error;
    }
  }
}

module.exports = new QualityParametersService();
