type QualityIntent = 'auto' | 'next' | 'edit';

type ResampleDecisionInput = {
  entry: any;
  qualityAttempts: any[];
  isResampleWorkflow: boolean;
};

const toTimeValue = (value?: string | null) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const getExplicitResampleStartTime = (entry: any) =>
  toTimeValue(
    entry?.resampleStartAt
    || entry?.resampleTriggeredAt
    || entry?.resampleDecisionAt
    || null
  );

export const hasSavedResampleAttemptFromHistory = ({
  entry,
  qualityAttempts,
  isResampleWorkflow
}: ResampleDecisionInput) => {
  if (!isResampleWorkflow) return false;

  const resampleStartTime = getExplicitResampleStartTime(entry);
  if (!resampleStartTime) {
    return false;
  }

  return qualityAttempts.some((attempt: any) => {
    const attemptTime = toTimeValue(attempt?.updatedAt || attempt?.createdAt);
    return attemptTime > 0 && attemptTime >= (resampleStartTime - 2000);
  });
};

export const shouldPreserveGpsPrefill = ({
  entry,
  hasSavedQuality,
  needsNewAttempt,
  intent
}: {
  entry: any;
  hasSavedQuality: boolean;
  needsNewAttempt: boolean;
  intent: QualityIntent;
}) => (
  intent === 'edit'
  && entry?.entryType === 'LOCATION_SAMPLE'
  && entry?.lotSelectionDecision === 'FAIL'
  && String(entry?.resampleOriginDecision || '').toUpperCase() === 'PASS_WITHOUT_COOKING'
  && hasSavedQuality
  && !needsNewAttempt
);

export const shouldShowQualityUpdateMode = ({
  intent,
  hasSavedQuality,
  isPaddyResampleModal,
  hasSavedResampleAttempt
}: {
  intent: QualityIntent;
  hasSavedQuality: boolean;
  isPaddyResampleModal: boolean;
  hasSavedResampleAttempt: boolean;
}) => {
  if (intent === 'next') return false;
  if (intent === 'edit') return hasSavedQuality;
  return hasSavedQuality && (!isPaddyResampleModal || hasSavedResampleAttempt);
};

export const shouldRefillQualityModal = ({
  intent,
  hasLatestSavedAttempt,
  hasMeaningfulFormData,
  isResampleAddMode
}: {
  intent: QualityIntent;
  hasLatestSavedAttempt: boolean;
  hasMeaningfulFormData: boolean;
  isResampleAddMode: boolean;
}) => {
  if (intent === 'next') return false;
  if (!hasLatestSavedAttempt) return false;
  if (hasMeaningfulFormData) return false;
  if (isResampleAddMode) return false;
  return true;
};

export const getDisplayQualityParameters = (entry: any) => {
  if (!entry || !entry.qualityParameters) return null;
  const qp = entry.qualityParameters;

  // 1. Is this a quality recheck pending?
  const isQualityRecheckPending = entry.qualityPending === true ||
    (entry.qualityPending == null && entry.recheckRequested === true && entry.recheckType !== 'cooking');

  if (isQualityRecheckPending) {
    return null;
  }

  // 2. Is this a resample workflow pending?
  const hasResampleCollectorHistory = (Array.isArray(entry.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0)
    || (Array.isArray(entry.resampleCollectedHistory) && entry.resampleCollectedHistory.length > 0);
  const isFailDecision = String(entry.lotSelectionDecision || '').toUpperCase() === 'FAIL';
  const isConvertedLocationResample = String(entry.entryType || '').toUpperCase() === 'LOCATION_SAMPLE'
    && ['FAIL', 'PASS_WITH_COOKING'].includes(String(entry.resampleOriginDecision || '').toUpperCase());

  const isResampleFlow = isFailDecision || hasResampleCollectorHistory || isConvertedLocationResample;

  if (isResampleFlow) {
    const qpUpdated = toTimeValue(qp.updatedAt || qp.createdAt);
    const resampleStart = getExplicitResampleStartTime(entry);
    const failDate = toTimeValue(entry.lotSelectionAt);

    // Strict chronological check: If the quality was last updated BEFORE it was failed or resample was triggered,
    // it unequivocally means this is the OLD data and NOT the new resample quality!
    if (resampleStart > 0 && qpUpdated < resampleStart) {
      return null;
    }
    if (isFailDecision && failDate > 0 && qpUpdated < failDate) {
      return null;
    }
  }

  // 3. For extra safety, check recheck requested at
  const recheckRequested = toTimeValue(entry.qualityRecheckRequestedAt);
  if (recheckRequested > 0 && toTimeValue(qp.updatedAt || qp.createdAt) < recheckRequested) {
    return null;
  }

  return qp;
};
