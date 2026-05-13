import {
  getExplicitResampleStartTime,
  hasSavedResampleAttemptFromHistory,
  shouldPreserveGpsPrefill,
  shouldShowQualityUpdateMode
} from './sampleEntryQualityModalLogic';

describe('sampleEntryQualityModalLogic', () => {
  it('does not treat the original pass-without-cooking sample as a saved resample attempt', () => {
    const entry = {
      entryType: 'LOCATION_SAMPLE',
      lotSelectionDecision: 'FAIL',
      resampleOriginDecision: 'PASS_WITHOUT_COOKING',
      lotSelectionAt: '2026-04-04T10:00:00.000Z'
    };
    const qualityAttempts = [
      {
        attemptNo: 1,
        moisture: 12,
        grainsCount: 122,
        updatedAt: '2026-04-04T10:05:00.000Z'
      }
    ];

    expect(getExplicitResampleStartTime(entry)).toBe(0);
    expect(
      hasSavedResampleAttemptFromHistory({
        entry,
        qualityAttempts,
        isResampleWorkflow: true
      })
    ).toBe(false);
  });

  it('treats a saved attempt after the true resample decision time as a resample sample', () => {
    const entry = {
      entryType: 'LOCATION_SAMPLE',
      lotSelectionDecision: 'FAIL',
      resampleOriginDecision: 'PASS_WITHOUT_COOKING',
      resampleDecisionAt: '2026-04-04T11:00:00.000Z'
    };
    const qualityAttempts = [
      {
        attemptNo: 1,
        moisture: 12,
        grainsCount: 122,
        updatedAt: '2026-04-04T10:05:00.000Z'
      },
      {
        attemptNo: 2,
        moisture: 10,
        grainsCount: 10,
        updatedAt: '2026-04-04T11:10:00.000Z'
      }
    ];

    expect(
      hasSavedResampleAttemptFromHistory({
        entry,
        qualityAttempts,
        isResampleWorkflow: true
      })
    ).toBe(true);
  });

  it('never shows update mode for a Next action', () => {
    expect(
      shouldShowQualityUpdateMode({
        intent: 'next',
        hasSavedQuality: true,
        isPaddyResampleModal: true,
        hasSavedResampleAttempt: true
      })
    ).toBe(false);
  });

  it('preserves GPS-prefilled quality only for edit on pass-without-cooking resample rows', () => {
    const baseEntry = {
      entryType: 'LOCATION_SAMPLE',
      lotSelectionDecision: 'FAIL',
      resampleOriginDecision: 'PASS_WITHOUT_COOKING'
    };

    expect(
      shouldPreserveGpsPrefill({
        entry: baseEntry,
        hasSavedQuality: true,
        needsNewAttempt: false,
        intent: 'edit'
      })
    ).toBe(true);

    expect(
      shouldPreserveGpsPrefill({
        entry: baseEntry,
        hasSavedQuality: true,
        needsNewAttempt: false,
        intent: 'next'
      })
    ).toBe(false);
  });
});
