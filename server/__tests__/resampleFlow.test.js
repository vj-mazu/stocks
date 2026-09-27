const {
  isResampleActuallyInitiated,
  isConvertedLocationResample
} = require('../utils/resampleFlow');

describe('isResampleActuallyInitiated', () => {
  test('a plain WB-R / WB-BK edit on a Pass-with-Cooking lot is NOT a resample', () => {
    // The bug scenario: a lot marked Pass with Cooking whose WB-R / WB-BK were
    // missed, later filled in. It carries resampleDecisionAt but no resample has
    // actually been triggered, so it must not be treated as an initiated resample.
    expect(isResampleActuallyInitiated({
      entryType: 'RICE_SAMPLE',
      lotSelectionDecision: 'PASS_WITH_COOKING',
      resampleOriginDecision: 'PASS_WITH_COOKING',
      resampleTriggerRequired: true,
      resampleTriggeredAt: null,
      resampleStartAt: null,
      resampleDecisionAt: '2026-04-01T10:00:00.000Z'
    })).toBe(false);
  });

  test('resampleDecisionAt alone never counts as initiated', () => {
    expect(isResampleActuallyInitiated({ resampleDecisionAt: new Date() })).toBe(false);
  });

  test('resampleTriggerRequired alone never counts as initiated', () => {
    expect(isResampleActuallyInitiated({ resampleTriggerRequired: true })).toBe(false);
  });

  test('a triggered resample counts as initiated', () => {
    expect(isResampleActuallyInitiated({ resampleTriggeredAt: new Date() })).toBe(true);
    expect(isResampleActuallyInitiated({ resampleStartAt: new Date() })).toBe(true);
    expect(isResampleActuallyInitiated({ resampleAfterFinal: true })).toBe(true);
    expect(isResampleActuallyInitiated({ lotSelectionDecision: 'FAIL' })).toBe(true);
  });

  test('a converted location sample counts as initiated', () => {
    const converted = { entryType: 'LOCATION_SAMPLE', originalEntryType: 'RICE_SAMPLE' };
    expect(isConvertedLocationResample(converted)).toBe(true);
    expect(isResampleActuallyInitiated(converted)).toBe(true);
  });

  test('a native location sample is not a converted resample', () => {
    expect(isResampleActuallyInitiated({ entryType: 'LOCATION_SAMPLE', originalEntryType: '' })).toBe(false);
  });
});
