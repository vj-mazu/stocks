export const getEntryTypeCode = (entryType?: string | null) => {
  const normalized = String(entryType || '').toUpperCase();
  if (normalized === 'DIRECT_LOADED_VEHICLE') return 'RL';
  if (normalized === 'LOCATION_SAMPLE') return 'LS';
  if (normalized === 'RICE_SAMPLE') return 'RS';
  return 'MS';
};

export const getEntryTypeTextColor = (typeCode?: string | null) => {
  const normalized = String(typeCode || '').toUpperCase();
  if (normalized === 'RL') return '#1565c0';
  if (normalized === 'MS' || normalized === 'RS') return '#166534';
  return '#c2410c';
};

export const isConvertedResampleType = (entry: any) => {
  const originalEntryType = String(entry?.originalEntryType || '').trim();
  const currentEntryType = String(entry?.entryType || '').toUpperCase();
  if (!originalEntryType || currentEntryType !== 'LOCATION_SAMPLE' || originalEntryType.toUpperCase() === 'LOCATION_SAMPLE') {
    return false;
  }

  return (
    String(entry?.resampleOriginDecision || '').toUpperCase() === 'PASS_WITH_COOKING'
    || String(entry?.resampleOriginDecision || '').toUpperCase() === 'PASS_WITHOUT_COOKING'
    || Number(entry?.qualityReportAttempts || 0) > 1
    || (Array.isArray(entry?.qualityAttemptDetails) && entry.qualityAttemptDetails.length > 1)
    || (Array.isArray(entry?.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0)
    || (Array.isArray(entry?.resampleCollectedHistory) && entry.resampleCollectedHistory.length > 0)
    || Boolean(entry?.resampleStartAt)
    || Boolean(entry?.resampleTriggerRequired)
    || Boolean(entry?.resampleTriggeredAt)
    || Boolean(entry?.resampleDecisionAt)
  );
};

export const getDisplayedEntryTypeCode = (entry: any) => {
  if (isConvertedResampleType(entry)) {
    return getEntryTypeCode(entry?.originalEntryType);
  }
  return getEntryTypeCode(entry?.entryType);
};

export const getOriginalEntryTypeCode = (entry: any) => {
  return getEntryTypeCode(entry?.originalEntryType || entry?.entryType);
};

export const getConvertedEntryTypeCode = (entry: any) => {
  return getEntryTypeCode(entry?.entryType);
};

export type SupervisorLike = {
  id?: string | number | null;
  username?: string | null;
  fullName?: string | null;
  role?: string | null;
};

export type CollectedByDisplayResult = {
  primary: string;
  secondary: string | null;
  highlightPrimary: boolean;
};

type CollectedByDisplayOptions = {
  keepLoginPair?: boolean;
};

const toTitleCase = (value?: string | null) => {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
};

const getCollectorLabel = (value: string | null | undefined, supervisors: SupervisorLike[], entry?: any) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.toLowerCase() === 'broker office sample') return 'Broker Office Sample';

  const normalizedRaw = raw.toLowerCase();
  const match = supervisors.find((sup) => {
    const username = String(sup.username || '').trim().toLowerCase();
    const fullName = String(sup.fullName || '').trim().toLowerCase();
    const id = String(sup.id || '').trim().toLowerCase();
    return normalizedRaw === username || normalizedRaw === fullName || normalizedRaw === id;
  });

  return match?.fullName
    ? toTitleCase(match.fullName)
    : match?.username
      ? toTitleCase(match.username)
      : (() => {
          const normalizedRaw = raw.toLowerCase();
          const creatorUsername = String(entry?.creator?.username || '').trim().toLowerCase();
          const creatorId = String(entry?.creator?.id || '').trim().toLowerCase();
          const creatorFullName = String(entry?.creator?.fullName || '').trim();
          if (creatorFullName && (normalizedRaw === creatorUsername || normalizedRaw === creatorId || normalizedRaw === creatorFullName.toLowerCase())) {
            return toTitleCase(creatorFullName);
          }

          const updatedBy = String(entry?.updatedBy || '').trim().toLowerCase();
          const updatedByFullName = String(entry?.updatedByFullName || '').trim();
          if (updatedByFullName && (normalizedRaw === updatedBy || normalizedRaw === updatedByFullName.toLowerCase())) {
            return toTitleCase(updatedByFullName);
          }

          const createdBy = String(entry?.createdBy || '').trim().toLowerCase();
          const createdByFullName = String(entry?.createdByFullName || '').trim();
          if (createdByFullName && (normalizedRaw === createdBy || normalizedRaw === createdByFullName.toLowerCase())) {
            return toTitleCase(createdByFullName);
          }

          return toTitleCase(raw);
        })();
};

const buildOrderedCollectorNames = (values: Array<string | null | undefined>) => values
  .map((value) => String(value || '').trim())
  .filter(Boolean)
  .filter((value, index, arr) => (
    arr.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
  ));

const extractCollectorValue = (item: any) => {
  if (typeof item === 'string') return String(item || '').trim();
  if (item && typeof item === 'object') return String(item.sampleCollectedBy || item.name || '').trim();
  return '';
};

const getLatestFirstCycleCollector = (entry: any) => {
  const current = String(entry?.sampleCollectedBy || '').trim();
  const timeline = Array.isArray(entry?.sampleCollectedTimeline) ? entry.sampleCollectedTimeline : [];
  const history = Array.isArray(entry?.sampleCollectedHistory) ? entry.sampleCollectedHistory : [];
  const lastTimelineValue = timeline.length > 0 ? extractCollectorValue(timeline[timeline.length - 1]) : '';
  const lastHistoryValue = history.length > 0 ? extractCollectorValue(history[history.length - 1]) : '';
  const firstHistoryValue = history.length > 0 ? extractCollectorValue(history[0]) : '';
  const currentIsBroker = current.toLowerCase() === 'broker office sample';
  const latestNonBroker = [lastTimelineValue, lastHistoryValue, firstHistoryValue]
    .map((value) => String(value || '').trim())
    .find((value) => value && value.toLowerCase() !== 'broker office sample');

  if (currentIsBroker && latestNonBroker) {
    return latestNonBroker;
  }

  return String(current || lastTimelineValue || lastHistoryValue || firstHistoryValue || '').trim();
};

const getResampleCollectorNames = (entry: any) => {
  const resampleTimeline = Array.isArray(entry?.resampleCollectedTimeline) ? entry.resampleCollectedTimeline : [];
  const resampleHistory = Array.isArray(entry?.resampleCollectedHistory) ? entry.resampleCollectedHistory : [];
  return buildOrderedCollectorNames([
    ...resampleTimeline.map(extractCollectorValue),
    ...resampleHistory.map(extractCollectorValue)
  ]).filter((name) => name.toLowerCase() !== 'broker office sample');
};

const parseStoredCollectorPair = (value: string) => {
  const parts = String(value || '').split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const loginName = parts[parts.length - 1];
  const selectedName = parts.slice(0, -1).join(' | ');
  return { selectedName, loginName };
};

export const getCollectedByDisplay = (entry: any, supervisors: SupervisorLike[], options?: CollectedByDisplayOptions): CollectedByDisplayResult => {
  const keepLoginPair = options?.keepLoginPair === true;
  const latestFirstCycleCollector = getLatestFirstCycleCollector(entry);
  const currentCollector = String(entry?.sampleCollectedBy || '').trim();
  const resampleCollectors = getResampleCollectorNames(entry);

  if (resampleCollectors.length === 0) {
    const storedPair = parseStoredCollectorPair(latestFirstCycleCollector || currentCollector);
    if (storedPair) {
      const selectedLabel = getCollectorLabel(storedPair.selectedName, supervisors, entry);
      if (selectedLabel === 'Broker Office Sample') {
        return { primary: 'Broker Office Sample', secondary: null, highlightPrimary: false };
      }
      if (!keepLoginPair) {
        return {
          primary: selectedLabel,
          secondary: null,
          highlightPrimary: false
        };
      }
      return {
        primary: getCollectorLabel(storedPair.loginName, supervisors, entry),
        secondary: selectedLabel,
        highlightPrimary: true
      };
    }

    return {
      primary: getCollectorLabel(latestFirstCycleCollector || currentCollector || null, supervisors, entry),
      secondary: null,
      highlightPrimary: false
    };
  }

  const resampleCollectorTokens = resampleCollectors.map((value) => value.toLowerCase());
  const firstCycleCandidates = buildOrderedCollectorNames([
    ...(Array.isArray(entry?.sampleCollectedTimeline) ? entry.sampleCollectedTimeline.map(extractCollectorValue) : []),
    ...(Array.isArray(entry?.sampleCollectedHistory) ? entry.sampleCollectedHistory.map(extractCollectorValue) : []),
    latestFirstCycleCollector,
    currentCollector
  ]);
  const firstCycleCollector = firstCycleCandidates.find((value) => (
    value
    && !resampleCollectorTokens.includes(value.toLowerCase())
  )) || latestFirstCycleCollector || currentCollector;
  const parsedFirstCycleCollector = !keepLoginPair ? (parseStoredCollectorPair(firstCycleCollector || '')?.selectedName || firstCycleCollector) : firstCycleCollector;
  const parsedResampleCollector = !keepLoginPair ? (parseStoredCollectorPair(resampleCollectors[resampleCollectors.length - 1] || '')?.selectedName || resampleCollectors[resampleCollectors.length - 1]) : resampleCollectors[resampleCollectors.length - 1];
  const firstCycleLabel = getCollectorLabel(parsedFirstCycleCollector || null, supervisors, entry);
  const resampleLabel = getCollectorLabel(parsedResampleCollector || null, supervisors, entry);

  if (!resampleLabel || resampleLabel === '-' || firstCycleLabel.toLowerCase() === resampleLabel.toLowerCase()) {
    return {
      primary: firstCycleLabel,
      secondary: null,
      highlightPrimary: false
    };
  }

  return {
    primary: firstCycleLabel,
    secondary: resampleLabel,
    highlightPrimary: false
  };
};
