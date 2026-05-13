function normalizeQualityEntryIntent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'next' || normalized === 'edit') {
    return normalized;
  }
  return 'auto';
}

function shouldCreateNewQualityAttempt({ intent, heuristicDecision, isResampleQualityPending }) {
  const normalizedIntent = normalizeQualityEntryIntent(intent);
  if (normalizedIntent === 'edit') {
    return false;
  }
  if (normalizedIntent === 'next') {
    return Boolean(isResampleQualityPending || heuristicDecision);
  }
  return Boolean(heuristicDecision);
}

module.exports = {
  normalizeQualityEntryIntent,
  shouldCreateNewQualityAttempt
};
