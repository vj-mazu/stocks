const express = require('express');
const router = express.Router();

const createPendingManagerApprovalRequest = (data, requestedBy, requestedAt = new Date()) => ({
  id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  data: data || {},
  requestedBy: requestedBy || null,
  requestedAt: requestedAt instanceof Date ? requestedAt.toISOString() : requestedAt
});

const normalizePendingManagerApprovalQueue = (offering) => {
  const queue = Array.isArray(offering?.pendingManagerValueApprovalQueue)
    ? offering.pendingManagerValueApprovalQueue
        .filter((item) => item && typeof item === 'object' && item.data && typeof item.data === 'object')
        .map((item) => ({
          id: item.id || `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          data: item.data || {},
          requestedBy: item.requestedBy ?? null,
          requestedAt: item.requestedAt || null
        }))
    : [];

  if (queue.length > 0) return queue;

  const legacyData = offering?.pendingManagerValueApprovalData;
  if (legacyData && typeof legacyData === 'object' && Object.keys(legacyData).length > 0) {
    return [
      createPendingManagerApprovalRequest(
        legacyData,
        offering?.pendingManagerValueApprovalRequestedBy || null,
        offering?.pendingManagerValueApprovalRequestedAt || new Date()
      )
    ];
  }

  return [];
};
const { auth: authenticateToken } = require('../middleware/auth');
const SampleEntryService = require('../services/SampleEntryService');
const QualityParametersService = require('../services/QualityParametersService');
const CookingReportService = require('../services/CookingReportService');
const LotAllotmentService = require('../services/LotAllotmentService');
const PhysicalInspectionService = require('../services/PhysicalInspectionService');
const InventoryDataService = require('../services/InventoryDataService');
const FinancialCalculationService = require('../services/FinancialCalculationService');
const WorkflowEngine = require('../services/WorkflowEngine');
const FileUploadService = require('../services/FileUploadService');
const SampleEntry = require('../models/SampleEntry');
const QualityParameters = require('../models/QualityParameters');
const SampleEntryOffering = require('../models/SampleEntryOffering');
const CookingReport = require('../models/CookingReport');
const SampleEntryAuditLog = require('../models/SampleEntryAuditLog');
const User = require('../models/User');
const { attachLoadingLotsHistories } = require('../utils/historyUtil');
const { shouldCreateNewQualityAttempt, normalizeQualityEntryIntent } = require('../utils/qualityEntryIntent');
const { Op, col, where: sqlWhere } = require('sequelize');
const getWorkflowRole = (user) => user?.effectiveRole || user?.role;
const isUserMatchingAssigned = (assigned, username, fullName) => {
  if (!assigned) return false;
  const cleanAssigned = assigned.trim().toLowerCase();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanFullName = String(fullName || '').trim().toLowerCase();

  // 1. Exact match
  if (cleanAssigned === cleanUsername || cleanAssigned === cleanFullName) {
    return true;
  }

  // 2. Prefix/First name match: If assigned name is a single word, check if username or fullName starts with it.
  // e.g., assigned: "mahesh", fullName: "mahesh patil" -> matches
  // e.g., assigned: "mahesh", username: "mahesh.l" -> matches
  const assignedWords = cleanAssigned.split(/\s+/);
  if (assignedWords.length === 1 && assignedWords[0].length >= 3) {
    const firstWord = assignedWords[0];
    if (cleanUsername.startsWith(firstWord) || cleanFullName.startsWith(firstWord)) {
      return true;
    }
  }

  // 3. Reverse prefix match: If username or fullName is a single word, check if assigned starts with it.
  // e.g., assigned: "mahesh patil", fullName: "mahesh" -> matches
  const usernameWords = cleanUsername.split(/\s+/);
  if (usernameWords.length === 1 && usernameWords[0].length >= 3) {
    if (cleanAssigned.startsWith(usernameWords[0])) {
      return true;
    }
  }
  const fullNameWords = cleanFullName.split(/\s+/);
  if (fullNameWords.length === 1 && fullNameWords[0].length >= 3) {
    if (cleanAssigned.startsWith(fullNameWords[0])) {
      return true;
    }
  }

  return false;
};
const hasResampleCollectorTimeline = (entry = {}) => (
  (Array.isArray(entry?.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0)
  || (Array.isArray(entry?.resampleCollectedHistory) && entry.resampleCollectedHistory.length > 0)
);
const isConvertedLocationResample = (entry = {}) => (
  String(entry?.entryType || '').toUpperCase() === 'LOCATION_SAMPLE'
  && !!String(entry?.originalEntryType || '').trim()
  && String(entry?.originalEntryType || '').toUpperCase() !== 'LOCATION_SAMPLE'
);
const isResampleWorkflowMarker = (entry = {}) => {
  const decision = String(entry?.lotSelectionDecision || '').toUpperCase();
  const originDecision = String(entry?.resampleOriginDecision || '').toUpperCase();
  return decision === 'FAIL'
    || originDecision === 'PASS_WITH_COOKING'
    || originDecision === 'PASS_WITHOUT_COOKING'
    || Boolean(entry?.resampleTriggerRequired)
    || Boolean(entry?.resampleTriggeredAt)
    || Boolean(entry?.resampleDecisionAt)
    || Boolean(entry?.resampleAfterFinal)
    || Boolean(entry?.resampleStartAt)
    || hasResampleCollectorTimeline(entry)
    || isConvertedLocationResample(entry)
    || Number(entry?.qualityReportAttempts || 0) > 1;
};
const canLocationStaffEditQuality = async (sampleEntry, reqUser) => {
  const workflowRole = getWorkflowRole(reqUser);
  if (workflowRole !== 'physical_supervisor') {
    return true;
  }

  const currentUser = await User.findByPk(reqUser.userId, { attributes: ['username', 'fullName'], raw: true });
  const currentUsername = String(currentUser?.username || reqUser?.username || '').trim().toLowerCase();
  const currentFullName = String(currentUser?.fullName || '').trim().toLowerCase();

  const assignedUsername = String(sampleEntry.sampleCollectedBy || '').trim().toLowerCase();

  // Resample assignment: only the assigned location staff can edit quality (any entry type).
  if (isResampleWorkflowMarker(sampleEntry) && assignedUsername) {
    return isUserMatchingAssigned(assignedUsername, currentUsername, currentFullName);
  }

  if (sampleEntry.entryType !== 'LOCATION_SAMPLE') {
    return true;
  }

  // Restriction: If Location Sample is "Taken By" (not given to office),
  // only the specific user who collected it can add quality.
  if (sampleEntry.sampleGivenToOffice === true) {
    return true;
  }

  if (assignedUsername) {
    return isUserMatchingAssigned(assignedUsername, currentUsername, currentFullName);
  }

  return sampleEntry.createdByUserId === reqUser.userId;
};

const hydrateSampleEntryWorkflowState = async (entry) => {
  if (!entry) return entry;
  await attachLoadingLotsHistories([entry]);
  if (entry?.dataValues && typeof entry.dataValues === 'object') {
    Object.assign(entry, entry.dataValues);
  }
  return entry;
};

const invalidateSampleEntryTabCaches = () => {
  [
    'sample-entries/tabs/edit-approvals',
    'sample-entries/tabs/final-pass-lots',
    'sample-entries/tabs/loading-lots',
    'sample-entries/tabs/resample-assignments',
    'sample-entries/tabs/completed-lots',
    'sample-entries/tabs/sample-book',
    'sample-entries/tabs/rate-linking-approvals',
    'sample-entries/by-role'
  ].forEach(invalidateCache);
};

// --- Quality Parameters Helper Functions ---
const parseFloatSafe = (value, fallback = 0) => {
  if (value === undefined || value === null) return fallback;
  if (value === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
};

const parseIntSafe = (value, fallback = 0) => {
  if (value === undefined || value === null) return fallback;
  if (value === '') return 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const normalizeAlphaNumeric = (value, fallback = '0') => {
  if (value === undefined || value === null) return fallback;
  if (value === '') return '0';
  const raw = String(value).trim();
  if (!raw) return fallback;
  const capped = raw.slice(0, 20);
  if (/[a-zA-Z]/.test(capped)) return capped;
  const num = parseFloat(capped);
  return Number.isFinite(num) ? String(num) : fallback;
};

const normalizeRaw = (value) => {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  return raw === '' ? null : raw;
};

const parseBoolFlag = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
};

const resolveQualitySmellInput = (body = {}, sampleEntry = {}, existingQuality = null, options = {}) => {
  const smellHasFlag = parseBoolFlag(body.smellHas);
  const smellAnsweredFlag = parseBoolFlag(body.smellAnswered);
  const explicitSmellType = typeof body.smellType === 'string' ? body.smellType.trim() : '';
  const requireExplicitSmell = options.requireExplicitSmell === true;

  if (requireExplicitSmell || smellAnsweredFlag === true) {
    if (requireExplicitSmell && smellAnsweredFlag !== true) {
      throw new Error('Please choose smell Yes or No for resample quality');
    }
    if (smellHasFlag === true && explicitSmellType === '') {
      throw new Error('Please choose smell type for resample quality');
    }
    return {
      smellHas: smellHasFlag === true,
      smellType: smellHasFlag === true ? explicitSmellType : ''
    };
  }

  const entrySmellType = String(sampleEntry?.smellType || '').trim();
  const existingSmellType = String(existingQuality?.smellType || '').trim();
  const preservedSmellType = entrySmellType || existingSmellType || '';
  const preservedSmellHas =
    sampleEntry?.smellHas === true
    || existingQuality?.smellHas === true
    || preservedSmellType !== '';

  // The current quality UI treats smell as preserved display data.
  // If a blank/false smell payload arrives while the entry already has smell,
  // preserve the real stored smell instead of converting it to "No Smell".
  const shouldPreserveStoredSmell =
    preservedSmellHas
    && explicitSmellType === ''
    && (smellHasFlag === null || smellHasFlag === false);

  if (shouldPreserveStoredSmell) {
    return {
      smellHas: true,
      smellType: preservedSmellType
    };
  }

  const smellHas = smellHasFlag !== null ? smellHasFlag : preservedSmellHas;
  const smellType = smellHas ? (explicitSmellType || preservedSmellType) : '';

  return { smellHas, smellType };
};
const toTitleCaseWords = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase())
  .trim();

const normalizeAuditMetadata = (metadata) => {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch (error) {
      return null;
    }
  }
  return metadata;
};

const hasAlphaOrPositive = (value) => {
  if (value === undefined || value === null) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  if (/[a-zA-Z]/.test(raw)) return true;
  const num = Number(raw);
  return Number.isFinite(num);
};

const normalizeGramsReport = (value, fallback = '10gms') => {
  if (value === undefined || value === null || value === '') return fallback;
  return value === '5gms' ? '5gms' : '10gms';
};
const isProvidedNumericValue = (rawVal, valueVal) => {
  const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
  if (raw !== '') return true;
  const num = Number(valueVal);
  return Number.isFinite(num);
};
const isProvidedAlphaValue = (rawVal, valueVal) => {
  const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
  if (raw !== '') return true;
  return hasAlphaOrPositive(valueVal);
};
const hasQualitySnapshot = (attempt = {}) => {
  const hasMoisture = isProvidedNumericValue(attempt.moistureRaw, attempt.moisture);
  const hasGrains = isProvidedNumericValue(attempt.grainsCountRaw, attempt.grainsCount);
  const hasDetailedQuality =
    isProvidedNumericValue(attempt.cutting1Raw, attempt.cutting1) ||
    isProvidedNumericValue(attempt.bend1Raw, attempt.bend1) ||
    isProvidedAlphaValue(attempt.mixRaw, attempt.mix) ||
    isProvidedAlphaValue(attempt.mixSRaw, attempt.mixS) ||
    isProvidedAlphaValue(attempt.mixLRaw, attempt.mixL) ||
    isProvidedAlphaValue(attempt.kanduRaw, attempt.kandu) ||
    isProvidedAlphaValue(attempt.oilRaw, attempt.oil) ||
    isProvidedAlphaValue(attempt.skRaw, attempt.sk);

  return hasMoisture && (hasGrains || hasDetailedQuality);
};
const hasAnyDetailedQuality = (attempt = {}) => (
  isProvidedNumericValue(attempt.cutting1Raw, attempt.cutting1)
  || isProvidedNumericValue(attempt.cutting2Raw, attempt.cutting2)
  || isProvidedNumericValue(attempt.bend1Raw, attempt.bend1)
  || isProvidedNumericValue(attempt.bend2Raw, attempt.bend2)
  || isProvidedAlphaValue(attempt.mixRaw, attempt.mix)
  || isProvidedAlphaValue(attempt.mixSRaw, attempt.mixS)
  || isProvidedAlphaValue(attempt.mixLRaw, attempt.mixL)
  || isProvidedAlphaValue(attempt.kanduRaw, attempt.kandu)
  || isProvidedAlphaValue(attempt.oilRaw, attempt.oil)
  || isProvidedAlphaValue(attempt.skRaw, attempt.sk)
);
const hasFullQualitySnapshot = (attempt = {}) => {
  const hasMoisture = isProvidedNumericValue(attempt.moistureRaw, attempt.moisture);
  const hasGrains = isProvidedNumericValue(attempt.grainsCountRaw, attempt.grainsCount);
  return hasMoisture
    && hasGrains
    && isProvidedNumericValue(attempt.cutting1Raw, attempt.cutting1)
    && isProvidedNumericValue(attempt.cutting2Raw, attempt.cutting2)
    && isProvidedNumericValue(attempt.bend1Raw, attempt.bend1)
    && isProvidedNumericValue(attempt.bend2Raw, attempt.bend2)
    && isProvidedAlphaValue(attempt.mixRaw, attempt.mix)
    && isProvidedAlphaValue(attempt.kanduRaw, attempt.kandu)
    && isProvidedAlphaValue(attempt.oilRaw, attempt.oil)
    && isProvidedAlphaValue(attempt.skRaw, attempt.sk);
};
const hasSampleBookReadySnapshot = (attempt = {}) => {
  const hasMoisture = isProvidedNumericValue(attempt.moistureRaw, attempt.moisture);
  const hasGrains = isProvidedNumericValue(attempt.grainsCountRaw, attempt.grainsCount);
  if (hasResampleCookingPrepSnapshot(attempt)) return true;
  if (!hasMoisture || !hasGrains) return false;
  if (hasFullQualitySnapshot(attempt)) return true;
  return !hasAnyDetailedQuality(attempt);
};
const hasResampleCookingPrepSnapshot = (attempt = {}) => (
  isProvidedNumericValue(attempt.moistureRaw, attempt.moisture)
  && isProvidedNumericValue(attempt.wbRRaw, attempt.wbR)
  && isProvidedNumericValue(attempt.wbBkRaw, attempt.wbBk)
  && isProvidedNumericValue(attempt.paddyWbRaw, attempt.paddyWb)
  && isProvidedNumericValue(attempt.grainsCountRaw, attempt.grainsCount)
  && !hasAnyDetailedQuality(attempt)
);
const normalizeAttemptValue = (value = '') => String(value ?? '').trim().toLowerCase();
const areQualityAttemptsEquivalent = (left = {}, right = {}) => {
  const fields = [
    'reportedBy',
    'moistureRaw', 'moisture',
    'grainsCountRaw', 'grainsCount',
    'cutting1Raw', 'cutting1',
    'cutting2Raw', 'cutting2',
    'bend1Raw', 'bend1',
    'bend2Raw', 'bend2',
    'mixRaw', 'mix',
    'mixSRaw', 'mixS',
    'mixLRaw', 'mixL',
    'kanduRaw', 'kandu',
    'oilRaw', 'oil',
    'skRaw', 'sk',
    'wbRRaw', 'wbR',
    'wbBkRaw', 'wbBk',
    'wbTRaw', 'wbT',
    'paddyWbRaw', 'paddyWb',
    'smellHas', 'smellType'
  ];
  return fields.every((field) => normalizeAttemptValue(left?.[field]) === normalizeAttemptValue(right?.[field]));
};
const getQualityAttemptsForEntry = (entry = {}) => {
  const attempts = Array.isArray(entry.qualityAttemptDetails)
    ? [...entry.qualityAttemptDetails].filter(Boolean).sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0))
    : [];
  const currentQuality = entry.qualityParameters;
  if (!currentQuality || !hasQualitySnapshot(currentQuality)) {
    return attempts;
  }
  const alreadyIncluded = attempts.some((attempt) => (
    areQualityAttemptsEquivalent(attempt, currentQuality)
  ));
  if (alreadyIncluded) {
    return attempts;
  }
  return [
    ...attempts,
    {
      ...currentQuality,
      attemptNo: attempts.length + 1
    }
  ];
};
const shouldCreateNewResampleQualityAttempt = (entry = {}) => {
  const workflowStatus = String(entry?.workflowStatus || '').toUpperCase();
  const originDecision = String(entry?.resampleOriginDecision || '').toUpperCase();
  const persistedAttemptCount = Math.max(
    Number(entry?.qualityReportAttempts || 0),
    Array.isArray(entry?.qualityAttemptDetails) ? entry.qualityAttemptDetails.length : 0
  );
  const isExplicitResampleCycle = isResampleWorkflowMarker(entry)
    && (
      String(entry?.lotSelectionDecision || '').toUpperCase() === 'FAIL'
      || originDecision === 'PASS_WITHOUT_COOKING'
      || originDecision === 'PASS_WITH_COOKING'
      || Boolean(entry?.resampleTriggerRequired)
      || Boolean(entry?.resampleTriggeredAt)
      || Boolean(entry?.resampleDecisionAt)
      || Boolean(entry?.resampleAfterFinal)
      || Boolean(entry?.resampleStartAt)
      || hasResampleCollectorTimeline(entry)
      || isConvertedLocationResample(entry)
    );
  return isExplicitResampleCycle
    && persistedAttemptCount <= 1
    && !['FAILED', 'COMPLETED_LOT'].includes(workflowStatus);
};
const toTimeValue = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};
const hasPersistedResampleQualityAttempt = (entry = {}) => {
  if (!isResampleWorkflowMarker(entry)) return false;
  const resampleStartTime = toTimeValue(
    entry?.resampleStartAt
    || entry?.resampleTriggeredAt
    || entry?.resampleDecisionAt
    || null
  );
  if (!resampleStartTime) return false;
  const attempts = Array.isArray(entry?.qualityAttemptDetails)
    ? entry.qualityAttemptDetails.filter(Boolean)
    : [];
  return attempts.some((attempt) => {
    const attemptTime = toTimeValue(attempt?.updatedAt || attempt?.createdAt || null);
    return attemptTime > 0 && attemptTime >= (resampleStartTime - 2000);
  });
};
const hasPostResampleSampleBookAttempt = (entry = {}) => {
  const attempts = getQualityAttemptsForEntry(entry);
  if (attempts.length <= 1) return false;
  const latestAttempt = attempts[attempts.length - 1] || null;
  return !!latestAttempt && hasSampleBookReadySnapshot(latestAttempt);
};
const hasAssignedResampleCollector = (entry = {}) => {
  const timeline = Array.isArray(entry?.resampleCollectedTimeline) ? entry.resampleCollectedTimeline.filter(Boolean) : [];
  const history = Array.isArray(entry?.resampleCollectedHistory) ? entry.resampleCollectedHistory.filter(Boolean) : [];
  if (timeline.length > 0 || history.length > 0) return true;
  const assignedName = String(entry.sampleCollectedBy || '').trim().toLowerCase();
  return !!assignedName && assignedName !== 'broker office sample';
};
const isPostFinalResampleFlow = (entry = {}) => (
  Boolean(entry?.resampleAfterFinal)
  || (
    isResampleWorkflowMarker(entry)
    && hasAssignedResampleCollector(entry)
    && Boolean(entry.offering?.finalPrice || entry.offering?.finalBaseRate || entry.offering?.isFinalized || entry.finalPrice)
  )
);
const hasCompletedResampleSampleBookAttempt = (entry = {}) => {
  if (!hasAssignedResampleCollector(entry)) return false;
  const workflow = String(entry.workflowStatus || '').toUpperCase();
  if (workflow === 'STAFF_ENTRY' || workflow === 'LOT_ALLOTMENT') return false;
  return hasPostResampleSampleBookAttempt(entry);
};
const isFinalPassVisibleEntry = (entry = {}) => {
  const workflow = String(entry.workflowStatus || '').toUpperCase();
  const decision = String(entry.lotSelectionDecision || '').toUpperCase();
  const cookingStatus = String(entry.cookingReport?.status || '').toUpperCase();
  const hasResampleHistory = Boolean(entry.resampleStartAt) || Number(entry.qualityReportAttempts || 0) > 1;
  const hasFinalizedOffer = Boolean(entry.offering?.finalPrice || entry.offering?.isFinalized || entry.finalPrice);
  const postFinalResample = isPostFinalResampleFlow(entry);

  if (workflow === 'FAILED' || decision === 'SOLDOUT') return false;
  if (postFinalResample) return false;

  if (decision === 'FAIL') {
    if (workflow === 'LOT_ALLOTMENT' && hasFinalizedOffer) return false;
    return ['STAFF_ENTRY', 'QUALITY_CHECK', 'COOKING_REPORT', 'LOT_SELECTION', 'FINAL_REPORT', 'LOT_ALLOTMENT'].includes(workflow);
  }

  if (hasResampleHistory && decision === 'PASS_WITH_COOKING') {
    if (workflow === 'LOT_ALLOTMENT' && hasFinalizedOffer) return false;
    return ['QUALITY_CHECK', 'COOKING_REPORT', 'LOT_SELECTION', 'FINAL_REPORT', 'LOT_ALLOTMENT'].includes(workflow);
  }

  if (workflow === 'FINAL_REPORT') return true;

  return workflow === 'LOT_SELECTION'
    && decision === 'PASS_WITH_COOKING'
    && ['PASS', 'MEDIUM'].includes(cookingStatus);
};
// ------------------------------------------
const getRecheckState = async (sampleEntryId, qualityUpdatedAt, cookingUpdatedAt, qualitySnapshot = null, cookingSnapshot = null) => {
  try {
    const isProvidedNumeric = (rawVal, valueVal) => {
      const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
      if (raw !== '') return true;
      const num = Number(valueVal);
      return Number.isFinite(num) && num > 0;
    };
    const isProvidedAlpha = (rawVal, valueVal) => {
      const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
      if (raw !== '') return true;
      return hasAlphaOrPositive(valueVal);
    };
    const hasQualityData = (qp) => {
      if (!qp) return false;
      const moisture = isProvidedNumeric(qp.moistureRaw, qp.moisture);
      const grains = isProvidedNumeric(qp.grainsCountRaw, qp.grainsCount);
      const cutting = isProvidedNumeric(qp.cutting1Raw, qp.cutting1);
      const bend = isProvidedNumeric(qp.bend1Raw, qp.bend1);
      const mix = isProvidedAlpha(qp.mixRaw, qp.mix)
        || isProvidedAlpha(qp.mixSRaw, qp.mixS)
        || isProvidedAlpha(qp.mixLRaw, qp.mixL);
      return moisture && (grains || cutting || bend || mix);
    };
    const hasCookingData = (cr) => {
      if (!cr) return false;
      const status = String(cr.status || '').trim();
      const doneBy = String(cr.cookingDoneBy || '').trim();
      const approvedBy = String(cr.cookingApprovedBy || '').trim();
      return !!(status || doneBy || approvedBy);
    };

    const transitionLogs = await SampleEntryAuditLog.findAll({
      where: {
        tableName: 'sample_entries',
        actionType: 'WORKFLOW_TRANSITION',
        recordId: sampleEntryId
      },
      order: [['createdAt', 'DESC']],
      limit: 50,
      raw: true
    });
    const latestRecheckLog = transitionLogs.find((log) => {
      const meta = normalizeAuditMetadata(log?.metadata);
      return meta?.recheckRequested === true;
    });
    const latestMeta = normalizeAuditMetadata(latestRecheckLog?.metadata) || null;

    if (!latestMeta?.recheckRequested) {
      return {
        recheckRequested: false,
        recheckType: null,
        recheckAt: null,
        qualityPending: false,
        cookingPending: false
      };
    }

    const recheckType = latestMeta.recheckType || null;
    const previousDecision = latestMeta.previousDecision || null;
    const recheckAt = latestRecheckLog.createdAt || null;
    const recheckTime = recheckAt ? new Date(recheckAt).getTime() : null;
    const qualityTime = qualityUpdatedAt ? new Date(qualityUpdatedAt).getTime() : null;
    const cookingTime = cookingUpdatedAt ? new Date(cookingUpdatedAt).getTime() : null;

    const qualityDone = !!(qualityTime && recheckTime && qualityTime >= recheckTime) && hasQualityData(qualitySnapshot);
    const cookingDone = !!(cookingTime && recheckTime && cookingTime >= recheckTime) && hasCookingData(cookingSnapshot);

    let recheckRequested = true;
    if (recheckType === 'quality') {
      recheckRequested = !qualityDone;
    } else if (recheckType === 'cooking') {
      recheckRequested = !cookingDone;
    } else if (recheckType === 'both') {
      recheckRequested = !(qualityDone && cookingDone);
    } else {
      recheckRequested = false;
    }

      return {
        recheckRequested,
        recheckType,
        recheckAt,
        recheckPreviousDecision: previousDecision,
        qualityPending: (recheckType === 'quality' || recheckType === 'both') ? !qualityDone : false,
        cookingPending: (recheckType === 'cooking' || recheckType === 'both') ? !cookingDone : false
      };
  } catch (error) {
    console.error('Non-critical error fetching recheck status:', error);
    return {
      recheckRequested: false,
      recheckType: null,
      recheckAt: null,
      recheckPreviousDecision: null,
      qualityPending: false,
      cookingPending: false
    };
  }
};

const getRecheckStateForEntries = async (entries) => {
  const result = new Map();
  const ids = entries.map((entry) => entry.id).filter(Boolean);
  if (ids.length === 0) return result;

  const logs = await SampleEntryAuditLog.findAll({
    where: {
      tableName: 'sample_entries',
      actionType: 'WORKFLOW_TRANSITION',
      recordId: { [Op.in]: ids }
    },
    order: [['createdAt', 'DESC']],
    raw: true
  });

  const latestByEntry = new Map();
  logs.forEach((log) => {
    if (latestByEntry.has(log.recordId)) return;
    const meta = normalizeAuditMetadata(log?.metadata);
    if (meta?.recheckRequested === true) {
      latestByEntry.set(log.recordId, {
        meta,
        createdAt: log.createdAt || null
      });
    }
  });

  const isProvidedNumeric = (rawVal, valueVal) => {
    const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
    if (raw !== '') return true;
    const num = Number(valueVal);
    return Number.isFinite(num) && num > 0;
  };
  const isProvidedAlpha = (rawVal, valueVal) => {
    const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
    if (raw !== '') return true;
    return hasAlphaOrPositive(valueVal);
  };
  const hasQualityData = (qp) => {
    if (!qp) return false;
    const moisture = isProvidedNumeric(qp.moistureRaw, qp.moisture);
    const grains = isProvidedNumeric(qp.grainsCountRaw, qp.grainsCount);
    const cutting = isProvidedNumeric(qp.cutting1Raw, qp.cutting1);
    const bend = isProvidedNumeric(qp.bend1Raw, qp.bend1);
    const mix = isProvidedAlpha(qp.mixRaw, qp.mix)
      || isProvidedAlpha(qp.mixSRaw, qp.mixS)
      || isProvidedAlpha(qp.mixLRaw, qp.mixL);
    return moisture && (grains || cutting || bend || mix);
  };
  const hasCookingData = (cr) => {
    if (!cr) return false;
    const status = String(cr.status || '').trim();
    const doneBy = String(cr.cookingDoneBy || '').trim();
    const approvedBy = String(cr.cookingApprovedBy || '').trim();
    return !!(status || doneBy || approvedBy);
  };

  entries.forEach((entry) => {
    const latest = latestByEntry.get(entry.id);
    if (!latest?.meta?.recheckRequested) {
      result.set(entry.id, {
        recheckRequested: false,
        recheckType: null,
        recheckAt: null,
        recheckPreviousDecision: null,
        qualityPending: false,
        cookingPending: false
      });
      return;
    }

    const recheckType = latest.meta.recheckType || null;
    const recheckAt = latest.createdAt || null;
    const qualitySnapshot = entry.qualityParameters || null;
    const cookingSnapshot = entry.cookingReport || null;

    const qualityDone = hasQualityData(qualitySnapshot);
    const cookingDone = hasCookingData(cookingSnapshot);

    let recheckRequested = true;
    if (recheckType === 'quality') {
      recheckRequested = !qualityDone;
    } else if (recheckType === 'cooking') {
      recheckRequested = !cookingDone;
    } else if (recheckType === 'both') {
      recheckRequested = !(qualityDone && cookingDone);
    } else {
      recheckRequested = false;
    }

    result.set(entry.id, {
      recheckRequested,
      recheckType,
      recheckAt,
      recheckPreviousDecision: latest.meta.previousDecision || null,
      qualityPending: (recheckType === 'quality' || recheckType === 'both') ? !qualityDone : false,
      cookingPending: (recheckType === 'cooking' || recheckType === 'both') ? !cookingDone : false
    });
  });

  return result;
};

// ─── Paddy Supervisors list (for Sample Collected By dropdown) ───
router.get('/paddy-supervisors', authenticateToken, async (req, res) => {
  try {
    const { staffType } = req.query;
    const whereClause = {
      role: { [Op.in]: ['staff', 'paddy_supervisor'] },
      isActive: true
    };
    if (staffType) {
      whereClause.staffType = staffType;
    }
    const supervisors = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'fullName', 'staffType'],
      order: [['username', 'ASC']]
    });

    res.json({
      success: true,
      users: supervisors.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName || null,
        staffType: u.staffType || null
      }))
    });
  } catch (error) {
    console.error('Get paddy supervisors error:', error);
    res.status(500).json({ error: 'Failed to fetch paddy supervisors' });
  }
});

// Staff-only: Move entry to QUALITY_CHECK without adding quality parameters
router.post('/:id/send-to-quality', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;

    const requestRole = String(getWorkflowRole(req.user) || req.user.role || '').toLowerCase();

    // Only operational staff roles and admin/manager roles can use this endpoint
    if (!['staff', 'physical_supervisor', 'paddy_supervisor', 'admin', 'manager', 'owner'].includes(requestRole)) {
      return res.status(403).json({ error: 'Only staff can use this endpoint' });
    }

    const entry = await SampleEntry.findByPk(entryId);

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    await hydrateSampleEntryWorkflowState(entry);

    const workflowStatus = String(entry.workflowStatus || '').toUpperCase();
    const isLocationResampleTrigger =
      entry.entryType === 'LOCATION_SAMPLE'
      && isResampleWorkflowMarker(entry)
      && Boolean(entry.resampleTriggerRequired)
      && !entry.resampleTriggeredAt
      && !entry.resampleDecisionAt;

    if (isLocationResampleTrigger && !['admin', 'manager', 'owner'].includes(requestRole)) {
      const currentUser = await User.findByPk(req.user.userId, { attributes: ['username', 'fullName'], raw: true });
      const currentUsername = String(currentUser?.username || req.user?.username || '').trim().toLowerCase();
      const currentFullName = String(currentUser?.fullName || '').trim().toLowerCase();

      const assignedUsername = String(entry.sampleCollectedBy || '').trim().toLowerCase();
      const userMatched = isUserMatchingAssigned(assignedUsername, currentUsername, currentFullName);

      if (!userMatched) {
        return res.status(403).json({ error: 'Only the assigned location sample staff can trigger this resample' });
      }
    }

    if (workflowStatus === 'QUALITY_CHECK') {
      return res.json({
        message: isLocationResampleTrigger ? 'Resample already triggered and pending quality' : 'Entry already sent to Quality Supervisor',
        workflowStatus
      });
    }

    const allowedStatuses = isLocationResampleTrigger
      ? ['STAFF_ENTRY', 'FINAL_REPORT', 'LOT_ALLOTMENT']
      : ['STAFF_ENTRY'];

    if (!allowedStatuses.includes(workflowStatus)) {
      return res.status(400).json({
        error: isLocationResampleTrigger
          ? 'Entry is not in a resample-triggerable status'
          : 'Entry is not in STAFF_ENTRY status'
      });
    }

    // Transition to QUALITY_CHECK
    await WorkflowEngine.transitionTo(
      entryId,
      'QUALITY_CHECK',
      req.user.userId,
      getWorkflowRole(req.user),
      {
        sentByStaff: true,
        resampleTrigger: isLocationResampleTrigger,
        triggerSource: isLocationResampleTrigger ? 'location_sample_trigger' : 'staff_send_to_quality'
      }
    );

    if (isLocationResampleTrigger) {
      await SampleEntryService.updateSampleEntry(
        entryId,
        {
          resampleTriggeredAt: new Date(),
          resampleDecisionAt: null
        },
        req.user.userId
      );
    }

    invalidateSampleEntryTabCaches();

    res.json({
      message: isLocationResampleTrigger
        ? 'Resample triggered successfully'
        : 'Entry sent to Quality Supervisor successfully',
      workflowStatus: 'QUALITY_CHECK'
    });
  } catch (error) {
    console.error('Error sending to quality:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create sample entry (Staff)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();
    upload.fields([{ name: 'godownImage', maxCount: 1 }, { name: 'paddyLotImage', maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const entryData = { ...req.body };

        // Handle uploaded files
        if (req.files) {
          if (req.files.godownImage && req.files.godownImage[0]) {
            const uploadResult = await FileUploadService.uploadFile(req.files.godownImage[0], { compress: true });
            entryData.godownImageUrl = uploadResult.fileUrl;
          }
          if (req.files.paddyLotImage && req.files.paddyLotImage[0]) {
            const uploadResult = await FileUploadService.uploadFile(req.files.paddyLotImage[0], { compress: true });
            entryData.paddyLotImageUrl = uploadResult.fileUrl;
          }
        }

        // Parse boolean and numeric values that might come as strings from FormData
        if (entryData.smellHas !== undefined) {
          entryData.smellHas = entryData.smellHas === 'true';
        }
        if (entryData.sampleGivenToOffice !== undefined) {
          entryData.sampleGivenToOffice = entryData.sampleGivenToOffice === 'true';
        }
        if (Object.prototype.hasOwnProperty.call(entryData, 'bags')) {
          const rawBags = String(entryData.bags ?? '').trim();
          const parsedBags = parseInt(rawBags, 10);
          if (!rawBags || Number.isNaN(parsedBags) || parsedBags < 1) {
            return res.status(400).json({ error: 'Bags must be a positive number.' });
          }
          entryData.bags = parsedBags;
        }

        const requiredError = validateRequiredEntryFields(entryData.entryType, entryData);
        if (requiredError) {
          return res.status(400).json({ error: requiredError });
        }

        const entry = await SampleEntryService.createSampleEntry(entryData, req.user.userId);
        res.status(201).json(entry);
      } catch (error) {
        console.error('Error creating sample entry:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sample entries by role
router.get('/by-role', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate, broker, variety, party, location, collectedBy, page, pageSize, cursor, entryType, excludeEntryType, sampleType, includeInventory } = req.query;

    const filters = {
      status,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      broker,
      variety,
      party,
      location,
      collectedBy,
      sampleType,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
      cursor,
      staffType: req.user.staffType || null,
      staffUsername: req.user.username || null,
      entryType,
      excludeEntryType,
      includeInventory
    };

    // Keep sample-book visibility for all staff users (mill/location).
    // For listing endpoints, using effectiveRole (quality_supervisor/physical_supervisor)
    // applies strict workflow status filters and hides normal staff entries.
    const queryRole =
      req.user.role === 'staff'
        ? 'staff'
        : getWorkflowRole(req.user);

    const result = await SampleEntryService.getSampleEntriesByRole(queryRole, filters, req.user.userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting sample entries:', error);
    res.status(500).json({ error: error.message });
  }
});

const { buildCursorQuery, formatCursorResponse } = require('../utils/cursorPagination');
const {
  SAMPLE_ENTRY_CURSOR_FIELDS,
  fetchHydratedSampleEntryPage
} = require('../utils/sampleEntryPagination');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// ─── TAB ROUTES (MUST be before /:id to avoid route shadowing) ───

const REQUIRED_ENTRY_TYPES = new Set([
  'CREATE_NEW',
  'NEW_PADDY_SAMPLE',
  'DIRECT_LOADED_VEHICLE',
  'READY_LORRY',
  'LOCATION_SAMPLE'
]);

const validateRequiredEntryFields = (entryType, data) => {
  if (!entryType || !REQUIRED_ENTRY_TYPES.has(entryType)) return null;
  const isEmpty = (value) => !String(value ?? '').trim();

  if (isEmpty(data.entryDate)) return 'Entry Date is required';
  if (isEmpty(data.brokerName)) return 'Broker Name is required';
  if (isEmpty(data.variety)) return 'Variety is required';
  if (entryType !== 'DIRECT_LOADED_VEHICLE' && entryType !== 'READY_LORRY' && isEmpty(data.partyName)) {
    return 'Party Name is required';
  }
  if (isEmpty(data.location)) return 'Location is required';
  if (isEmpty(data.bags)) return 'Bags is required';
  if (isEmpty(data.packaging)) return 'Packaging is required';
  if (isEmpty(data.sampleCollectedBy)) return 'Sample Collected By is required';

  if ((entryType === 'DIRECT_LOADED_VEHICLE' || entryType === 'READY_LORRY') && isEmpty(data.lorryNumber)) {
    return 'Lorry Number is required';
  }

  if (data.smellHas === true && isEmpty(data.smellType)) return 'Smell type is required';

  return null;
};

// ─── Loading Lots (passed lots in processing) ───
router.get('/tabs/loading-lots', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, cursor, broker, variety, party, location, collectedBy, sampleType, startDate, endDate, entryType, excludeEntryType } = req.query;

    const baseWhere = {
      [Op.or]: [
        {
          workflowStatus: {
            [Op.in]: ['LOT_ALLOTMENT', 'PHYSICAL_INSPECTION', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW', 'COMPLETED']
          }
        },
        {
          lotSelectionDecision: 'FAIL',
          workflowStatus: { [Op.notIn]: ['CANCELLED', 'FAILED'] }
        }
      ]
    };
    const where = { [Op.and]: [baseWhere] };
    if (broker) where[Op.and].push({ brokerName: { [Op.iLike]: `%${broker}%` } });
    if (variety) where[Op.and].push({ variety: { [Op.iLike]: `%${variety}%` } });
    if (party) where[Op.and].push({ partyName: { [Op.iLike]: `%${party}%` } });
    if (location) where[Op.and].push({ location: { [Op.iLike]: `%${location}%` } });
    if (collectedBy) where[Op.and].push({ sampleCollectedBy: { [Op.iLike]: `%${collectedBy}%` } });
    if (startDate && endDate) where[Op.and].push({ entryDate: { [Op.between]: [startDate, endDate] } });
    if (entryType) where[Op.and].push({ entryType });
    if (excludeEntryType) where[Op.and].push({ entryType: { [Op.ne]: excludeEntryType } });
    if (sampleType) {
      const type = String(sampleType || '').toUpperCase();
      if (type === 'LS') where[Op.and].push({ entryType: 'LOCATION_SAMPLE' });
      if (type === 'RL') where[Op.and].push({ entryType: 'DIRECT_LOADED_VEHICLE' });
      if (type === 'MS') where[Op.and].push({ entryType: { [Op.notIn]: ['LOCATION_SAMPLE', 'DIRECT_LOADED_VEHICLE', 'RICE_SAMPLE'] } });
    }

    // Use cursor pagination if cursor provided, else fallback to offset
    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        attributes: [
          'id', 'serialNo', 'entryDate', 'brokerName', 'variety', 'partyName', 'location', 'bags', 'packaging',
          'workflowStatus', 'createdAt', 'sampleCollectedBy', 'entryType', 'lorryNumber', 'lotSelectionDecision',
          'lotSelectionAt', 'qualityReportAttempts', 'qualityAttemptDetails',
          'resampleOriginDecision', 'resampleTriggeredAt', 'resampleDecisionAt', 'resampleAfterFinal',
          'failRemarks'
        ],
        include: [
          {
            model: QualityParameters,
            as: 'qualityParameters',
            attributes: [
              'id', 'reportedBy', 'moisture', 'dryMoisture', 'cutting1', 'cutting2',
              'bend', 'bend1', 'bend2', 'mixS', 'mixL', 'mix', 'kandu', 'oil', 'sk',
              'grainsCount', 'wbR', 'wbBk', 'wbT', 'paddyWb', 'gramsReport',
              'moistureRaw', 'dryMoistureRaw', 'cutting1Raw', 'cutting2Raw', 'bend1Raw',
              'bend2Raw', 'mixRaw', 'mixSRaw', 'mixLRaw', 'kanduRaw', 'oilRaw', 'skRaw',
              'grainsCountRaw', 'wbRRaw', 'wbBkRaw', 'wbTRaw', 'paddyWbRaw',
              'smellHas', 'smellType', 'createdAt', 'updatedAt'
            ],
            include: [
              {
                model: User,
                as: 'reportedByUser',
                attributes: ['id', 'username', 'fullName'],
                required: false
              }
            ],
            required: false
          },
          {
            model: CookingReport,
            as: 'cookingReport',
            attributes: ['id', 'status', 'remarks', 'cookingDoneBy', 'cookingApprovedBy', 'history', 'updatedAt', 'createdAt'],
            include: [
              {
                model: User,
                as: 'reviewedBy',
                attributes: ['id', 'username', 'fullName'],
                required: false
              }
            ],
            required: false
          },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username', 'fullName'] }
        ],
        subQuery: false
      }
    });

    await attachLoadingLotsHistories(result.entries);
    result.entries = result.entries.filter((entry) => {
      const decision = String(entry?.lotSelectionDecision || '').toUpperCase();
      if (decision === 'FAIL') {
        // Only allow FAIL entries in Loading Lots if they have finalized price/offering
        return entry.offering && (entry.offering.finalPrice || entry.offering.isFinalized);
      }
      return true;
    });

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting loading lots:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ——— Resample Allotment (location resamples) ———
router.get('/tabs/resample-assignments', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = {
      lotSelectionDecision: 'FAIL',
      workflowStatus: { [Op.in]: ['STAFF_ENTRY', 'QUALITY_CHECK', 'LOT_SELECTION', 'FINAL_REPORT', 'LOT_ALLOTMENT'] }
    };
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate || endDate) {
      const formatYMD = (val) => {
        if (!val) return null;
        if (val instanceof Date) {
          if (isNaN(val)) return null;
          const y = val.getFullYear();
          const m = String(val.getMonth() + 1).padStart(2, '0');
          const d = String(val.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
        return String(val).split('T')[0];
      };

      const startYMD = formatYMD(startDate);
      const endYMD = formatYMD(endDate);
      const entryDateCondition = {};
      const updatedAtCondition = {};
      const lotSelectionAtCondition = {};

      if (startYMD && !endYMD) {
        entryDateCondition.entryDate = startYMD;
        updatedAtCondition.updatedAt = {
          [Op.gte]: new Date(`${startYMD}T00:00:00.000Z`),
          [Op.lt]: new Date(new Date(`${startYMD}T00:00:00.000Z`).getTime() + 86400000)
        };
        lotSelectionAtCondition.lotSelectionAt = {
          [Op.gte]: new Date(`${startYMD}T00:00:00.000Z`),
          [Op.lt]: new Date(new Date(`${startYMD}T00:00:00.000Z`).getTime() + 86400000)
        };
      } else {
        entryDateCondition.entryDate = {};
        updatedAtCondition.updatedAt = {};
        lotSelectionAtCondition.lotSelectionAt = {};
        if (startYMD) {
          entryDateCondition.entryDate[Op.gte] = startYMD;
          updatedAtCondition.updatedAt[Op.gte] = new Date(`${startYMD}T00:00:00.000Z`);
          lotSelectionAtCondition.lotSelectionAt[Op.gte] = new Date(`${startYMD}T00:00:00.000Z`);
        }
        if (endYMD) {
          const endBoundary = new Date(new Date(`${endYMD}T00:00:00.000Z`).getTime() + 86400000);
          entryDateCondition.entryDate[Op.lte] = endYMD;
          updatedAtCondition.updatedAt[Op.lt] = endBoundary;
          lotSelectionAtCondition.lotSelectionAt[Op.lt] = endBoundary;
        }
      }

      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            entryDateCondition,
            updatedAtCondition,
            lotSelectionAtCondition
          ]
        }
      ];
    }
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        attributes: [
          'id', 'serialNo', 'entryDate', 'brokerName', 'variety', 'partyName', 'location', 'bags',
          'packaging', 'workflowStatus', 'createdAt', 'updatedAt', 'sampleCollectedBy', 'entryType',
          'lorryNumber', 'lotSelectionDecision', 'lotSelectionAt'
        ],
        include: [
          {
            model: QualityParameters,
            as: 'qualityParameters',
            attributes: ['id', 'createdAt', 'updatedAt'],
            required: false
          }
        ],
        subQuery: false
      }
    });

    await attachLoadingLotsHistories(result.entries);
    result.entries = result.entries.filter((entry) => !hasPostResampleSampleBookAttempt(entry));

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.entries.length, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting resample assignments:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/tabs/edit-approvals', authenticateToken, cacheMiddleware(15), async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'manager', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin/manager can view edit approvals' });
    }

    const entries = await SampleEntry.findAll({
      where: {
        [Op.or]: [
          { entryEditApprovalStatus: 'pending' },
          { qualityEditApprovalStatus: 'pending' }
        ]
      },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'fullName'], required: false }
      ],
      order: [
        ['entryDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    const requestUserIds = Array.from(new Set(entries.flatMap((entry) => ([
      entry.entryEditApprovalRequestedBy,
      entry.qualityEditApprovalRequestedBy
    ])).filter(Boolean)));
    const users = requestUserIds.length
      ? await User.findAll({ where: { id: requestUserIds }, attributes: ['id', 'username', 'fullName'], raw: true })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const payload = entries.map((entry) => {
      const plain = entry.toJSON ? entry.toJSON() : entry;
      return {
        ...plain,
        entryEditApprovalRequestedByName: plain.entryEditApprovalRequestedBy
          ? (userMap.get(plain.entryEditApprovalRequestedBy)?.fullName || userMap.get(plain.entryEditApprovalRequestedBy)?.username || '')
          : '',
        qualityEditApprovalRequestedByName: plain.qualityEditApprovalRequestedBy
          ? (userMap.get(plain.qualityEditApprovalRequestedBy)?.fullName || userMap.get(plain.qualityEditApprovalRequestedBy)?.username || '')
          : ''
      };
    });

    return res.json({ entries: payload });
  } catch (error) {
    console.error('Error getting edit approvals:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tabs/manager-value-approvals', authenticateToken, cacheMiddleware(15), async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin can view manager value approvals' });
    }

    const entries = await SampleEntry.findAll({
      include: [
        {
          model: SampleEntryOffering,
          as: 'offering',
          where: { pendingManagerValueApprovalStatus: 'pending' },
          required: true
        },
        { model: User, as: 'creator', attributes: ['id', 'username', 'fullName'], required: false }
      ],
      order: [
        ['entryDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    const pendingRequests = entries.flatMap((entry) => normalizePendingManagerApprovalQueue(entry?.offering));
    const requestUserIds = Array.from(new Set(pendingRequests.map((request) => request.requestedBy).filter(Boolean)));
    const users = requestUserIds.length
      ? await User.findAll({ where: { id: requestUserIds }, attributes: ['id', 'username', 'fullName'], raw: true })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const payload = entries.flatMap((entry) => {
      const plain = entry.toJSON ? entry.toJSON() : entry;
      const queue = normalizePendingManagerApprovalQueue(plain.offering);
      return queue.map((request) => {
        const requester = request.requestedBy ? userMap.get(request.requestedBy) : null;
        return {
          ...plain,
          pendingManagerValueApprovalRequestId: request.id,
          pendingManagerValueApprovalRequestedByName: requester?.fullName || requester?.username || '',
          offering: {
            ...plain.offering,
            pendingManagerValueApprovalData: request.data,
            pendingManagerValueApprovalRequestedAt: request.requestedAt
          }
        };
      });
    });

    return res.json({ entries: payload });
  } catch (error) {
    console.error('Error getting manager value approvals:', error);
    return res.status(500).json({ error: error.message });
  }
});


router.get('/tabs/rate-linking-approvals', authenticateToken, cacheMiddleware(15), async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin can view rate linking approvals' });
    }

    const entries = await SampleEntry.findAll({
      include: [
        {
          model: SampleEntryOffering,
          as: 'offering',
          where: { pendingRateLinkingStatus: 'pending' },
          required: true
        },
        { model: User, as: 'creator', attributes: ['id', 'username', 'fullName'], required: false }
      ],
      order: [
        ['entryDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    return res.json({ entries });
  } catch (error) {
    console.error('Error getting rate linking approvals:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/rate-linking-decision', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin can approve rate linking requests' });
    }

    const nextDecision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['approve', 'reject'].includes(nextDecision)) {
      return res.status(400).json({ error: 'Decision must be approve or reject' });
    }

    const sampleEntry = await SampleEntry.findByPk(req.params.id, {
      include: [{ model: SampleEntryOffering, as: 'offering', required: false }]
    });
    if (!sampleEntry || !sampleEntry.offering) {
      return res.status(404).json({ error: 'Sample entry offering not found' });
    }

    const offering = sampleEntry.offering;
    if (offering.pendingRateLinkingStatus !== 'pending' || !offering.pendingRateLinkingData) {
      return res.status(400).json({ error: 'No pending rate linking request found for this lot' });
    }

    if (nextDecision === 'approve') {
      const data = offering.pendingRateLinkingData;

      if (data && data.targetLorryTripId) {
        const PhysicalInspection = require('../models/PhysicalInspection');
        const AuditService = require('../services/AuditService');

        const trip = await PhysicalInspection.findByPk(data.targetLorryTripId);
        if (!trip) {
          return res.status(404).json({ error: 'Lorry trip not found. The linked lorry may have been deleted or the ID is invalid.' });
        }

        const oldTrip = JSON.parse(JSON.stringify(trip));
        trip.linkedPattiRate = data.rateInfo;
        trip.finalBaseRate = data.rateInfo.rate;
        trip.finalBaseRateType = data.rateInfo.rateType;
        trip.finalSute = data.rateInfo.sute;
        trip.finalSuteUnit = data.rateInfo.suteUnit;
        trip.moisture = data.rateInfo.moisture;
        trip.revisedHamali = data.rateInfo.hamali;
        trip.hamaliUnit = data.rateInfo.hamaliUnit;
        trip.revisedLf = data.rateInfo.lf;
        trip.lfUnit = data.rateInfo.lfUnit;
        await trip.save();
        await AuditService.logUpdate(req.user.userId, 'physical_inspections', trip.id, oldTrip, trip);

        // Also update the offering with same approved rates so both tables stay in sync
        const offeringUpdates = {
          pendingRateLinkingStatus: 'approved',
          pendingRateLinkingData: null
        };
        if (data.rateInfo) {
          offeringUpdates.finalBaseRate = data.rateInfo.rate;
          offeringUpdates.finalBaseRateType = data.rateInfo.rateType;
          offeringUpdates.finalSute = data.rateInfo.sute;
          offeringUpdates.finalSuteUnit = data.rateInfo.suteUnit;
          offeringUpdates.moistureValue = data.rateInfo.moisture;
          offeringUpdates.hamali = data.rateInfo.hamali;
          offeringUpdates.hamaliUnit = data.rateInfo.hamaliUnit;
          offeringUpdates.lf = data.rateInfo.lf;
          offeringUpdates.lfUnit = data.rateInfo.lfUnit;
        }
        await offering.update(offeringUpdates);
      } else {
        await offering.update({
          finalPrice: data.finalPrice !== undefined ? data.finalPrice : offering.finalPrice,
          finalBaseRate: data.finalBaseRate !== undefined ? data.finalBaseRate : offering.finalBaseRate,
          finalSute: data.finalSute !== undefined ? data.finalSute : offering.finalSute,
          finalSuteUnit: data.finalSuteUnit !== undefined ? data.finalSuteUnit : offering.finalSuteUnit,
          baseRateType: data.baseRateType !== undefined ? data.baseRateType : offering.baseRateType,
          baseRateUnit: data.baseRateUnit !== undefined ? data.baseRateUnit : offering.baseRateUnit,
          moistureValue: data.moistureValue !== undefined ? data.moistureValue : offering.moistureValue,
          hamali: data.hamali !== undefined ? data.hamali : offering.hamali,
          hamaliUnit: data.hamaliUnit !== undefined ? data.hamaliUnit : offering.hamaliUnit,
          brokerage: data.brokerage !== undefined ? data.brokerage : offering.brokerage,
          brokerageUnit: data.brokerageUnit !== undefined ? data.brokerageUnit : offering.brokerageUnit,
          lf: data.lf !== undefined ? data.lf : offering.lf,
          lfUnit: data.lfUnit !== undefined ? data.lfUnit : offering.lfUnit,
          egbValue: data.egbValue !== undefined ? data.egbValue : offering.egbValue,
          egbType: data.egbType !== undefined ? data.egbType : offering.egbType,
          cdEnabled: data.cdEnabled !== undefined ? data.cdEnabled : offering.cdEnabled,
          cdValue: data.cdValue !== undefined ? data.cdValue : offering.cdValue,
          cdUnit: data.cdUnit !== undefined ? data.cdUnit : offering.cdUnit,
          bankLoanEnabled: data.bankLoanEnabled !== undefined ? data.bankLoanEnabled : offering.bankLoanEnabled,
          bankLoanValue: data.bankLoanValue !== undefined ? data.bankLoanValue : offering.bankLoanValue,
          bankLoanUnit: data.bankLoanUnit !== undefined ? data.bankLoanUnit : offering.bankLoanUnit,
          paymentConditionValue: data.paymentConditionValue !== undefined ? data.paymentConditionValue : offering.paymentConditionValue,
          paymentConditionUnit: data.paymentConditionUnit !== undefined ? data.paymentConditionUnit : offering.paymentConditionUnit,
          pendingRateLinkingStatus: 'approved',
          pendingRateLinkingData: null
        });
      }
    } else {
      await offering.update({
        pendingRateLinkingStatus: 'rejected',
        pendingRateLinkingData: null
      });
    }

    invalidateSampleEntryTabCaches();
    return res.json({ success: true, message: `Rate linking request ${nextDecision}ed successfully` });
  } catch (error) {
    console.error('Error deciding rate linking approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/edit-approval-request', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['staff', 'physical_supervisor', 'paddy_supervisor'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only staff can request edit approval' });
    }

    const { type, reason } = req.body || {};
    const requestType = String(type || '').trim().toLowerCase();
    if (!['entry', 'quality'].includes(requestType)) {
      return res.status(400).json({ error: 'Approval type must be entry or quality' });
    }

    const sampleEntry = await SampleEntry.findByPk(req.params.id);
    if (!sampleEntry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    const isQualityRequest = requestType === 'quality';
    const usedCount = Number(isQualityRequest ? sampleEntry.staffBagsEdits : sampleEntry.staffPartyNameEdits) || 0;
    const allowance = Math.max(1, Number(isQualityRequest ? sampleEntry.staffQualityEditAllowance : sampleEntry.staffEntryEditAllowance) || 1);
    if (usedCount < allowance) {
      return res.status(400).json({ error: 'This entry still has a direct staff edit available. Approval is not needed yet.' });
    }

    const statusKey = isQualityRequest ? 'qualityEditApprovalStatus' : 'entryEditApprovalStatus';
    if (sampleEntry[statusKey] === 'pending') {
      return res.status(400).json({ error: 'Approval request is already pending for this edit type.' });
    }

    const updates = isQualityRequest
      ? {
        qualityEditApprovalStatus: 'pending',
        qualityEditApprovalReason: String(reason || '').trim() || null,
        qualityEditApprovalRequestedBy: req.user.userId,
        qualityEditApprovalRequestedAt: new Date(),
        qualityEditApprovalApprovedBy: null,
        qualityEditApprovalApprovedAt: null
      }
      : {
        entryEditApprovalStatus: 'pending',
        entryEditApprovalReason: String(reason || '').trim() || null,
        entryEditApprovalRequestedBy: req.user.userId,
        entryEditApprovalRequestedAt: new Date(),
        entryEditApprovalApprovedBy: null,
        entryEditApprovalApprovedAt: null
      };

    await sampleEntry.update(updates);
    invalidateSampleEntryTabCaches();
    return res.json({ success: true, message: `${isQualityRequest ? 'Quality' : 'Entry'} edit approval requested.` });
  } catch (error) {
    console.error('Error requesting edit approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/edit-approval-decision', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'manager', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin/manager can approve edit requests' });
    }

    const { type, decision } = req.body || {};
    const requestType = String(type || '').trim().toLowerCase();
    const nextDecision = String(decision || '').trim().toLowerCase();
    if (!['entry', 'quality'].includes(requestType) || !['approve', 'reject'].includes(nextDecision)) {
      return res.status(400).json({ error: 'Invalid approval decision request' });
    }

    const sampleEntry = await SampleEntry.findByPk(req.params.id);
    if (!sampleEntry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    const isQualityRequest = requestType === 'quality';
    const statusKey = isQualityRequest ? 'qualityEditApprovalStatus' : 'entryEditApprovalStatus';
    const approvedByKey = isQualityRequest ? 'qualityEditApprovalApprovedBy' : 'entryEditApprovalApprovedBy';
    const approvedAtKey = isQualityRequest ? 'qualityEditApprovalApprovedAt' : 'entryEditApprovalApprovedAt';
    const allowanceKey = isQualityRequest ? 'staffQualityEditAllowance' : 'staffEntryEditAllowance';

    if (sampleEntry[statusKey] !== 'pending') {
      return res.status(400).json({ error: 'No pending request found for this edit type.' });
    }

    const updates = {
      [statusKey]: nextDecision === 'approve' ? 'approved' : 'rejected',
      [approvedByKey]: req.user.userId,
      [approvedAtKey]: new Date()
    };

    if (nextDecision === 'approve') {
      updates[allowanceKey] = Math.max(1, Number(sampleEntry[allowanceKey] || 1)) + 1;
    }

    await sampleEntry.update(updates);
    invalidateSampleEntryTabCaches();
    return res.json({ success: true, message: `${isQualityRequest ? 'Quality' : 'Entry'} edit request ${nextDecision}d.` });
  } catch (error) {
    console.error('Error deciding edit approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/manager-value-approval-decision', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    if (!['admin', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin can approve manager value requests' });
    }

    const nextDecision = String(req.body?.decision || '').trim().toLowerCase();
    const requestId = String(req.body?.requestId || '').trim();
    if (!['approve', 'reject'].includes(nextDecision)) {
      return res.status(400).json({ error: 'Decision must be approve or reject' });
    }

    const sampleEntry = await SampleEntry.findByPk(req.params.id, {
      include: [{ model: SampleEntryOffering, as: 'offering', required: false }]
    });
    if (!sampleEntry || !sampleEntry.offering) {
      return res.status(404).json({ error: 'Sample entry approval request not found' });
    }

    const offering = sampleEntry.offering;
    if (String(offering.pendingManagerValueApprovalStatus || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ error: 'No pending manager approval found for this lot' });
    }

    const pendingQueue = normalizePendingManagerApprovalQueue(offering);
    if (pendingQueue.length === 0) {
      return res.status(400).json({ error: 'No pending manager approval found for this lot' });
    }

    const requestIndex = requestId
      ? pendingQueue.findIndex((item) => item.id === requestId)
      : pendingQueue.length - 1;
    if (requestIndex < 0) {
      return res.status(404).json({ error: 'Pending manager approval request not found' });
    }
    const targetRequest = pendingQueue[requestIndex];

    if (nextDecision === 'reject') {
      const remainingQueue = pendingQueue.filter((_, index) => index !== requestIndex);
      const latestPending = remainingQueue[remainingQueue.length - 1] || null;
      await offering.update({
        pendingManagerValueApprovalStatus: latestPending ? 'pending' : 'rejected',
        pendingManagerValueApprovalQueue: remainingQueue,
        pendingManagerValueApprovalApprovedBy: latestPending ? null : req.user.userId,
        pendingManagerValueApprovalApprovedAt: latestPending ? null : new Date(),
        pendingManagerValueApprovalData: latestPending ? latestPending.data : null,
        pendingManagerValueApprovalRequestedBy: latestPending ? latestPending.requestedBy : null,
        pendingManagerValueApprovalRequestedAt: latestPending ? latestPending.requestedAt : null
      });
      invalidateSampleEntryTabCaches();
      return res.json({ success: true, message: 'Manager value request rejected' });
    }

    const pendingData = targetRequest.data || {};

    const requesterUser = await User.findByPk(targetRequest.requestedBy, { attributes: ['fullName', 'username'] });
    const requesterName = requesterUser?.fullName || requesterUser?.username || 'Manager';
    const approverUser = await User.findByPk(req.user.userId, { attributes: ['fullName', 'username'] });
    const approverName = approverUser?.fullName || approverUser?.username || 'Admin';

    await SampleEntryService.setFinalPrice(
      req.params.id,
      { 
        ...pendingData, 
        fillMissingValues: false,
        requestId: targetRequest.id,
        requestedBy: targetRequest.requestedBy,
        requestedByName: requesterName,
        requestedAt: targetRequest.requestedAt || new Date()
      },
      req.user.userId,
      'admin'
    );

    const managerFieldUpdates = {};
    if (pendingData.hamali !== undefined || pendingData.hamaliUnit !== undefined) managerFieldUpdates.hamaliBy = 'manager';
    if (pendingData.brokerage !== undefined || pendingData.brokerageUnit !== undefined) managerFieldUpdates.brokerageBy = 'manager';
    if (pendingData.lf !== undefined || pendingData.lfUnit !== undefined) managerFieldUpdates.lfBy = 'manager';

    const remainingQueue = pendingQueue.filter((_, index) => index !== requestIndex);
    const latestPending = remainingQueue[remainingQueue.length - 1] || null;

    // Reload offering from database to prevent clobbering disputeVersions
    const updatedOffering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: req.params.id }
    });

    if (updatedOffering) {
      await updatedOffering.update({
        ...managerFieldUpdates,
        pendingManagerValueApprovalStatus: latestPending ? 'pending' : 'approved',
        pendingManagerValueApprovalApprovedBy: latestPending ? null : req.user.userId,
        pendingManagerValueApprovalApprovedAt: latestPending ? null : new Date(),
        pendingManagerValueApprovalQueue: remainingQueue,
        pendingManagerValueApprovalData: latestPending ? latestPending.data : null,
        pendingManagerValueApprovalRequestedBy: latestPending ? latestPending.requestedBy : null,
        pendingManagerValueApprovalRequestedAt: latestPending ? latestPending.requestedAt : null
      });
    }

    if (pendingData.isFinalized) {
      try {
        const entry = await SampleEntryService.getSampleEntryById(req.params.id);
        if (entry && ['FINAL_REPORT', 'LOT_SELECTION'].includes(entry.workflowStatus)) {
          await WorkflowEngine.transitionTo(
            req.params.id,
            'LOT_ALLOTMENT',
            req.user.userId,
            workflowRole,
            { finalPriceSet: true }
          );
        }
      } catch (transitionError) {
        console.error('[MANAGER-VALUE-APPROVAL] Transition FAILED:', transitionError.message);
      }
    }

    invalidateSampleEntryTabCaches();
    return res.json({ success: true, message: 'Manager value request approved' });
  } catch (error) {
    console.error('Error deciding manager value approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Final Pass Lots (optimized for very large datasets) ───
router.get('/tabs/final-pass-lots', authenticateToken, cacheMiddleware(15), async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 100,
      broker,
      variety,
      party,
      location,
      collectedBy,
      sampleType,
      startDate,
      endDate,
      entryType,
      excludeEntryType
    } = req.query;

    // Final Pass Lots should include:
    // 1) entries directly moved to FINAL_REPORT
    // 2) entries that went to cooking and came back to LOT_SELECTION with PASS/MEDIUM
    // 3) entries marked as resample from Final Lots (FAIL) which may already be in loading flow
    const cookingStatusPassOrMedium = sqlWhere(col('cookingReport.status'), { [Op.in]: ['PASS', 'MEDIUM'] });
    const conditionBlocks = [
      {
        [Op.or]: [
          { workflowStatus: 'FINAL_REPORT' },
          {
            [Op.and]: [
              { workflowStatus: 'LOT_SELECTION', lotSelectionDecision: 'PASS_WITH_COOKING' },
              cookingStatusPassOrMedium
            ]
          },
          {
            [Op.and]: [
              {
                workflowStatus: {
                  [Op.in]: ['QUALITY_CHECK', 'COOKING_REPORT', 'LOT_SELECTION', 'FINAL_REPORT', 'LOT_ALLOTMENT']
                }
              },
              { lotSelectionDecision: 'PASS_WITH_COOKING' }
            ]
          },
          {
            [Op.and]: [
              { lotSelectionDecision: 'FAIL' },
              {
                // Re-sample BEFORE final should stay visible in Final Pass Lots.
                // Re-sample AFTER final (already in loading workflow) must skip this tab.
                workflowStatus: {
                  [Op.in]: [
                    'STAFF_ENTRY',
                    'QUALITY_CHECK',
                    'COOKING_REPORT',
                    'LOT_SELECTION',
                    'FINAL_REPORT',
                    'LOT_ALLOTMENT'
                  ]
                }
              }
            ]
          }
        ]
      }
    ];

    if (broker) conditionBlocks.push({ brokerName: { [Op.iLike]: `%${broker}%` } });
    if (variety) conditionBlocks.push({ variety: { [Op.iLike]: `%${variety}%` } });
    if (party) conditionBlocks.push({ partyName: { [Op.iLike]: `%${party}%` } });
    if (location) conditionBlocks.push({ location: { [Op.iLike]: `%${location}%` } });
    if (collectedBy) conditionBlocks.push({ sampleCollectedBy: { [Op.iLike]: `%${collectedBy}%` } });

    if (startDate && endDate) {
      conditionBlocks.push({ entryDate: { [Op.between]: [startDate, endDate] } });
    } else if (startDate) {
      conditionBlocks.push({ entryDate: { [Op.gte]: startDate } });
    } else if (endDate) {
      conditionBlocks.push({ entryDate: { [Op.lte]: endDate } });
    }

    if (entryType) {
      conditionBlocks.push({ entryType });
    } else if (excludeEntryType) {
      conditionBlocks.push({ entryType: { [Op.ne]: excludeEntryType } });
    }
    if (sampleType) {
      const type = String(sampleType || '').toUpperCase();
      if (type === 'LS') conditionBlocks.push({ entryType: 'LOCATION_SAMPLE' });
      if (type === 'RL') conditionBlocks.push({ entryType: 'DIRECT_LOADED_VEHICLE' });
      if (type === 'MS') conditionBlocks.push({ entryType: { [Op.notIn]: ['LOCATION_SAMPLE', 'DIRECT_LOADED_VEHICLE', 'RICE_SAMPLE'] } });
    }

    const include = [
      {
        model: QualityParameters,
        as: 'qualityParameters',
        attributes: [
          'id', 'moisture', 'dryMoisture', 'cutting1', 'cutting2', 'bend', 'bend1', 'bend2',
          'mixS', 'mixL', 'mix', 'kandu', 'oil', 'sk', 'grainsCount', 'wbR', 'wbBk', 'wbT',
          'paddyWb', 'gramsReport', 'reportedBy',
          'moistureRaw', 'dryMoistureRaw', 'cutting1Raw', 'cutting2Raw', 'bend1Raw', 'bend2Raw',
          'mixRaw', 'mixSRaw', 'mixLRaw', 'kanduRaw', 'oilRaw', 'skRaw', 'grainsCountRaw',
          'wbRRaw', 'wbBkRaw', 'wbTRaw', 'paddyWbRaw',
          'updatedAt', 'createdAt'
        ],
        include: [
          {
            model: User,
            as: 'reportedByUser',
            attributes: ['id', 'username', 'fullName'],
            required: false
          }
        ],
        required: false
      },
      {
        model: CookingReport,
        as: 'cookingReport',
        attributes: ['id', 'status', 'remarks', 'cookingDoneBy', 'cookingApprovedBy', 'history', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'reviewedBy',
            attributes: ['id', 'username', 'fullName'],
            required: false
          }
        ],
        required: false
      },
      {
        model: SampleEntryOffering,
        as: 'offering',
        attributes: [
          'id', 'offerRate', 'sute', 'suteUnit', 'baseRateType', 'baseRateUnit',
          'offerBaseRateValue', 'hamaliEnabled', 'hamaliPerKg', 'hamaliPerQuintal',
          'hamaliUnit', 'moistureValue', 'brokerage', 'brokerageEnabled', 'brokerageUnit',
          'lf', 'lfEnabled', 'lfUnit', 'egbType', 'egbValue', 'customDivisor',
          'offerVersions', 'activeOfferKey', 'cdEnabled', 'cdValue', 'cdUnit',
          'bankLoanEnabled', 'bankLoanValue', 'bankLoanUnit',
          'paymentConditionValue', 'paymentConditionUnit',
          'finalBaseRate', 'finalSute', 'finalSuteUnit', 'finalPrice', 'isFinalized'
        ],
        required: false
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'username', 'fullName'],
        required: false
      }
    ];

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    if (paginationQuery.where && Object.keys(paginationQuery.where).length) {
      conditionBlocks.push(paginationQuery.where);
    }
    const mergedWhere = conditionBlocks.length === 1
      ? conditionBlocks[0]
      : { [Op.and]: conditionBlocks };

    const attributes = [
      'id', 'serialNo', 'entryDate', 'createdAt', 'updatedAt', 'workflowStatus', 'lotSelectionDecision', 'lotSelectionAt',
      'brokerName', 'variety', 'partyName', 'location', 'bags', 'packaging',
      'entryType', 'sampleCollectedBy', 'offeringPrice', 'finalPrice', 'lorryNumber'
    ];

    if (paginationQuery.isCursor) {
      const rows = await SampleEntry.findAll({
        where: mergedWhere,
        attributes,
        include,
        order: paginationQuery.order,
        limit: paginationQuery.limit,
        subQuery: false
      });

      const recheckStates = await getRecheckStateForEntries(rows);
      const filteredRows = rows.filter((row) => {
        const state = recheckStates.get(row.id);
        if (state) {
          row.setDataValue('recheckRequested', state.recheckRequested);
          row.setDataValue('recheckType', state.recheckType);
          row.setDataValue('recheckAt', state.recheckAt);
          row.setDataValue('recheckPreviousDecision', state.recheckPreviousDecision);
          row.setDataValue('qualityPending', state.qualityPending);
          row.setDataValue('cookingPending', state.cookingPending);
        }
        if (!(state && state.recheckRequested)) return true;
        const rowData = row?.toJSON ? row.toJSON() : row;
        return isFinalPassVisibleEntry(rowData);
      });
      await attachLoadingLotsHistories(filteredRows);
      const visibleRows = filteredRows.filter((row) => isFinalPassVisibleEntry(row?.toJSON ? row.toJSON() : row));

      const response = formatCursorResponse(visibleRows, paginationQuery.limit, null, {
        fields: SAMPLE_ENTRY_CURSOR_FIELDS
      });
      return res.json({ entries: response.data, pagination: response.pagination });
    }

    const { count, rows } = await SampleEntry.findAndCountAll({
      where: mergedWhere,
      attributes,
      include,
      order: paginationQuery.order,
      limit: paginationQuery.limit,
      offset: paginationQuery.offset,
      subQuery: false,
      distinct: true
    });

    const recheckStates = await getRecheckStateForEntries(rows);
    const filteredRows = rows.filter((row) => {
      const state = recheckStates.get(row.id);
      if (state) {
        row.setDataValue('recheckRequested', state.recheckRequested);
        row.setDataValue('recheckType', state.recheckType);
        row.setDataValue('recheckAt', state.recheckAt);
        row.setDataValue('recheckPreviousDecision', state.recheckPreviousDecision);
        row.setDataValue('qualityPending', state.qualityPending);
        row.setDataValue('cookingPending', state.cookingPending);
      }
      if (!(state && state.recheckRequested)) return true;
      const rowData = row?.toJSON ? row.toJSON() : row;
      return isFinalPassVisibleEntry(rowData);
    });
    await attachLoadingLotsHistories(filteredRows);
    const visibleRows = filteredRows.filter((row) => isFinalPassVisibleEntry(row?.toJSON ? row.toJSON() : row));

    return res.json({
      entries: visibleRows,
      total: visibleRows.length,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      totalPages: Math.max(1, Math.ceil(visibleRows.length / Math.max(1, parseInt(pageSize, 10) || 100)))
    });
  } catch (error) {
    console.error('Error getting final pass lots:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Completed Lots (patti not yet added) ───
router.get('/tabs/completed-lots', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const LotAllotment = require('../models/LotAllotment');
    const PhysicalInspection = require('../models/PhysicalInspection');
    const User = require('../models/User');

    const where = {
      workflowStatus: {
        [Op.in]: ['INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW', 'COMPLETED']
      }
    };
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        include: [
          { model: QualityParameters, as: 'qualityParameters' },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username'] },
          {
            model: LotAllotment,
            as: 'lotAllotment',
            include: [
              {
                model: PhysicalInspection,
                as: 'physicalInspections'
              },
              {
                model: User,
                as: 'supervisor',
                attributes: ['id', 'username', 'fullName']
              }
            ]
          }
        ]
      }
    });

    const activeEntries = result.entries.filter(entry => {
      if (entry.lotAllotment?.closedAt) {
        const type = entry.lotAllotment.completionType;
        if (type === 'CLOSED_EARLY') {
          return false;
        }
        if (!type) {
          // Backward compatibility fallback for older records
          const reason = String(entry.lotAllotment.closedReason || '');
          if (reason.toLowerCase().includes('closed') || reason.toLowerCase().includes('did not send') || reason.toLowerCase().includes('early')) {
            return false;
          }
        }
      }
      return true;
    });

    if (result.pagination) {
      res.json({ entries: activeEntries, pagination: result.pagination });
    } else {
      res.json({ entries: activeEntries, total: activeEntries.length, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting completed lots:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Sample Book (all entries from lot selection onwards) ───
router.get('/tabs/sample-book', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = {};
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        include: [
          { model: QualityParameters, as: 'qualityParameters' },
          { model: CookingReport, as: 'cookingReport' },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ]
      }
    });

    await attachLoadingLotsHistories(result.entries);

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting sample book:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch get offering data for multiple entries (for performance)
// IMPORTANT: This must be BEFORE /:id route to avoid route shadowing
router.get('/offering-data-batch', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids parameter is required' });
    }

    const idList = ids.split(',');
    const offerings = await SampleEntryOffering.findAll({
      where: { sampleEntryId: idList }
    });

    // Convert to map
    const result = {};
    offerings.forEach(o => {
      result[o.sampleEntryId] = o;
    });

    res.json(result);
  } catch (error) {
    console.error('Error batch fetching offering data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get sample entry by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const entry = await SampleEntryService.getSampleEntryById(
      req.params.id, // Keep as UUID string
      {
        includeQuality: true,
        includeCooking: true,
        includeAllotment: true,
        includeInspection: true,
        includeInventory: true,
        includeFinancial: true
      }
    );

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    const result = entry.toJSON ? entry.toJSON() : { ...entry };
    const qualityUpdatedAt = entry?.qualityParameters?.updatedAt || entry?.qualityParameters?.createdAt || null;
    const cookingUpdatedAt = entry?.cookingReport?.updatedAt || entry?.cookingReport?.createdAt || null;
    const recheckState = await getRecheckState(req.params.id, qualityUpdatedAt, cookingUpdatedAt, entry?.qualityParameters, entry?.cookingReport);
    result.recheckRequested = recheckState.recheckRequested;
    result.recheckType = recheckState.recheckType;
    result.recheckAt = recheckState.recheckAt;
    result.qualityPending = recheckState.qualityPending;
    result.cookingPending = recheckState.cookingPending;
    result.recheckPreviousDecision = recheckState.recheckPreviousDecision;
    await attachLoadingLotsHistories([result]);

    res.json(result);
  } catch (error) {
    console.error('Error getting sample entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update sample entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();
    upload.fields([{ name: 'godownImage', maxCount: 1 }, { name: 'paddyLotImage', maxCount: 1 }])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const existingEntry = await SampleEntryService.getSampleEntryById(req.params.id);
        if (!existingEntry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }

        const updates = { ...req.body };

        // Handle uploaded files
        if (req.files) {
          if (req.files.godownImage && req.files.godownImage[0]) {
            const uploadResult = await FileUploadService.uploadFile(req.files.godownImage[0], { compress: true });
            updates.godownImageUrl = uploadResult.fileUrl;
            // Optionally delete old image
            if (existingEntry.godownImageUrl) {
              const oldFileName = existingEntry.godownImageUrl.split('/').pop();
              if (oldFileName) await FileUploadService.deleteFile(oldFileName).catch(e => console.error("Failed to delete old image:", e));
            }
          }
          if (req.files.paddyLotImage && req.files.paddyLotImage[0]) {
            const uploadResult = await FileUploadService.uploadFile(req.files.paddyLotImage[0], { compress: true });
            updates.paddyLotImageUrl = uploadResult.fileUrl;
            // Optionally delete old image
            if (existingEntry.paddyLotImageUrl) {
              const oldFileName = existingEntry.paddyLotImageUrl.split('/').pop();
              if (oldFileName) await FileUploadService.deleteFile(oldFileName).catch(e => console.error("Failed to delete old image:", e));
            }
          }
        }

        // Parse boolean and numeric values that might come as strings from FormData
        if (updates.smellHas !== undefined) {
          updates.smellHas = updates.smellHas === 'true';
        }
        if (updates.sampleGivenToOffice !== undefined) {
          updates.sampleGivenToOffice = updates.sampleGivenToOffice === 'true';
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'bags')) {
          const rawBags = String(updates.bags ?? '').trim();
          const parsedBags = parseInt(rawBags, 10);
          if (!rawBags || Number.isNaN(parsedBags) || parsedBags < 1) {
            return res.status(400).json({ error: 'Bags must be a positive number.' });
          }
          updates.bags = parsedBags;
        }

        const assignmentOnlyFields = new Set([
          'sampleCollectedBy',
          'resampleCollectedBy'
        ]);
        const submittedKeys = Object.keys(updates).filter((key) => updates[key] !== undefined);
        const isAssignmentOnlyPayload = submittedKeys.length > 0
          && submittedKeys.every((key) => assignmentOnlyFields.has(key));
        const isResampleAssignmentUpdate =
          Object.prototype.hasOwnProperty.call(updates, 'sampleCollectedBy')
          && existingEntry.lotSelectionDecision === 'FAIL'
          && isAssignmentOnlyPayload;

        if (!isResampleAssignmentUpdate) {
          const mergedEntry = {
            ...(existingEntry?.toJSON ? existingEntry.toJSON() : existingEntry),
            ...updates
          };
          const requiredError = validateRequiredEntryFields(mergedEntry.entryType, mergedEntry);
          if (requiredError) {
            return res.status(400).json({ error: requiredError });
          }
        }

        if (isResampleAssignmentUpdate) {
          const workflowRole = getWorkflowRole(req.user);
          if (!['admin', 'manager', 'owner'].includes(workflowRole)) {
            return res.status(403).json({ error: 'Only admin/manager can assign resample supervisor' });
          }

          const assignedName = String(updates.sampleCollectedBy || '').trim();
          if (!assignedName) {
            return res.status(400).json({ error: 'Sample Collected By is required for resample assignment' });
          }

          const locationStaffUser = await User.findOne({
            where: {
              username: assignedName,
              role: 'staff',
              staffType: 'location',
              isActive: true
            },
            attributes: ['id', 'username', 'fullName']
          });

          if (!locationStaffUser) {
            return res.status(400).json({ error: 'Assigned user must be an active location staff' });
          }

          updates.sampleCollectedBy = locationStaffUser.fullName || locationStaffUser.username;
        }

        // Staff edit limits are now handled cleanly inside SampleEntryService.updateSampleEntry


        const entry = await SampleEntryService.updateSampleEntry(
          req.params.id, // Keep as UUID string
          updates,
          req.user.userId // Use userId from JWT token
        );

        if (!entry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }

        // Intercept offering Patti edits by manager/admin:
        const userRole = getWorkflowRole(req.user);
        const hasRateEdits = updates.finalPrice !== undefined || updates.finalBaseRate !== undefined ||
          updates.finalSute !== undefined || updates.finalSuteUnit !== undefined ||
          updates.baseRateType !== undefined || updates.baseRateUnit !== undefined ||
          updates.moistureValue !== undefined || updates.hamali !== undefined ||
          updates.hamaliUnit !== undefined || updates.brokerage !== undefined ||
          updates.brokerageUnit !== undefined || updates.lf !== undefined ||
          updates.lfUnit !== undefined || updates.egbValue !== undefined ||
          updates.egbType !== undefined || updates.cdEnabled !== undefined ||
          updates.cdValue !== undefined || updates.cdUnit !== undefined ||
          updates.bankLoanEnabled !== undefined || updates.bankLoanValue !== undefined ||
          updates.bankLoanUnit !== undefined || updates.paymentConditionValue !== undefined ||
          updates.paymentConditionUnit !== undefined;

        if (hasRateEdits) {
          const offering = await SampleEntryOffering.findOne({ where: { sampleEntryId: req.params.id } });
          if (offering) {
            // Prevent overwriting a pending rate linking request
            if (userRole === 'manager' && offering.pendingRateLinkingStatus === 'pending') {
              return res.status(409).json({ error: 'A rate update request is already pending approval for this lot. Please wait for admin to process it before submitting new rates.' });
            }
            if (userRole === 'manager') {
              // Manager rate change -> goes to admin approval
              await offering.update({
                pendingRateLinkingStatus: 'pending',
                pendingRateLinkingData: {
                  finalPrice: updates.finalPrice,
                  finalBaseRate: updates.finalBaseRate,
                  finalSute: updates.finalSute,
                  finalSuteUnit: updates.finalSuteUnit,
                  baseRateType: updates.baseRateType,
                  baseRateUnit: updates.baseRateUnit,
                  moistureValue: updates.moistureValue,
                  hamali: updates.hamali,
                  hamaliUnit: updates.hamaliUnit,
                  brokerage: updates.brokerage,
                  brokerageUnit: updates.brokerageUnit,
                  lf: updates.lf,
                  lfUnit: updates.lfUnit,
                  egbValue: updates.egbValue,
                  egbType: updates.egbType,
                  cdEnabled: updates.cdEnabled,
                  cdValue: updates.cdValue,
                  cdUnit: updates.cdUnit,
                  bankLoanEnabled: updates.bankLoanEnabled,
                  bankLoanValue: updates.bankLoanValue,
                  bankLoanUnit: updates.bankLoanUnit,
                  paymentConditionValue: updates.paymentConditionValue,
                  paymentConditionUnit: updates.paymentConditionUnit
                }
              });
            } else if (['admin', 'owner'].includes(userRole)) {
              // Admin/owner rate change -> applied directly
              await offering.update({
                finalPrice: updates.finalPrice !== undefined ? updates.finalPrice : offering.finalPrice,
                finalBaseRate: updates.finalBaseRate !== undefined ? updates.finalBaseRate : offering.finalBaseRate,
                finalSute: updates.finalSute !== undefined ? updates.finalSute : offering.finalSute,
                finalSuteUnit: updates.finalSuteUnit !== undefined ? updates.finalSuteUnit : offering.finalSuteUnit,
                baseRateType: updates.baseRateType !== undefined ? updates.baseRateType : offering.baseRateType,
                baseRateUnit: updates.baseRateUnit !== undefined ? updates.baseRateUnit : offering.baseRateUnit,
                moistureValue: updates.moistureValue !== undefined ? updates.moistureValue : offering.moistureValue,
                hamali: updates.hamali !== undefined ? updates.hamali : offering.hamali,
                hamaliUnit: updates.hamaliUnit !== undefined ? updates.hamaliUnit : offering.hamaliUnit,
                brokerage: updates.brokerage !== undefined ? updates.brokerage : offering.brokerage,
                brokerageUnit: updates.brokerageUnit !== undefined ? updates.brokerageUnit : offering.brokerageUnit,
                lf: updates.lf !== undefined ? updates.lf : offering.lf,
                lfUnit: updates.lfUnit !== undefined ? updates.lfUnit : offering.lfUnit,
                egbValue: updates.egbValue !== undefined ? updates.egbValue : offering.egbValue,
                egbType: updates.egbType !== undefined ? updates.egbType : offering.egbType,
                cdEnabled: updates.cdEnabled !== undefined ? updates.cdEnabled : offering.cdEnabled,
                cdValue: updates.cdValue !== undefined ? updates.cdValue : offering.cdValue,
                cdUnit: updates.cdUnit !== undefined ? updates.cdUnit : offering.cdUnit,
                bankLoanEnabled: updates.bankLoanEnabled !== undefined ? updates.bankLoanEnabled : offering.bankLoanEnabled,
                bankLoanValue: updates.bankLoanValue !== undefined ? updates.bankLoanValue : offering.bankLoanValue,
                bankLoanUnit: updates.bankLoanUnit !== undefined ? updates.bankLoanUnit : offering.bankLoanUnit,
                paymentConditionValue: updates.paymentConditionValue !== undefined ? updates.paymentConditionValue : offering.paymentConditionValue,
                paymentConditionUnit: updates.paymentConditionUnit !== undefined ? updates.paymentConditionUnit : offering.paymentConditionUnit
              });
            }
          }
        }

        // Resample assignment should only allot the lot to the location sample user.
        // The special resample workflow starts only after that user clicks Trigger in the Location Sample tab.
        invalidateSampleEntryTabCaches();

        res.json(entry);
      } catch (error) {
        console.error('Error updating sample entry:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add quality parameters (Quality Supervisor)
router.post('/:id/quality-parameters', authenticateToken, async (req, res) => {
  try {
    // Use multer to handle multipart/form-data (for photo upload)
    const upload = FileUploadService.getUploadMiddleware();

    upload.single('photo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        // --- Authorization Check for Location Staff ---
        const userRole = getWorkflowRole(req.user);
        const sampleEntry = await SampleEntry.findByPk(req.params.id);

        if (!sampleEntry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }

        await hydrateSampleEntryWorkflowState(sampleEntry);

        const isResampleCookingPrepOnlyRequest = parseBoolFlag(req.body.resampleCookingPrepOnly) === true;

        // Location staff can edit own LOCATION_SAMPLE entries OR assigned resample lots.
        // Resample 100gms from Cooking Book is a separate supervisor flow and is allowed for the broader paddy supervisor set.
        if (userRole === 'physical_supervisor' && sampleEntry.entryType === 'LOCATION_SAMPLE' && !isResampleCookingPrepOnlyRequest) {
          const canEdit = await canLocationStaffEditQuality(sampleEntry, req.user);
          if (!canEdit) {
            return res.status(403).json({
              error: 'You do not have permission to edit this lot. Only the assigned location staff can edit quality parameters.'
            });
          }
        }
        // --------------------------------------------

        const isProvided = (value) => normalizeRaw(value) !== null;
        const hasMoisture = isProvided(req.body.moisture);
        const hasGrains = isProvided(req.body.grainsCount);
        const hasCutting1 = isProvided(req.body.cutting1);
        const hasCutting2 = isProvided(req.body.cutting2);
        const hasBend1 = isProvided(req.body.bend1);
        const hasBend2 = isProvided(req.body.bend2);

        if (hasMoisture && !Number.isFinite(parseFloat(req.body.moisture))) {
          return res.status(400).json({ error: 'Moisture must be a valid number' });
        }
        if (hasGrains && !Number.isFinite(parseFloat(req.body.grainsCount))) {
          return res.status(400).json({ error: 'Grains Count must be a valid number' });
        }
        if (hasCutting1 && !Number.isFinite(parseFloat(req.body.cutting1))) {
          return res.status(400).json({ error: 'Cutting must be a valid number' });
        }
        if (hasCutting2 && !Number.isFinite(parseFloat(req.body.cutting2))) {
          return res.status(400).json({ error: 'Cutting must be a valid number' });
        }
        if (hasBend1 && !Number.isFinite(parseFloat(req.body.bend1))) {
          return res.status(400).json({ error: 'Bend must be a valid number' });
        }
        if (hasBend2 && !Number.isFinite(parseFloat(req.body.bend2))) {
          return res.status(400).json({ error: 'Bend must be a valid number' });
        }
        const hasMix = hasAlphaOrPositive(req.body.mix);
        const hasKandu = hasAlphaOrPositive(req.body.kandu);
        const hasOil = hasAlphaOrPositive(req.body.oil);
        const hasSk = hasAlphaOrPositive(req.body.sk);
        const hasSmix = hasAlphaOrPositive(req.body.mixS);
        const hasLmix = hasAlphaOrPositive(req.body.mixL);
        const hasWbR = isProvided(req.body.wbR);
        const hasWbBk = isProvided(req.body.wbBk);
        const hasPaddyWb = isProvided(req.body.paddyWb);
        const hasDryMoisture = isProvided(req.body.dryMoisture);
        const smixEnabledFlag = parseBoolFlag(req.body.smixEnabled);
        const lmixEnabledFlag = parseBoolFlag(req.body.lmixEnabled);
        const wbEnabledFlag = parseBoolFlag(req.body.wbEnabled);
        const paddyWbEnabledFlag = parseBoolFlag(req.body.paddyWbEnabled);
        const dryMoistureEnabledFlag = parseBoolFlag(req.body.dryMoistureEnabled);
        const isResampleCookingPrepOnly =
          parseBoolFlag(req.body.resampleCookingPrepOnly) === true
          && sampleEntry?.entryType !== 'RICE_SAMPLE'
          && isResampleWorkflowMarker(sampleEntry);
        const requireExplicitResampleSmell =
          !isResampleCookingPrepOnly
          &&
          String(req.body.qualityEntryIntent || '').toLowerCase() === 'next'
          && sampleEntry?.entryType !== 'RICE_SAMPLE'
          && isResampleWorkflowMarker(sampleEntry);
        const { smellHas, smellType } = resolveQualitySmellInput(req.body, sampleEntry, null, {
          requireExplicitSmell: requireExplicitResampleSmell
        });
        const smixEnabled = smixEnabledFlag !== null ? smixEnabledFlag : hasSmix;
        const lmixEnabled = lmixEnabledFlag !== null ? lmixEnabledFlag : hasLmix;
        const wbEnabled = wbEnabledFlag !== null ? wbEnabledFlag : (hasWbR || hasWbBk);
        const paddyWbEnabled = paddyWbEnabledFlag !== null ? paddyWbEnabledFlag : hasPaddyWb;
        const dryMoistureEnabled = dryMoistureEnabledFlag !== null ? dryMoistureEnabledFlag : hasDryMoisture;

        const hasAnyFullDetail = hasCutting1 || hasCutting2 || hasBend1 || hasBend2 || hasMix || hasKandu || hasOil || hasSk;
        const is100gOnly = hasMoisture && hasGrains && !hasAnyFullDetail;
        const isResampleWbActivationOnly = false;
        const isValidResampleCookingPrepOnly =
          isResampleCookingPrepOnly
          && wbEnabled
          && hasMoisture
          && hasWbR
          && hasWbBk
          && hasGrains
          && !hasAnyFullDetail
          && !hasDryMoisture
          && !hasSmix
          && !hasLmix;
        const isValidPaddy100gThreeFieldOnly =
          sampleEntry?.entryType !== 'RICE_SAMPLE'
          && hasMoisture
          && wbEnabled
          && hasWbR
          && hasWbBk
          && hasGrains
          && !hasAnyFullDetail
          && !hasDryMoisture
          && !hasSmix
          && !hasLmix;
        const rawReportedByValue = typeof req.body.reportedBy === 'string' ? req.body.reportedBy.trim() : '';
        const reportedByValue = rawReportedByValue;
        const is100gSave = isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly || is100gOnly;
        if ((!is100gSave && !reportedByValue) || reportedByValue.toLowerCase() === 'unknown') {
          return res.status(400).json({ error: 'Sample Reported By is required' });
        }

        if (!is100gOnly && !isValidResampleCookingPrepOnly && !isValidPaddy100gThreeFieldOnly) {
          if (!hasMoisture) return res.status(400).json({ error: 'Moisture is required' });
          if (!hasGrains) return res.status(400).json({ error: 'Grains Count is required' });
          if (!hasCutting1 || !hasCutting2) return res.status(400).json({ error: 'Cutting is required' });
          if (!hasBend1 || !hasBend2) return res.status(400).json({ error: 'Bend is required' });
          if (!hasMix) return res.status(400).json({ error: 'Mix is required' });
          if (!hasKandu) return res.status(400).json({ error: 'Kandu is required' });
          if (!hasOil) return res.status(400).json({ error: 'Oil is required' });
          if (!hasSk) return res.status(400).json({ error: 'SK is required' });
        }

        // Convert string values from FormData to numbers (with safe parsing)
        const qualityData = {
          sampleEntryId: req.params.id,
          moisture: parseFloatSafe(req.body.moisture),
          dryMoisture: parseFloatSafe(req.body.dryMoisture),
          cutting1: parseFloatSafe(req.body.cutting1),
          cutting2: parseFloatSafe(req.body.cutting2),
          bend: parseFloatSafe(req.body.bend || req.body.bend1), // Support both bend and bend1
          bend1: parseFloatSafe(req.body.bend1),
          bend2: parseFloatSafe(req.body.bend2),
          mixS: smixEnabled ? normalizeAlphaNumeric(req.body.mixS) : '0',
          mixL: lmixEnabled ? normalizeAlphaNumeric(req.body.mixL) : '0',
          mix: normalizeAlphaNumeric(req.body.mix),
          kandu: normalizeAlphaNumeric(req.body.kandu),
          oil: normalizeAlphaNumeric(req.body.oil),
          sk: normalizeAlphaNumeric(req.body.sk),
          grainsCount: parseIntSafe(req.body.grainsCount),
          wbR: wbEnabled ? parseFloatSafe(req.body.wbR) : 0,
          wbBk: wbEnabled ? parseFloatSafe(req.body.wbBk) : 0,
          wbT: wbEnabled ? parseFloatSafe(req.body.wbT) : 0,
          paddyWb: paddyWbEnabled ? parseFloatSafe(req.body.paddyWb) : 0,
          moistureRaw: normalizeRaw(req.body.moisture),
          dryMoistureRaw: dryMoistureEnabled ? normalizeRaw(req.body.dryMoisture) : null,
          cutting1Raw: normalizeRaw(req.body.cutting1),
          cutting2Raw: normalizeRaw(req.body.cutting2),
          bend1Raw: normalizeRaw(req.body.bend1),
          bend2Raw: normalizeRaw(req.body.bend2),
          mixSRaw: smixEnabled ? normalizeRaw(req.body.mixS) : null,
          mixLRaw: lmixEnabled ? normalizeRaw(req.body.mixL) : null,
          mixRaw: hasMix ? normalizeRaw(req.body.mix) : null,
          kanduRaw: hasKandu ? normalizeRaw(req.body.kandu) : null,
          oilRaw: hasOil ? normalizeRaw(req.body.oil) : null,
          skRaw: hasSk ? normalizeRaw(req.body.sk) : null,
          grainsCountRaw: normalizeRaw(req.body.grainsCount),
          wbRRaw: wbEnabled ? normalizeRaw(req.body.wbR) : null,
          wbBkRaw: wbEnabled ? normalizeRaw(req.body.wbBk) : null,
          wbTRaw: wbEnabled ? normalizeRaw(req.body.wbT) : null,
          paddyWbRaw: paddyWbEnabled ? normalizeRaw(req.body.paddyWb) : null,
          gramsReport: normalizeGramsReport(req.body.gramsReport),
          reportedBy: reportedByValue,
          smellHas,
          smellType,
          smixEnabled,
          smixEnabled,
          lmixEnabled,
          paddyWbEnabled
        };

        // --- GPS and Resample Timeline Update ---
        const userProvidedGps = typeof req.body.gpsCoordinates === 'string' ? req.body.gpsCoordinates.trim() : '';
        const isResampleAction = sampleEntry.entryType !== 'RICE_SAMPLE'
          && isResampleWorkflowMarker(sampleEntry);

        let gpsUpdatePromise = Promise.resolve();
        if (isResampleAction) {
          const updates = {};
          if (userProvidedGps) {
             updates.gpsCoordinates = userProvidedGps;
          }
          
          // The "Super Feature": Update the timeline date so the entry appears in Pending Selection / Cooking Book under TODAY's date,
          // rather than the original allotment date from 2 days ago.
          if (Array.isArray(sampleEntry.resampleCollectedTimeline) && sampleEntry.resampleCollectedTimeline.length > 0) {
            const timeline = [...sampleEntry.resampleCollectedTimeline];
            const lastItem = timeline[timeline.length - 1];
            if (lastItem) {
              lastItem.date = new Date().toISOString(); // Update the assignment/action date to NOW
              updates.resampleCollectedTimeline = timeline;
            }
          }
          
          if (Object.keys(updates).length > 0) {
            gpsUpdatePromise = sampleEntry.update(updates);
          }
        }
        // ----------------------------------------

        const existingQuality = await QualityParametersService.getQualityParametersBySampleEntry(req.params.id);
        if (existingQuality) {
          const sampleEntry = await SampleEntry.findByPk(req.params.id);
          await hydrateSampleEntryWorkflowState(sampleEntry);
          const recheckState = await getRecheckState(
            req.params.id,
            existingQuality?.updatedAt || existingQuality?.createdAt || null,
            null,
            existingQuality,
            null
          );
          const isRecheckQualityPending = recheckState.qualityPending === true;
          const isResampleQualityPending = isResampleWorkflowMarker(sampleEntry);
          const normalizedQualityIntent = normalizeQualityEntryIntent(req.body.qualityEntryIntent);
          const isResampleQualityCreateRequest =
            isResampleWorkflowMarker(sampleEntry || {})
            && normalizedQualityIntent !== 'edit';
          const heuristicCreateNewResampleAttempt = shouldCreateNewResampleQualityAttempt(sampleEntry || {});
          const strictResampleNextAttempt =
            isResampleQualityCreateRequest
            && (
              normalizedQualityIntent === 'next'
              || normalizedQualityIntent === 'auto'
            );
          const explicitCreateNewResampleAttempt =
            isResampleQualityCreateRequest
            && !hasPersistedResampleQualityAttempt(sampleEntry || {});
          const shouldCreateNewResampleAttempt = shouldCreateNewQualityAttempt({
            intent: req.body.qualityEntryIntent,
            heuristicDecision: strictResampleNextAttempt || explicitCreateNewResampleAttempt || heuristicCreateNewResampleAttempt,
            isResampleQualityPending
          });

          // Staff one-time edit check: if already used their available chances, block
          const qualityEditAllowance = Math.max(1, Number(sampleEntry?.staffQualityEditAllowance || 1));
          const isLimitedStaffRole = ['staff', 'quality_supervisor', 'physical_supervisor', 'paddy_supervisor'].includes(String(getWorkflowRole(req.user) || '').toLowerCase());
          if (isLimitedStaffRole && Number(sampleEntry?.staffBagsEdits || 0) >= qualityEditAllowance && !isRecheckQualityPending && !isResampleQualityPending) {
            return res.status(403).json({ error: 'Quality parameters can only be edited once by staff.' });
          }

          const same =
            String(existingQuality.mixS || '0') === String(qualityData.mixS || '0') &&
            String(existingQuality.mixL || '0') === String(qualityData.mixL || '0') &&
            String(existingQuality.mix || '0') === String(qualityData.mix || '0') &&
            String(existingQuality.kandu || '0') === String(qualityData.kandu || '0') &&
            String(existingQuality.oil || '0') === String(qualityData.oil || '0') &&
            String(existingQuality.sk || '0') === String(qualityData.sk || '0') &&
            Boolean(existingQuality.smellHas) === Boolean(qualityData.smellHas) &&
            String(existingQuality.smellType || '') === String(qualityData.smellType || '') &&
            Number(existingQuality.moisture || 0) === Number(qualityData.moisture || 0) &&
            Number(existingQuality.cutting1 || 0) === Number(qualityData.cutting1 || 0) &&
            Number(existingQuality.cutting2 || 0) === Number(qualityData.cutting2 || 0) &&
            Number(existingQuality.bend1 || 0) === Number(qualityData.bend1 || 0) &&
            Number(existingQuality.bend2 || 0) === Number(qualityData.bend2 || 0) &&
            Number(existingQuality.grainsCount || 0) === Number(qualityData.grainsCount || 0);

          if (same && !isRecheckQualityPending && !isResampleQualityPending) {
            return res.json(existingQuality);
          }

          // Staff with staffBagsEdits=0 get ONE chance to update quality
          // Admin/manager can always update (no 409 block for them)
          if (isLimitedStaffRole) {
            // Staff one-time edit: allow update, then lock
            if (req.file) {
              const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
              qualityData.uploadFileUrl = uploadResult.fileUrl;
            }
            const updatedQuality = await QualityParametersService.updateQualityParameters(
              existingQuality.id,
              {
                ...qualityData,
                is100Grams: req.body.is100Grams === 'true' || req.body.is100Grams === true || isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly,
                reportedByUserId: req.user.userId
              },
              req.user.userId,
              getWorkflowRole(req.user),
              { createNewAttempt: shouldCreateNewResampleAttempt }
            );
            // Increment the edit counter to lock future edits
            if (sampleEntry && !isResampleQualityPending) {
              await sampleEntry.update({
                staffBagsEdits: (sampleEntry.staffBagsEdits || 0) + 1,
                qualityEditApprovalStatus: null,
                qualityEditApprovalReason: null,
                qualityEditApprovalRequestedBy: null,
                qualityEditApprovalRequestedAt: null,
                qualityEditApprovalApprovedBy: null,
                qualityEditApprovalApprovedAt: null
              });
            }
            invalidateSampleEntryTabCaches();
            return res.status(200).json(updatedQuality);
          } else if (['admin', 'manager', 'owner'].includes(req.user.role)) {
            // Admin/manager/owner can always update - no restriction
            if (req.file) {
              const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
              qualityData.uploadFileUrl = uploadResult.fileUrl;
            }
            const updatedQuality = await QualityParametersService.updateQualityParameters(
              existingQuality.id,
              {
                ...qualityData,
                is100Grams: req.body.is100Grams === 'true' || req.body.is100Grams === true || isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly,
                reportedByUserId: req.user.userId
              },
              req.user.userId,
              getWorkflowRole(req.user),
              { createNewAttempt: shouldCreateNewResampleAttempt }
            );
            invalidateSampleEntryTabCaches();
            return res.status(200).json(updatedQuality);
          }

          // Other roles: block with 409
          return res.status(409).json({ error: 'Quality parameters already saved. Please contact admin/manager to update.' });
        }

        // Handle photo upload if present (first-time creation)
        if (req.file) {
          const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
          qualityData.uploadFileUrl = uploadResult.fileUrl;
        }

        const quality = await QualityParametersService.addQualityParameters(
          {
            ...qualityData,
            is100Grams: req.body.is100Grams === 'true' || req.body.is100Grams === true || isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly
          },
          req.user.userId,
          getWorkflowRole(req.user)
        );

        await gpsUpdatePromise;
        invalidateSampleEntryTabCaches();
        res.status(201).json(quality);
      } catch (error) {
        console.error('Error adding quality parameters:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quality parameters (Admin/Manager edit)
router.put('/:id/quality-parameters', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.single('photo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const sampleEntryId = req.params.id;

        // --- Authorization Check for Location Staff ---
        const userRole = getWorkflowRole(req.user);
        const sampleEntry = await SampleEntry.findByPk(sampleEntryId);

        if (!sampleEntry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }

        await hydrateSampleEntryWorkflowState(sampleEntry);

        const isResampleCookingPrepOnlyRequest = parseBoolFlag(req.body.resampleCookingPrepOnly) === true;

        // Location staff can edit own LOCATION_SAMPLE entries OR assigned resample lots.
        // Resample 100gms from Cooking Book is a separate supervisor flow and is allowed for the broader paddy supervisor set.
        if (userRole === 'physical_supervisor' && sampleEntry.entryType === 'LOCATION_SAMPLE' && !isResampleCookingPrepOnlyRequest) {
          const canEdit = await canLocationStaffEditQuality(sampleEntry, req.user);
          if (!canEdit) {
            return res.status(403).json({
              error: 'You do not have permission to edit this lot. Only the assigned location staff can edit quality parameters.'
            });
          }
        }
        // --------------------------------------------

        // Get existing quality parameters for this entry
        const existing = await QualityParametersService.getQualityParametersBySampleEntry(sampleEntryId);
        if (!existing) {
          return res.status(404).json({ error: 'Quality parameters not found for this entry' });
        }

        const recheckState = await getRecheckState(
          sampleEntryId,
          existing?.updatedAt || existing?.createdAt || null,
          null,
          existing,
          null
        );
        const isRecheckQualityPending = recheckState.qualityPending === true;
        const isResampleQualityPending = isResampleWorkflowMarker(sampleEntry);
        const normalizedQualityIntent = normalizeQualityEntryIntent(req.body.qualityEntryIntent);
        const heuristicCreateNewResampleAttempt = shouldCreateNewResampleQualityAttempt(sampleEntry || {});
        const strictResampleNextAttempt =
          normalizedQualityIntent === 'next'
          && isResampleWorkflowMarker(sampleEntry || {});
        const shouldCreateNewResampleAttempt = shouldCreateNewQualityAttempt({
          intent: req.body.qualityEntryIntent,
          heuristicDecision: strictResampleNextAttempt || heuristicCreateNewResampleAttempt,
          isResampleQualityPending
        });

        // Admin/Manager edit only. Staff can edit quality only up to their approved allowance.
        const qualityEditAllowance = Math.max(1, Number(sampleEntry.staffQualityEditAllowance || 1));
        const isLimitedStaffRole = ['staff', 'quality_supervisor', 'physical_supervisor', 'paddy_supervisor'].includes(String(getWorkflowRole(req.user) || '').toLowerCase());
        if (isLimitedStaffRole && Number(sampleEntry.staffBagsEdits || 0) >= qualityEditAllowance && !isRecheckQualityPending && !isResampleQualityPending) {
          return res.status(403).json({ error: 'Quality parameters can only be edited once by staff. Please contact admin/manager for further changes.' });
        }

        const hasSmix = hasAlphaOrPositive(req.body.mixS);
        const hasLmix = hasAlphaOrPositive(req.body.mixL);
        const hasMix = hasAlphaOrPositive(req.body.mix);
        const hasKandu = hasAlphaOrPositive(req.body.kandu);
        const hasOil = hasAlphaOrPositive(req.body.oil);
        const hasSk = hasAlphaOrPositive(req.body.sk);
        const hasWbR = normalizeRaw(req.body.wbR) !== null;
        const hasWbBk = normalizeRaw(req.body.wbBk) !== null;
        const hasPaddyWb = normalizeRaw(req.body.paddyWb) !== null;
        const hasDryMoisture = normalizeRaw(req.body.dryMoisture) !== null;
        const smixEnabledFlag = parseBoolFlag(req.body.smixEnabled);
        const lmixEnabledFlag = parseBoolFlag(req.body.lmixEnabled);
        const wbEnabledFlag = parseBoolFlag(req.body.wbEnabled);
        const paddyWbEnabledFlag = parseBoolFlag(req.body.paddyWbEnabled);
        const dryMoistureEnabledFlag = parseBoolFlag(req.body.dryMoistureEnabled);
        const smixEnabled = smixEnabledFlag !== null ? smixEnabledFlag : hasSmix;
        const lmixEnabled = lmixEnabledFlag !== null ? lmixEnabledFlag : hasLmix;
        const wbEnabled = wbEnabledFlag !== null ? wbEnabledFlag : (hasWbR || hasWbBk);
        const paddyWbEnabled = paddyWbEnabledFlag !== null ? paddyWbEnabledFlag : hasPaddyWb;
        const dryMoistureEnabled = dryMoistureEnabledFlag !== null ? dryMoistureEnabledFlag : hasDryMoisture;
        const isResampleWbActivationOnly = false;
        const isResampleCookingPrepOnly =
          parseBoolFlag(req.body.resampleCookingPrepOnly) === true
          && sampleEntry?.entryType !== 'RICE_SAMPLE'
          && isResampleWorkflowMarker(sampleEntry);
        const isValidResampleCookingPrepOnly =
          isResampleCookingPrepOnly
          && wbEnabled
          && hasWbR
          && hasWbBk
          && normalizeRaw(req.body.moisture) !== null
          && normalizeRaw(req.body.grainsCount) !== null
          && !hasMix
          && !hasKandu
          && !hasOil
          && !hasSk
          && !hasSmix
          && !hasLmix
          && normalizeRaw(req.body.cutting1) === null
          && normalizeRaw(req.body.cutting2) === null
          && normalizeRaw(req.body.bend1) === null
          && normalizeRaw(req.body.bend2) === null
          && !hasDryMoisture;
        const isValidPaddy100gThreeFieldOnly =
          sampleEntry?.entryType !== 'RICE_SAMPLE'
          && normalizeRaw(req.body.moisture) !== null
          && wbEnabled
          && hasWbR
          && hasWbBk
          && normalizeRaw(req.body.grainsCount) !== null
          && !hasMix
          && !hasKandu
          && !hasOil
          && !hasSk
          && !hasSmix
          && !hasLmix
          && normalizeRaw(req.body.cutting1) === null
          && normalizeRaw(req.body.cutting2) === null
          && normalizeRaw(req.body.bend1) === null
          && normalizeRaw(req.body.bend2) === null
          && !hasDryMoisture;
        const rawReportedByValue = typeof req.body.reportedBy === 'string' ? req.body.reportedBy.trim() : '';
        const reportedByValue = rawReportedByValue;
        const is100gSave = isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly;
        if ((!is100gSave && !reportedByValue) || reportedByValue.toLowerCase() === 'unknown') {
          return res.status(400).json({ error: 'Sample Reported By is required' });
        }

        const { smellHas, smellType } = resolveQualitySmellInput(req.body, sampleEntry, existing, {
          requireExplicitSmell: false
        });

        // Prepare update data
        const updates = {
          sampleEntryId,
          is100Grams: req.body.is100Grams === 'true' || req.body.is100Grams === true || isValidResampleCookingPrepOnly || isValidPaddy100gThreeFieldOnly,
          moisture: parseFloatSafe(req.body.moisture, existing.moisture),
          dryMoisture: dryMoistureEnabled ? parseFloatSafe(req.body.dryMoisture, existing.dryMoisture) : null,
          cutting1: parseFloatSafe(req.body.cutting1, existing.cutting1),
          cutting2: parseFloatSafe(req.body.cutting2, existing.cutting2),
          bend1: parseFloatSafe(req.body.bend1, existing.bend1),
          bend2: parseFloatSafe(req.body.bend2, existing.bend2),
          bend: parseFloatSafe(req.body.bend || req.body.bend1, existing.bend),
          mixS: smixEnabled ? normalizeAlphaNumeric(req.body.mixS, existing.mixS) : '0',
          mixL: lmixEnabled ? normalizeAlphaNumeric(req.body.mixL, existing.mixL) : '0',
          mix: normalizeAlphaNumeric(req.body.mix, existing.mix),
          kandu: normalizeAlphaNumeric(req.body.kandu, existing.kandu),
          oil: normalizeAlphaNumeric(req.body.oil, existing.oil),
          sk: normalizeAlphaNumeric(req.body.sk, existing.sk),
          grainsCount: parseIntSafe(req.body.grainsCount, existing.grainsCount),
          wbR: wbEnabled ? parseFloatSafe(req.body.wbR, existing.wbR) : 0,
          wbBk: wbEnabled ? parseFloatSafe(req.body.wbBk, existing.wbBk) : 0,
          wbT: wbEnabled ? parseFloatSafe(req.body.wbT, existing.wbT) : 0,
          paddyWb: paddyWbEnabled ? parseFloatSafe(req.body.paddyWb, existing.paddyWb) : 0,
          smellHas,
          smellType,
          moistureRaw: normalizeRaw(req.body.moisture) ?? existing.moistureRaw ?? null,
          dryMoistureRaw: dryMoistureEnabled ? (normalizeRaw(req.body.dryMoisture) ?? existing.dryMoistureRaw ?? null) : null,
          cutting1Raw: normalizeRaw(req.body.cutting1) ?? existing.cutting1Raw ?? null,
          cutting2Raw: normalizeRaw(req.body.cutting2) ?? existing.cutting2Raw ?? null,
          bend1Raw: normalizeRaw(req.body.bend1) ?? existing.bend1Raw ?? null,
          bend2Raw: normalizeRaw(req.body.bend2) ?? existing.bend2Raw ?? null,
          mixSRaw: smixEnabled ? (normalizeRaw(req.body.mixS) ?? existing.mixSRaw ?? null) : null,
          mixLRaw: lmixEnabled ? (normalizeRaw(req.body.mixL) ?? existing.mixLRaw ?? null) : null,
          mixRaw: hasMix ? (normalizeRaw(req.body.mix) ?? existing.mixRaw ?? null) : (existing.mixRaw ?? null),
          kanduRaw: hasKandu ? (normalizeRaw(req.body.kandu) ?? existing.kanduRaw ?? null) : (existing.kanduRaw ?? null),
          oilRaw: hasOil ? (normalizeRaw(req.body.oil) ?? existing.oilRaw ?? null) : (existing.oilRaw ?? null),
          skRaw: hasSk ? (normalizeRaw(req.body.sk) ?? existing.skRaw ?? null) : (existing.skRaw ?? null),
          grainsCountRaw: normalizeRaw(req.body.grainsCount) ?? existing.grainsCountRaw ?? null,
          wbRRaw: wbEnabled ? (normalizeRaw(req.body.wbR) ?? existing.wbRRaw ?? null) : null,
          wbBkRaw: wbEnabled ? (normalizeRaw(req.body.wbBk) ?? existing.wbBkRaw ?? null) : null,
          wbTRaw: wbEnabled ? (normalizeRaw(req.body.wbT) ?? existing.wbTRaw ?? null) : null,
          paddyWbRaw: paddyWbEnabled ? (normalizeRaw(req.body.paddyWb) ?? existing.paddyWbRaw ?? null) : null,
          gramsReport: normalizeGramsReport(req.body.gramsReport, existing.gramsReport),
          reportedBy: reportedByValue,
          reportedByUserId: req.user.userId,
          smixEnabled,
          lmixEnabled,
          paddyWbEnabled
        };

        // --- GPS and Resample Timeline Update ---
        const userProvidedGps = typeof req.body.gpsCoordinates === 'string' ? req.body.gpsCoordinates.trim() : '';
        const isResampleAction = sampleEntry.entryType !== 'RICE_SAMPLE'
            && (
              String(sampleEntry.lotSelectionDecision || '').toUpperCase() === 'FAIL'
              || (Array.isArray(sampleEntry.resampleCollectedTimeline) && sampleEntry.resampleCollectedTimeline.length > 0)
              || (Array.isArray(sampleEntry.resampleCollectedHistory) && sampleEntry.resampleCollectedHistory.length > 0)
              || Boolean(sampleEntry.resampleStartAt)
              || Number(sampleEntry.qualityReportAttempts || 0) > 1
            );

        let gpsUpdatePromise = Promise.resolve();
        if (isResampleAction) {
          const entryUpdates = {};
          if (userProvidedGps) {
             entryUpdates.gpsCoordinates = userProvidedGps;
          }
          if (Array.isArray(sampleEntry.resampleCollectedTimeline) && sampleEntry.resampleCollectedTimeline.length > 0) {
            const timeline = [...sampleEntry.resampleCollectedTimeline];
            const lastItem = timeline[timeline.length - 1];
            if (lastItem) {
              lastItem.date = new Date().toISOString(); 
              entryUpdates.resampleCollectedTimeline = timeline;
            }
          }
          if (Object.keys(entryUpdates).length > 0) {
            gpsUpdatePromise = sampleEntry.update(entryUpdates);
          }
        }
        // ----------------------------------------

        // Handle photo upload if present
        if (req.file) {
          const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
          updates.uploadFileUrl = uploadResult.fileUrl;
        }

        const updated = await QualityParametersService.updateQualityParameters(
          existing.id,
          updates,
          req.user.userId,
          getWorkflowRole(req.user),
          { createNewAttempt: shouldCreateNewResampleAttempt }
        );

        // Increment edit counter for staff to prevent further changes (skip during recheck)
        if (isLimitedStaffRole && !isRecheckQualityPending) {
          if (!isResampleQualityPending) {
            await sampleEntry.update({
              staffBagsEdits: (sampleEntry.staffBagsEdits || 0) + 1,
              qualityEditApprovalStatus: null,
              qualityEditApprovalReason: null,
              qualityEditApprovalRequestedBy: null,
              qualityEditApprovalRequestedAt: null,
              qualityEditApprovalApprovedBy: null,
              qualityEditApprovalApprovedAt: null
            });
          }
        }

        invalidateSampleEntryTabCaches();
        await gpsUpdatePromise;
        res.json(updated);
      } catch (innerError) {
        console.error('Error in quality parameters update logic:', innerError);
        res.status(400).json({ error: innerError.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload or updating quality parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update physical inspection (Admin/Manager edit)
router.put('/:id/physical-inspection/:inspectionId', authenticateToken, async (req, res) => {
  try {
    const { inspectionId } = req.params;

    const updates = {};
    if (req.body.inspectionDate !== undefined) updates.inspectionDate = req.body.inspectionDate;
    if (req.body.lorryNumber !== undefined) updates.lorryNumber = req.body.lorryNumber;
    if (req.body.bags !== undefined) updates.bags = parseInt(req.body.bags);
    if (req.body.cutting1 !== undefined) updates.cutting1 = parseFloat(req.body.cutting1);
    if (req.body.cutting2 !== undefined) updates.cutting2 = parseFloat(req.body.cutting2);
    if (req.body.bend !== undefined) updates.bend = parseFloat(req.body.bend);
    if (req.body.bend2 !== undefined) updates.bend2 = parseFloat(req.body.bend2);
    if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;

    const updated = await PhysicalInspectionService.updatePhysicalInspection(
      inspectionId,
      updates,
      req.user.userId
    );

    if (!updated) {
      return res.status(404).json({ error: 'Physical inspection not found' });
    }

    invalidateSampleEntryTabCaches();

    res.json(updated);
  } catch (error) {
    console.error('Error updating physical inspection:', error);
    res.status(400).json({ error: error.message });
  }
});

// Approve a specific progressive stage of physical inspection
router.post('/:id/physical-inspection/:inspectionId/approve-stage', authenticateToken, async (req, res) => {
  try {
    const { id, inspectionId } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    const PhysicalInspectionService = require('../services/PhysicalInspectionService');

    const updated = await PhysicalInspectionService.approvePhysicalInspectionStage(
      id,
      inspectionId,
      stage,
      req.user.userId,
      getWorkflowRole(req.user)
    );

    invalidateSampleEntryTabCaches();

    res.json(updated);
  } catch (error) {
    console.error('Error approving progressive stage:', error);
    res.status(400).json({ error: error.message });
  }
});

// Hold a specific progressive stage of physical inspection
router.post('/:id/physical-inspection/:inspectionId/hold-stage', authenticateToken, async (req, res) => {
  try {
    const { id, inspectionId } = req.params;
    const { stage, holdDuration } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }
    if (!holdDuration) {
      return res.status(400).json({ error: 'Hold duration is required' });
    }

    const PhysicalInspectionService = require('../services/PhysicalInspectionService');

    const updated = await PhysicalInspectionService.holdPhysicalInspectionStage(
      id,
      inspectionId,
      stage,
      holdDuration,
      req.user.userId,
      getWorkflowRole(req.user)
    );

    invalidateSampleEntryTabCaches();

    res.json(updated);
  } catch (error) {
    console.error('Error holding progressive stage:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reject a specific progressive stage of physical inspection (Admin/Manager/Quality Supervisor)
router.post('/:id/physical-inspection/:inspectionId/reject-stage', authenticateToken, async (req, res) => {
  try {
    const { id, inspectionId } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    const allowedRoles = ['quality_supervisor', 'manager', 'admin', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only quality supervisor or manager can reject a stage' });
    }

    const PhysicalInspectionService = require('../services/PhysicalInspectionService');

    const updated = await PhysicalInspectionService.rejectPhysicalInspectionStage(
      id,
      inspectionId,
      stage,
      req.user.userId,
      getWorkflowRole(req.user)
    );

    invalidateSampleEntryTabCaches();

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting progressive stage:', error);
    res.status(400).json({ error: error.message });
  }
});

// Revert skip on a progressive stage (Admin/Manager/CEO)
router.post('/:id/physical-inspection/:inspectionId/revert-skip-stage', authenticateToken, async (req, res) => {
  try {
    const { id, inspectionId } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    const workflowRole = getWorkflowRole(req.user);
    const allowedRoles = ['manager', 'admin', 'owner'];
    if (!allowedRoles.includes(String(workflowRole || '').toLowerCase())) {
      return res.status(403).json({ error: 'Only Admin, Manager, or CEO can revert skipped stages' });
    }

    const PhysicalInspectionService = require('../services/PhysicalInspectionService');

    const updated = await PhysicalInspectionService.revertSkipPhysicalInspectionStage(
      id,
      inspectionId,
      stage,
      req.user.userId,
      workflowRole
    );

    invalidateSampleEntryTabCaches();

    res.json(updated);
  } catch (error) {
    console.error('Error reverting skipped stage:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update a specific progressive stage of physical inspection
router.put('/:id/physical-inspection/:inspectionId/stage/:stageKey', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.fields([
      { name: 'stageImage', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const { id, inspectionId, stageKey } = req.params;

        const isTruthyFlag = value => value === true || value === 'true' || value === 'Y' || value === 'Yes';

        const stageData = {
          moisture: (req.body.moisture !== undefined && req.body.moisture !== null && req.body.moisture !== '') ? Number.parseFloat(req.body.moisture) : undefined,
          moistureRaw: req.body.moistureRaw || null,
          dryMoisture: (req.body.dryMoisture !== undefined && req.body.dryMoisture !== null && req.body.dryMoisture !== '') ? Number.parseFloat(req.body.dryMoisture) : undefined,
          dryMoistureRaw: req.body.dryMoistureRaw || null,
          grainsCount: (req.body.grainsCount !== undefined && req.body.grainsCount !== null && req.body.grainsCount !== '') ? Number.parseInt(req.body.grainsCount) : undefined,
          grainsCountRaw: req.body.grainsCountRaw || null,
          cutting1: (req.body.cutting1 !== undefined && req.body.cutting1 !== null && req.body.cutting1 !== '') ? Number.parseFloat(req.body.cutting1) : undefined,
          cutting2: (req.body.cutting2 !== undefined && req.body.cutting2 !== null && req.body.cutting2 !== '') ? Number.parseFloat(req.body.cutting2) : undefined,
          bend1: (req.body.bend1 !== undefined && req.body.bend1 !== null && req.body.bend1 !== '') ? Number.parseFloat(req.body.bend1) : undefined,
          bend2: (req.body.bend2 !== undefined && req.body.bend2 !== null && req.body.bend2 !== '') ? Number.parseFloat(req.body.bend2) : undefined,
          mix: req.body.mix || null,
          mixRaw: req.body.mixRaw || null,
          smixEnabled: isTruthyFlag(req.body.smixEnabled) ? 'Y' : 'N',
          mixS: isTruthyFlag(req.body.smixEnabled) ? req.body.mixS || null : null,
          lmixEnabled: isTruthyFlag(req.body.lmixEnabled) ? 'Y' : 'N',
          mixL: isTruthyFlag(req.body.lmixEnabled) ? req.body.mixL || null : null,
          sk: req.body.sk || null,
          kandu: req.body.kandu || null,
          oil: req.body.oil || null,
          smellHas: isTruthyFlag(req.body.smellHas) ? 'Yes' : 'No',
          smellType: isTruthyFlag(req.body.smellHas) ? req.body.smellType || null : null,
          paddyWbEnabled: isTruthyFlag(req.body.paddyWbEnabled) ? 'Y' : 'N',
          paddyWb: isTruthyFlag(req.body.paddyWbEnabled) ? (req.body.paddyWb ? Number.parseFloat(req.body.paddyWb) : undefined) : undefined,
          paddyColorEnabled: isTruthyFlag(req.body.paddyColorEnabled) || (req.body.paddyColor ? true : false),
          paddyColor: req.body.paddyColor || null,
          kadiga: req.body.kadiga || 'N',
          nit: req.body.nit || null,
          remarks: req.body.remarks || null
        };

        if (stageKey === 'full_avg' && req.body.actualBags !== undefined) {
          stageData.bags = Number.parseInt(req.body.actualBags) || 0;
          stageData.actualBags = Number.parseInt(req.body.actualBags) || 0;
        }

        if (req.files && req.files.stageImage) {
          const fileToUpload = req.files.stageImage[0] || req.files.stageImage;
          const uploadResult = await FileUploadService.uploadFile(fileToUpload, { compress: true });
          stageData.imageUrl = uploadResult.fileUrl;
        }

        const PhysicalInspectionService = require('../services/PhysicalInspectionService');

        const updated = await PhysicalInspectionService.updatePhysicalInspectionStage(
          id,
          inspectionId,
          stageKey,
          stageData,
          req.user.userId,
          getWorkflowRole(req.user)
        );

        invalidateSampleEntryTabCaches();

        res.json(updated);
      } catch (error) {
        console.error('Error updating progressive stage:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error in update progressive stage route:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/lot-selection', authenticateToken, async (req, res) => {
  try {
    let { decision, remarks } = req.body; // 'PASS_WITHOUT_COOKING', 'PASS_WITH_COOKING', 'FAIL'
    const entry = await SampleEntry.findByPk(req.params.id, {
      attributes: [
        'id',
        'entryType',
        'workflowStatus',
        'lotSelectionDecision',
        'resampleOriginDecision',
        'resampleTriggerRequired',
        'resampleTriggeredAt',
        'resampleDecisionAt',
        'resampleAfterFinal'
      ]
    });

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    const currentWorkflowStatus = String(entry.workflowStatus || '').toUpperCase();
    const isLoadingStageResample =
      decision === 'RESAMPLE'
      && [
        'LOT_ALLOTMENT',
        'PHYSICAL_INSPECTION',
        'INVENTORY_ENTRY',
        'OWNER_FINANCIAL',
        'MANAGER_FINANCIAL',
        'FINAL_REVIEW',
        'COMPLETED'
      ].includes(currentWorkflowStatus);
    const isAlreadyFailedSoldOut =
      decision === 'SOLDOUT'
      && currentWorkflowStatus === 'FAILED';

    let nextStatus;
    if (decision === 'PASS_WITHOUT_COOKING') {
      nextStatus = 'FINAL_REPORT';
    } else if (decision === 'PASS_WITH_COOKING') {
      nextStatus = 'COOKING_REPORT';
    } else if (decision === 'FAIL') {
      nextStatus = 'FAILED';
    } else if (decision === 'RESAMPLE') {
      nextStatus = isLoadingStageResample ? 'LOT_ALLOTMENT' : 'STAFF_ENTRY';
    } else if (decision === 'SOLDOUT') {
      nextStatus = 'FAILED';
    } else {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    if (!isLoadingStageResample && !isAlreadyFailedSoldOut) {
      await WorkflowEngine.transitionTo(
        req.params.id, // Keep as UUID string, don't parse to int
        nextStatus,
        req.user.userId, // Use userId from JWT token
        getWorkflowRole(req.user),
        { lotSelectionDecision: decision === 'RESAMPLE' ? 'FAIL' : decision }
      );
    }

    // Explicitly update the lot selection fields on the SampleEntry
    const previousDecision = String(entry.lotSelectionDecision || '').toUpperCase();
    const resampleUpdates = decision === 'RESAMPLE'
      ? {
        entryType: 'LOCATION_SAMPLE',
        sampleCollectedBy: null,
        staffBagsEdits: 0,
        resampleOriginDecision: previousDecision || null,
        resampleTriggerRequired: previousDecision === 'PASS_WITH_COOKING',
        resampleTriggeredAt: null,
        resampleDecisionAt: null,
        resampleCollectedTimeline: [],
        resampleCollectedHistory: [],
        resampleAfterFinal: isLoadingStageResample ? false : Boolean(entry.resampleAfterFinal)
      }
      : {
        resampleDecisionAt: isResampleWorkflowMarker(entry) ? new Date() : entry.resampleDecisionAt
      };

    await SampleEntryService.updateSampleEntry(
      req.params.id,
      {
        ...(isLoadingStageResample ? { workflowStatus: 'LOT_ALLOTMENT' } : {}),
        lotSelectionDecision: decision === 'RESAMPLE' ? 'FAIL' : decision,
        lotSelectionByUserId: req.user.userId,
        lotSelectionAt: new Date(),
        failRemarks: (decision === 'FAIL' || decision === 'RESAMPLE') && req.body.remarks ? req.body.remarks : null,
        ...resampleUpdates
      },
      req.user.userId
    );

    if (decision === 'RESAMPLE' && isLoadingStageResample) {
      const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(req.params.id);
      if (existingAllotment?.id) {
        await LotAllotmentService.updateLotAllotment(
          existingAllotment.id,
          { allottedToSupervisorId: null },
          req.user.userId
        );
      }
    }

    invalidateSampleEntryTabCaches();

    // Auto-skip Final Pass Lots for resample entries that already have offering/final price
    // Scenario 2: PASS_WITHOUT_COOKING goes to FINAL_REPORT, but if price exists, skip to LOT_ALLOTMENT
    if (nextStatus === 'FINAL_REPORT') {
      try {
        const SampleEntryOffering = require('../models/SampleEntryOffering');
        const offering = await SampleEntryOffering.findOne({
          where: { sampleEntryId: req.params.id },
          attributes: ['id', 'finalPrice', 'isFinalized', 'offerBaseRateValue'],
          raw: true
        });

        // If offering exists with a finalized price, this is Scenario 2 — auto-skip to LOT_ALLOTMENT
        if (offering && (offering.finalPrice || offering.isFinalized)) {
          console.log(`[LOT-SELECTION] Auto-skipping Final Pass Lots for resample entry ${req.params.id} — offering already exists`);
          await WorkflowEngine.transitionTo(
            req.params.id,
            'LOT_ALLOTMENT',
            req.user.userId,
            getWorkflowRole(req.user),
            { autoSkipFinalPassLots: true, resample: true }
          );
        }
      } catch (skipErr) {
        console.log(`[LOT-SELECTION] Auto-skip note: ${skipErr.message}`);
      }
    }

    res.json({ message: 'Workflow transitioned successfully', nextStatus });
  } catch (error) {
    console.error('Error transitioning workflow:', error);
    res.status(400).json({ error: error.message });
  }
});

// Recheck endpoint (Admin/Manager)
router.post('/:id/recheck', authenticateToken, async (req, res) => {
  try {
    const { recheckType } = req.body; // 'quality', 'cooking', 'both'
    const workflowRole = getWorkflowRole(req.user);

    if (!['admin', 'manager', 'owner'].includes(workflowRole)) {
      return res.status(403).json({ error: 'Only admin or manager can request recheck' });
    }

    const entry = await SampleEntry.findByPk(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    // Expand Eligibility: Allow recheck for any lot unless it's fully COMPLETED
    if (entry.workflowStatus === 'COMPLETED') {
      return res.status(400).json({ error: 'Recheck is not allowed for finalized/completed lots' });
    }

    let nextStatus;
    if (recheckType === 'quality' || recheckType === 'both') {
      nextStatus = 'QUALITY_CHECK';
    } else if (recheckType === 'cooking') {
      nextStatus = 'COOKING_REPORT';
    } else {
      return res.status(400).json({ error: 'Invalid recheck type' });
    }

    // 1. Capture metadata for the recheck
    const transitionMetadata = {
      recheckRequested: true,
      recheckType,
      previousStatus: entry.workflowStatus,
      previousDecision: entry.lotSelectionDecision || null
    };

    // 2. Transition workflow FIRST to mark the end of the current attempt in audit logs
    await WorkflowEngine.transitionTo(
      req.params.id,
      nextStatus,
      req.user.userId,
      workflowRole,
      transitionMetadata
    );

    // Reset lot selection decision for quality/both rechecks so previous FAIL doesn't persist
    if (recheckType === 'quality' || recheckType === 'both') {
      try {
        await SampleEntry.update(
          { lotSelectionDecision: null, lotSelectionAt: null },
          { where: { id: entry.id } }
        );
      } catch (lsError) {
        console.error('Non-critical error resetting lot selection during recheck:', lsError);
      }
    }

    // 3. Reset parameters AFTER transition to provide "Fresh Form" for the NEXT attempt
    if (recheckType === 'quality' || recheckType === 'both') {
      try {
        const qp = await QualityParameters.findOne({ where: { sampleEntryId: entry.id } });
        if (qp) {
          await QualityParametersService.resetQualityParameters(entry.id, req.user.userId);
        }
      } catch (qpError) {
        console.error('Non-critical error resetting quality parameters during recheck:', qpError);
      }
    }

    if (recheckType === 'cooking' || recheckType === 'both') {
      try {
        const CookingReport = require('../models/CookingReport');
        const CookingReportService = require('../services/CookingReportService');
        const cr = await CookingReport.findOne({ where: { sampleEntryId: entry.id } });
        if (cr) {
          const currentHistory = Array.isArray(cr.history) ? cr.history : [];
          if (cr.status) {
            currentHistory.push({
              date: new Date().toISOString(),
              status: cr.status,
              cookingDoneBy: cr.cookingDoneBy,
              approvedBy: cr.cookingApprovedBy,
              remarks: cr.remarks
            });
          }
          const freshCookingData = {
            sampleEntryId: entry.id,
            status: null,
            remarks: null,
            cookingDoneBy: null,
            cookingApprovedBy: null,
            hasRemarks: false,
            history: currentHistory
          };
          await CookingReportService.updateCookingReport(cr.id, freshCookingData, req.user.userId);
        }
      } catch (crError) {
        console.error('Non-critical error resetting cooking report during recheck:', crError);
      }
    }

    invalidateSampleEntryTabCaches();
    res.json({ success: true, message: `Recheck initiated. Entry moved to ${nextStatus}`, nextStatus });
  } catch (error) {
    console.error('Error initiating recheck:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create cooking report (Owner/Admin)
router.post('/:id/cooking-report', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    const reportData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };
    // Staff/quality supervisor should only submit "Cooking Done By".
    // They cannot set final cooking status transitions.
    if (['staff', 'quality_supervisor'].includes(workflowRole)) {
      reportData.status = null;
      reportData.cookingApprovedBy = null;
    }

    const report = await CookingReportService.createCookingReport(
      reportData,
      req.user.userId, // Use userId from JWT token
      workflowRole
    );

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating cooking report:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update offering price (Owner/Admin/Manager)
router.post('/:id/offering-price', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner', 'manager'].includes(getWorkflowRole(req.user))) {
      return res.status(403).json({ error: 'Only admin, owner, or manager can update offering price' });
    }

    const entry = await SampleEntryService.updateOfferingPrice(
      req.params.id, // Keep as UUID string
      req.body,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.json(entry);
  } catch (error) {
    console.error('Error updating offering price:', error);
    res.status(400).json({ error: error.message });
  }
});

// Set final price (Admin sets toggles, Manager fills values)
router.post('/:id/final-price', authenticateToken, async (req, res) => {
  try {
    console.log(`[FINAL-PRICE] ===== START =====`);
    console.log(`[FINAL-PRICE] Entry ID: ${req.params.id}`);
    console.log(`[FINAL-PRICE] User role: ${getWorkflowRole(req.user)}, baseRole: ${req.user.role}, userId: ${req.user.userId}`);
    console.log(`[FINAL-PRICE] isFinalized: ${req.body.isFinalized}`);
    console.log(`[FINAL-PRICE] finalPrice: ${req.body.finalPrice}`);

    // If a specific lorry trip ID is targetted
    if (req.body.targetLorryTripId) {
      const PhysicalInspection = require('../models/PhysicalInspection');
      const AuditService = require('../services/AuditService');
      const SampleEntryOffering = require('../models/SampleEntryOffering');

      const trip = await PhysicalInspection.findByPk(req.body.targetLorryTripId);
      if (!trip) {
        return res.status(404).json({ error: 'Target lorry trip inspection not found' });
      }

      const rateInfo = {
        rate: req.body.finalBaseRate,
        rateType: req.body.finalBaseRateType,
        sute: req.body.finalSute,
        suteUnit: req.body.finalSuteUnit,
        moisture: req.body.moistureValue,
        hamali: req.body.revisedHamali,
        hamaliUnit: req.body.hamaliUnit,
        lf: req.body.revisedLf,
        lfUnit: req.body.lfUnit,
        disputeReason: req.body.disputeReason,
        isDispute: Boolean(req.body.isDispute === true || req.body.isDispute === 'true' || req.body.revisedRateOption === 'dispute'),
        isRevision: Boolean(req.body.isRevision === true || req.body.isRevision === 'true'),
        linkedRevisionId: req.body.linkedRevisionId || null,
        linkedAt: new Date().toISOString(),
        linkedByUserId: req.user.userId
      };

      const userRole = getWorkflowRole(req.user);
      const isAlreadyLinked = !!trip.linkedPattiRate;

      if (isAlreadyLinked && (userRole === 'manager' || userRole === 'ceo')) {
        // Edit by manager on already linked lorry -> goes to approvals
        const offering = await SampleEntryOffering.findOne({ where: { sampleEntryId: trip.sampleEntryId } });
        if (!offering) {
          return res.status(404).json({ error: 'Offering not found for this entry' });
        }

        await offering.update({
          pendingRateLinkingStatus: 'pending',
          pendingRateLinkingData: {
            targetLorryTripId: req.body.targetLorryTripId,
            targetLorryNumber: trip.lorryNumber,
            rateInfo: rateInfo,
            // Format fields so the frontend Rate Linking Approvals tab table can display them
            finalPrice: rateInfo.rate,
            finalBaseRate: rateInfo.rate,
            finalSute: rateInfo.sute,
            finalSuteUnit: rateInfo.suteUnit,
            baseRateType: rateInfo.rateType,
            moistureValue: rateInfo.moisture,
            hamali: rateInfo.hamali,
            hamaliUnit: rateInfo.hamaliUnit,
            lf: rateInfo.lf,
            lfUnit: rateInfo.lfUnit
          }
        });

        invalidateSampleEntryTabCaches();
        return res.json({ success: true, pendingApproval: true, message: 'Lorry rate edit submitted for Admin approval!' });
      }

      // First time linking, or actioned by Admin/Owner -> Save directly
      const oldTrip = JSON.parse(JSON.stringify(trip));
      trip.linkedPattiRate = rateInfo;
      trip.finalBaseRate = rateInfo.rate;
      trip.finalBaseRateType = rateInfo.rateType;
      trip.finalSute = rateInfo.sute;
      trip.finalSuteUnit = rateInfo.suteUnit;
      trip.moisture = rateInfo.moisture;
      trip.revisedHamali = rateInfo.hamali;
      trip.hamaliUnit = rateInfo.hamaliUnit;
      trip.revisedLf = rateInfo.lf;
      trip.lfUnit = rateInfo.lfUnit;

      await trip.save();
      await AuditService.logUpdate(req.user.userId, 'physical_inspections', trip.id, oldTrip, trip);
      invalidateSampleEntryTabCaches();
      return res.json({ success: true, message: 'Rate linked to lorry trip successfully', linkedPattiRate: rateInfo });
    }

    const currentEntry = await SampleEntry.findByPk(req.params.id, {
      attributes: ['id', 'lotSelectionDecision', 'resampleAfterFinal']
    });

    const result = await SampleEntryService.setFinalPrice(
      req.params.id,
      req.body,
      req.user.userId,
      getWorkflowRole(req.user)
    );

    console.log(`[FINAL-PRICE] setFinalPrice succeeded. isFinalized in body: ${req.body.isFinalized}`);

    if (
      getWorkflowRole(req.user) === 'manager'
      && req.body.fillMissingValues
      && String(result?.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending'
    ) {
      invalidateSampleEntryTabCaches();
      console.log(`[FINAL-PRICE] Manager missing values staged for admin approval`);
      return res.json({
        ...result,
        pendingApproval: true,
        message: 'Manager values sent for admin approval'
      });
    }

    if (req.body.resampleAfterFinal) {
      const previousDecision = String(currentEntry?.lotSelectionDecision || '').toUpperCase();
      const resampleUpdate = {
        lotSelectionDecision: 'FAIL',
        lotSelectionByUserId: req.user.userId,
        lotSelectionAt: new Date(),
        entryType: 'LOCATION_SAMPLE',
        staffBagsEdits: 0,
        sampleCollectedBy: null,
        resampleOriginDecision: previousDecision || null,
        resampleTriggerRequired: previousDecision === 'PASS_WITH_COOKING',
        resampleTriggeredAt: null,
        resampleDecisionAt: null,
        resampleAfterFinal: true
      };
      if (req.body.resampleCollectedBy) {
        resampleUpdate.sampleCollectedBy = req.body.resampleCollectedBy;
      }
      await SampleEntryService.updateSampleEntry(req.params.id, resampleUpdate, req.user.userId);
      
      // Reset supervisor allotment so it has to be manually assigned
      const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(req.params.id);
      if (existingAllotment?.id) {
        await LotAllotmentService.updateLotAllotment(
          existingAllotment.id,
          { allottedToSupervisorId: null },
          req.user.userId
        );
      }
      console.log(`[FINAL-PRICE] Resample flagged and supervisor allotment reset for ${req.params.id}`);
    }

    // After updating the final price, ALWAYS check if we can transition to LOT_ALLOTMENT
    if (req.body.isFinalized) {
      try {
        const entry = await SampleEntryService.getSampleEntryById(req.params.id);
        console.log(`[FINAL-PRICE] Entry found: ${!!entry}, workflowStatus: ${entry ? entry.workflowStatus : 'N/A'}`);

        if (entry && ['FINAL_REPORT', 'LOT_SELECTION'].includes(entry.workflowStatus)) {
          console.log(`[FINAL-PRICE] Transitioning ${req.params.id} to LOT_ALLOTMENT (Loading Lots) (Triggered by ${getWorkflowRole(req.user)})`);
          await WorkflowEngine.transitionTo(
            req.params.id,
            'LOT_ALLOTMENT',
            req.user.userId,
            getWorkflowRole(req.user),
            { finalPriceSet: true }
          );
          console.log(`[FINAL-PRICE] ✅ Transition to LOT_ALLOTMENT (Loading Lots) SUCCEEDED!`);
        } else if (entry && entry.workflowStatus === 'LOT_ALLOTMENT' && req.body.resampleAfterFinal) {
          // Resample on an entry already at LOT_ALLOTMENT — stay at LOT_ALLOTMENT.
          // Offering price already exists, so it skips Final Lots and goes directly to Loading Lots.
          console.log(`[FINAL-PRICE] ✅ Entry ${req.params.id} already at LOT_ALLOTMENT (resample) — staying at Loading Lots`);
        } else {
          console.log(`[FINAL-PRICE] ⚠️ Skipped transition - entry status is: ${entry ? entry.workflowStatus : 'NOT FOUND'}`);
        }
      } catch (transitionError) {
        console.error(`[FINAL-PRICE] ❌ Transition FAILED:`, transitionError.message);
      }
    } else {
      console.log(`[FINAL-PRICE] ⚠️ isFinalized is false/undefined - no transition attempted`);
    }

    invalidateSampleEntryTabCaches();
    console.log(`[FINAL-PRICE] ===== END =====`);
    res.json(result);
  } catch (error) {
    console.error('[FINAL-PRICE] ❌ FATAL ERROR:', error.message);
    console.error('[FINAL-PRICE] Stack:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Transition workflow status (Manager can move lot to next stage)
router.post('/:id/transition', authenticateToken, async (req, res) => {
  try {
    const { toStatus } = req.body;
    if (!toStatus) {
      return res.status(400).json({ error: 'toStatus is required' });
    }

    const result = await WorkflowEngine.transitionTo(
      req.params.id,
      toStatus,
      req.user.userId,
      getWorkflowRole(req.user),
      {}
    );

    invalidateSampleEntryTabCaches();
    res.json({ success: true, message: `Transitioned to ${toStatus}`, result });
  } catch (error) {
    console.error('[TRANSITION] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// offering-data-batch route moved above /:id to prevent route shadowing

// Get offering data for auto-population in final price modal
router.get('/:id/offering-data', authenticateToken, async (req, res) => {
  try {
    const offering = await SampleEntryService.getOfferingData(req.params.id);
    res.json(offering || {});
  } catch (error) {
    console.error('Error fetching offering data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create lot allotment (Manager)
router.post('/:id/lot-allotment', authenticateToken, async (req, res) => {
  try {
    // Server-side enforcement: block supervisor assignment if manager fields are still missing
    const entry = await SampleEntryService.getSampleEntryById(req.params.id);
    if (entry && entry.offering) {
      const o = entry.offering;
      const missingFields = [];
      if (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) missingFields.push('Sute');
      if (o.moistureEnabled === false && !parseFloat(o.moistureValue)) missingFields.push('Moisture');
      if (o.hamaliEnabled === false && !parseFloat(o.hamali)) missingFields.push('Hamali');
      if (o.brokerageEnabled === false && !parseFloat(o.brokerage)) missingFields.push('Brokerage');
      if (o.lfEnabled === false && !parseFloat(o.lf)) missingFields.push('LF');
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Manager must fill missing fields before assigning supervisor: ${missingFields.join(', ')}. Update in Loading Lots tab first.`
        });
      }
    }

    const allotmentData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const allotment = await LotAllotmentService.createLotAllotment(
      allotmentData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(allotment);
  } catch (error) {
    console.error('Error creating lot allotment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update lot allotment (Manager - for reassigning supervisor)
router.put('/:id/lot-allotment', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;
    const { physicalSupervisorId } = req.body;

    if (!physicalSupervisorId) {
      return res.status(400).json({ error: 'Physical supervisor ID is required' });
    }

    // Get existing lot allotment
    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);

    if (!existingAllotment) {
      return res.status(404).json({ error: 'Lot allotment not found for this entry' });
    }

    // Update the supervisor assignment
    const updated = await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      { allottedToSupervisorId: physicalSupervisorId },
      req.user.userId
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating lot allotment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Complete loading lot manually (Manager / Admin)
router.post('/:id/complete-loading', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;

    // Only manager/admin can complete loading
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only manager or admin can complete loading lots' });
    }

    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);
    if (!existingAllotment) {
      return res.status(404).json({ error: 'Lot allotment not found for this entry' });
    }

    const progress = await PhysicalInspectionService.getInspectionProgress(sampleEntryId);
    const inspectedBags = progress.inspectedBags || 0;
    const finalBags = inspectedBags > 0 ? inspectedBags : (existingAllotment.allottedBags || 0);

    // Validate that all lorry trips are linked with a rate before completing
    const PhysicalInspection = require('../models/PhysicalInspection');
    const inspections = await PhysicalInspection.findAll({
      where: {
        lotAllotmentId: existingAllotment.id
      }
    });
    const lorryTrips = inspections.filter(insp => {
      const num = (insp.lorryNumber || '').trim().toUpperCase();
      return num !== 'LOT_AVG' && num !== 'BALANCED_LOT';
    });
    const hasUnlinked = lorryTrips.some(insp => !insp.linkedPattiRate);
    if (hasUnlinked) {
      return res.status(400).json({ error: 'Cannot complete lot: One or more lorry trips are not linked with a rate.' });
    }

    // Update lot allotment with close/complete info
    await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      {
        closedAt: new Date(),
        closedByUserId: req.user.userId,
        closedReason: `Lot marked as completed by ${req.user.role}.`,
        inspectedBags: finalBags,
        allottedBags: finalBags,
        completionType: 'COMPLETED'
      },
      req.user.userId
    );

    const entry = await SampleEntry.findByPk(sampleEntryId);
    if (entry) {
      entry.bags = finalBags;
      await entry.save();
    }

    // Only transition if not already at INVENTORY_ENTRY (avoid self-transition error)
    if (!entry || entry.workflowStatus !== 'INVENTORY_ENTRY') {
      await WorkflowEngine.transitionTo(
        sampleEntryId,
        'INVENTORY_ENTRY',
        req.user.userId,
        getWorkflowRole(req.user),
        {
          completedByManager: true,
          inspectedBags: finalBags,
          reason: `Manually completed by ${req.user.role}`
        }
      );
    }

    invalidateSampleEntryTabCaches();

    res.json({
      message: 'Lot completed successfully',
      bags: finalBags
    });
  } catch (error) {
    console.error('Error completing lot:', error);
    res.status(400).json({ error: error.message });
  }
});

// Close lot (Manager - when party doesn't send all bags)
router.post('/:id/close-lot', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;
    const { reason } = req.body;

    // Only manager/admin can close lots
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only manager or admin can close lots' });
    }

    // Get existing lot allotment
    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);
    if (!existingAllotment) {
      return res.status(404).json({ error: 'Lot allotment not found for this entry' });
    }

    // Get inspection progress to know how many bags were inspected
    const progress = await PhysicalInspectionService.getInspectionProgress(sampleEntryId);
    const inspectedBags = progress.inspectedBags || 0;

    // Update lot allotment with close info
    await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      {
        closedAt: new Date(),
        closedByUserId: req.user.userId,
        closedReason: reason || `Lot closed by manager. ${inspectedBags} of ${progress.totalBags} bags inspected. Party did not send remaining ${progress.remainingBags} bags.`,
        inspectedBags: inspectedBags,
        allottedBags: progress.totalBags,  // ✅ FIX: Keep original total bags, not inspected bags
        completionType: 'CLOSED_EARLY'
      },
      req.user.userId
    );

    // ✅ FIX: Do NOT modify Sample Entry bags field - it should always show original total (600)
    // The inspectedBags field in LotAllotment tracks actual loaded bags (300)
    // This way the UI shows: "600 total bags, 300 completed, 300 remaining"

    // Transition workflow to INVENTORY_ENTRY (skipping remaining bags)
    await WorkflowEngine.transitionTo(
      sampleEntryId,
      'INVENTORY_ENTRY',
      req.user.userId,
      getWorkflowRole(req.user),
      {
        closedByManager: true,
        inspectedBags,
        totalAllottedBags: progress.totalBags,
        remainingBags: progress.remainingBags,
        reason: reason || 'Party did not send remaining bags'
      }
    );

    // Invalidate caches so the UI updates immediately
    invalidateSampleEntryTabCaches();

    res.json({
      message: 'Lot closed successfully',
      inspectedBags,
      totalBags: progress.totalBags,
      remainingBags: progress.remainingBags
    });
  } catch (error) {
    console.error('Error closing lot:', error);
    res.status(400).json({ error: error.message });
  }
});

// Resume lot (Manager/Admin)
router.post('/:id/resume-lot', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;

    // Only manager and admin can resume lots
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only manager or admin can resume lots' });
    }

    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);
    if (!existingAllotment) {
      return res.status(404).json({ error: 'No lot allotment found for this sample entry' });
    }

    if (!existingAllotment.closedAt) {
      return res.status(400).json({ error: 'Lot is not closed' });
    }

    // Get original entry to restore bag count
    const entry = await SampleEntry.findByPk(sampleEntryId);

    // Get inspection progress
    const progress = await PhysicalInspectionService.getInspectionProgress(sampleEntryId);

    // Clear closed state and restore allotted bags
    await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      {
        closedAt: null,
        closedByUserId: null,
        closedReason: null,
        allottedBags: progress.totalBags || existingAllotment.allottedBags,
        completionType: null
      },
      req.user.userId
    );

    // Transition workflow back to PHYSICAL_INSPECTION
    await WorkflowEngine.transitionTo(
      sampleEntryId,
      'PHYSICAL_INSPECTION',
      req.user.userId,
      getWorkflowRole(req.user),
      { resumedByManager: true }
    );

    // Invalidate caches so the UI updates immediately
    invalidateSampleEntryTabCaches();

    res.json({
      message: 'Lot resumed successfully'
    });
  } catch (error) {
    console.error('Error resuming lot:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel lot (Admin/Manager)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { remarks, decision } = req.body;
    const SampleEntry = require('../models/SampleEntry');

    // Only manager/admin/owner can cancel lots
    if (!['manager', 'admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only manager or admin can cancel lots' });
    }

    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({ error: 'Remarks are required to cancel a lot.' });
    }

    const entry = await SampleEntry.findByPk(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    entry.workflowStatus = 'CANCELLED';
    entry.cancelRemarks = remarks.trim();
    if (String(decision || '').toUpperCase() === 'SOLDOUT') {
      entry.lotSelectionDecision = 'SOLDOUT';
      entry.lotSelectionAt = new Date();
      entry.lotSelectionByUserId = req.user.userId;
    }
    await entry.save();

    invalidateSampleEntryTabCaches();

    res.json({ message: 'Lot cancelled successfully', id: entry.id });
  } catch (error) {
    console.error('Error cancelling lot:', error);
    res.status(400).json({ error: error.message });
  }
});
// Create physical inspection (Physical Supervisor)
router.post('/:id/physical-inspection', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.fields([
      { name: 'halfLorryImage', maxCount: 1 },
      { name: 'fullLorryImage', maxCount: 1 },
      { name: 'stageImage', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        // Parse FormData values to correct types
        const inspectionData = {
          sampleEntryId: req.params.id, // Keep as UUID string
          inspectionDate: req.body.inspectionDate,
          lorryNumber: req.body.lorryNumber,
          stage: req.body.stage || null,
          actualBags: (req.body.actualBags !== undefined && req.body.actualBags !== null && req.body.actualBags !== '') ? Number.parseInt(req.body.actualBags) : 0,
          moisture: (req.body.moisture !== undefined && req.body.moisture !== null && req.body.moisture !== '') ? Number.parseFloat(req.body.moisture) : undefined,
          moistureRaw: req.body.moistureRaw || null,
          dryMoisture: (req.body.dryMoisture !== undefined && req.body.dryMoisture !== null && req.body.dryMoisture !== '') ? Number.parseFloat(req.body.dryMoisture) : undefined,
          dryMoistureRaw: req.body.dryMoistureRaw || null,
          grainsCount: (req.body.grainsCount !== undefined && req.body.grainsCount !== null && req.body.grainsCount !== '') ? Number.parseInt(req.body.grainsCount) : undefined,
          grainsCountRaw: req.body.grainsCountRaw || null,
          cutting1: (req.body.cutting1 !== undefined && req.body.cutting1 !== null && req.body.cutting1 !== '') ? Number.parseFloat(req.body.cutting1) : undefined,
          cutting2: (req.body.cutting2 !== undefined && req.body.cutting2 !== null && req.body.cutting2 !== '') ? Number.parseFloat(req.body.cutting2) : undefined,
          bend: (req.body.bend1 !== undefined && req.body.bend1 !== null && req.body.bend1 !== '') ? Number.parseFloat(req.body.bend1) : ((req.body.bend !== undefined && req.body.bend !== null && req.body.bend !== '') ? Number.parseFloat(req.body.bend) : undefined),
          bend1: (req.body.bend1 !== undefined && req.body.bend1 !== null && req.body.bend1 !== '') ? Number.parseFloat(req.body.bend1) : undefined,
          bend2: (req.body.bend2 !== undefined && req.body.bend2 !== null && req.body.bend2 !== '') ? Number.parseFloat(req.body.bend2) : undefined,
          mix: req.body.mix || null,
          mixRaw: req.body.mixRaw || null,
          smixEnabled: req.body.smixEnabled,
          mixS: req.body.mixS || null,
          mixSRaw: req.body.mixS || null,
          lmixEnabled: req.body.lmixEnabled,
          mixL: req.body.mixL || null,
          mixLRaw: req.body.mixL || null,
          sk: req.body.sk || null,
          skRaw: req.body.skRaw || null,
          kandu: req.body.kandu || null,
          kanduRaw: req.body.kanduRaw || null,
          oil: req.body.oil || null,
          oilRaw: req.body.oilRaw || null,
          smellHas: req.body.smellHas,
          smellType: req.body.smellType || null,
          paddyWbEnabled: req.body.paddyWbEnabled,
          paddyWb: (req.body.paddyWb !== undefined && req.body.paddyWb !== null && req.body.paddyWb !== '') ? Number.parseFloat(req.body.paddyWb) : undefined,
          paddyWbRaw: req.body.paddyWbRaw || null,
          paddyColorEnabled: req.body.paddyColorEnabled,
          paddyColor: req.body.paddyColor || null,
          kadiga: req.body.kadiga || 'N',
          nit: req.body.nit || null,
          remarks: req.body.remarks || null,
          samplingRulesMode: req.body.samplingRulesMode || null,
          isSkipped: req.body.isSkipped || null,
          totalUnloadedBags: req.body.totalUnloadedBags ? Number.parseInt(req.body.totalUnloadedBags) : null,
          disputeRows: req.body.disputeRows ? (typeof req.body.disputeRows === 'string' ? JSON.parse(req.body.disputeRows) : req.body.disputeRows) : null,
          returnBags: req.body.returnBags ? Number.parseInt(req.body.returnBags) : null,
          vehicleNo: req.body.vehicleNo || null,
          finalUnloadedBags: req.body.finalUnloadedBags ? Number.parseInt(req.body.finalUnloadedBags) : null,
          reportedBy: req.user.username // Username of the supervisor
        };

        const inspection = await PhysicalInspectionService.createPhysicalInspection(
          inspectionData,
          req.user.userId, // Use userId from JWT token
          getWorkflowRole(req.user)
        );

        // Upload images if provided (optional - don't fail if images not provided)
        if (req.files && (req.files.halfLorryImage || req.files.fullLorryImage || req.files.stageImage)) {
          try {
            await PhysicalInspectionService.uploadInspectionImages(
              inspection.id,
              req.files,
              req.user.userId,
              req.body.stage
            );
          } catch (imageError) {
            console.error('Error uploading images (non-critical):', imageError);
            // Continue without images - they are optional
          }
        }

        invalidateSampleEntryTabCaches();

        res.status(201).json(inspection);
      } catch (error) {
        console.error('Error creating physical inspection:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error in physical inspection route:', error);
    res.status(400).json({ error: error.message });
  }
});

// Upload inspection images
router.post('/:id/inspection-images', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.fields([
      { name: 'halfLorryImage', maxCount: 1 },
      { name: 'fullLorryImage', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const inspection = await PhysicalInspectionService.uploadInspectionImages(
        req.params.id, // Keep as UUID string
        req.files,
        req.user.userId // Use userId from JWT token
      );

      res.json(inspection);
    });
  } catch (error) {
    console.error('Error uploading inspection images:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reject a specific trip/physical inspection (Admin/Manager/Quality Supervisor)
router.delete('/:id/physical-inspection/:inspectionId', authenticateToken, async (req, res) => {
  try {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const AuditService = require('../services/AuditService');

    // Only quality supervisor, manager, admin, or owner can reject/delete a trip
    const allowedRoles = ['quality_supervisor', 'manager', 'admin', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only quality supervisor or manager can reject a trip' });
    }

    const inspection = await PhysicalInspection.findByPk(req.params.inspectionId);
    if (!inspection) {
      return res.status(404).json({ error: 'Trip inspection record not found' });
    }

    // Check if it belongs to this entry
    if (inspection.sampleEntryId !== req.params.id) {
      return res.status(400).json({ error: 'Trip inspection does not belong to this lot' });
    }

    // Log deletion in audit
    await AuditService.logDelete(req.user.userId, 'physical_inspections', inspection.id, inspection);

    // Delete the record
    await inspection.destroy();

    // Recalculate remaining status
    const remainingCount = await PhysicalInspection.count({
      where: { sampleEntryId: req.params.id }
    });

    const SampleEntry = require('../models/SampleEntry');
    const entry = await SampleEntry.findByPk(req.params.id);

    if (entry) {
      if (remainingCount === 0) {
        entry.workflowStatus = 'LOT_ALLOTMENT';
        await entry.save();
      } else {
        const InventoryData = require('../models/InventoryData');
        const inspections = await PhysicalInspection.findAll({
          where: { sampleEntryId: req.params.id }
        });
        let allHaveInventory = true;
        for (const insp of inspections) {
          const inv = await InventoryData.findOne({ where: { physicalInspectionId: insp.id } });
          if (!inv) {
            allHaveInventory = false;
            break;
          }
        }
        if (allHaveInventory) {
          entry.workflowStatus = 'INVENTORY_ENTRY';
        } else {
          entry.workflowStatus = 'PHYSICAL_INSPECTION';
        }
        await entry.save();
      }
    }

    // Invalidate caches
    invalidateSampleEntryTabCaches();

    res.json({ message: 'Trip rejected and removed successfully' });
  } catch (error) {
    console.error('Error rejecting trip:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create inventory data (Inventory Staff)
router.post('/:id/inventory-data', authenticateToken, async (req, res) => {
  try {
    const inventoryData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const inventory = await InventoryDataService.createInventoryData(
      inventoryData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(inventory);
  } catch (error) {
    console.error('Error creating inventory data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create financial calculation (Owner/Admin)
router.post('/:id/financial-calculation', authenticateToken, async (req, res) => {
  try {
    const calculationData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const calculation = await FinancialCalculationService.createFinancialCalculation(
      calculationData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error creating financial calculation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create manager financial calculation (Manager)
router.post('/:id/manager-financial-calculation', authenticateToken, async (req, res) => {
  try {
    const calculationData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const calculation = await FinancialCalculationService.createManagerFinancialCalculation(
      calculationData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error creating manager financial calculation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Complete workflow (Final Review -> Completed) + Auto-create Arrival records
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    // CHECK: Get inspection progress to see if all bags are inspected
    const progress = await PhysicalInspectionService.getInspectionProgress(req.params.id);
    const remainingBags = progress.remainingBags || 0;

    if (remainingBags > 0) {
      return res.status(400).json({
        error: `Cannot complete this lot! There are still ${remainingBags} bags remaining to be inspected. Please have the Physical Supervisor add the remaining bags first.`,
        remainingBags,
        inspectedBags: progress.inspectedBags,
        totalBags: progress.totalBags
      });
    }

    await WorkflowEngine.transitionTo(
      req.params.id, // Keep as UUID string
      'COMPLETED',
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-CREATE ARRIVAL RECORDS from completed workflow data
    // This ensures data flows into kunchinittu ledger, outturn stock, paddy stock
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const SampleEntry = require('../models/SampleEntry');
      const LotAllotment = require('../models/LotAllotment');
      const PhysicalInspection = require('../models/PhysicalInspection');
      const InventoryData = require('../models/InventoryData');
      const Arrival = require('../models/Arrival');
      const { Kunchinittu } = require('../models/Location');

      // Fetch the full sample entry with all associations
      const sampleEntry = await SampleEntry.findByPk(req.params.id, {
        include: [
          {
            model: LotAllotment,
            as: 'lotAllotment',
            include: [
              {
                model: PhysicalInspection,
                as: 'physicalInspections',
                include: [
                  {
                    model: InventoryData,
                    as: 'inventoryData',
                    required: false
                  }
                ]
              }
            ]
          },
          {
            model: require('../models/QualityParameters'),
            as: 'qualityParameters',
            required: false
          }
        ]
      });

      if (sampleEntry && sampleEntry.lotAllotment && sampleEntry.lotAllotment.physicalInspections) {
        const inspections = sampleEntry.lotAllotment.physicalInspections;
        let arrivalsCreated = 0;

        for (const inspection of inspections) {
          const invData = inspection.inventoryData;
          if (!invData) continue; // Skip inspections without inventory data

          // Generate SL No for each arrival
          const lastArrival = await Arrival.findOne({
            order: [['createdAt', 'DESC']],
            attributes: ['slNo']
          });
          let slNo = 'A01';
          if (lastArrival && lastArrival.slNo) {
            const lastNumber = parseInt(lastArrival.slNo.substring(1));
            slNo = `A${(lastNumber + 1).toString().padStart(2, '0')}`;
          }

          // Determine movementType and destination based on inventoryData.location
          let movementType = 'purchase';
          let toKunchinintuId = invData.kunchinittuId || null;
          let toWarehouseId = null;
          let outturnId = null;

          if (sampleEntry.placeType === 'production') {
            outturnId = sampleEntry.outturnId || null;
            toWarehouseId = sampleEntry.placeWarehouseId || null;
            toKunchinintuId = null;
          } else if (sampleEntry.placeType === 'kunchinittu') {
            toKunchinintuId = sampleEntry.placeKunchinittuId || toKunchinintuId;
            toWarehouseId = sampleEntry.placeWarehouseId || toWarehouseId;
            outturnId = null;
          } else if (invData.location === 'DIRECT_OUTTURN_PRODUCTION') {
            // For production — goes to outturn
            outturnId = invData.outturnId || null;
            toKunchinintuId = null;
          } else if (toKunchinintuId) {
            // Normal purchase — get warehouse from kunchinittu
            const kunchinittu = await Kunchinittu.findByPk(toKunchinintuId, {
              attributes: ['id', 'warehouseId']
            });
            if (kunchinittu) {
              toWarehouseId = kunchinittu.warehouseId || null;
            }
          }

          const grossWeight = parseFloat(invData.grossWeight) || 0;
          const tareWeight = parseFloat(invData.tareWeight) || 0;
          const netWeight = grossWeight - tareWeight;

          // Create the Arrival record — auto-approved since it comes from completed workflow
          await Arrival.create({
            slNo,
            date: invData.entryDate || sampleEntry.entryDate,
            movementType,
            broker: sampleEntry.brokerName || null,
            variety: invData.variety ? invData.variety.trim().toUpperCase() : (sampleEntry.variety ? sampleEntry.variety.trim().toUpperCase() : null),
            bags: invData.bags || sampleEntry.bags || 0,
            fromLocation: sampleEntry.location || null,
            toKunchinintuId,
            toWarehouseId,
            outturnId,
            moisture: invData.moisture || null,
            cutting: (sampleEntry.qualityParameters?.cutting1 && sampleEntry.qualityParameters?.cutting2)
              ? `${sampleEntry.qualityParameters.cutting1} x ${sampleEntry.qualityParameters.cutting2}`
              : (sampleEntry.qualityParameters?.cutting1 || sampleEntry.qualityParameters?.cutting2 || null),
            wbNo: invData.wbNumber || 'N/A',
            grossWeight,
            tareWeight,
            netWeight,
            lorryNumber: inspection.lorryNumber || sampleEntry.lorryNumber || 'N/A',
            status: 'approved',
            createdBy: req.user.userId,
            approvedBy: req.user.userId,
            approvedAt: new Date(),
            adminApprovedBy: req.user.userId,
            adminApprovedAt: new Date(),
            remarks: `Auto-created from completed sample entry #${sampleEntry.id}`,
            wbInputType: sampleEntry.wbInputType || null,
            millWbId: sampleEntry.millWbId || null,
            partyWbName: sampleEntry.partyWbName || null,
            wbStatus: sampleEntry.wbStatus || 'none',
            wbRejectReason: sampleEntry.wbRejectReason || null,
            placeType: sampleEntry.placeType || null,
            placeWarehouseId: sampleEntry.placeWarehouseId || null,
            placeKunchinittuId: sampleEntry.placeKunchinittuId || null,
            placeDate: sampleEntry.placeDate || null,
            placeStatus: sampleEntry.placeStatus || 'none',
            placeRejectReason: sampleEntry.placeRejectReason || null
          });

          arrivalsCreated++;
          console.log(`✅ Arrival ${slNo} created from sample entry ${sampleEntry.id} (inspection ${inspection.id})`);
        }

        console.log(`✅ Workflow COMPLETED: ${arrivalsCreated} arrival(s) auto-created for sample entry ${sampleEntry.id}`);
      }
    } catch (arrivalError) {
      // Log but don't fail the completion — arrival creation is secondary
      console.error('⚠️ Error auto-creating arrivals (workflow still completed):', arrivalError);
    }

    res.json({ message: 'Sample entry completed successfully' });
  } catch (error) {
    console.error('Error completing sample entry:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get sample entry ledger
router.get('/ledger/all', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, broker, variety, party, location, status, limit, page, pageSize, cursor, entryType, excludeEntryType } = req.query;

    const filters = {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      broker,
      variety,
      party,
      location,
      status,
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 100,
      cursor,
      entryType,
      excludeEntryType
    };

    const ledger = await SampleEntryService.getSampleEntryLedger(filters);

    res.json(ledger);
  } catch (error) {
    console.error('Error getting sample entry ledger:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get inspection progress for a sample entry
router.get('/:id/inspection-progress', authenticateToken, async (req, res) => {
  try {
    const progress = await PhysicalInspectionService.getInspectionProgress(req.params.id);
    res.json(progress);
  } catch (error) {
    console.error('Error getting inspection progress:', error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
