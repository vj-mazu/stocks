import {
  hasSavedResampleAttemptFromHistory,
  shouldPreserveGpsPrefill,
  shouldRefillQualityModal,
  shouldShowQualityUpdateMode
} from '../utils/sampleEntryQualityModalLogic';

describe('sampleEntryQualityModalLogic', () => {
  it('keeps first resample next in add mode', () => {
    expect(shouldShowQualityUpdateMode({
      intent: 'next',
      hasSavedQuality: true,
      isPaddyResampleModal: true,
      hasSavedResampleAttempt: false
    })).toBe(false);
  });

  it('keeps edit in update mode when saved quality exists', () => {
    expect(shouldShowQualityUpdateMode({
      intent: 'edit',
      hasSavedQuality: true,
      isPaddyResampleModal: true,
      hasSavedResampleAttempt: false
    })).toBe(true);
  });

  it('only preserves gps prefill for edit, not next', () => {
    expect(shouldPreserveGpsPrefill({
      entry: {
        entryType: 'LOCATION_SAMPLE',
        lotSelectionDecision: 'FAIL',
        resampleOriginDecision: 'PASS_WITHOUT_COOKING'
      },
      hasSavedQuality: true,
      needsNewAttempt: false,
      intent: 'edit'
    })).toBe(true);

    expect(shouldPreserveGpsPrefill({
      entry: {
        entryType: 'LOCATION_SAMPLE',
        lotSelectionDecision: 'FAIL',
        resampleOriginDecision: 'PASS_WITHOUT_COOKING'
      },
      hasSavedQuality: true,
      needsNewAttempt: false,
      intent: 'next'
    })).toBe(false);
  });

  it('does not refill next mode with old values', () => {
    expect(shouldRefillQualityModal({
      intent: 'next',
      hasLatestSavedAttempt: true,
      hasMeaningfulFormData: false,
      isResampleAddMode: true
    })).toBe(false);
  });

  it('does refill edit mode when the form is blank', () => {
    expect(shouldRefillQualityModal({
      intent: 'edit',
      hasLatestSavedAttempt: true,
      hasMeaningfulFormData: false,
      isResampleAddMode: false
    })).toBe(true);
  });

  it('detects saved resample attempt only after explicit resample start', () => {
    expect(hasSavedResampleAttemptFromHistory({
      entry: {
        resampleTriggeredAt: '2026-04-04T10:00:00.000Z'
      },
      isResampleWorkflow: true,
      qualityAttempts: [
        { createdAt: '2026-04-04T09:00:00.000Z' },
        { createdAt: '2026-04-04T10:05:00.000Z' }
      ]
    })).toBe(true);
  });
});
