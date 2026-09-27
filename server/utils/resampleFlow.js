// Pure helpers for deciding whether a lot's resample workflow has genuinely
// started. Kept dependency-free so they can be unit tested directly.

const isConvertedLocationResample = (entry = {}) => (
  String(entry?.entryType || '').toUpperCase() === 'LOCATION_SAMPLE'
  && !!String(entry?.originalEntryType || '').trim()
  && String(entry?.originalEntryType || '').toUpperCase() !== 'LOCATION_SAMPLE'
);

// isResampleActuallyInitiated: true only when a resample has really started.
//
// A bare resampleTriggerRequired flag only means "a resample WILL be needed" -- it
// is set the moment a Pass-with-Cooking lot is marked for resample, BEFORE the
// Trigger button is pressed. It must never be enough on its own to create a second
// quality sample, otherwise a plain WB-R / WB-BK edit silently spawns a duplicate
// sample. Only a genuinely initiated resample may create one.
//
// resampleDecisionAt is deliberately NOT counted here. It is only ever written to a
// real timestamp by the ordinary lot-decision branch (a Pass-with-Cooking /
// Pass-without-Cooking decision on an entry that already carries a resample marker).
// Every genuine resample path clears it back to null and sets resampleTriggeredAt
// instead. Counting it made a plain WB-R / WB-BK edit look like an initiated
// resample and spawn a duplicate 2nd sample.
const isResampleActuallyInitiated = (entry = {}) => (
  String(entry?.lotSelectionDecision || '').toUpperCase() === 'FAIL'
  || Boolean(entry?.resampleTriggeredAt)
  || Boolean(entry?.resampleStartAt)
  || Boolean(entry?.resampleAfterFinal)
  || isConvertedLocationResample(entry)
);

module.exports = {
  isConvertedLocationResample,
  isResampleActuallyInitiated
};
