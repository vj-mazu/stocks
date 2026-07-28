const {
  normalizeQualityEntryIntent,
  shouldCreateNewQualityAttempt
} = require('../utils/qualityEntryIntent');

describe('qualityEntryIntent', () => {
  test('normalizes supported intents', () => {
    expect(normalizeQualityEntryIntent('next')).toBe('next');
    expect(normalizeQualityEntryIntent('edit')).toBe('edit');
    expect(normalizeQualityEntryIntent('other')).toBe('auto');
  });

  test('edit intent never creates a new attempt', () => {
    expect(shouldCreateNewQualityAttempt({
      intent: 'edit',
      heuristicDecision: true,
      isResampleQualityPending: true
    })).toBe(false);
  });

  test('next intent creates a new attempt for pending resample flow', () => {
    expect(shouldCreateNewQualityAttempt({
      intent: 'next',
      heuristicDecision: false,
      isResampleQualityPending: true
    })).toBe(true);
  });

  test('auto intent falls back to heuristic decision', () => {
    expect(shouldCreateNewQualityAttempt({
      intent: 'auto',
      heuristicDecision: true,
      isResampleQualityPending: false
    })).toBe(true);
    expect(shouldCreateNewQualityAttempt({
      intent: 'auto',
      heuristicDecision: false,
      isResampleQualityPending: true
    })).toBe(false);
  });
});
