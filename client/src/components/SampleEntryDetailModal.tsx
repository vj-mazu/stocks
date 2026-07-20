import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { getCollectedByDisplay as getSharedCollectedByDisplay, splitCollectedByLine } from '../utils/sampleTypeDisplay';
import { toast } from '../utils/toast';
import ConfirmationModal from './ConfirmationModal';

interface SampleEntry {
    id: string;
    serialNo?: number;
    entryDate: string;
    createdAt: string;
    brokerName: string;
    variety: string;
    partyName: string;
    location: string;
    bags: number;
    packaging?: string;
    lorryNumber?: string;
    entryType?: string;
    sampleCollectedBy?: string;
    workflowStatus: string;
    lotSelectionDecision?: string;
    lotSelectionAt?: string;
    resampleStartAt?: string;
    cancelRemarks?: string;
    failRemarks?: string | null;
    qualityReportAttempts?: number;
    qualityAttemptDetails?: any[];
    qualityParameters?: {
        moisture: number;
        cutting1: number;
        cutting2: number;
        bend: number;
        bend1: number;
        bend2: number;
        mixS: number;
        mixL: number;
        mix: number;
        kandu: number;
        oil: number;
        sk: number;
        grainsCount: number;
        wbR: number;
        wbBk: number;
        wbT: number;
        paddyWb: number;
        smellHas?: boolean;
        smellType?: string | null;
        reportedBy: string;
        uploadFileUrl?: string;
    };
    cookingReport?: {
        status: string;
        cookingResult: string;
        recheckCount?: number;
        remarks?: string;
        cookingDoneBy?: string;
        cookingApprovedBy?: string;
        updatedAt?: string;
        createdAt?: string;
        history?: Array<{
            date?: string | null;
            status?: string | null;
            cookingDoneBy?: string | null;
            approvedBy?: string | null;
            remarks?: string | null;
        }>;
    };
    offering?: {
        finalPrice?: number;
        offeringPrice?: number;
        offerBaseRateValue?: number;
        baseRateType?: string;
        baseRateUnit?: string;
        finalBaseRate?: number;
        finalBaseRateType?: string;
        finalBaseRateUnit?: string;
        finalSute?: number;
        finalSuteUnit?: string;
        sute?: number;
        suteUnit?: string;
        moistureValue?: number;
        hamali?: number;
        hamaliUnit?: string;
        brokerage?: number;
        brokerageUnit?: string;
        lf?: number;
        lfUnit?: string;
        egbType?: string;
        egbValue?: number;
        cdEnabled?: boolean;
        cdValue?: number;
        cdUnit?: string;
        bankLoanEnabled?: boolean;
        bankLoanValue?: number;
        bankLoanUnit?: string;
        paymentConditionValue?: number;
        paymentConditionUnit?: string;
        updatedBy?: string;
        createdBy?: string;
        disputeBaseRate?: number | string;
        disputeBaseRateType?: string;
        revisedHamali?: number | string;
        revisedLf?: number | string;
        offerVersions?: Array<{
            key: string;
            offerBaseRateValue?: number;
            baseRateType?: string;
            baseRateUnit?: string;
            offeringPrice?: number;
            finalPrice?: number;
            finalBaseRate?: number;
            moistureValue?: number;
            hamali?: number;
            hamaliUnit?: string;
            brokerage?: number;
            brokerageUnit?: string;
            lf?: number;
            lfUnit?: string;
            egbType?: string;
            egbValue?: number;
            cdValue?: number;
            cdUnit?: string;
            bankLoanValue?: number;
            bankLoanUnit?: string;
            paymentConditionValue?: number;
            paymentConditionUnit?: string;
        }>;
    };
    creator?: { username: string };
    staffEntryEditAllowance?: number;
    staffQualityEditAllowance?: number;
    entryEditApprovalStatus?: string | null;
    entryEditApprovalReason?: string | null;
    entryEditApprovalRequestedAt?: string | null;
    entryEditApprovalRequestedByName?: string | null;
    qualityEditApprovalStatus?: string | null;
    qualityEditApprovalReason?: string | null;
    qualityEditApprovalRequestedAt?: string | null;
    qualityEditApprovalRequestedByName?: string | null;
    lotAllotment?: {
        id?: string | number;
        allottedBags?: number;
        closedAt?: string | null;
        allottedToSupervisorId?: number;
        supervisor?: {
            id: number;
            username: string;
            fullName?: string;
            role?: string;
        };
        manager?: {
            id: number;
            username: string;
            fullName?: string;
        };
    };
}


const normalizePendingManagerApprovalQueue = (offering: any) => {
  const queue = Array.isArray(offering?.pendingManagerValueApprovalQueue)
    ? offering.pendingManagerValueApprovalQueue
        .filter((item: any) => item && typeof item === 'object' && item.data && typeof item.data === 'object')
        .map((item: any) => ({
          id: item.id || `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          data: item.data || {},
          requestedBy: item.requestedBy ?? null,
          requestedAt: item.requestedAt || null
        }))
    : [];

  if (queue.length > 0) return queue;

  const legacyData = offering?.pendingManagerValueApprovalData;
  if (legacyData && typeof legacyData === 'object' && Object.keys(legacyData).length > 0) {
    return [{
      id: `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data: legacyData,
      requestedBy: offering?.pendingManagerValueApprovalRequestedBy ?? null,
      requestedAt: offering?.pendingManagerValueApprovalRequestedAt || null
    }];
  }

  return [];
};

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const toSentenceCase = (value: string) => {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) return '';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
const resolveMediaUrl = (value?: string | null) => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const baseUrl = API_URL.replace(/\/api\/?$/, '');
    return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
};
const getPartyLabel = (entry: SampleEntry) => {
    const partyNameText = toTitleCase(entry.partyName || '').trim();
    const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
    if (entry.entryType === 'DIRECT_LOADED_VEHICLE') return lorryText || partyNameText || '-';
    return partyNameText || lorryText || '-';
};
const getPartyDisplayParts = (entry: SampleEntry) => {
    const partyNameText = toTitleCase(entry.partyName || '').trim();
    const isDirectVehicle = entry.entryType === 'DIRECT_LOADED_VEHICLE' || partyNameText.toUpperCase() === 'DIRECT LOADED VEHICLE';
    const cleanPartyName = isDirectVehicle ? '' : partyNameText;
    const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
    
    if (isDirectVehicle && lorryText) {
        return {
            label: lorryText,
            lorryText,
            showLorrySecondLine: false
        };
    }
    
    return {
        label: cleanPartyName || lorryText || '-',
        lorryText,
        showLorrySecondLine: !!cleanPartyName && !!lorryText && cleanPartyName.toUpperCase() !== lorryText
    };
};
const toNumberText = (value: any, digits = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    if (num % 1 === 0) return String(num);
    return num.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
};
const formatFlexibleValue = (value: any, digits = 2) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value).trim() || '-';
    if (num % 1 === 0) return String(num);
    return num.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
};
const formatIndianCurrency = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num)
        ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
};
const formatIndianCurrencyFlexible = (value: any, digits = 2) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value).trim() || '-';
    const formatted = num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
    return formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted;
};
const formatRateUnitLabel = (value?: string) => value === 'per_quintal'
    ? 'Per Qtl'
    : value === 'per_ton'
        ? 'Per Ton'
        : value === 'per_kg'
            ? 'Per Kg'
            : 'Per Bag';
const formatToggleUnitLabel = (value?: string) => value === 'per_quintal'
    ? 'Per Qtl'
    : value === 'percentage'
        ? '%'
        : value === 'lumps'
            ? 'Lumps'
            : value === 'per_kg'
                ? 'Per Kg'
                : 'Per Bag';
const formatShortDateTime = (value?: string | null) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return '';
    }
};
const getTimeValue = (value?: string | null) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
};
const formatMeasurementText = (value: any, suffix = '', digits = 2) => {
    const formatted = formatFlexibleValue(value, digits);
    return formatted === '-' ? '-' : `${formatted}${suffix}`;
};
const formatUnitValueText = (value: any, unit?: string, digits = 2, prefix = '') => {
    const formatted = formatFlexibleValue(value, digits);
    return formatted === '-' ? '-' : `${prefix}${formatted}${unit ? ` / ${unit}` : ''}`;
};
const formatPaymentText = (value: any, unit?: string) => {
    const formatted = formatFlexibleValue(value, 2);
    if (formatted === '-') return '-';
    const normalizedUnit = String(unit || 'Days').trim().toLowerCase();
    const unitLabel = normalizedUnit === 'month' ? 'Month' : normalizedUnit === 'months' ? 'Months' : normalizedUnit === 'day' ? 'Day' : 'Days';
    return `${formatted} ${unitLabel}`;
};
const formatDateInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const hasAlphaOrPositiveValue = (val: any) => {
  if (val === null || val === undefined || val === '') return false;
  const raw = String(val).trim();
  if (!raw) return false;
  if (/[a-zA-Z]/.test(raw)) return true;
  const num = parseFloat(raw);
  return Number.isFinite(num);
};
const isProvidedNumeric = (rawVal: any, valueVal: any) => {
  const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
  if (raw !== '') return true;
  const num = Number(valueVal);
  return Number.isFinite(num) && num > 0;
};
const isProvidedAlpha = (rawVal: any, valueVal: any) => {
  const raw = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
  if (raw !== '') return true;
  return hasAlphaOrPositiveValue(valueVal);
};

const hasQualitySnapshot = (attempt: any) => {
  const hasMoisture = isProvidedNumeric(attempt?.moistureRaw, attempt?.moisture);
  const hasGrains = isProvidedNumeric(attempt?.grainsCountRaw, attempt?.grainsCount);
  const hasSmell = attempt?.smellHas || (attempt?.smellType && String(attempt?.smellType).trim() !== '');
  const hasDetailedQuality =
    isProvidedNumeric(attempt?.cutting1Raw, attempt?.cutting1) ||
    isProvidedNumeric(attempt?.bend1Raw, attempt?.bend1) ||
    isProvidedAlpha(attempt?.mixRaw, attempt?.mix) ||
    isProvidedAlpha(attempt?.mixSRaw, attempt?.mixS) ||
    isProvidedAlpha(attempt?.mixLRaw, attempt?.mixL) ||
    isProvidedAlpha(attempt?.kanduRaw, attempt?.kandu) ||
    isProvidedAlpha(attempt?.oilRaw, attempt?.oil) ||
    isProvidedAlpha(attempt?.skRaw, attempt?.sk);

  return (hasMoisture && (hasGrains || hasDetailedQuality)) || hasDetailedQuality || hasSmell;
};
const hasPaddy100gSnapshot = (attempt: any) => (
    isProvidedNumeric(attempt?.moistureRaw, attempt?.moisture)
    && isProvidedNumeric(attempt?.wbRRaw, attempt?.wbR)
    && isProvidedNumeric(attempt?.wbBkRaw, attempt?.wbBk)
    && isProvidedNumeric(attempt?.grainsCountRaw, attempt?.grainsCount)
    && !isProvidedNumeric(attempt?.cutting1Raw, attempt?.cutting1)
    && !isProvidedNumeric(attempt?.bend1Raw, attempt?.bend1)
    && !isProvidedAlpha(attempt?.mixRaw, attempt?.mix)
    && !isProvidedAlpha(attempt?.mixSRaw, attempt?.mixS)
    && !isProvidedAlpha(attempt?.mixLRaw, attempt?.mixL)
    && !isProvidedAlpha(attempt?.kanduRaw, attempt?.kandu)
    && !isProvidedAlpha(attempt?.oilRaw, attempt?.oil)
    && !isProvidedAlpha(attempt?.skRaw, attempt?.sk)
);

const getResampleRoundLabel = (attempts: number) => {
    if (attempts <= 1) return '';
    return `Re-sample Round ${attempts}`;
};
const getSamplingLabel = (attemptNo: number) => {
    if (attemptNo <= 1) return '1st';
    if (attemptNo === 2) return '2nd';
    if (attemptNo === 3) return '3rd';
    return `${attemptNo}th`;
};
const getQualityAttemptsForEntry = (entry: any) => {
    const getAttemptFingerprint = (attempt: any) => ([
        attempt?.reportedBy ?? '',
        attempt?.moistureRaw ?? attempt?.moisture ?? '',
        attempt?.grainsCountRaw ?? attempt?.grainsCount ?? '',
        attempt?.cutting1Raw ?? attempt?.cutting1 ?? '',
        attempt?.cutting2Raw ?? attempt?.cutting2 ?? '',
        attempt?.bend1Raw ?? attempt?.bend1 ?? '',
        attempt?.bend2Raw ?? attempt?.bend2 ?? '',
        attempt?.mixRaw ?? attempt?.mix ?? '',
        attempt?.mixSRaw ?? attempt?.mixS ?? '',
        attempt?.mixLRaw ?? attempt?.mixL ?? '',
        attempt?.kanduRaw ?? attempt?.kandu ?? '',
        attempt?.oilRaw ?? attempt?.oil ?? '',
        attempt?.skRaw ?? attempt?.sk ?? '',
        attempt?.wbRRaw ?? attempt?.wbR ?? '',
        attempt?.wbBkRaw ?? attempt?.wbBk ?? '',
        attempt?.wbTRaw ?? attempt?.wbT ?? '',
        attempt?.paddyWbRaw ?? attempt?.paddyWb ?? '',
        attempt?.smellHas ?? '',
        attempt?.smellType ?? ''
    ].map((value) => String(value ?? '').trim()).join('|'));

    const baseAttempts = Array.isArray(entry?.qualityAttemptDetails)
        ? [...entry.qualityAttemptDetails].filter(Boolean).sort((a: any, b: any) => (a.attemptNo || 0) - (b.attemptNo || 0))
        : [];
    const normalizedBaseAttempts = baseAttempts.reduce((acc: any[], attempt: any) => {
        const previous = acc[acc.length - 1];
        if (!previous) {
            acc.push(attempt);
            return acc;
        }

        const sameAttemptNo = Number(previous?.attemptNo || 0) === Number(attempt?.attemptNo || 0);
        const sameFingerprint = getAttemptFingerprint(previous) === getAttemptFingerprint(attempt);

        if (sameAttemptNo && sameFingerprint) {
            acc[acc.length - 1] = { ...previous, ...attempt };
            return acc;
        }

        acc.push(attempt);
        return acc;
    }, []);
    const currentQuality = entry?.qualityParameters;

    if (normalizedBaseAttempts.length > 0) {
        return normalizedBaseAttempts.map((attempt: any, index: number) => ({
            ...attempt,
            attemptNo: Number(attempt?.attemptNo) || index + 1
        }));
    }

    if (!currentQuality || !hasQualitySnapshot(currentQuality)) return [];
    return [{ ...currentQuality, attemptNo: 1 }];
};

const getQualityAttemptSmellLabel = (entry: any, attempt?: any, isLatestAttempt = false) => {
    const sources: any[] = [];
    const attemptDetails = Array.isArray(entry?.qualityAttemptDetails) ? entry.qualityAttemptDetails.filter(Boolean) : [];
    const attemptNo = Number(attempt?.attemptNo || 0);

    if (attempt) sources.push(attempt);
    if (attemptNo > 0) {
        const matchingAttempts = attemptDetails.filter((item: any) => Number(item?.attemptNo || 0) === attemptNo);
        sources.push(...matchingAttempts.reverse());
    }
    if (isLatestAttempt && entry?.qualityParameters) {
        sources.push(entry.qualityParameters);
    }

    for (const source of sources) {
        const smellHas = source?.smellHas;
        const smellType = source?.smellType;
        if (smellHas || (smellType && String(smellType).trim())) {
            return toTitleCase(smellType || 'Yes');
        }
    }

    return '-';
};
const getSmellLabelRobust = (entry: any, attempt?: any) => {
    // Check ALL possible sources of smell data in order of priority
    
    // 1. Check qualityAttempts array (for resample entries)
    if (Array.isArray(entry?.qualityAttemptDetails)) {
        for (let i = entry.qualityAttemptDetails.length - 1; i >= 0; i--) {
            const att = entry.qualityAttemptDetails[i];
            if (att?.smellHas || (att?.smellType && String(att.smellType).trim())) {
                return toTitleCase(att.smellType || 'Yes');
            }
        }
    }
    
    // 2. Check qualityParameters (most recent quality entry)
    if (entry?.qualityParameters) {
        const qpSmellHas = entry.qualityParameters.smellHas;
        const qpSmellType = entry.qualityParameters.smellType;
        if (qpSmellHas || (qpSmellType && String(qpSmellType).trim())) {
            return toTitleCase(qpSmellType || 'Yes');
        }
    }
    
    // 3. Check entry top-level (original smell from sample entry)
    const entrySmellHas = entry?.smellHas;
    const entrySmellType = entry?.smellType;
    if (entrySmellHas || (entrySmellType && String(entrySmellType).trim())) {
        return toTitleCase(entrySmellType || 'Yes');
    }
    
    // 4. Check current attempt if provided
    if (attempt) {
        const aSmellHas = attempt?.smellHas;
        const aSmellType = attempt?.smellType;
        if (aSmellHas || (aSmellType && String(aSmellType).trim())) {
            return toTitleCase(aSmellType || 'Yes');
        }
    }
    
    return '-';
};

const getPopupSmellSummary = (entry: any) => {
    // Check all possible sources of smell data
    const smellLabel = getSmellLabelRobust(entry);
    if (smellLabel !== '-') {
        const upperLabel = String(smellLabel || '').trim().toUpperCase();
        const tone = upperLabel === 'LIGHT' ? '#ff6b6b' : (upperLabel === 'MEDIUM' ? '#dc2626' : '#7f1d1d');
        return {
            label: 'Smell',
            value: smellLabel,
            tone: tone
        };
    }

    const failRemarks = String(entry?.failRemarks || '').trim();
    if (failRemarks && failRemarks.toLowerCase().includes('smell')) {
        const failedLabel = toTitleCase(failRemarks.replace(/^failed:\s*/i, '').trim() || 'Smell');
        return {
            label: 'Failed Smell',
            value: failedLabel,
            tone: '#7f1d1d'
        };
    }

    return null;
};

const renderBeautifulSmell = (stageObjOrLabel: any) => {
    let hasSmell = false;
    let type = '';
    let rawLabel = '';

    if (typeof stageObjOrLabel === 'string') {
        rawLabel = stageObjOrLabel;
        const upper = rawLabel.trim().toUpperCase();
        if (upper && upper !== '-') {
            hasSmell = true;
            type = upper;
        }
    } else if (stageObjOrLabel && typeof stageObjOrLabel === 'object') {
        hasSmell = stageObjOrLabel.smellHas === true || String(stageObjOrLabel.smellHas).trim().toUpperCase() === 'YES';
        type = String(stageObjOrLabel.smellType || '').trim().toUpperCase();
        rawLabel = stageObjOrLabel.smellType || 'Yes';
    }

    if (!hasSmell) return '-';

    let label = rawLabel;
    let color = '#7f1d1d'; // dark red text for dark/heavy/other
    let bgColor = '#fee2e2'; // light red background for light

    if (type === 'LIGHT' || type.includes('LIGHT')) {
        label = 'LIGHT';
        bgColor = '#ffe4e6'; // Very light red
        color = '#e11d48'; // Bright light red
    } else if (type === 'MEDIUM' || type.includes('MEDIUM')) {
        label = 'MEDIUM';
        bgColor = '#f43f5e'; // Medium dark red
        color = '#ffffff'; // White text
    } else if (type === 'DARK' || type === 'HEAVY' || type.includes('DARK') || type.includes('HEAVY')) {
        label = 'DARK';
        bgColor = '#881337'; // Darkest red
        color = '#ffffff'; // White text
    } else {
        label = rawLabel.toUpperCase() === 'YES' ? 'SMELL' : rawLabel.toUpperCase();
        bgColor = '#f43f5e';
        color = '#ffffff';
    }

    return (
        <span style={{
            fontWeight: '800',
            color: color,
            backgroundColor: bgColor,
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '10px',
            display: 'inline-block',
            border: `1px solid ${color}33`
        }}>
            {label}
        </span>
    );
};




const getNitAvgLabel = (nitValue: string) => {
    if (!nitValue) return 'Nit Avg';
    const clean = nitValue.trim().replace(/^(nit_avg|nit\s*)/i, '').trim();
    return `Nit Avg (${clean})`;
};
const getApprovedFullAvgBags = (stages: any, defaultBags: any) => {
    if (!stages) return defaultBags;
    const approvedKey = Object.keys(stages).find(key => {
        const baseKey = key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
        return baseKey === 'full_avg' && stages[key]?.approvalStatus === 'approved';
    });
    if (approvedKey && stages[approvedKey]?.actualBags !== undefined && stages[approvedKey]?.actualBags !== null) {
        return stages[approvedKey].actualBags;
    }
    const latestFullAvg = Object.keys(stages)
        .filter(key => key === 'full_avg' || key.startsWith('full_avg_'))
        .sort((a, b) => {
            const timeA = new Date(stages[a].reportedAt || stages[a].holdAt || stages[a].createdAt || 0).getTime();
            const timeB = new Date(stages[b].reportedAt || stages[b].holdAt || stages[b].createdAt || 0).getTime();
            return timeB - timeA;
        });
    if (latestFullAvg.length > 0) {
        const key = latestFullAvg[0];
        if (stages[key]?.actualBags !== undefined && stages[key]?.actualBags !== null) {
            return stages[key].actualBags;
        }
    }
    return defaultBags || '-';
};

export const SampleEntryDetailModal = ({ detailEntry, detailMode, onClose, onUpdate, showCollectorLoginPair = false, progressiveMode = false, completedLotsOrder = false, onEditStage, onTriggerDispute, autoTriggerDisputeKey, targetRateLinkAction, targetLorryTripId }: { detailEntry: SampleEntry, detailMode: 'quick' | 'history' | 'summary' | 'full', onClose: () => void, onUpdate?: (gpsCoordinates?: string) => void | Promise<void>, showCollectorLoginPair?: boolean, progressiveMode?: boolean, completedLotsOrder?: boolean, onEditStage?: (lorryNumber: string, stageKey: string) => void, onTriggerDispute?: (entry: SampleEntry) => void, autoTriggerDisputeKey?: { inspectionId: string; stageKey: string }, targetRateLinkAction?: (rateInfo: { rate: number; rateType: string; sute: number; suteUnit: string; moisture: number; hamali: number; hamaliUnit: string; lf: number; lfUnit: string; disputeReason?: string; isDispute: boolean; isRevision: boolean; linkedRevisionId?: string | null }) => void | Promise<void>, targetLorryTripId?: string }) => {
    const { user } = useAuth();
    const buildMapHref = (value: any) => {
        const raw = typeof value === 'object' && value !== null
            ? `${value.lat},${value.lng}`
            : String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
    };
    const isStaff = user?.role === 'staff';
    const getStageLabel = (key: string) => {
        if (key === 'lot_avg') return 'Lot Avg';
        if (key === 'balanced_lot') return 'Balanced Lot';
        if (key === 'half_lorry') return 'Half Lorry';
        if (key === 'full_avg') return 'Full Lorry';
        if (key.startsWith('nit_avg')) {
            if (key === 'nit_avg') return 'Nit Avg';
            const num = key.replace('nit_avg_', '');
            return `Nit Avg ${num}`;
        }
        return key;
    };
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [cookingInput, setCookingInput] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isCapturingGps, setIsCapturingGps] = useState(false);
    const [isSavingGps, setIsSavingGps] = useState(false);
    const [localGps, setLocalGps] = useState<string | null>((detailEntry as any)?.gpsCoordinates || null);
    const [remarksPopup, setRemarksPopup] = useState({ isOpen: false, text: '' });
    const [pricingDetail, setPricingDetail] = useState<{ entry: SampleEntry, mode: 'offer' | 'final' } | null>(null);
    const [inspectionsProgress, setInspectionsProgress] = useState<any>(null);
    const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
    const [disputeModalData, setDisputeModalData] = useState<{
        isOpen: boolean;
        inspectionId: string;
        stageKey: string;
        disputeRate: string;
        disputeRateType: string;
        sute: string;
        suteUnit: string;
        moistureValue: string;
        revisedRateOption: string;
        linkedRevisionId: string;
        disputeReason: string;
    }>({
        isOpen: false,
        inspectionId: '',
        stageKey: '',
        disputeRate: '',
        disputeRateType: 'PD_LOOSE',
        sute: '',
        suteUnit: 'per_bag',
        moistureValue: '',
        revisedRateOption: 'final',
        linkedRevisionId: '',
        disputeReason: ''
    });

    const triggerDisputeFlow = async (inspectionId: string, stageKey: string) => {
        if (onTriggerDispute) {
            try {
                setProcessingAction(true);
                const token = localStorage.getItem('token');
                // Dispute means approved only -> approve stage first
                await axios.post(
                    `${API_URL}/sample-entries/${detailEntry.id}/physical-inspection/${inspectionId}/approve-stage`,
                    { stage: stageKey },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Stage approved for dispute successfully!');
                onTriggerDispute(detailEntry);
                onClose();
            } catch (error: any) {
                console.error('Error approving stage for dispute:', error);
                toast.error(error.response?.data?.error || 'Failed to approve stage for dispute');
            } finally {
                setProcessingAction(false);
            }
        } else {
            const offering = detailEntry?.offering;
            setDisputeModalData({
                isOpen: true,
                inspectionId,
                stageKey,
                disputeRate: String(offering?.disputeBaseRate ?? offering?.finalBaseRate ?? offering?.offerBaseRateValue ?? ''),
                disputeRateType: offering?.disputeBaseRateType || offering?.baseRateType || 'PD_LOOSE',
                sute: String(offering?.finalSute ?? offering?.sute ?? ''),
                suteUnit: offering?.finalSuteUnit || offering?.suteUnit || 'per_bag',
                moistureValue: String(offering?.moistureValue ?? ''),
                revisedRateOption: offering?.revisedRateOption || 'final',
                linkedRevisionId: '',
                disputeReason: ''
            });
        }
    };

    const submitDisputeFlow = async () => {
        if (!disputeModalData.disputeRate || isNaN(Number(disputeModalData.disputeRate))) {
            toast.error('Please enter a valid Dispute Rate');
            return;
        }
        if (disputeModalData.revisedRateOption === 'dispute' && !disputeModalData.linkedRevisionId) {
            toast.error('Please select a revised rate to link');
            return;
        }
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            const payload = {
                isFinalized: true,
                disputeBaseRate: Number(disputeModalData.disputeRate),
                disputeBaseRateType: disputeModalData.disputeRateType,
                finalSute: disputeModalData.sute ? Number(disputeModalData.sute) : null,
                finalSuteUnit: disputeModalData.suteUnit,
                moistureValue: disputeModalData.moistureValue ? Number(disputeModalData.moistureValue) : null,
                revisedRateOption: disputeModalData.revisedRateOption,
                linkedRevisionId: disputeModalData.revisedRateOption === 'dispute' ? disputeModalData.linkedRevisionId : null,
                disputeReason: disputeModalData.disputeReason,
                __requestType: 'dispute',
                inspectionId: disputeModalData.inspectionId,
                stageKey: disputeModalData.stageKey
            };
            await axios.post(
                `${API_URL}/sample-entries/${detailEntry.id}/final-price`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await axios.post(
                `${API_URL}/sample-entries/${detailEntry.id}/physical-inspection/${disputeModalData.inspectionId}/approve-stage`,
                { stage: disputeModalData.stageKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Dispute submitted & stage approved successfully!');
            setDisputeModalData(prev => ({ ...prev, isOpen: false }));
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error submitting dispute workflow:', error);
            toast.error(error.response?.data?.error || 'Failed to submit dispute');
        } finally {
            setProcessingAction(false);
        }
    };

    const [processingAction, setProcessingAction] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'approve' | 'reject' | 'confirm';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm',
        onConfirm: () => {}
    });

    const refreshProgressData = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/sample-entries/${detailEntry.id}/inspection-progress`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInspectionsProgress(response.data);
            if (onUpdate) {
                await onUpdate();
            }
        } catch (err) {
            console.error('Error refreshing progress data:', err);
        }
    };

    const handleApproveProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, stageLabel: string) => {
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/approve-stage`,
                { stage: stageKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`${stageLabel} Stage Approved successfully!`);
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error approving progressive stage:', error);
            toast.error(error.response?.data?.error || 'Failed to approve stage');
        } finally {
            setProcessingAction(false);
        }
    };

    const handleRejectProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, stageLabel: string) => {
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/reject-stage`,
                { stage: stageKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`Stage "${stageLabel}" rejected successfully.`);
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error rejecting progressive stage:', error);
            toast.error(error.response?.data?.error || 'Failed to reject stage');
        } finally {
            setProcessingAction(false);
        }
    };

    const handleHoldProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, stageLabel: string) => {
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/hold-stage`,
                { stage: stageKey, holdDuration: 'Hold' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`${stageLabel} Stage put on Hold successfully!`);
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error holding progressive stage:', error);
            toast.error(error.response?.data?.error || 'Failed to hold stage');
        } finally {
            setProcessingAction(false);
        }
    };

    const handleRevertSkip = (entryId: string, inspectionId: string, stageKey: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Retrieve Skip',
            message: 'Are you sure you want to retrieve this skip? This will allow adding balanced lot sampling data again.',
            type: 'confirm',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    setProcessingAction(true);
                    const token = localStorage.getItem('token');
                    await axios.post(
                        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/revert-skip-stage`,
                        { stage: stageKey },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    toast.success('Stage skip retrieved successfully.');
                    await refreshProgressData();
                } catch (error: any) {
                    console.error('Error reverting skipped stage:', error);
                    toast.error(error.response?.data?.error || 'Failed to retrieve skip');
                } finally {
                    setProcessingAction(false);
                }
            }
        });
    };


    const executeRejectSpecificLorry = async (entryId: string, inspectionId: string, lorryNumber: string) => {
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            await axios.delete(
                `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`Trip for Lorry ${lorryNumber || ''} rejected and removed successfully.`);
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error rejecting specific lorry trip:', error);
            toast.error(error.response?.data?.error || 'Failed to reject lorry trip');
        } finally {
            setProcessingAction(false);
        }
    };

    const handleRejectSpecificLorry = (entryId: string, inspectionId: string, lorryNumber: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Reject Lorry Trip',
            message: `Are you sure you want to reject and delete the trip for Lorry ${lorryNumber || ''}?`,
            type: 'reject',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                await executeRejectSpecificLorry(entryId, inspectionId, lorryNumber);
            }
        });
    };

    const handleApproveLorryQuality = async (entryId: string) => {
        try {
            setProcessingAction(true);
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_URL}/sample-entries/${entryId}/transition`,
                { toStatus: 'INVENTORY_ENTRY' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Lorry Loaded Quality Approved! Status moved to Inventory Entry.');
            await refreshProgressData();
        } catch (error: any) {
            console.error('Error approving lorry quality:', error);
            toast.error(error.response?.data?.error || 'Failed to approve lorry quality');
        } finally {
            setProcessingAction(false);
        }
    };

    useEffect(() => {
        if (detailEntry && detailEntry.id) {
            const fetchInspectionProgress = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await axios.get(`${API_URL}/sample-entries/${detailEntry.id}/inspection-progress`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setInspectionsProgress(response.data);

                    if (autoTriggerDisputeKey) {
                        // Small timeout to allow state to settle
                        setTimeout(() => {
                            triggerDisputeFlow(autoTriggerDisputeKey.inspectionId, autoTriggerDisputeKey.stageKey);
                        }, 100);
                    }
                } catch (err) {
                    console.error('Error fetching inspection progress in modal:', err);
                }
            };
            fetchInspectionProgress();
        }
    }, [detailEntry, autoTriggerDisputeKey]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const normalizeUsers = (users: any[]) => users
                    .filter((u: any) => u && (u.username || u.fullName))
                    .map((u: any) => ({
                        id: u.id,
                        username: String(u.username || '').trim(),
                        fullName: String(u.fullName || u.username || '').trim()
                    }));

                let mergedUsers: any[] = [];

                try {
                    const adminResponse = await axios.get(`${API_URL}/admin/users`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    const adminData: any = adminResponse.data;
                    const adminUsers = Array.isArray(adminData) ? adminData : (adminData.users || []);
                    mergedUsers = normalizeUsers(adminUsers);
                } catch (_adminError) {
                    const supervisorResponse = await axios.get(`${API_URL}/sample-entries/paddy-supervisors`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    const supervisorData: any = supervisorResponse.data;
                    const supervisorUsers = Array.isArray(supervisorData)
                        ? supervisorData
                        : (supervisorData.users || supervisorData.data || []);
                    mergedUsers = normalizeUsers(supervisorUsers);
                }

                const unique = new Map<string, any>();
                mergedUsers.forEach((user: any) => {
                    const usernameKey = String(user.username || '').trim().toLowerCase();
                    const fullNameKey = String(user.fullName || '').trim().toLowerCase();
                    const idKey = String(user.id || '').trim().toLowerCase();
                    if (usernameKey && !unique.has(usernameKey)) unique.set(usernameKey, user);
                    if (fullNameKey && !unique.has(fullNameKey)) unique.set(fullNameKey, user);
                    if (idKey && !unique.has(idKey)) unique.set(idKey, user);
                });
                setSupervisors(Array.from(new Set(Array.from(unique.values()))));
            } catch (error) {
                console.error('Error fetching users for cooking:', error);
            }
        };
        fetchUsers();
    }, []);

    const setDetailEntry = (val: any) => {
        if (!val) {
            onClose();
        }
    };

    const handleCaptureAndSaveGps = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsCapturingGps(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const coords = `${latitude},${longitude}`;
                
                try {
                    setIsSavingGps(true);
                    // Use multipart/form-data because the backend PUT /:id route uses it
                    const formData = new FormData();
                    formData.append('gpsCoordinates', coords);

                    await axios.put(`${API_URL}/sample-entries/${detailEntry.id}`, formData, {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    setLocalGps(coords);
                    if (onUpdate) await onUpdate(coords);
                } catch (error: any) {
                    console.error('Failed to save GPS:', error);
                    alert(error.response?.data?.error || 'Failed to save GPS coordinates');
                } finally {
                    setIsCapturingGps(false);
                    setIsSavingGps(false);
                }
            },
            (error) => {
                console.error('GPS error:', error);
                setIsCapturingGps(false);
                alert('Failed to capture GPS location. Please ensure location permissions are enabled.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };


    // Need an empty stub for recheckModal or removed buttons?
    // The popup might render recheck modal if called, but it's only rendered conditionally if recheckModal.isOpen
    // We can just stub setRecheckModal if the popup JSX tries to call it.
    const setRecheckModal = () => {
        console.warn("Recheck is disabled in this detached modal views.");
    };

    const getCollectorLabel = (value?: string | null) => {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return '-';
        if (raw.toLowerCase() === 'broker office sample') return 'Broker Office Sample';
        const normalizedRaw = raw.toLowerCase();
        const match = supervisors.find((sup) => {
            const username = String(sup.username || '').trim().toLowerCase();
            const fullName = String(sup.fullName || '').trim().toLowerCase();
            const id = String(sup.id || '').trim().toLowerCase();
            return normalizedRaw === username || normalizedRaw === fullName || normalizedRaw === id;
        });
        if (match?.fullName) return toTitleCase(match.fullName);
        if (match?.username) return toTitleCase(match.username);
        return toTitleCase(raw);
    };

    const getCollectorWithRole = (value?: string | number | null) => {
        const raw = (value !== null && value !== undefined) ? String(value).trim() : '';
        if (!raw) return '-';
        if (raw.toLowerCase() === 'broker office sample') return 'Broker Office Sample';
        const normalizedRaw = raw.toLowerCase();
        const match = supervisors.find((sup) => {
            const username = String(sup.username || '').trim().toLowerCase();
            const fullName = String(sup.fullName || '').trim().toLowerCase();
            const id = String(sup.id || '').trim().toLowerCase();
            return normalizedRaw === username || normalizedRaw === fullName || normalizedRaw === id;
        });
        const name = match?.fullName ? toTitleCase(match.fullName) : match?.username ? toTitleCase(match.username) : toTitleCase(raw);
        if (match?.role) {
            return `${name} (${toTitleCase(match.role.replace(/_/g, ' '))})`;
        }
        return name;
    };
    const getCreatorLabel = (entry: SampleEntry) => {
        const creator = (entry as any)?.creator;
        const raw = creator?.fullName || creator?.username || '';
        return raw ? toTitleCase(raw) : '-';
    };
    const getOriginalCollector = (entry: SampleEntry) => {
        const history = Array.isArray((entry as any)?.sampleCollectedHistory) ? (entry as any).sampleCollectedHistory : [];
        const firstHistoryValue = history.find((value: any) => String(value || '').trim());
        return String(firstHistoryValue || entry.sampleCollectedBy || '').trim();
    };
    const getLatestFirstCycleCollector = (entry: SampleEntry) => {
        const current = String(entry.sampleCollectedBy || '').trim();
        const timeline = Array.isArray((entry as any)?.sampleCollectedTimeline) ? (entry as any).sampleCollectedTimeline : [];
        const history = Array.isArray((entry as any)?.sampleCollectedHistory) ? (entry as any).sampleCollectedHistory : [];
        const getValue = (item: any) => {
            if (typeof item === 'string') return String(item || '').trim();
            if (item && typeof item === 'object') return String(item.sampleCollectedBy || item.name || '').trim();
            return '';
        };
        const lastTimelineValue = timeline.length > 0 ? getValue(timeline[timeline.length - 1]) : '';
        const lastHistoryValue = history.length > 0 ? getValue(history[history.length - 1]) : '';
        const firstHistoryValue = history.length > 0 ? getValue(history[0]) : '';
        return String(current || lastTimelineValue || lastHistoryValue || firstHistoryValue || '').trim();
    };
    const buildOrderedCollectorNames = (values: Array<string | null | undefined>) => values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => (
            arr.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
        ));
    const getCollectedByDisplay = (entry: SampleEntry) => getSharedCollectedByDisplay(entry as any, supervisors, { keepLoginPair: showCollectorLoginPair, currentUser: user });



    const normalizeCookingStatusLabel = (status?: string | null) => {
        const normalized = String(status || '').trim().toUpperCase();
        if (normalized === 'PASS' || normalized === 'OK') return 'Pass';
        if (normalized === 'MEDIUM') return 'Medium';
        if (normalized === 'FAIL') return 'Fail';
        if (normalized === 'RECHECK') return 'Recheck';
        if (normalized === 'RECHECKING') return 'Rechecking';
        if (normalized === 'PENDING') return 'Pending';
        return normalized ? toTitleCase(normalized.toLowerCase()) : 'Pending';
    };

    const getQualityTypeLabel = (attempt: any) => {
        if (!attempt) return 'Pending';
        const hasFullQuality = isProvidedNumeric((attempt as any).cutting1Raw, attempt.cutting1)
            || isProvidedNumeric((attempt as any).bend1Raw, attempt.bend1)
            || isProvidedAlpha((attempt as any).mixRaw, attempt.mix)
            || isProvidedAlpha((attempt as any).mixSRaw, attempt.mixS)
            || isProvidedAlpha((attempt as any).mixLRaw, attempt.mixL);
        const has100g = hasPaddy100gSnapshot(attempt);
        if (hasFullQuality) return 'Done';
        if (has100g) return '100-Gms';
        return 'Pending';
    };

    const getQualityTypeStyle = (label: string) => {
        if (label === 'Done') return { bg: '#c8e6c9', color: '#2e7d32' };
        if (label === '100-Gms') return { bg: '#fff8e1', color: '#f57f17' };
        if (label === 'Recheck') return { bg: '#e3f2fd', color: '#1565c0' };
        if (label === 'Resample') return { bg: '#fff3e0', color: '#ef6c00' };
        return { bg: '#f5f5f5', color: '#666' };
    };

    const getStatusStyle = (label: string) => {
        if (label === 'Pass') return { bg: '#a5d6a7', color: '#1b5e20' };
        if (label === 'Pass Without Cooking') return { bg: '#e3f2fd', color: '#1565c0' };
        if (label === 'Medium') return { bg: '#ffe0b2', color: '#f39c12' };
        if (label === 'Fail') return { bg: '#ffcdd2', color: '#b71c1c' };
        if (label === 'Recheck' || label === 'Rechecking') return { bg: '#e3f2fd', color: '#1565c0' };
        if (label === 'Resample' || label === 'Resampling') return { bg: '#fff3e0', color: '#ef6c00' };
        return { bg: '#ffe0b2', color: '#e65100' };
    };

    const mapQualityDecisionToStatus = (decision: string | null | undefined) => {
        const key = String(decision || '').toUpperCase();
        if (key === 'FAIL') return 'Fail';
        if (key.startsWith('PASS') || key === 'SOLDOUT') return 'Pass';
        return 'Pending';
    };

    const renderHorizontalTable = (title: React.ReactNode, icon: string, headerColor: string, columns: string[], rows: any[], options: { isQuality?: boolean; compact?: boolean } = {}) => {
        if (rows.length === 0) return null;
        const isCompact = options.compact === true;

        return (
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', width: isCompact ? 'fit-content' : '100%', maxWidth: '100%', alignSelf: 'flex-start' }}>
                {/* Section Header - gradient bar */}
                <div style={{
                    background: `linear-gradient(135deg, ${headerColor}, ${headerColor}cc)`,
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '17px' }}>{icon}</span>
                        <span style={{ color: 'white', fontSize: '16px', fontWeight: 700, letterSpacing: '0.4px', fontStyle: 'italic' }}>{title}</span>
                    </div>
                    {options.isQuality && detailEntry.lorryNumber && getPartyDisplayParts(detailEntry).label !== detailEntry.lorryNumber.toUpperCase() && (
                        <span style={{ color: 'white', fontSize: '16px', fontWeight: 900, letterSpacing: '1px' }}>
                            {detailEntry.lorryNumber.toUpperCase()}
                        </span>
                    )}
                </div>
                {/* Table */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: isCompact ? 'fit-content' : '100%', maxWidth: '100%' }}>
                    <table style={{ width: isCompact ? 'auto' : '100%', minWidth: isCompact ? '760px' : undefined, borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #000000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #000000' }}>
                                {columns.map((col, i) => {
                                    const name = col.toUpperCase().trim();
                                    const thStyle: React.CSSProperties = {
                                        padding: '6px 4px',
                                        textAlign: 'left',
                                        color: '#495057',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        fontSize: '10.5px',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '0.2px',
                                        border: '1px solid #000000'
                                    };
                                    
                                    if (name === 'MIX' || name === 'S MIX' || name === 'L MIX' || name === 'WB-R' || name === 'WB-BK' || name === 'WB-T' || name === 'OIL' || name === 'KANDU' || name === 'SK') {
                                        thStyle.width = '45px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'GRAINS') {
                                        thStyle.width = '55px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'CUTTING' || name === 'BEND') {
                                        thStyle.width = '55px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'SMELL' || name === 'PADDY WB') {
                                        thStyle.width = '50px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'P COLOR' || name === '') {
                                        thStyle.width = '100px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'MOISTURE') {
                                        thStyle.width = '70px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'STAGE' || name === 'SAMPLE') {
                                        thStyle.width = '90px';
                                    } else if (name === 'REPORTED BY') {
                                        thStyle.width = '100px';
                                    } else if (name === 'REPORTED AT') {
                                        thStyle.width = '85px';
                                    } else if (name === 'ACTIONS') {
                                        thStyle.width = '170px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'HAMALI' || name === 'BROKERAGE' || name === 'LF') {
                                        thStyle.width = '110px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'SUTE') {
                                        thStyle.width = '95px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'BANK LOAN') {
                                        thStyle.width = '100px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'TYPE') {
                                        thStyle.width = '110px';
                                    } else if (name === 'RATE') {
                                        thStyle.width = '85px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'RATE TYPE') {
                                        thStyle.width = '120px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'EGB') {
                                        thStyle.width = '75px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'CD') {
                                        thStyle.width = '55px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'PAYMENT') {
                                        thStyle.width = '85px';
                                        thStyle.textAlign = 'center';
                                    } else if (name === 'REMARKS') {
                                        thStyle.width = '120px';
                                    }
                                    
                                    return (
                                        <th key={i} style={thStyle}>
                                            {col}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => {
                                if (row && row.type === 'header') {
                                    return (
                                        <tr key={i} style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                                            <td colSpan={columns.length} style={{ padding: '8px 10px', fontWeight: '800', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', border: '1px solid #000000' }}>
                                                {row.content}
                                            </td>
                                        </tr>
                                    );
                                }
                                if (row && row.type === 'spacer') {
                                    return (
                                        <tr key={i} style={{ height: '8px', backgroundColor: 'transparent' }}>
                                            <td colSpan={columns.length} style={{ padding: 0, height: '8px', border: 'none' }}></td>
                                        </tr>
                                    );
                                }
                                return (
                                    <tr key={i} style={{
                                        backgroundColor: row.isHighlighted
                                            ? '#fef9c3'
                                            : (row.hasSmell 
                                                ? '#ffebee' 
                                                : (i % 2 === 0 ? '#ffffff' : '#f8fafb')),
                                        borderBottom: row.isHighlighted ? '2px solid #eab308' : (row.hasSmell ? '2px solid #ef5350' : '1px solid #000000'),
                                        transition: 'background-color 0.2s'
                                    }}>
                                        {row.map((cell: any, j: number) => {
                                            const colName = columns[j] || '';
                                            const cellStyle: React.CSSProperties = {
                                                padding: '6px 4px',
                                                color: '#1e293b',
                                                fontWeight: j === 0 ? 700 : 500,
                                                whiteSpace: j === 0 || j === 1 || j === 2 || colName === 'ACTIONS' ? 'normal' : 'nowrap',
                                                fontSize: '11px',
                                                border: '1px solid #000000',
                                            };
                                            
                                            const upperCol = colName.toUpperCase().trim();
                                            if (upperCol === 'MIX' || upperCol === 'S MIX' || upperCol === 'L MIX' || upperCol === 'WB-R' || upperCol === 'WB-BK' || upperCol === 'WB-T' || upperCol === 'OIL' || upperCol === 'KANDU' || upperCol === 'SK') {
                                                cellStyle.width = '45px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'GRAINS') {
                                                cellStyle.width = '55px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'CUTTING' || upperCol === 'BEND') {
                                                cellStyle.width = '55px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'SMELL' || upperCol === 'PADDY WB') {
                                                cellStyle.width = '50px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'P COLOR' || upperCol === '') {
                                                cellStyle.width = '100px';
                                                cellStyle.maxWidth = '100px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'MOISTURE') {
                                                cellStyle.width = '70px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'STAGE' || upperCol === 'SAMPLE') {
                                                cellStyle.width = '90px';
                                                cellStyle.maxWidth = '90px';
                                                cellStyle.wordBreak = 'break-word';
                                            } else if (upperCol === 'REPORTED BY') {
                                                cellStyle.width = '100px';
                                                cellStyle.maxWidth = '100px';
                                                cellStyle.wordBreak = 'break-word';
                                            } else if (upperCol === 'REPORTED AT') {
                                                cellStyle.width = '85px';
                                                cellStyle.maxWidth = '85px';
                                            } else if (upperCol === 'ACTIONS') {
                                                cellStyle.width = '170px';
                                                cellStyle.maxWidth = '170px';
                                                cellStyle.textAlign = 'center';
                                                cellStyle.wordBreak = 'break-word';
                                            } else if (upperCol === 'HAMALI' || upperCol === 'BROKERAGE' || upperCol === 'LF') {
                                                cellStyle.width = '110px';
                                                cellStyle.maxWidth = '110px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'SUTE') {
                                                cellStyle.width = '95px';
                                                cellStyle.maxWidth = '95px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'BANK LOAN') {
                                                cellStyle.width = '100px';
                                                cellStyle.maxWidth = '100px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'TYPE') {
                                                cellStyle.width = '110px';
                                                cellStyle.maxWidth = '110px';
                                            } else if (upperCol === 'RATE') {
                                                cellStyle.width = '85px';
                                                cellStyle.maxWidth = '85px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'RATE TYPE') {
                                                cellStyle.width = '120px';
                                                cellStyle.maxWidth = '120px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'EGB') {
                                                cellStyle.width = '75px';
                                                cellStyle.maxWidth = '75px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'CD') {
                                                cellStyle.width = '55px';
                                                cellStyle.maxWidth = '55px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'PAYMENT') {
                                                cellStyle.width = '85px';
                                                cellStyle.maxWidth = '85px';
                                                cellStyle.textAlign = 'center';
                                            } else if (upperCol === 'REMARKS') {
                                                cellStyle.width = '120px';
                                                cellStyle.maxWidth = '120px';
                                            }
                                            
                                            return (
                                                <td key={j} style={cellStyle}>
                                                    {cell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                             })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const buildQualityRows = () => {
        const attempts = getQualityAttemptsForEntry(detailEntry);
        const rows = attempts.map((attempt: any, idx: number) => {
            const label = getSamplingLabel(attempt.attemptNo || idx + 1);
            const reportedAt = attempt.reportedAt || attempt.updatedAt || attempt.createdAt;
            
            const formatQ = (raw: any, val: any) => {
                if (raw !== undefined && raw !== null && raw !== '') return raw;
                const s = String(val === undefined || val === null ? '' : val).trim();
                if (!s || s === '0' || s === '0.00') return '-';
                return s;
            };

            const mRaw = attempt.moistureRaw;
            const mVal = String(attempt.moisture === undefined || attempt.moisture === null ? '' : attempt.moisture);
            const moisture = mRaw ? `${mRaw}%` : (mVal && mVal !== '0' && mVal !== '0.00' ? `${mVal}%` : '-');

            const c1Raw = attempt.cutting1Raw;
            const c1Val = String(attempt.cutting1 === undefined || attempt.cutting1 === null ? '' : attempt.cutting1);
            const c2Raw = attempt.cutting2Raw;
            const c2Val = String(attempt.cutting2 === undefined || attempt.cutting2 === null ? '' : attempt.cutting2);
            let cutting = '-';
            if (c1Raw) cutting = `${c1Raw}x${c2Raw || 0}`;
            else if (c1Val && c1Val !== '0' && c1Val !== '0.00') cutting = `${c1Val}x${c2Val || 0}`;

            const b1Raw = attempt.bend1Raw;
            const b1Val = String(attempt.bend1 === undefined || attempt.bend1 === null ? '' : attempt.bend1);
            const b2Raw = attempt.bend2Raw;
            const b2Val = String(attempt.bend2 === undefined || attempt.bend2 === null ? '' : attempt.bend2);
            let bend = '-';
            if (b1Raw) bend = `${b1Raw}x${b2Raw || 0}`;
            else if (b1Val && b1Val !== '0' && b1Val !== '0.00') bend = `${b1Val}x${b2Val || 0}`;

            const gRaw = attempt.grainsCountRaw;
            const gVal = String(attempt.grainsCount === undefined || attempt.grainsCount === null ? '' : attempt.grainsCount);
            const grains = gRaw ? `(${gRaw})` : (gVal && gVal !== '0' && gVal !== '0.00' ? `(${gVal})` : '-');

            const renderStackedDateTime = (dtStr: any) => {
                if (!dtStr) return '-';
                try {
                    const d = new Date(dtStr);
                    const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10.5px', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: '600' }}>{dStr}</span>
                            <span style={{ color: '#64748b', fontSize: '9.5px' }}>{tStr}</span>
                        </div>
                    );
                } catch {
                    return '-';
                }
            };

            const rowData = [
                <span style={{ color: '#c2410c' }}>{label} Sample</span>,
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>{getCollectorLabel(attempt.reportedBy)}</span>,
                renderStackedDateTime(reportedAt),
                <span style={{ fontSize: '9.5px', fontWeight: '700' }}>{moisture}</span>,
                cutting,
                bend,
                <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569' }}>{grains}</span>,
                formatQ(attempt.mixRaw, attempt.mix),
                formatQ(attempt.mixSRaw, attempt.mixS),
                formatQ(attempt.mixLRaw, attempt.mixL),
                formatQ(attempt.kanduRaw, attempt.kandu),
                formatQ(attempt.oilRaw, attempt.oil),
                formatQ(attempt.skRaw, attempt.sk),
                formatQ(attempt.wbRRaw, attempt.wbR),
                formatQ(attempt.wbBkRaw, attempt.wbBk),
                formatQ(attempt.wbTRaw, attempt.wbT),
                renderBeautifulSmell(getQualityAttemptSmellLabel(detailEntry, attempt)),
                formatQ(attempt.paddyWbRaw, attempt.paddyWb),
                '-'
            ];

            if (progressiveMode) {
                rowData.push('-');
            }

            const smellLabel = getQualityAttemptSmellLabel(detailEntry, attempt);
            rowData.hasSmell = attempt?.smellHas === true 
                || String(attempt?.smellHas).trim().toUpperCase() === 'YES'
                || (smellLabel && smellLabel !== '-' && smellLabel !== 'No');

            return rowData;
        });

        if (progressiveMode && inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections)) {
            const canApprove = ['admin', 'owner', 'manager'].includes(String(user?.role || '').toLowerCase());

            inspectionsProgress.previousInspections.forEach((insp: any, tripIdx: number) => {
                const stages = insp.samplingStages || {};
                
                const formatQ = (raw: any, val: any) => {
                    if (raw !== undefined && raw !== null && raw !== '') return raw;
                    const s = String(val === undefined || val === null ? '' : val).trim();
                    if (!s || s === '0' || s === '0.00') return '-';
                    return s;
                };

                const formatStageMoisture = (stageObj: any) => {
                    const raw = stageObj.moistureRaw;
                    const val = stageObj.moisture;
                    if (raw) return `${raw}%`;
                    if (val !== undefined && val !== null && String(val) !== '0') return `${val}%`;
                    return '-';
                };

                const formatStageCutting = (stageObj: any) => {
                    if (stageObj.cutting1 === undefined || stageObj.cutting1 === null) return '-';
                    const c1 = parseFloat(stageObj.cutting1);
                    const c2 = parseFloat(stageObj.cutting2) || 0;
                    return `${isNaN(c1) || c1 === 0 ? 1 : c1}x${c2}`;
                };

                const formatStageBend = (stageObj: any) => {
                    if (stageObj.bend1 === undefined || stageObj.bend1 === null) return '-';
                    const b1 = parseFloat(stageObj.bend1);
                    const b2 = parseFloat(stageObj.bend2) || 0;
                    return `${isNaN(b1) || b1 === 0 ? 1 : b1}x${b2}`;
                };

                const formatStageGrains = (stageObj: any) => {
                    const raw = stageObj.grainsCountRaw;
                    const val = stageObj.grainsCount;
                    if (raw) return `(${raw})`;
                    if (val !== undefined && val !== null && String(val) !== '0') return `(${val})`;
                    return '-';
                };

                // Add spacer before subsequent trips
                if (tripIdx > 0) {
                    rows.push({ type: 'spacer' });
                }

                const isLorryNotAdded = !insp.lorryNumber || 
                    ['LOT_AVG', 'BALANCED_LOT'].includes(insp.lorryNumber.toUpperCase().trim()) ||
                    insp.lorryNumber.toLowerCase().includes('next loading lorry');

                const bagsLoaded = getApprovedFullAvgBags(stages, insp.bags);

                rows.push({
                    type: 'header',
                    content: isLorryNotAdded
                        ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                        : tripIdx === 0
                            ? `Load 1 - Loading Sample Details : ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`
                            : `Load ${tripIdx + 1} - Lorry Number: ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`
                });

                const getPendingStageOfTrip = (currentInsp: any) => {
                    const stg = currentInsp.samplingStages || {};
                    if (stg.lot_avg?.approvalStatus === 'pending') return { key: 'lot_avg', label: 'Lot Avg' };
                    if (stg.balanced_lot?.approvalStatus === 'pending') return { key: 'balanced_lot', label: 'Balanced Lot' };
                    if (stg.half_lorry?.approvalStatus === 'pending') return { key: 'half_lorry', label: 'Half Lorry' };
                    
                    // Scan all nit_avg keys
                    const nitKeys = Object.keys(stg)
                        .filter(k => k.startsWith('nit_avg'))
                        .sort((a, b) => {
                            if (a === 'nit_avg') return -1;
                            if (b === 'nit_avg') return 1;
                            const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                            const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                            return numA - numB;
                        });
                    for (const key of nitKeys) {
                        if (stg[key]?.approvalStatus === 'pending') {
                            const idx = nitKeys.indexOf(key);
                            const label = idx === 0 ? 'Nit Avg' : `Nit Avg ${idx + 1}`;
                            return { key, label };
                        }
                    }

                    if (stg.full_avg?.approvalStatus === 'pending') return { key: 'full_avg', label: 'Full Lorry' };
                    return null;
                };

                const pendingStage = getPendingStageOfTrip(insp);

                const makeRow = (labelElement: any, stageObj: any, stageKey: string) => {
                    if (!stageObj || !stageObj.reportedBy) return null;
                    const reportedAt = stageObj.reportedAt;
                    
                    let actionsCell: any = '-';
                    const isStageAlreadyPassed = Object.keys(stages).filter(key => key !== 'holdHistory').some(key => {
                        const isBaseMatch = (key === stageKey || key.startsWith(`${stageKey}_hold_`) || 
                            (stageKey.includes('_hold_') && (key === stageKey.split('_hold_')[0] || key.startsWith(`${stageKey.split('_hold_')[0]}_hold_`))));
                        if (isBaseMatch) {
                            const stgObj = stages[key];
                            return stgObj && (stgObj.approvalStatus === 'approved' || stgObj.approvalStatus === 'dispute' || stgObj.approvalStatus === 'rejected');
                        }
                        return false;
                    });
                    const baseStageKey = stageKey.replace(/_hold_\d+$/, '');
                    const sameStageKeys = Object.keys(stages)
                        .filter(k => k !== 'holdHistory')
                        .filter(k => k.replace(/_hold_\d+$/, '') === baseStageKey)
                        .sort((a, b) => {
                            const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || stages[a].updatedAt || 0).getTime();
                            const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || stages[b].updatedAt || 0).getTime();
                            return timeA - timeB;
                        });
                    const isLatestAttempt = sameStageKeys.length === 0 || stageKey === sameStageKeys[sameStageKeys.length - 1];
                    const attemptIndex = sameStageKeys.indexOf(stageKey);
                    const attemptNo = attemptIndex !== -1 ? attemptIndex + 1 : 1;

                    if (stageObj.isSkipped || stageObj.approvalStatus === 'skipped') {
                        if (canApprove) {
                            actionsCell = (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>
                                    <button
                                        onClick={() => handleRevertSkip(detailEntry.id, insp.id, stageKey)}
                                        disabled={processingAction}
                                        style={{
                                            background: '#8b5cf6',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Retrieve Skip
                                    </button>
                                </div>
                            );
                        } else {
                            actionsCell = <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>;
                        }
                    } else if (stageObj.isHoldHistory) {
                        actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Hold (Past Attempt)</span>;
                    } else if (canApprove) {
                        if (isStageAlreadyPassed) {
                            if (stageObj.approvalStatus === 'approved') {
                                const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                                const name = stageObj.firstApprovedBy || stageObj.approvedBy || fallbackManagerName;
                                actionsCell = (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                                        <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved (Attempt {attemptNo})</span>
                                        <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                                    </div>
                                );
                            } else if (stageObj.approvalStatus === 'rejected') {
                                actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                            } else {
                                actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Hold (Past Attempt)</span>;
                            }
                        } else if (canApprove && (stageObj.approvalStatus === 'pending' || stageObj.approvalStatus === 'hold')) {
                            actionsCell = (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '7px', color: 'blue' }}>D: {stageKey} Passed: {isStageAlreadyPassed ? "YES" : "NO"} Keys: {Object.keys(stages).join(', ')}</span>
                                    {stageObj.approvalStatus === 'hold' && (
                                        <span style={{ color: '#d97706', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>[Hold]</span>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => handleApproveProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                            disabled={processingAction}
                                            style={{
                                                background: '#27ae60',
                                                border: 'none',
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                fontSize: '10px',
                                                padding: '3px 8px',
                                                borderRadius: '3px'
                                            }}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                            disabled={processingAction}
                                            style={{
                                                background: '#dc2626',
                                                border: 'none',
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                fontSize: '10px',
                                                padding: '3px 8px',
                                                borderRadius: '3px'
                                            }}
                                        >
                                            Reject
                                        </button>
                                        {stageObj.approvalStatus !== 'hold' && (
                                            <button
                                                onClick={() => handleHoldProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                                disabled={processingAction}
                                                style={{
                                                    background: '#d97706',
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    fontSize: '10px',
                                                    padding: '3px 8px',
                                                    borderRadius: '3px'
                                                }}
                                            >
                                                Hold
                                            </button>
                                        )}
                                        {stageObj.approvalStatus === 'hold' && (
                                            <button
                                                onClick={() => triggerDisputeFlow(insp.id, stageKey)}
                                                disabled={processingAction}
                                                style={{
                                                    background: '#d97706',
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    fontSize: '10px',
                                                    padding: '3px 8px',
                                                    borderRadius: '3px'
                                                }}
                                            >
                                                Dispute
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        } else if (!pendingStage && detailEntry.status === 'PHYSICAL_INSPECTION' && (insp.isComplete || stages.balanced_lot?.approvalStatus === 'approved') && stageKey === 'balanced_lot' && (inspectionsProgress?.inspectedBags >= inspectionsProgress?.totalBags)) {
                            actionsCell = (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleApproveLorryQuality(detailEntry.id)}
                                        disabled={processingAction}
                                        style={{
                                            background: '#27ae60',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Approve Lorry
                                    </button>
                                    <button
                                        onClick={() => handleRejectSpecificLorry(detailEntry.id, insp.id, insp.lorryNumber)}
                                        disabled={processingAction}
                                        style={{
                                            background: '#dc2626',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            );
                        } else if (stageObj.approvalStatus === 'approved') {
                            const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                            const name = stageObj.firstApprovedBy || stageObj.approvedBy || fallbackManagerName;
                            actionsCell = (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                                    <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved</span>
                                    <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                                </div>
                            );
                        } else if (stageObj.approvalStatus === 'rejected') {
                            actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                        } else if (!pendingStage && stageKey === 'full_avg' && !stages.balanced_lot?.reportedBy) {
                            actionsCell = (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '600' }}>Awaiting Next</span>
                                    <button
                                        onClick={() => handleRejectSpecificLorry(detailEntry.id, insp.id, insp.lorryNumber)}
                                        disabled={processingAction}
                                        style={{
                                            background: '#dc2626',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            );
                        }
                    } else {
                        if (stageObj.approvalStatus === 'approved') {
                            const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                            const name = stageObj.firstApprovedBy || stageObj.approvedBy || fallbackManagerName;
                            actionsCell = (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                                    <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved</span>
                                    <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                                </div>
                            );
                        } else if (stageObj.approvalStatus === 'rejected') {
                            actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                        } else if (stageObj.approvalStatus === 'pending') {
                            actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Pending Approval</span>;
                        } else if (stageObj.approvalStatus === 'hold') {
                            actionsCell = (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(217, 119, 6, 0.3)', backgroundColor: '#fffbeb', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                                    <span style={{ color: '#d97706', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hold</span>
                                    {stageObj.holdDuration && (
                                        <span style={{ color: '#b45309', fontSize: '11px', fontWeight: '800' }}>{stageObj.holdDuration}</span>
                                    )}
                                </div>
                            );
                        }
                    }

                    const canEdit = onEditStage && !stageObj.isSkipped && stageObj.approvalStatus !== 'skipped' && stageObj.approvalStatus !== 'hold' && (stageObj.approvalStatus === 'approved' || stageObj.approvalStatus === 'pending');
                    if (canEdit) {
                        const editBtn = (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditStage(insp.lorryNumber, stageKey);
                                }}
                                style={{
                                    background: '#e67e22',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '9.5px',
                                    padding: '2.5px 7px',
                                    borderRadius: '3px',
                                    marginTop: '4px',
                                    display: 'block'
                                }}
                            >
                                ✏️ Edit
                            </button>
                        );
                        actionsCell = (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <div>{actionsCell}</div>
                                {editBtn}
                            </div>
                        );
                    }

                    const renderStageReportedAtStacked = (dtStr: any) => {
                        if (!dtStr) return '-';
                        try {
                            const d = new Date(dtStr);
                            const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10.5px', lineHeight: '1.2' }}>
                                    <span style={{ fontWeight: '600' }}>{dStr}</span>
                                    <span style={{ color: '#64748b', fontSize: '9.5px' }}>{tStr}</span>
                                </div>
                            );
                        } catch {
                            return '-';
                        }
                    };

                    const renderStageReportedBy = (stage: any) => {
                        return (
                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>
                                {getCollectorLabel(stage.reportedBy)}
                            </span>
                        );
                    };

                    const renderStagePaddyWb = (stage: any) => {
                        const hasPaddyWb = !!stage.paddyWbEnabled;
                        if (!hasPaddyWb) return '-';
                        return (
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{formatQ(stage.paddyWbRaw, stage.paddyWb)}</span>
                            </span>
                        );
                    };

                    const isKadigaVal = stageObj.kadiga === 'Y' || stageObj.kadiga === 'Yes' || stageObj.kadiga === true || stageObj.kadiga === 'true';
                    return [
                        labelElement,
                        renderStageReportedBy(stageObj),
                        renderStageReportedAtStacked(reportedAt),
                        <span style={{ fontSize: '9.5px', fontWeight: '700' }}>{formatStageMoisture(stageObj)}</span>,
                        formatStageCutting(stageObj),
                        formatStageBend(stageObj),
                        <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569' }}>{formatStageGrains(stageObj)}</span>,
                        formatQ(stageObj.mixRaw, stageObj.mix),
                        stageObj.smixEnabled ? formatQ(stageObj.mixSRaw, stageObj.mixS) || 'Yes' : '-',
                        stageObj.lmixEnabled ? formatQ(stageObj.mixLRaw, stageObj.mixL) || 'Yes' : '-',
                        formatQ(stageObj.kanduRaw, stageObj.kandu),
                        formatQ(stageObj.oilRaw, stageObj.oil),
                        formatQ(stageObj.skRaw, stageObj.sk),
                        formatQ(stageObj.wbRRaw, stageObj.wbR),
                        formatQ(stageObj.wbBkRaw, stageObj.wbBk),
                        formatQ(stageObj.wbTRaw, stageObj.wbT),
                        renderBeautifulSmell(stageObj),
                        renderStagePaddyWb(stageObj),
                        stageObj.isSkipped ? '-' : (() => {
                            const hasColor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                            const hasKadiga = isKadigaVal;
                            if (!hasColor && !hasKadiga) return '-';
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#7c2d12', fontWeight: '800', gap: '2px' }}>
                                    {hasColor && <span>{stageObj.paddyColor}</span>}
                                    {hasColor && hasKadiga && <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />}
                                    {hasKadiga && <span>ಕಡಿಗಾ: Yes</span>}
                                </div>
                            );
                        })(),
                        actionsCell
                    ];
                };

                const stageKeys: { key: string; label: string }[] = [];
                const sortedKeys = Object.keys(stages)
                    .filter(key => stages[key] && stages[key].reportedBy)
                    .sort((a, b) => {
                        const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || stages[a].updatedAt || 0).getTime();
                        const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || stages[b].updatedAt || 0).getTime();
                        return timeA - timeB;
                    });

                sortedKeys.forEach(key => {
                    const baseStageKey = key.replace(/_hold_\d+$/, '');
                    let baseLabel = '';
                    if (baseStageKey === 'lot_avg') baseLabel = 'Lot Avg';
                    else if (baseStageKey === 'half_lorry') baseLabel = 'Half Lorry';
                    else if (baseStageKey === 'full_avg') baseLabel = 'Full Avg Lorry';
                    else if (baseStageKey === 'balanced_lot') baseLabel = 'Balanced Lot';
                    else if (baseStageKey.startsWith('nit_avg')) {
                        const stageObj = stages[key];
                        baseLabel = getNitAvgLabel(stageObj?.nit || '');
                    } else {
                        baseLabel = baseStageKey;
                    }

                    const sameStageKeys = Object.keys(stages)
                        .filter(k => k.replace(/_hold_\d+$/, '') === baseStageKey)
                        .sort((a, b) => {
                            const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || stages[a].updatedAt || 0).getTime();
                            const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || stages[b].updatedAt || 0).getTime();
                            return timeA - timeB;
                        });
                    const attemptIndex = sameStageKeys.indexOf(key);
                    const attemptNo = attemptIndex !== -1 ? attemptIndex + 1 : 1;
                    const isHold = key.includes('_hold_');

                    let label = '';
                    if (sameStageKeys.length > 1) {
                        label = `${baseLabel} (Attempt ${attemptNo}${isHold ? ' - Hold' : ''})`;
                    } else {
                        label = `${baseLabel}${isHold ? ' (Hold)' : ''}`;
                    }
                    stageKeys.push({ key, label });
                });

                stageKeys.forEach(({ key, label }) => {
                    const stageObj = stages[key];
                    if (stageObj && stageObj.reportedBy) {
                        const labelElement = (
                            <span
                                onClick={() => {
                                    setSelectedLorryForComparison({
                                        lorryNumber: insp.lorryNumber,
                                        previousInspections: [insp],
                                        lotAllotment: detailEntry.lotAllotment,
                                        singleLorryMode: true,
                                        loadNumber: tripIdx + 1
                                    });
                                }}
                                style={{ color: '#000000', textDecoration: 'underline', cursor: 'pointer', fontWeight: 900 }}
                                title="Click to view side-by-side stage comparison"
                            >
                                {key.startsWith('nit_avg') ? (
                                    <>
                                        {label}
                                        {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                                    </>
                                ) : key === 'full_avg' && insp.bags ? (
                                    <>
                                        {label}{' '}
                                        <span style={{ color: '#1565c0', fontWeight: '900' }}>
                                            ({insp.bags})
                                        </span>
                                        {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                                    </>
                                ) : (
                                    <>
                                        {label}
                                        {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                                    </>
                                )}
                            </span>
                        );
                        const stageRow = makeRow(labelElement, stageObj, key);
                        if (stageRow) {
                            (stageRow as any).hasSmell = stageObj.smellHas === true 
                                || String(stageObj.smellHas).trim().toUpperCase() === 'YES'
                                || (stageObj.smellType && String(stageObj.smellType).trim() !== '' && String(stageObj.smellType).trim() !== '-' && String(stageObj.smellType).trim().toLowerCase() !== 'no');
                            rows.push(stageRow);
                        }
                    }
                });
            });
        }

        return rows;
    };

    const buildInitialQualityRows = () => {
        const attempts = getQualityAttemptsForEntry(detailEntry);
        return attempts.map((attempt: any, idx: number) => {
            const label = getSamplingLabel(attempt.attemptNo || idx + 1);
            const reportedAt = attempt.reportedAt || attempt.updatedAt || attempt.createdAt;
            
            const formatQ = (raw: any, val: any) => {
                if (raw !== undefined && raw !== null && raw !== '') return raw;
                const s = String(val === undefined || val === null ? '' : val).trim();
                if (!s || s === '0' || s === '0.00') return '-';
                return s;
            };

            const mRaw = attempt.moistureRaw;
            const mVal = String(attempt.moisture === undefined || attempt.moisture === null ? '' : attempt.moisture);
            const moisture = mRaw ? `${mRaw}%` : (mVal && mVal !== '0' && mVal !== '0.00' ? `${mVal}%` : '-');

            const c1Raw = attempt.cutting1Raw;
            const c1Val = String(attempt.cutting1 === undefined || attempt.cutting1 === null ? '' : attempt.cutting1);
            const c2Raw = attempt.cutting2Raw;
            const c2Val = String(attempt.cutting2 === undefined || attempt.cutting2 === null ? '' : attempt.cutting2);
            let cutting = '-';
            if (c1Raw) cutting = `${c1Raw}x${c2Raw || 0}`;
            else if (c1Val && c1Val !== '0' && c1Val !== '0.00') cutting = `${c1Val}x${c2Val || 0}`;

            const b1Raw = attempt.bend1Raw;
            const b1Val = String(attempt.bend1 === undefined || attempt.bend1 === null ? '' : attempt.bend1);
            const b2Raw = attempt.bend2Raw;
            const b2Val = String(attempt.bend2 === undefined || attempt.bend2 === null ? '' : attempt.bend2);
            let bend = '-';
            if (b1Raw) bend = `${b1Raw}x${b2Raw || 0}`;
            else if (b1Val && b1Val !== '0' && b1Val !== '0.00') bend = `${b1Val}x${b2Val || 0}`;

            const gRaw = attempt.grainsCountRaw;
            const gVal = String(attempt.grainsCount === undefined || attempt.grainsCount === null ? '' : attempt.grainsCount);
            const grains = gRaw ? `(${gRaw})` : (gVal && gVal !== '0' && gVal !== '0.00' ? `(${gVal})` : '-');

            const renderStackedDateTime = (dtStr: any) => {
                if (!dtStr) return '-';
                try {
                    const d = new Date(dtStr);
                    const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10.5px', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: '600' }}>{dStr}</span>
                            <span style={{ color: '#64748b', fontSize: '9.5px' }}>{tStr}</span>
                        </div>
                    );
                } catch {
                    return '-';
                }
            };

            const rowData = [
                <span style={{ color: '#c2410c' }}>{label} Sample</span>,
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>{getCollectorLabel(attempt.reportedBy)}</span>,
                renderStackedDateTime(reportedAt),
                <span style={{ fontSize: '9.5px', fontWeight: '700' }}>{moisture}</span>,
                cutting,
                bend,
                <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569' }}>{grains}</span>,
                formatQ(attempt.mixRaw, attempt.mix),
                formatQ(attempt.mixSRaw, attempt.mixS),
                formatQ(attempt.mixLRaw, attempt.mixL),
                formatQ(attempt.kanduRaw, attempt.kandu),
                formatQ(attempt.oilRaw, attempt.oil),
                formatQ(attempt.skRaw, attempt.sk),
                formatQ(attempt.wbRRaw, attempt.wbR),
                formatQ(attempt.wbBkRaw, attempt.wbBk),
                formatQ(attempt.wbTRaw, attempt.wbT),
                renderBeautifulSmell(getQualityAttemptSmellLabel(detailEntry, attempt)),
                formatQ(attempt.paddyWbRaw, attempt.paddyWb)
            ];

            if (progressiveMode) {
                rowData.push('-');
            }

            const smellLabel = getQualityAttemptSmellLabel(detailEntry, attempt);
            (rowData as any).hasSmell = attempt?.smellHas === true 
                || String(attempt?.smellHas).trim().toUpperCase() === 'YES'
                || (smellLabel && smellLabel !== '-' && smellLabel !== 'No');

            return rowData;
        });
    };

    const buildBmbQualityRows = () => {
        const params = (detailEntry as any).inventoryQualityParameters || [];
        return params.map((param: any, idx: number) => {
            const label = param.type === 'lot_avg' ? 'Lot Avg' : 'Full Lorry Avg';
            const reportedAt = param.createdAt;
            
            const formatQ = (val: any) => {
                const s = String(val === undefined || val === null ? '' : val).trim();
                if (!s || s === '0' || s === '0.00') return '-';
                return s;
            };

            const moisture = param.moisture ? `${param.moisture}%` : '-';
            const cutting = param.cutting || '-';
            const bend = param.bend || '-';
            const grains = param.grains ? `(${param.grains})` : '-';

            const renderStackedDateTime = (dtStr: any) => {
                if (!dtStr) return '-';
                try {
                    const d = new Date(dtStr);
                    const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10.5px', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: '600' }}>{dStr}</span>
                            <span style={{ color: '#64748b', fontSize: '9.5px' }}>{tStr}</span>
                        </div>
                    );
                } catch {
                    return '-';
                }
            };

            const rowData = [
                <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{label}</span>,
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>{param.reporter?.username || 'admin'}</span>,
                renderStackedDateTime(reportedAt),
                <span style={{ fontSize: '9.5px', fontWeight: '700' }}>{moisture}</span>,
                cutting,
                bend,
                <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569' }}>{grains}</span>,
                formatQ(param.mix),
                formatQ(param.sMix),
                formatQ(param.lMix),
                formatQ(param.kandu),
                formatQ(param.oil),
                formatQ(param.sk),
                formatQ(param.wbR),
                formatQ(param.wbBk),
                formatQ(param.wbT),
                renderBeautifulSmell(param.smell || (param.smellHas ? param.smellType : '-')),
                formatQ(param.paddyWb)
            ];

            const isApproved = param.status === 'approved';
            rowData.push(
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                    background: isApproved ? '#dcfce7' : '#fef3c7',
                    color: isApproved ? '#166534' : '#92400e',
                    border: `1px solid ${isApproved ? '#22c55e' : '#f59e0b'}`,
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                    {isApproved ? '✅ Approved' : '⏳ Pending'}
                </span>
            );

            const smellLabel = param.smell || (param.smellHas ? param.smellType : '-');
            (rowData as any).hasSmell = param.smellHas === true 
                || String(param.smellHas).trim().toUpperCase() === 'YES'
                || (smellLabel && smellLabel !== '-' && smellLabel !== 'No' && smellLabel !== 'No Smell');

            return rowData;
        });
    };

    const buildTripQualityRows = (insp: any, tripIdx: number) => {
        const rows: any[] = [];
        const stages = insp.samplingStages || {};
        const canApprove = ['admin', 'owner', 'manager'].includes(String(user?.role || '').toLowerCase());
        
        const formatQ = (raw: any, val: any) => {
            if (raw !== undefined && raw !== null && raw !== '') return raw;
            const s = String(val === undefined || val === null ? '' : val).trim();
            if (!s || s === '0' || s === '0.00') return '-';
            return s;
        };

        const formatStageMoisture = (stageObj: any) => {
            const raw = stageObj.moistureRaw;
            const val = stageObj.moisture;
            if (raw) return `${raw}%`;
            if (val !== undefined && val !== null && String(val) !== '0') return `${val}%`;
            return '-';
        };

        const formatStageCutting = (stageObj: any) => {
            if (stageObj.cutting1 === undefined || stageObj.cutting1 === null) return '-';
            const c1 = parseFloat(stageObj.cutting1);
            const c2 = parseFloat(stageObj.cutting2) || 0;
            return `${isNaN(c1) || c1 === 0 ? 1 : c1}x${c2}`;
        };

        const formatStageBend = (stageObj: any) => {
            if (stageObj.bend1 === undefined || stageObj.bend1 === null) return '-';
            const b1 = parseFloat(stageObj.bend1);
            const b2 = parseFloat(stageObj.bend2) || 0;
            return `${isNaN(b1) || b1 === 0 ? 1 : b1}x${b2}`;
        };

        const formatStageGrains = (stageObj: any) => {
            const raw = stageObj.grainsCountRaw;
            const val = stageObj.grainsCount;
            if (raw) return `(${raw})`;
            if (val !== undefined && val !== null && String(val) !== '0') return `(${val})`;
            return '-';
        };

        const getPendingStageOfTrip = (currentInsp: any) => {
            const stg = currentInsp.samplingStages || {};
            if (stg.lot_avg?.approvalStatus === 'pending') return { key: 'lot_avg', label: 'Lot Avg' };
            if (stg.balanced_lot?.approvalStatus === 'pending') return { key: 'balanced_lot', label: 'Balanced Lot' };
            if (stg.half_lorry?.approvalStatus === 'pending') return { key: 'half_lorry', label: 'Half Lorry' };
            
            // Scan all nit_avg keys
            const nitKeys = Object.keys(stg)
                .filter(k => k.startsWith('nit_avg'))
                .sort((a, b) => {
                    if (a === 'nit_avg') return -1;
                    if (b === 'nit_avg') return 1;
                    const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                    const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                    return numA - numB;
                });
            for (const key of nitKeys) {
                if (stg[key]?.approvalStatus === 'pending') {
                    const idx = nitKeys.indexOf(key);
                    const label = idx === 0 ? 'Nit Avg' : `Nit Avg ${idx + 1}`;
                    return { key, label };
                }
            }

            if (stg.full_avg?.approvalStatus === 'pending') return { key: 'full_avg', label: 'Full Lorry' };
            return null;
        };

        const pendingStage = getPendingStageOfTrip(insp);

        const makeRow = (labelElement: any, stageObj: any, stageKey: string) => {
            if (!stageObj || !stageObj.reportedBy) return null;
            let isStageAlreadyPassed = false;
            const reportedAt = stageObj.reportedAt;
            
            const renderStageCompareCell = (
                currentStage: any,
                getValueFn: (obj: any) => any,
                isElement = false
            ) => {
                const currentVal = getValueFn(currentStage);
                if (!currentStage.beforeEdit || currentStage.approvalStatus !== 'pending') {
                    return currentVal;
                }
                
                const beforeVal = getValueFn(currentStage.beforeEdit);
                if (beforeVal === currentVal) {
                    return currentVal;
                }
                
                if (isElement) {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                            <span style={{ textDecoration: 'line-through', color: '#dc2626', fontSize: '9px', opacity: 0.8 }}>{beforeVal}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{currentVal}</span>
                        </div>
                    );
                }
                
                const formattedBefore = beforeVal === undefined || beforeVal === null || beforeVal === '' ? '-' : String(beforeVal);
                const formattedCurrent = currentVal === undefined || currentVal === null || currentVal === '' ? '-' : String(currentVal);
                
                if (formattedBefore === formattedCurrent) {
                    return currentVal;
                }
                
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ textDecoration: 'line-through', color: '#dc2626', fontSize: '9px', opacity: 0.8 }}>{formattedBefore}</span>
                        <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{formattedCurrent}</span>
                    </div>
                );
            };
            
            let actionsCell: any = '-';
            const getBaseStageKey = (k: string) => {
                return k.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
            };
            const baseStageKey = getBaseStageKey(stageKey);
            isStageAlreadyPassed = Object.keys(stages).some(key => {
                if (getBaseStageKey(key) === baseStageKey) {
                    const stgObj = stages[key];
                    return stgObj && (stgObj.approvalStatus === 'approved' || stgObj.approvalStatus === 'dispute' || stgObj.approvalStatus === 'rejected');
                }
                return false;
            });
            const sameStageKeys = Object.keys(stages)
                .filter(k => getBaseStageKey(k) === baseStageKey)
                .sort((a, b) => {
                    const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || stages[a].updatedAt || 0).getTime();
                    const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || stages[b].updatedAt || 0).getTime();
                    return timeA - timeB;
                });
            const isLatestAttempt = sameStageKeys.length === 0 || stageKey === sameStageKeys[sameStageKeys.length - 1];
            const attemptIndex = sameStageKeys.indexOf(stageKey);
            const attemptNo = attemptIndex !== -1 ? attemptIndex + 1 : 1;

            if (stageObj.isSkipped || stageObj.approvalStatus === 'skipped') {
                if (canApprove) {
                    actionsCell = (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>
                            <button
                                onClick={() => handleRevertSkip(detailEntry.id, insp.id, stageKey)}
                                disabled={processingAction}
                                style={{
                                    background: '#8b5cf6',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    borderRadius: '3px'
                                }}
                            >
                                Retrieve Skip
                            </button>
                        </div>
                    );
                } else {
                    actionsCell = <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>;
                }
            } else if (canApprove) {
                if (isStageAlreadyPassed) {
                    if (stageObj.approvalStatus === 'approved') {
                        const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                        const name = stageObj.firstApprovedBy || stageObj.approvedBy || fallbackManagerName;
                        actionsCell = (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                                <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved (Attempt {attemptNo})</span>
                                <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                            </div>
                        );
                    } else if (stageObj.approvalStatus === 'rejected') {
                        actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                    } else {
                        actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Hold (Past Attempt)</span>;
                    }
                } else if (canApprove && (stageObj.approvalStatus === 'pending' || stageObj.approvalStatus === 'hold')) {
                    actionsCell = (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            {stageObj.approvalStatus === 'hold' && (
                                <span style={{ color: '#d97706', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>[Hold]</span>
                            )}
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => handleApproveProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                    disabled={processingAction}
                                    style={{
                                        background: '#27ae60',
                                        border: 'none',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        padding: '3px 8px',
                                        borderRadius: '3px'
                                    }}
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleRejectProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                    disabled={processingAction}
                                    style={{
                                        background: '#dc2626',
                                        border: 'none',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        padding: '3px 8px',
                                        borderRadius: '3px'
                                    }}
                                >
                                    Reject
                                </button>
                                {stageObj.approvalStatus !== 'hold' && (
                                    <button
                                        onClick={() => handleHoldProgressiveStage(detailEntry.id, insp.id, stageKey, getStageLabel(stageKey))}
                                        disabled={processingAction}
                                        style={{
                                            background: '#d97706',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Hold
                                    </button>
                                )}
                                {stageObj.approvalStatus === 'hold' && (
                                    <button
                                        onClick={() => triggerDisputeFlow(insp.id, stageKey)}
                                        disabled={processingAction}
                                        style={{
                                            background: '#d97706',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            borderRadius: '3px'
                                        }}
                                    >
                                        Dispute
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                } else if (!pendingStage && detailEntry.status === 'PHYSICAL_INSPECTION' && (stageKey === 'balanced_lot' || stageKey === 'full_avg') && (stages.full_avg?.approvalStatus === 'approved' || stages.balanced_lot?.approvalStatus === 'approved')) {
                    actionsCell = (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => handleApproveLorryQuality(detailEntry.id)}
                                disabled={processingAction}
                                style={{
                                    background: '#27ae60',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    borderRadius: '3px'
                                }}
                            >
                                Approve Lorry
                            </button>
                            <button
                                onClick={() => handleRejectSpecificLorry(detailEntry.id, insp.id, insp.lorryNumber)}
                                disabled={processingAction}
                                style={{
                                    background: '#dc2626',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    borderRadius: '3px'
                                }}
                            >
                                Reject
                            </button>
                        </div>
                    );
                } else if (stageObj.approvalStatus === 'approved') {
                    const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                    const name = stageObj.approvedBy ? stageObj.approvedBy : fallbackManagerName;
                    actionsCell = (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                            <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved</span>
                            <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                        </div>
                    );
                } else if (stageObj.approvalStatus === 'rejected') {
                    actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                } else if (stageObj.approvalStatus === 'hold') {
                    actionsCell = (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(217, 119, 6, 0.3)', backgroundColor: '#fffbeb', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                            <span style={{ color: '#d97706', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hold</span>
                            {stageObj.holdDuration && (
                                <span style={{ color: '#b45309', fontSize: '11px', fontWeight: '800' }}>{stageObj.holdDuration}</span>
                            )}
                        </div>
                    );
                } else if (!pendingStage && stageKey === 'full_avg' && !stages.balanced_lot?.reportedBy) {
                    actionsCell = (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '600' }}>Awaiting Next</span>
                            <button
                                onClick={() => handleRejectSpecificLorry(detailEntry.id, insp.id, insp.lorryNumber)}
                                disabled={processingAction}
                                style={{
                                    background: '#dc2626',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '3px 8px',
                                    borderRadius: '3px'
                                }}
                            >
                                Reject
                            </button>
                        </div>
                    );
                }
            } else {
                if (stageObj.approvalStatus === 'approved') {
                    const fallbackManagerName = detailEntry.lotAllotment?.manager?.fullName || detailEntry.lotAllotment?.manager?.username || 'MANAGER';
                    const name = stageObj.approvedBy ? stageObj.approvedBy : fallbackManagerName;
                    actionsCell = (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(39, 174, 96, 0.3)', backgroundColor: '#e8f5e9', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                            <span style={{ color: '#2e7d32', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved</span>
                            <span style={{ color: '#1b5e20', fontSize: '13px', fontWeight: '900', whiteSpace: 'normal', maxWidth: '110px', wordBreak: 'break-word' }}>by {name.toUpperCase()}</span>
                        </div>
                    );
                } else if (stageObj.approvalStatus === 'rejected') {
                    actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                } else if (stageObj.approvalStatus === 'hold') {
                    actionsCell = (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1', border: '1px solid rgba(217, 119, 6, 0.3)', backgroundColor: '#fffbeb', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>
                            <span style={{ color: '#d97706', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hold</span>
                            {stageObj.holdDuration && (
                                <span style={{ color: '#b45309', fontSize: '11px', fontWeight: '800' }}>{stageObj.holdDuration}</span>
                            )}
                        </div>
                    );
                } else if (stageObj.approvalStatus === 'pending') {
                    actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Pending Approval</span>;
                }
            }

            const canEdit = onEditStage && !stageObj.isSkipped && stageObj.approvalStatus !== 'skipped' && stageObj.approvalStatus !== 'hold' && (stageObj.approvalStatus === 'approved' || stageObj.approvalStatus === 'pending');
            if (canEdit) {
                const editBtn = (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEditStage(insp.lorryNumber, stageKey);
                        }}
                        style={{
                            background: '#e67e22',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '9.5px',
                            padding: '2.5px 7px',
                            borderRadius: '3px',
                            marginTop: '4px',
                            display: 'block'
                        }}
                    >
                        ✏️ Edit
                    </button>
                );
                actionsCell = (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div>{actionsCell}</div>
                        {editBtn}
                    </div>
                );
            }

            const renderStageReportedAtStacked = (dtStr: any) => {
                if (!dtStr) return '-';
                try {
                    const d = new Date(dtStr);
                    const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '10.5px', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: '600' }}>{dStr}</span>
                            <span style={{ color: '#64748b', fontSize: '9.5px' }}>{tStr}</span>
                        </div>
                    );
                } catch {
                    return '-';
                }
            };

            const renderStageReportedBy = (stage: any) => {
                return (
                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e293b' }}>
                        {getCollectorLabel(stage.reportedBy)}
                    </span>
                );
            };

            const currentSmell = renderBeautifulSmell(stageObj);
            const beforeSmell = stageObj.beforeEdit ? renderBeautifulSmell(stageObj.beforeEdit) : null;
            const hasSmellDiff = stageObj.approvalStatus === 'pending' && beforeSmell !== null && (
                stageObj.smellHas !== stageObj.beforeEdit.smellHas ||
                stageObj.smellType !== stageObj.beforeEdit.smellType
            );
            const smellCell = hasSmellDiff ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ textDecoration: 'line-through', color: '#dc2626', fontSize: '9px', opacity: 0.8 }}>{beforeSmell}</span>
                    <span>{currentSmell}</span>
                </div>
            ) : currentSmell;

            const isKadigaVal = stageObj.kadiga === 'Y' || stageObj.kadiga === 'Yes' || stageObj.kadiga === true || stageObj.kadiga === 'true';
            return [
                labelElement,
                renderStageReportedBy(stageObj),
                renderStageReportedAtStacked(reportedAt),
                <span style={{ fontSize: '9.5px', fontWeight: '700' }}>{renderStageCompareCell(stageObj, formatStageMoisture)}</span>,
                renderStageCompareCell(stageObj, formatStageCutting),
                renderStageCompareCell(stageObj, formatStageBend),
                <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#475569' }}>{renderStageCompareCell(stageObj, formatStageGrains)}</span>,
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.mixRaw, obj.mix)),
                renderStageCompareCell(stageObj, (obj) => obj.smixEnabled ? formatQ(obj.mixSRaw, obj.mixS) || 'Yes' : '-'),
                renderStageCompareCell(stageObj, (obj) => obj.lmixEnabled ? formatQ(obj.mixLRaw, obj.mixL) || 'Yes' : '-'),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.kanduRaw, obj.kandu)),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.oilRaw, obj.oil)),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.skRaw, obj.sk)),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.wbRRaw, obj.wbR)),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.wbBkRaw, obj.wbBk)),
                renderStageCompareCell(stageObj, (obj) => formatQ(obj.wbTRaw, obj.wbT)),
                smellCell,
                renderStageCompareCell(stageObj, (obj) => {
                    const hasPaddyWb = !!obj.paddyWbEnabled;
                    if (!hasPaddyWb) return '-';
                    return formatQ(obj.paddyWbRaw, obj.paddyWb);
                }),
                stageObj.isSkipped ? '-' : (() => {
                    const hasColor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                    const hasKadiga = isKadigaVal || (stageObj.beforeEdit && (stageObj.beforeEdit.kadiga === 'Y' || stageObj.beforeEdit.kadiga === 'Yes' || stageObj.beforeEdit.kadiga === true || stageObj.beforeEdit.kadiga === 'true'));
                    if (!hasColor && !hasKadiga) return '-';
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#7c2d12', fontWeight: '800', gap: '2px' }}>
                            {hasColor && <span>{renderStageCompareCell(stageObj, (obj) => obj.paddyColorEnabled && obj.paddyColor ? obj.paddyColor : '-')}</span>}
                            {hasColor && hasKadiga && <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />}
                            {hasKadiga && <span>ಕಡಿಗಾ: {renderStageCompareCell(stageObj, (obj) => {
                                const isK = obj.kadiga === 'Y' || obj.kadiga === 'Yes' || obj.kadiga === true || obj.kadiga === 'true';
                                return obj.kadiga ? (isK ? 'Yes' : 'No') : '-';
                            })}</span>}
                        </div>
                    );
                })(),
                actionsCell
            ];
        };

        const displayStages: Record<string, any> = { ...stages };
        // holdHistory is not a real stage — remove it from the display dictionary
        delete displayStages.holdHistory;

        const stageKeys: { key: string; label: string }[] = [];
        const sortedKeys = Object.keys(displayStages)
            .filter(key => key !== 'holdHistory' && displayStages[key] && displayStages[key].reportedBy)
            .sort((a, b) => {
                const timeA = new Date(displayStages[a].reportedAt || displayStages[a].holdAt || displayStages[a].createdAt || displayStages[a].updatedAt || 0).getTime();
                const timeB = new Date(displayStages[b].reportedAt || displayStages[b].holdAt || displayStages[b].createdAt || displayStages[b].updatedAt || 0).getTime();
                return timeA - timeB;
            });

        sortedKeys.forEach(key => {
            const baseStageKey = key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
            let baseLabel = '';
            if (baseStageKey === 'lot_avg') baseLabel = 'Lot Avg';
            else if (baseStageKey === 'half_lorry') baseLabel = 'Half Lorry';
            else if (baseStageKey === 'full_avg') baseLabel = 'Full Avg Lorry';
            else if (baseStageKey === 'balanced_lot') baseLabel = 'Balanced Lot';
            else if (baseStageKey.startsWith('nit_avg')) {
                const stageObj = displayStages[key];
                baseLabel = getNitAvgLabel(stageObj?.nit || '');
            } else {
                baseLabel = baseStageKey;
            }

            const sameStageKeys = Object.keys(displayStages)
                .filter(k => k !== 'holdHistory')
                .filter(k => k.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '') === baseStageKey)
                .sort((a, b) => {
                    const timeA = new Date(displayStages[a].reportedAt || displayStages[a].holdAt || displayStages[a].createdAt || displayStages[a].updatedAt || 0).getTime();
                    const timeB = new Date(displayStages[b].reportedAt || displayStages[b].holdAt || displayStages[b].createdAt || displayStages[b].updatedAt || 0).getTime();
                    return timeA - timeB;
                });
            const attemptIndex = sameStageKeys.indexOf(key);
            const attemptNo = attemptIndex !== -1 ? attemptIndex + 1 : 1;
            const isHold = displayStages[key]?.approvalStatus === 'hold';

            let label = '';
            if (sameStageKeys.length > 1) {
                label = `${baseLabel} (Attempt ${attemptNo}${isHold ? ' - Hold' : ''})`;
            } else {
                label = `${baseLabel}${isHold ? ' (Hold)' : ''}`;
            }
            stageKeys.push({ key, label });
        });

        stageKeys.forEach(({ key, label }) => {
            const stageObj = displayStages[key];
            if (stageObj && stageObj.reportedBy) {
                const labelElement = (
                    <span
                        onClick={() => {
                            setSelectedLorryForComparison({
                                lorryNumber: insp.lorryNumber,
                                previousInspections: [insp],
                                lotAllotment: detailEntry.lotAllotment,
                                singleLorryMode: true,
                                loadNumber: tripIdx + 1
                            });
                        }}
                        style={{ color: '#000000', textDecoration: 'underline', cursor: 'pointer', fontWeight: 900 }}
                        title="Click to view side-by-side stage comparison"
                    >
                        {key.startsWith('nit_avg') ? (
                            <>
                                {label}
                                {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                            </>
                        ) : (key === 'full_avg' || key.startsWith('full_avg_')) && (insp.bags || stageObj.actualBags || stageObj.bags) ? (
                            <>
                                {label}{' '}
                                <span style={{ color: '#1565c0', fontWeight: '900' }}>
                                    ({(() => {
                                        const currentBags = stageObj.actualBags || stageObj.bags || insp.bags;
                                        if (stageObj.beforeEdit && stageObj.approvalStatus === 'pending') {
                                            const beforeBags = stageObj.beforeEdit.actualBags || stageObj.beforeEdit.bags || insp.bags;
                                            if (beforeBags !== currentBags) {
                                                return (
                                                    <>
                                                        <span style={{ textDecoration: 'line-through', color: '#dc2626', opacity: 0.8 }}>{beforeBags}</span>
                                                        {' → '}
                                                        <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{currentBags}</span>
                                                    </>
                                                );
                                            }
                                        }
                                        return currentBags;
                                    })()})
                                </span>
                                {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                            </>
                        ) : (
                            <>
                                {label}
                                {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                            </>
                        )}
                    </span>
                );
                const stageRow = makeRow(labelElement, stageObj, key);
                if (stageRow) {
                    (stageRow as any).hasSmell = stageObj.smellHas === true 
                        || String(stageObj.smellHas).trim().toUpperCase() === 'YES'
                        || (stageObj.smellType && String(stageObj.smellType).trim() !== '' && String(stageObj.smellType).trim() !== '-' && String(stageObj.smellType).trim().toLowerCase() !== 'no');
                    rows.push(stageRow);
                }
            }
        });

        return rows;
    };

    const buildCookingRows = () => {
        const statusRows = buildCookingStatusRows(detailEntry);
        if (statusRows.length === 0) return [];

        return statusRows.map((row, i) => {
            const style = getStatusStyle(row.status);
            return [
                `${i + 1}.`,
                <span style={{ backgroundColor: style.bg, color: style.color, padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>{row.status}</span>,
                <div>
                    <div style={{ fontWeight: 600 }}>{getCollectorLabel(row.doneBy)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatShortDateTime(row.doneDate)}</div>
                </div>,
                <div>
                    <div style={{ fontWeight: 600 }}>{getCollectorLabel(row.approvedBy)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatShortDateTime(row.approvedDate)}</div>
                </div>,
                row.remarks ? (
                    <button 
                        onClick={() => setRemarksPopup({ isOpen: true, text: row.remarks })}
                        style={{ padding: '2px 12px', borderRadius: '4px', border: '1px solid #3b82f6', color: '#3b82f6', background: 'transparent', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                        View
                    </button>
                ) : '-'
            ];
        });
    };

    const buildPriceComparisonRows = (rateInfoAction?: (rateInfo: any) => void) => {
        const o = detailEntry.offering;
        if (!o) return [];

        const rows: any[] = [];
        const versions = Array.isArray(o.offerVersions) ? o.offerVersions : [];
        const showLinkAction = typeof rateInfoAction === 'function';
        
        const allInsps = detailEntry.physicalInspections || (detailEntry as any).lotAllotment?.physicalInspections || [];
        const targetInsp = allInsps.find((i: any) => String(i.id) === String(targetLorryTripId));
        const linkedPattiRate = targetInsp?.linkedPattiRate;

        // Add historical offers (exclude when linking final rate or viewing a specific lorry trip rate details)
        if (!targetLorryTripId) {
            versions.forEach((v: any, i: number) => {
                const reporterName = getCollectorWithRole(v.updatedByFullName || v.createdByFullName || v.updatedBy || v.createdBy || o.updatedBy || o.createdBy);
                const reporterDate = formatShortDateTime(v.updatedAt || v.createdAt || (o as any).updatedAt || (o as any).createdAt) || '-';
                const suteVal = v.sute ?? o.sute;
                const suteUnitVal = v.suteUnit ?? o.suteUnit;
                const egbTypeVal = v.egbType ?? o.egbType;
                
                const actionBtn = showLinkAction ? (
                    <button
                        onClick={() => rateInfoAction({
                            rate: Number(v.offerBaseRateValue || v.offeringPrice || 0),
                            rateType: v.baseRateType || o.baseRateType || 'PD_LOOSE',
                            sute: Number(suteVal || 0),
                            suteUnit: suteUnitVal || 'per_ton',
                            moisture: Number(v.moistureValue ?? o.moistureValue ?? 0),
                            hamali: Number(v.hamali || o.hamali || 0),
                            hamaliUnit: v.hamaliUnit || o.hamaliUnit || 'per_bag',
                            lf: Number(v.lf || o.lf || 0),
                            lfUnit: v.lfUnit || o.lfUnit || 'per_bag',
                            isDispute: false,
                            isRevision: false
                        })}
                        style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10.5px', fontWeight: 'bold' }}
                    >
                        Link Rate
                    </button>
                ) : '-';

                const isMatch = linkedPattiRate && 
                    !linkedPattiRate.isDispute && !linkedPattiRate.isRevision &&
                    Number(v.offerBaseRateValue || v.offeringPrice || 0) === Number(linkedPattiRate.rate) &&
                    (v.baseRateType || o.baseRateType || 'PD_LOOSE') === (linkedPattiRate.rateType || 'PD_LOOSE') &&
                    Number(suteVal || 0) === Number(linkedPattiRate.sute || 0);

                const rowArray: any = [
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>Offer {i + 1}</span>,
                    reporterName,
                    reporterDate,
                    `Rs ${toNumberText(v.offerBaseRateValue || v.offeringPrice || 0, 0)}`,
                    `${(v.baseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(v.baseRateUnit || o.baseRateUnit)}`,
                    suteVal ? `${toNumberText(suteVal, 2)} / ${formatRateUnitLabel(suteUnitVal || 'per_ton')}` : '-',
                    v.moistureValue ?? o.moistureValue ? formatMeasurementText(v.moistureValue ?? o.moistureValue, '%') : '-',
                    v.hamali ? `${formatFlexibleValue(v.hamali)} / ${formatToggleUnitLabel(v.hamaliUnit || o.hamaliUnit || 'per_bag')}` : '-',
                    v.brokerage ? `${formatFlexibleValue(v.brokerage)} / ${formatToggleUnitLabel(v.brokerageUnit || o.brokerageUnit || 'per_bag')}` : '-',
                    v.lf ? `${formatFlexibleValue(v.lf)} / ${formatToggleUnitLabel(v.lfUnit || o.lfUnit || 'per_bag')}` : '-',
                    formatUnitValueText(v.egbValue ?? o.egbValue ?? 0, toTitleCase(egbTypeVal || 'Mill')),
                    v.cdValue ? formatFlexibleValue(v.cdValue) : '-',
                    v.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(v.bankLoanValue)}` : '-',
                    formatPaymentText(v.paymentConditionValue || o.paymentConditionValue || 15, v.paymentConditionUnit || o.paymentConditionUnit || 'Days'),
                    actionBtn
                ];

                if (isMatch) {
                    rowArray.isHighlighted = true;
                }

                rows.push(rowArray);
            });
        }

        // Add Final Rate row if finalized
        if ((o as any).isFinalized || o.finalPrice || o.finalBaseRate) {
            const finalReporter = getCollectorWithRole((o as any).finalReportedBy || (o as any).updatedByFullName || o.updatedBy || o.createdBy);
            const finalDate = formatShortDateTime((o as any).finalReportedAt || (o as any).updatedAt || (o as any).createdAt) || '-';
            
            const finalActionBtn = showLinkAction ? (
                <button
                    onClick={() => rateInfoAction({
                        rate: Number(o.finalPrice || o.finalBaseRate || 0),
                        rateType: o.finalBaseRateType || o.baseRateType || 'PD_LOOSE',
                        sute: Number(o.finalSute || o.sute || 0),
                        suteUnit: o.finalSuteUnit || o.suteUnit || 'per_ton',
                        moisture: Number(o.moistureValue || 0),
                        hamali: Number(o.hamali || 0),
                        hamaliUnit: o.hamaliUnit || 'per_bag',
                        lf: Number(o.lf || 0),
                        lfUnit: o.lfUnit || 'per_bag',
                        isDispute: false,
                        isRevision: false
                    })}
                    style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10.5px', fontWeight: 'bold' }}
                >
                    Link Rate
                </button>
            ) : '-';

            const isFinalMatch = linkedPattiRate && 
                !linkedPattiRate.isDispute && !linkedPattiRate.isRevision &&
                Number(o.finalPrice || o.finalBaseRate || 0) === Number(linkedPattiRate.rate) &&
                (o.finalBaseRateType || o.baseRateType || 'PD_LOOSE') === (linkedPattiRate.rateType || 'PD_LOOSE') &&
                Number(o.finalSute || o.sute || 0) === Number(linkedPattiRate.sute || 0);

            const finalRowArray: any = [
                <span style={{ color: '#16a34a', fontWeight: 700 }}>Final Rate</span>,
                finalReporter,
                finalDate,
                <span style={{ fontWeight: 700 }}>Rs {toNumberText(o.finalPrice || o.finalBaseRate || 0, 0)}</span>,
                `${(o.finalBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`,
                `${toNumberText(o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(o.finalSuteUnit || o.suteUnit || 'per_ton')}`,
                o.moistureValue ? formatMeasurementText(o.moistureValue, '%') : '-',
                o.hamali ? `${formatFlexibleValue(o.hamali)} / ${formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}` : '-',
                o.brokerage ? `${formatFlexibleValue(o.brokerage)} / ${formatToggleUnitLabel(o.brokerageUnit || 'per_bag')}` : '-',
                o.lf ? `${formatFlexibleValue(o.lf)} / ${formatToggleUnitLabel(o.lfUnit || 'per_bag')}` : '-',
                formatUnitValueText(o.egbValue ?? 0, toTitleCase(o.egbType || 'Mill')),
                o.cdValue ? formatFlexibleValue(o.cdValue) : '-',
                o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(o.bankLoanValue)}` : '-',
                <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>,
                finalActionBtn
            ];

            if (isFinalMatch) {
                finalRowArray.isHighlighted = true;
            }

            rows.push(finalRowArray);
        }

        // Check for approved or pending dispute rates or revised Hamali/LF as separate entries
        const isPending = String((o as any).pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending';
        const pendingQueue = normalizePendingManagerApprovalQueue(o);
        const disputeVersions = Array.isArray((o as any).disputeVersions) ? (o as any).disputeVersions : [];

        // Track printed disputes and revisions so we don't duplicate approved ones
        let approvedDisputePrinted = false;
        let approvedRevisionPrinted = false;

        // Process pending queue requests
        if (pendingQueue.length > 0 && isPending) {
            pendingQueue.forEach((request: any, idx: number) => {
                const pendingData = request.data || {};
                const isDispute = pendingData.__requestType === 'dispute' || (pendingData.__requestType === undefined && pendingData.disputeBaseRate !== undefined && pendingData.disputeBaseRate !== null && pendingData.disputeBaseRate !== '');
                const isRevision = pendingData.__requestType === 'revision' || (pendingData.__requestType === undefined && ((pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '')
                    || (pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '')));

                if (!isDispute && !isRevision) return;

                const disputeReporter = getCollectorWithRole(request.requestedByName || o.updatedByFullName || o.createdByFullName || o.updatedBy || o.createdBy);
                const disputeDate = formatShortDateTime(request.requestedAt || (o as any).updatedAt || (o as any).createdAt) || '-';

                let rowLabel = '';
                if (isDispute) {
                    rowLabel = `Dispute Request (Pending)`;
                } else {
                    let targetLabel = '(Final)';
                    if (pendingData.revisedRateOption === 'dispute') {
                        const approvedDisputes = disputeVersions.filter((d: any) => d.type === 'dispute' || d.disputeBaseRate);
                        const pendingDisputes = pendingQueue.filter((req: any) => {
                            const pData = req.data || {};
                            return pData.__requestType === 'dispute' || (pData.__requestType === undefined && pData.disputeBaseRate !== undefined && pData.disputeBaseRate !== null && pData.disputeBaseRate !== '');
                        });

                        let linkedIdx = -1;
                        let isPendingMatch = false;

                        // 1. Try to find in approved disputes first
                        if (pendingData.__linkedDisputeRequestId) {
                            linkedIdx = approvedDisputes.findIndex((d: any) => String(d.id) === String(pendingData.__linkedDisputeRequestId));
                            if (linkedIdx === -1) {
                                // Try in pending disputes
                                linkedIdx = pendingDisputes.findIndex((req: any) => String(req.id) === String(pendingData.__linkedDisputeRequestId));
                                if (linkedIdx !== -1) {
                                    isPendingMatch = true;
                                }
                            }
                        }

                        // 2. Fallback matching by rate
                        if (linkedIdx === -1) {
                            const rateToMatch = pendingData.disputeBaseRate || o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0;
                            linkedIdx = approvedDisputes.findIndex((d: any) => Number(d.disputeBaseRate) === Number(rateToMatch));
                            if (linkedIdx === -1) {
                                linkedIdx = pendingDisputes.findIndex((req: any) => Number(req.data?.disputeBaseRate) === Number(rateToMatch));
                                if (linkedIdx !== -1) {
                                    isPendingMatch = true;
                                }
                            }
                        }

                        // 3. Fallback: single dispute
                        if (linkedIdx === -1 && (approvedDisputes.length + pendingDisputes.length === 1)) {
                            if (approvedDisputes.length === 1) {
                                linkedIdx = 0;
                            } else {
                                linkedIdx = 0;
                                isPendingMatch = true;
                            }
                        }

                        if (linkedIdx !== -1) {
                            const displayNum = isPendingMatch ? (approvedDisputes.length + linkedIdx + 1) : (linkedIdx + 1);
                            targetLabel = `(Dispute ${displayNum})`;
                        } else if (pendingData.__linkedDisputeLabel) {
                            targetLabel = `(${pendingData.__linkedDisputeLabel})`;
                        } else {
                            targetLabel = '(Dispute)';
                        }
                    }
                    rowLabel = `Revised HM/LF ${targetLabel} (Pending)`;
                }

                // Rate values
                let displayDisputeRate = 0;
                let displayDisputeType = '';

                if (isDispute) {
                    displayDisputeRate = pendingData.disputeBaseRate;
                    displayDisputeType = pendingData.disputeBaseRateType || o.baseRateType || 'PD/WB';
                } else {
                    if (pendingData.revisedRateOption === 'dispute') {
                        let linkedDispute: any = null;
                        if (pendingData.__linkedDisputeRequestId) {
                            linkedDispute = disputeVersions.find((d: any) => String(d.id) === String(pendingData.__linkedDisputeRequestId));
                            if (!linkedDispute) {
                                const pendingDisputes = pendingQueue.filter((req: any) => {
                                    const pData = req.data || {};
                                    return pData.__requestType === 'dispute' || (pData.__requestType === undefined && pData.disputeBaseRate !== undefined && pData.disputeBaseRate !== null && pData.disputeBaseRate !== '');
                                });
                                const matchedPending = pendingDisputes.find((req: any) => String(req.id) === String(pendingData.__linkedDisputeRequestId));
                                if (matchedPending) {
                                    linkedDispute = matchedPending.data;
                                }
                            }
                        }

                        if (linkedDispute) {
                            displayDisputeRate = linkedDispute.disputeBaseRate;
                            displayDisputeType = linkedDispute.disputeBaseRateType || o.baseRateType || 'PD/WB';
                        } else if (pendingData.__linkedDisputeLabel) {
                            // Extract rate from label like "Dispute 2000 (PD/WB)"
                            const labelMatch = String(pendingData.__linkedDisputeLabel).match(/(\d+(?:\.\d+)?)/);
                            if (labelMatch) {
                                displayDisputeRate = Number(labelMatch[1]);
                            } else {
                                displayDisputeRate = o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0;
                            }
                            const typeMatch = String(pendingData.__linkedDisputeLabel).match(/\(([^)]+)\)/);
                            displayDisputeType = (typeMatch ? typeMatch[1] : o.disputeBaseRateType || o.baseRateType || 'PD/WB');
                        } else {
                            displayDisputeRate = o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0;
                            displayDisputeType = o.disputeBaseRateType || o.baseRateType || 'PD/WB';
                        }
                    } else {
                        displayDisputeRate = o.finalPrice || o.finalBaseRate || 0;
                        displayDisputeType = o.finalBaseRateType || o.baseRateType || 'PD/WB';
                    }
                }

                // Hamali values
                const displayRevisedHamali = pendingData.revisedHamali !== undefined ? pendingData.revisedHamali : o.revisedHamali;
                const hasHamaliChanged = pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '';

                // LF values
                const displayRevisedLf = pendingData.revisedLf !== undefined ? pendingData.revisedLf : o.revisedLf;
                const hasLfChanged = pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '';

                rows.push([
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>{rowLabel}</span>,
                    disputeReporter,
                    disputeDate,
                    // RATE
                    isDispute ? (
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>Rs {formatFlexibleValue(displayDisputeRate)}</span>
                    ) : (
                        <span>Rs {formatFlexibleValue(displayDisputeRate)}</span>
                    ),
                    // RATE TYPE
                    isDispute ? (
                        <span style={{ color: '#dc2626' }}>{`${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ) : (
                        <span>{`${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ),
                    // SUTE
                    <span>{`${toNumberText(pendingData.finalSute !== undefined && pendingData.finalSute !== null ? pendingData.finalSute : (o.finalSute || o.sute || 0), 2)} / ${formatRateUnitLabel(pendingData.finalSuteUnit !== undefined && pendingData.finalSuteUnit !== null ? pendingData.finalSuteUnit : (o.finalSuteUnit || o.suteUnit || 'per_ton'))}`}</span>,
                    // MOISTURE
                    (pendingData.moistureValue !== undefined && pendingData.moistureValue !== null ? pendingData.moistureValue : o.moistureValue) ? formatMeasurementText(pendingData.moistureValue !== undefined && pendingData.moistureValue !== null ? pendingData.moistureValue : o.moistureValue, '%') : '-',
                    // HAMALI
                    hasHamaliChanged ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            {formatFlexibleValue(displayRevisedHamali)} / {formatToggleUnitLabel(pendingData.hamaliUnit || o.hamaliUnit || 'per_bag')}
                        </span>
                    ) : (
                        o.revisedHamali ? (
                            <span>{formatFlexibleValue(o.revisedHamali)} / {formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}</span>
                        ) : (
                            o.hamali ? `${formatFlexibleValue(o.hamali)} / ${formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}` : '-'
                        )
                    ),
                    // BROKERAGE
                    o.brokerage ? `${formatFlexibleValue(o.brokerage)} / ${formatToggleUnitLabel(o.brokerageUnit || 'per_bag')}` : '-',
                    // LF
                    hasLfChanged ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            {formatFlexibleValue(displayRevisedLf)} / {formatToggleUnitLabel(pendingData.lfUnit || o.lfUnit || 'per_bag')}
                        </span>
                    ) : (
                        o.revisedLf ? (
                            <span>{formatFlexibleValue(o.revisedLf)} / {formatToggleUnitLabel(o.lfUnit || 'per_bag')}</span>
                        ) : (
                            o.lf ? `${formatFlexibleValue(o.lf)} / ${formatToggleUnitLabel(o.lfUnit || 'per_bag')}` : '-'
                        )
                    ),
                    // EGB
                    formatUnitValueText(o.egbValue ?? 0, toTitleCase(o.egbType || 'Mill')),
                    // CD
                    o.cdValue ? formatFlexibleValue(o.cdValue) : '-',
                    // BANK LOAN
                    o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(o.bankLoanValue)}` : '-',
                    // PAYMENT
                    <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>,
                    pendingData.disputeReason || '-'
                ]);
            });
        }

        // Add approved disputes and revisions from history (disputeVersions)
        // In progressive mode (Paddy Approvals), build a time-ordered list of inspections that had hold→dispute flow
        // Each inspection with a stage that was on hold and later approved gets its lorry number and hold time
        const disputeLorriesByTime: Array<{ lorry: string; holdTime: number }> = [];
        if (progressiveMode && inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections)) {
            inspectionsProgress.previousInspections.forEach((insp: any) => {
                const lorry = String(insp.lorryNumber || '').trim().toUpperCase();
                if (!lorry || ['LOT_AVG', 'BALANCED_LOT'].includes(lorry) || lorry.includes('NEXT LOADING')) return;
                const stages = insp.samplingStages || {};
                Object.keys(stages).forEach((key: string) => {
                    const stage = stages[key];
                    if (stage && stage.holdAt) {
                        const holdTime = new Date(stage.holdAt).getTime();
                        if (Number.isFinite(holdTime)) {
                            disputeLorriesByTime.push({ lorry: String(insp.lorryNumber || '').trim().toUpperCase(), holdTime });
                        }
                    }
                });
            });
            // Sort by hold time ascending (oldest first)
            disputeLorriesByTime.sort((a, b) => a.holdTime - b.holdTime);
        }
        if (disputeVersions.length > 0) {
            let disputeCount = 0;
            let revisionCount = 0;

            disputeVersions.forEach((v: any) => {
                const isDispute = v.type === 'dispute' || (v.type === undefined && v.disputeBaseRate !== undefined && v.disputeBaseRate !== null && v.disputeBaseRate !== '');
                const isRevision = v.type === 'revision' || (v.type === undefined && ((v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '')
                    || (v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '')));

                if (!isDispute && !isRevision) return;

                let rowLabel = '';
                let disputeLorryNumber = '';
                if (isDispute) {
                    disputeCount++;
                    rowLabel = `Dispute ${disputeCount}`;
                    // In progressive mode, find the correct lorry for this dispute
                    if (progressiveMode && inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections)) {
                        // 1) Try direct match by inspectionId (for new disputes that store it)
                        if (v.inspectionId) {
                            const matchedInsp = inspectionsProgress.previousInspections.find(
                                (insp: any) => String(insp.id) === String(v.inspectionId)
                            );
                            if (matchedInsp && matchedInsp.lorryNumber) {
                                disputeLorryNumber = matchedInsp.lorryNumber;
                            }
                        }
                        // 2) Fallback: match by timing - find the inspection with the closest hold time to this dispute's approval
                        if (!disputeLorryNumber && disputeLorriesByTime.length > 0) {
                            const disputeTime = new Date(v.approvedAt || v.requestedAt || v.updatedAt || 0).getTime();
                            if (Number.isFinite(disputeTime) && disputeTime > 0) {
                                // Find the inspection whose hold time is closest to this dispute's time
                                let bestMatch: any = null;
                                let bestDiff = Infinity;
                                for (const entry of disputeLorriesByTime) {
                                    const diff = Math.abs(entry.holdTime - disputeTime);
                                    if (diff < bestDiff) {
                                        bestDiff = diff;
                                        bestMatch = entry;
                                    }
                                }
                                if (bestMatch) {
                                    disputeLorryNumber = bestMatch.lorry;
                                }
                            }
                        }
                    }
                } else if (isRevision) {
                    revisionCount++;
                    let targetLabel = '(Final)';
                    if (v.revisedRateOption === 'dispute') {
                        let displayDisputeRate = 0;
                        const linked = v.linkedDisputeRequestId
                            ? disputeVersions.find((d: any) => String(d.id) === String(v.linkedDisputeRequestId))
                            : null;
                        if (linked) {
                            displayDisputeRate = linked.disputeBaseRate;
                        } else {
                            displayDisputeRate = o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0;
                        }

                        const disputes = disputeVersions.filter((d: any) => d.type === 'dispute' || d.disputeBaseRate);
                        const rDate = new Date(v.approvedAt || v.requestedAt || v.updatedAt || 0).getTime();
                        
                        // Chronologically, the revision targets a dispute created at or before it
                        const eligibleDisputes = disputes.filter((d: any) => {
                            const dDate = new Date(d.approvedAt || d.requestedAt || d.updatedAt || 0).getTime();
                            return dDate <= rDate;
                        });

                        let linkedIdx = -1;
                        if (v.linkedDisputeRequestId) {
                            const matchedDispute = eligibleDisputes.find((d: any) => String(d.id) === String(v.linkedDisputeRequestId));
                            if (matchedDispute) {
                                linkedIdx = disputes.findIndex((d: any) => String(d.id) === String(matchedDispute.id));
                            }
                        }
                        if (linkedIdx === -1 && eligibleDisputes.length > 0) {
                            const lastEligible = eligibleDisputes[eligibleDisputes.length - 1];
                            linkedIdx = disputes.findIndex((d: any) => String(d.id) === String(lastEligible.id));
                        }
                        if (linkedIdx === -1) {
                            linkedIdx = disputes.findIndex((d: any) => Number(d.disputeBaseRate) === Number(displayDisputeRate));
                        }
                        if (linkedIdx === -1 && disputes.length === 1) {
                            linkedIdx = 0;
                        }

                        if (linkedIdx !== -1) {
                            targetLabel = `(Dispute ${linkedIdx + 1})`;
                        } else if (v.linkedDisputeLabel) {
                            targetLabel = `(${v.linkedDisputeLabel})`;
                        } else {
                            targetLabel = '(Dispute)';
                        }
                    }
                    rowLabel = `Revised HM/LF ${revisionCount} ${targetLabel}`;
                } else {
                    rowLabel = 'Approved Request';
                }

                const approvedReporter = getCollectorWithRole(v.approvedByName || v.updatedByFullName || o.updatedByFullName || o.createdByFullName || o.updatedBy || o.createdBy);
                const approvedDate = formatShortDateTime(v.approvedAt || v.updatedAt || (o as any).updatedAt || (o as any).createdAt) || '-';

                let displayDisputeRate = 0;
                let displayDisputeType = '';

                if (isDispute) {
                    displayDisputeRate = v.disputeBaseRate;
                    displayDisputeType = v.disputeBaseRateType || o.baseRateType || 'PD/WB';
                } else {
                    if (v.revisedRateOption === 'dispute') {
                        const linked = v.linkedDisputeRequestId
                            ? disputeVersions.find((d: any) => d.id === v.linkedDisputeRequestId)
                            : null;
                        if (linked) {
                            displayDisputeRate = linked.disputeBaseRate;
                            displayDisputeType = linked.disputeBaseRateType || o.baseRateType || 'PD/WB';
                        } else {
                            displayDisputeRate = o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0;
                            displayDisputeType = o.disputeBaseRateType || o.baseRateType || 'PD/WB';
                        }
                    } else {
                        displayDisputeRate = o.finalPrice || o.finalBaseRate || 0;
                        displayDisputeType = o.finalBaseRateType || o.baseRateType || 'PD/WB';
                    }
                }

                const linkedRev = isDispute
                    ? (v.linkedRevisionId 
                        ? disputeVersions.find((d: any) => d.type === 'revision' && d.id === v.linkedRevisionId)
                        : disputeVersions.find((d: any) => d.type === 'revision' && d.linkedDisputeRequestId === v.id)
                      )
                    : null;

                const hamaliVal = v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== ''
                    ? v.revisedHamali 
                    : (o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== '' ? o.revisedHamali : o.hamali);
                const hasHamali = (v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '') || (o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== '');
                const hamaliUnitVal = v.hamaliUnit || o.hamaliUnit || 'per_bag';

                const lfVal = v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== ''
                    ? v.revisedLf
                    : (o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== '' ? o.revisedLf : o.lf);
                const hasLf = (v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '') || (o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== '');
                const lfUnitVal = v.lfUnit || o.lfUnit || 'per_bag';

                const disputeActionBtn = showLinkAction ? (
                    <button
                        onClick={() => rateInfoAction({
                            rate: Number(displayDisputeRate || o.finalPrice || o.finalBaseRate || 0),
                            rateType: displayDisputeType || o.finalBaseRateType || o.baseRateType || 'PD_LOOSE',
                            sute: Number(v.finalSute !== undefined && v.finalSute !== null ? v.finalSute : (o.finalSute || o.sute || 0)),
                            suteUnit: v.finalSuteUnit !== undefined && v.finalSuteUnit !== null ? v.finalSuteUnit : (o.suteUnit || 'per_ton'),
                            moisture: Number(v.moistureValue !== undefined && v.moistureValue !== null ? v.moistureValue : (o.moistureValue || 0)),
                            hamali: Number(hamaliVal || 0),
                            hamaliUnit: hamaliUnitVal || 'per_bag',
                            lf: Number(lfVal || 0),
                            lfUnit: lfUnitVal || 'per_bag',
                            disputeReason: v.disputeReason || v.reason || '',
                            isDispute: Boolean(isDispute),
                            isRevision: Boolean(isRevision),
                            linkedRevisionId: isRevision ? (v.id || null) : null
                        })}
                        style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10.5px', fontWeight: 'bold' }}
                    >
                        Link Rate
                    </button>
                ) : (v.disputeReason || v.reason || '-');

                const rateToCompare = Number(displayDisputeRate || o.finalPrice || o.finalBaseRate || 0);
                const typeToCompare = displayDisputeType || o.finalBaseRateType || o.baseRateType || 'PD_LOOSE';
                const suteToCompare = Number(v.finalSute !== undefined && v.finalSute !== null ? v.finalSute : (o.finalSute || o.sute || 0));

                const isMatch = linkedPattiRate && 
                    Number(linkedPattiRate.rate) === rateToCompare &&
                    (linkedPattiRate.rateType || 'PD_LOOSE') === (typeToCompare || 'PD_LOOSE') &&
                    Number(linkedPattiRate.sute || 0) === suteToCompare &&
                    (isRevision
                        ? (linkedPattiRate.isRevision && Number(linkedPattiRate.hamali || 0) === Number(hamaliVal || 0) && Number(linkedPattiRate.lf || 0) === Number(lfVal || 0))
                        : (linkedPattiRate.isDispute && !linkedPattiRate.isRevision)
                    );

                const rowArray: any = [
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>
                        {rowLabel}
                        {disputeLorryNumber && progressiveMode ? (
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px', display: 'block' }}>
                                🚛 {disputeLorryNumber.toUpperCase()}
                            </span>
                        ) : null}
                    </span>,
                    approvedReporter,
                    approvedDate,
                    // RATE
                    isDispute ? (
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>Rs {formatFlexibleValue(displayDisputeRate)}</span>
                    ) : (
                        displayDisputeRate ? <span>Rs {formatFlexibleValue(displayDisputeRate)}</span> : '-'
                    ),
                    // RATE TYPE
                    isDispute ? (
                        <span style={{ color: '#16a34a' }}>{`${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(v.baseRateUnit || o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ) : (
                        displayDisputeType ? <span>{`${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(v.baseRateUnit || o.finalBaseRateUnit || o.baseRateUnit)}`}</span> : '-'
                    ),
                    // SUTE
                    (() => {
                        const baseSute = o.sute || 0;
                        const currentSute = v.finalSute !== undefined && v.finalSute !== null ? v.finalSute : baseSute;
                        const isSuteChanged = isDispute && v.finalSute !== undefined && v.finalSute !== null && Number(v.finalSute) !== Number(baseSute);
                        return (
                             <span style={isSuteChanged ? { color: '#16a34a', fontWeight: 700 } : undefined}>
                                 {`${toNumberText(currentSute, 2)} / ${formatRateUnitLabel(v.finalSuteUnit !== undefined && v.finalSuteUnit !== null ? v.finalSuteUnit : (o.suteUnit || 'per_ton'))}`}
                             </span>
                        );
                    })(),
                    // MOISTURE
                    (() => {
                        const baseMoisture = detailEntry.qualityParameters?.moisture || o.moistureValue;
                        const currentMoisture = v.moistureValue !== undefined && v.moistureValue !== null ? v.moistureValue : baseMoisture;
                        const isMoistureChanged = isDispute && v.moistureValue !== undefined && v.moistureValue !== null && Number(v.moistureValue) !== Number(baseMoisture);
                        return currentMoisture ? (
                             <span style={isMoistureChanged ? { color: '#16a34a', fontWeight: 700 } : undefined}>
                                 {formatMeasurementText(currentMoisture, '%')}
                             </span>
                        ) : '-';
                    })(),
                    // HAMALI
                    hasHamali ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {formatFlexibleValue(hamaliVal)} / {formatToggleUnitLabel(hamaliUnitVal)}
                        </span>
                    ) : (
                        o.hamali ? `${formatFlexibleValue(o.hamali)} / ${formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}` : '-'
                    ),
                    // BROKERAGE
                    o.brokerage ? `${formatFlexibleValue(o.brokerage)} / ${formatToggleUnitLabel(o.brokerageUnit || 'per_bag')}` : '-',
                    // LF
                    hasLf ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {formatFlexibleValue(lfVal)} / {formatToggleUnitLabel(lfUnitVal)}
                        </span>
                    ) : (
                        o.lf ? `${formatFlexibleValue(o.lf)} / ${formatToggleUnitLabel(o.lfUnit || 'per_bag')}` : '-'
                    ),
                    // EGB
                    formatUnitValueText(v.egbValue ?? o.egbValue ?? 0, toTitleCase(v.egbType || o.egbType || 'Mill')),
                    // CD
                    v.cdValue || o.cdValue ? formatFlexibleValue(v.cdValue || o.cdValue) : '-',
                    // BANK LOAN
                    v.bankLoanValue || o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(v.bankLoanValue || o.bankLoanValue)}` : '-',
                    // PAYMENT
                    <span style={{ fontWeight: 600 }}>{formatPaymentText(v.paymentConditionValue || o.paymentConditionValue || 15, v.paymentConditionUnit || o.paymentConditionUnit || 'Days')}</span>,
                    disputeActionBtn
                ];

                if (isMatch) {
                    rowArray.isHighlighted = true;
                }

                rows.push(rowArray);
            });
        } else {
            // Fallback: Add already approved dispute base rate if it exists in older single fields
            const hasApprovedDispute = o.disputeBaseRate !== undefined && o.disputeBaseRate !== null && o.disputeBaseRate !== '';
            const approvedDisputes = Array.isArray(o.disputeVersions)
                ? o.disputeVersions.filter((v: any) => v.type === 'dispute' || (v.disputeBaseRate !== undefined && v.disputeBaseRate !== null && v.disputeBaseRate !== ''))
                : [];
            const latestApprovedDispute = approvedDisputes[approvedDisputes.length - 1];

            if (hasApprovedDispute) {
                const disputeReporter = getCollectorWithRole(o.updatedByFullName || o.createdByFullName || o.updatedBy || o.createdBy);
                const disputeDate = formatShortDateTime((o as any).updatedAt || (o as any).createdAt) || '-';

                rows.push([
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Dispute Rate</span>,
                    disputeReporter,
                    disputeDate,
                    // RATE
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>Rs {formatFlexibleValue(o.disputeBaseRate)}</span>,
                    // RATE TYPE
                    <span style={{ color: '#16a34a' }}>{`${(o.disputeBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>,
                    // SUTE
                    <span>{`${toNumberText(o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(o.finalSuteUnit || o.suteUnit || 'per_ton')}`}</span>,
                    // MOISTURE
                    o.moistureValue ? formatMeasurementText(o.moistureValue, '%') : '-',
                    // HAMALI
                    o.revisedHamali ? (
                        <span>{formatFlexibleValue(o.revisedHamali)} / {formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}</span>
                    ) : (
                        o.hamali ? `${formatFlexibleValue(o.hamali)} / ${formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}` : '-'
                    ),
                    // BROKERAGE
                    o.brokerage ? `${formatFlexibleValue(o.brokerage)} / ${formatToggleUnitLabel(o.brokerageUnit || 'per_bag')}` : '-',
                    // LF
                    o.revisedLf ? (
                        <span>{formatFlexibleValue(o.revisedLf)} / {formatToggleUnitLabel(o.lfUnit || 'per_bag')}</span>
                    ) : (
                        o.lf ? `${formatFlexibleValue(o.lf)} / ${formatToggleUnitLabel(o.lfUnit || 'per_bag')}` : '-'
                    ),
                    // EGB
                    formatUnitValueText(o.egbValue ?? 0, toTitleCase(o.egbType || 'Mill')),
                    // CD
                    o.cdValue ? formatFlexibleValue(o.cdValue) : '-',
                    // BANK LOAN
                    o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(o.bankLoanValue)}` : '-',
                    // PAYMENT
                    <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>,
                    latestApprovedDispute?.disputeReason || o.disputeReason || '-'
                ]);
            }

            // Add already approved revised HM/LF if they exist and are not shown in approved dispute
            const hasApprovedRevision = 
                (o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== '' && Number(o.revisedHamali) !== Number(o.hamali))
                || (o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== '' && Number(o.revisedLf) !== Number(o.lf));
            const latestApprovedVersion = Array.isArray(o.disputeVersions) && o.disputeVersions.length > 0
                ? o.disputeVersions[o.disputeVersions.length - 1]
                : null;

            if (hasApprovedRevision && !hasApprovedDispute) {
                const disputeReporter = getCollectorWithRole(o.updatedByFullName || o.createdByFullName || o.updatedBy || o.createdBy);
                const disputeDate = formatShortDateTime((o as any).updatedAt || (o as any).createdAt) || '-';
                const targetLabel = o.revisedRateOption === 'dispute' ? '(Dispute)' : '(Final)';

                rows.push([
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Revised HM/LF {targetLabel}</span>,
                    disputeReporter,
                    disputeDate,
                    // RATE
                    o.disputeBaseRate ? (
                        <span>Rs {formatFlexibleValue(o.disputeBaseRate)}</span>
                    ) : (
                        <span>Rs {toNumberText(o.finalPrice || o.finalBaseRate || 0, 0)}</span>
                    ),
                    // RATE TYPE
                    o.disputeBaseRate ? (
                        <span>{`${(o.disputeBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ) : (
                        <span>{`${(o.finalBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ),
                    // SUTE
                    <span>{`${toNumberText(o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(o.finalSuteUnit || o.suteUnit || 'per_ton')}`}</span>,
                    // MOISTURE
                    o.moistureValue ? formatMeasurementText(o.moistureValue, '%') : '-',
                    // HAMALI
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatFlexibleValue(o.revisedHamali)} / {formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}
                    </span>,
                    // BROKERAGE
                    o.brokerage ? `${formatFlexibleValue(o.brokerage)} / ${formatToggleUnitLabel(o.brokerageUnit || 'per_bag')}` : '-',
                    // LF
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatFlexibleValue(o.revisedLf)} / {formatToggleUnitLabel(o.lfUnit || 'per_bag')}
                    </span>,
                    // EGB
                    formatUnitValueText(o.egbValue ?? 0, toTitleCase(o.egbType || 'Mill')),
                    // CD
                    o.cdValue ? formatFlexibleValue(o.cdValue) : '-',
                    // BANK LOAN
                    o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(o.bankLoanValue)}` : '-',
                    // PAYMENT
                    <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>,
                    latestApprovedVersion?.disputeReason || o.disputeReason || '-'
                ]);
            }
        }

        return rows;
    };

    const buildCookingStatusRows = (entry: SampleEntry) => {
        const cr = entry.cookingReport;
        const d = entry.lotSelectionDecision;
        const isCookingRecheckPending = (entry as any).cookingPending === true
            || ((entry as any).cookingPending == null && (entry as any).recheckRequested === true && (entry as any).recheckType === 'cooking');
        const isQualityOnlyRecheck = (entry as any).qualityPending === true && !isCookingRecheckPending;
        const hasResampleHistory = Boolean((entry as any)?.resampleStartAt)
            || Number((entry as any)?.qualityReportAttempts || 0) > 1
            || (Array.isArray((entry as any)?.resampleCollectedTimeline) && (entry as any).resampleCollectedTimeline.length > 0)
            || (Array.isArray((entry as any)?.resampleCollectedHistory) && (entry as any).resampleCollectedHistory.length > 0);
        const hasStoredCookingHistory = Array.isArray(cr?.history) && cr!.history.length > 0;

        if (d === 'PASS_WITHOUT_COOKING' && !hasResampleHistory && !hasStoredCookingHistory) {
            return [];
        }

        const toTs = (value: any) => {
            if (!value) return 0;
            const time = new Date(value).getTime();
            return Number.isFinite(time) ? time : 0;
        };

        const rows: Array<{ status: string; remarks: string; doneBy: string; doneDate: any; approvedBy: string; approvedDate: any; }> = [];
        
        // Inject original Pass Without Cooking row if this is a resample from that state
        if (String((entry as any)?.resampleOriginDecision || '').toUpperCase() === 'PASS_WITHOUT_COOKING') {
            rows.push({
                status: 'Pass Without Cooking',
                remarks: '',
                doneBy: 'NA',
                doneDate: null,
                approvedBy: 'NA',
                approvedDate: null
            });
        }

        const historyRaw = Array.isArray(cr?.history) ? cr!.history : [];
        const history = [...historyRaw].sort((a, b) => toTs((a as any)?.date || (a as any)?.updatedAt || (a as any)?.createdAt || '') - toTs((b as any)?.date || (b as any)?.updatedAt || (b as any)?.createdAt || ''));
        let pendingDone: { doneBy: string; doneDate: any; remarks: string } | null = null as { doneBy: string; doneDate: any; remarks: string } | null;

        history.forEach((h: any) => {
            const hasStatus = !!h?.status;
            const doneByValue = String(h?.cookingDoneBy || '').trim();
            const doneDateValue = h?.doneDate || h?.cookingDoneAt || h?.submittedAt || h?.date || null;

            if (!hasStatus && doneByValue) {
                pendingDone = {
                    doneBy: doneByValue,
                    doneDate: doneDateValue,
                    remarks: String(h?.remarks || '').trim()
                };
                return;
            }

            if (hasStatus) {
                rows.push({
                    status: normalizeCookingStatusLabel(h.status),
                    remarks: String(h?.remarks || '').trim(),
                    doneBy: pendingDone?.doneBy || doneByValue || String(cr?.cookingDoneBy || '').trim(),
                    doneDate: pendingDone?.doneDate || doneDateValue,
                    approvedBy: String(h?.approvedBy || h?.cookingApprovedBy || cr?.cookingApprovedBy || '').trim(),
                    approvedDate: h?.approvedDate || h?.cookingApprovedAt || h?.date || null
                });
                pendingDone = null;
            }
        });

        if (rows.length === 0 && cr?.status) {
            rows.push({
                status: normalizeCookingStatusLabel(cr.status),
                remarks: String(cr.remarks || '').trim(),
                doneBy: String(cr.cookingDoneBy || '').trim(),
                doneDate: (cr as any)?.doneDate || (cr as any)?.cookingDoneAt || (cr as any)?.date || cr.updatedAt || cr.createdAt || null,
                approvedBy: String(cr.cookingApprovedBy || '').trim(),
                approvedDate: (cr as any)?.approvedDate || (cr as any)?.cookingApprovedAt || (cr as any)?.date || cr.updatedAt || cr.createdAt || null
            });
        }

        if (entry.workflowStatus === 'CANCELLED') {
            return rows;
        }

        if (pendingDone) {
            rows.push({
                status: 'Pending',
                remarks: pendingDone.remarks,
                doneBy: pendingDone.doneBy,
                doneDate: pendingDone.doneDate,
                approvedBy: '',
                approvedDate: null
            });
        } else if (isCookingRecheckPending && !isQualityOnlyRecheck) {
            const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
            if (!lastRow || (lastRow.status !== 'Recheck' && lastRow.status !== 'Pending')) {
                rows.push({
                    status: 'Recheck',
                    remarks: String(cr?.remarks || '').trim(),
                    doneBy: '',
                    doneDate: null,
                    approvedBy: '',
                    approvedDate: null
                });
            }
        }

        return rows;
    };

    const cookingBadge = (entry: SampleEntry) => {
        if (entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING') {
            return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
        }

        const rows = buildCookingStatusRows(entry);
        const qualityAttempts = getQualityAttemptsForEntry(entry);
        const shouldPrefixPassWithoutCooking =
            String(entry.lotSelectionDecision || '').toUpperCase() === 'FAIL'
            && qualityAttempts.length > 1
            && rows.length === 1
            && rows[0]?.status !== 'Pass Without Cooking';
        const displayRows = shouldPrefixPassWithoutCooking
            ? [{ status: 'Pass Without Cooking', remarks: '', doneBy: '', doneDate: null, approvedBy: '', approvedDate: null }, ...rows]
            : rows;
        if (displayRows.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' }}>
                {displayRows.map((row, idx) => {
                    const style = getStatusStyle(row.status);
                    return (
                        <div key={`${entry.id}-cook-status-${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%' }}>
                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#334155' }}>
                                {getSamplingLabel(idx + 1)}
                            </span>
                            <span style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                                {row.status}
                            </span>
                            {row.remarks ? (
                                <button
                                    type="button"
                                    onClick={() => setRemarksPopup({ isOpen: true, text: row.remarks })}
                                    style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                                >
                                    Remarks
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    };







    if (!detailEntry) return null;

    return (
        <>
            {/* Detail Popup — same design as AdminSampleBook */}
            {
                detailEntry && (() => {
                    return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '12px 8px' }}
                        onClick={() => setDetailEntry(null)}>
                        <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '96vw', maxWidth: '1400px', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                            onClick={e => e.stopPropagation()}>
                            {/* Redesigned Header — Green Background, Aligned Items */}
                            <div style={{
                                background: detailEntry.entryType === 'DIRECT_LOADED_VEHICLE'
                                    ? '#1565c0'
                                    : detailEntry.entryType === 'LOCATION_SAMPLE'
                                        ? '#e67e22'
                                        : '#4caf50',
                                padding: '16px 20px', borderRadius: '8px 8px 0 0', color: 'white',
                                position: 'relative'
                            }}>
                                <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', opacity: 0.9, textAlign: 'left' }}>
                                        {new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'center' }}>
                                        {detailEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'Ready Lorry' : detailEntry.entryType === 'LOCATION_SAMPLE' ? 'Location Sample' : 'Mill Sample'}
                                    </div>
                                    <div></div>
                                </div>
                                <div style={{
                                    fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px', marginTop: '4px',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%'
                                }}>
                                    {toTitleCase(detailEntry.brokerName) || '-'}
                                </div>
                                <button onClick={() => setDetailEntry(null)} style={{
                                    position: 'absolute', top: '16px', right: '16px',
                                    background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '50%',
                                    width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px',
                                    color: 'white', fontWeight: '900', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}>✕</button>
                            </div>
                            <div style={{ padding: '20px', backgroundColor: '#fff', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', position: 'relative' }}>
                                {/* Basic Info Grid */}
                                <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px', maxWidth: '100%' }}>
                                    {[
                                        ['Date', new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                                        ['Total Bags', detailEntry.bags?.toLocaleString('en-IN')],
                                        ['Packaging', `${detailEntry.packaging || '75'} Kg`],
                                        ['Variety', toTitleCase(detailEntry.variety || '-')],
                                    ].map(([label, value], i) => (
                                        <div key={i} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                                            <div style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>{value || '-'}</div>
                                        </div>
                                    ))}
                                </div>
                                <div  className="responsive-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${
                                        3 + 
                                        (getPopupSmellSummary(detailEntry as any) ? 1 : 0) +
                                        (detailEntry.lotAllotment?.supervisor ? 1 : 0)
                                    }, 1fr)`,
                                    gap: '12px',
                                    marginBottom: '24px',
                                    maxWidth: '100%'
                                }}>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {detailEntry.entryType === 'DIRECT_LOADED_VEHICLE' || (detailEntry.partyName || '').toUpperCase() === 'DIRECT LOADED VEHICLE' ? 'Lorry Number' : 'Party Name'}
                                        </div>
                                        {(() => {
                                            const partyDisplay = getPartyDisplayParts(detailEntry);
                                            const partyName = toTitleCase(detailEntry.partyName || '').trim();
                                            const hasParty = partyName && partyName !== '-' && partyName.toUpperCase() !== 'DIRECT LOADED VEHICLE';
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                                                    {hasParty ? (
                                                        <span
                                                            onClick={async () => {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    const response = await axios.get<any>(`${API_URL}/sample-entries/by-role`, {
                                                                        params: {
                                                                            partyName: partyName,
                                                                            page: 1,
                                                                            pageSize: 100,
                                                                            excludeEntryType: 'RICE_SAMPLE'
                                                                        },
                                                                        headers: { Authorization: `Bearer ${token}` }
                                                                    });
                                                                    const entries = response.data.entries || [];
                                                                    toast.success(`Found ${entries.length} entries for party "${partyName}"`);
                                                                } catch (err) {
                                                                    console.error('Error fetching party entries:', err);
                                                                }
                                                            }}
                                                            style={{ fontSize: '17px', fontWeight: '700', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            title={`Click to view all entries for ${partyName}`}
                                                        >
                                                            {partyDisplay.label}
                                                        </span>
                                                    ) : (
                                                        <div style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {partyDisplay.label}
                                                            {partyDisplay.showLorrySecondLine ? (
                                                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1565c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    Lorry No: {' '}
                                                                    <span
                                                                        onClick={() => {
                                                                            const matched = inspectionsProgress?.previousInspections?.find(
                                                                                (i: any) => (i.lorryNumber || '').trim().toUpperCase() === (partyDisplay.lorryText || '').trim().toUpperCase()
                                                                            );
                                                                            if (matched) {
                                                                                setSelectedLorryForComparison(matched);
                                                                            } else {
                                                                                toast.error(`No multi-stage sampling records found for lorry ${partyDisplay.lorryText}`);
                                                                            }
                                                                        }}
                                                                        style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', fontWeight: '750' }}
                                                                        title="Click to view side-by-side stage comparison"
                                                                    >
                                                                        {partyDisplay.lorryText}
                                                                    </span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {partyDisplay.showLorrySecondLine && hasParty ? (
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1565c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            Lorry No: {' '}
                                                            <span
                                                                onClick={() => {
                                                                    const matched = inspectionsProgress?.previousInspections?.find(
                                                                        (i: any) => (i.lorryNumber || '').trim().toUpperCase() === (partyDisplay.lorryText || '').trim().toUpperCase()
                                                                    );
                                                                    if (matched) {
                                                                        setSelectedLorryForComparison(matched);
                                                                    } else {
                                                                        toast.error(`No multi-stage sampling records found for lorry ${partyDisplay.lorryText}`);
                                                                    }
                                                                }}
                                                                style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', fontWeight: '750' }}
                                                                title="Click to view side-by-side stage comparison"
                                                            >
                                                                {partyDisplay.lorryText}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
                                        {(() => {
                                            const locationName = toTitleCase(detailEntry.location || '').trim();
                                            const hasLocation = locationName && locationName !== '-';
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {hasLocation ? (
                                                        <span
                                                            onClick={async () => {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    const response = await axios.get<any>(`${API_URL}/sample-entries/by-role`, {
                                                                        params: {
                                                                            location: locationName,
                                                                            page: 1,
                                                                            pageSize: 100,
                                                                            excludeEntryType: 'RICE_SAMPLE'
                                                                        },
                                                                        headers: { Authorization: `Bearer ${token}` }
                                                                    });
                                                                    const entries = response.data.entries || [];
                                                                    toast.success(`Found ${entries.length} entries at location "${locationName}"`);
                                                                } catch (err) {
                                                                    console.error('Error fetching location entries:', err);
                                                                }
                                                            }}
                                                            style={{ fontSize: '17px', fontWeight: '700', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }}
                                                            title={`Click to view all entries at ${locationName}`}
                                                        >
                                                            {locationName}
                                                        </span>
                                                    ) : (
                                                        <div style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>{toTitleCase(detailEntry.location || '-')}</div>
                                                    )}
                                                    {detailEntry.entryType === 'LOCATION_SAMPLE' && (detailEntry as any).gpsCoordinates && (() => {
                                                        const gps = (detailEntry as any).gpsCoordinates;
                                                        const query = typeof gps === 'object' ? `${gps.lat},${gps.lng}` : gps;
                                                        return (
                                                            <a
                                                                href={buildMapHref(query)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title="View on Map"
                                                                style={{ fontSize: '14px', textDecoration: 'none' }}
                                                            >
                                                                📍
                                                            </a>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collected By</div>
                                        {(() => {
                                            const collectedByDisplay = getCollectedByDisplay(detailEntry);
                                            if (collectedByDisplay.secondary) {
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                                        {(() => {
                                                            const primaryLine = splitCollectedByLine(collectedByDisplay.primary);
                                                            return (
                                                                <span style={{ fontSize: '17px', fontWeight: '700' }}>
                                                                    <span style={{ color: collectedByDisplay.highlightPrimary ? '#9c27b0' : '#1e293b' }}>{primaryLine.text}</span>
                                                                    {primaryLine.accent ? <><span style={{ color: '#94a3b8' }}> | </span><span style={{ color: '#9c27b0' }}>{primaryLine.accent}</span></> : null}
                                                                </span>
                                                            );
                                                        })()}
                                                        <div style={{ borderTop: '1px solid #cbd5e1' }} />
                                                        {(() => {
                                                            const secondaryLine = splitCollectedByLine(collectedByDisplay.secondary);
                                                            return (
                                                                <span style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    <span style={{ color: collectedByDisplay.highlightSecondary ? '#9c27b0' : '#333' }}>{secondaryLine.text}</span>
                                                                    {secondaryLine.accent ? <><span style={{ color: '#94a3b8' }}> | </span><span style={{ color: '#9c27b0' }}>{secondaryLine.accent}</span></> : null}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            }
                                            return (
                                                (() => {
                                                    const primaryLine = splitCollectedByLine(collectedByDisplay.primary);
                                                    return (
                                                        <div style={{ fontSize: '17px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            <span style={{ color: collectedByDisplay.highlightPrimary ? '#9c27b0' : '#1e293b' }}>{primaryLine.text}</span>
                                                            {primaryLine.accent ? <><span style={{ color: '#94a3b8' }}> | </span><span style={{ color: '#9c27b0' }}>{primaryLine.accent}</span></> : null}
                                                        </div>
                                                    );
                                                })()
                                            );
                                        })()}
                                    </div>
                                    {detailEntry.lotAllotment?.supervisor && (
                                        <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #ffd8a8' }}>
                                            <div style={{ fontSize: '12px', color: '#e67e22', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allotted Loading Supervisor</div>
                                            <div style={{ fontSize: '17px', fontWeight: '700', color: '#ef6c00' }}>
                                                {toTitleCase(detailEntry.lotAllotment.supervisor.fullName || detailEntry.lotAllotment.supervisor.username)}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: getPopupSmellSummary(detailEntry as any) ? undefined : 'none' }}>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Smell</div>
                                        {(() => {
                                            const s = getPopupSmellSummary(detailEntry as any);
                                            if (!s) return null;
                                            return (
                                                <div style={{ fontSize: '17px', fontWeight: '800', color: s.tone }}>
                                                    {s.value} Smell
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* Standardized Horizontal Tables Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    {/* Quality Parameters */}
                                    <div style={{ position: 'sticky', top: '0', zIndex: 20, backgroundColor: '#ffffff', paddingBottom: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                        {renderHorizontalTable(
                                            'Quality Parameters', 
                                            '🔬', 
                                            '#f97316', 
                                                                        progressiveMode
                                                ? ['SAMPLE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', '', 'ACTIONS']
                                                : ['SAMPLE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', ''],
                                            buildInitialQualityRows(),
                                            { isQuality: true }
                                        )}
                                    </div>
                                    {/* BMB Inventory Quality Parameters */}
                                    {(detailEntry as any).isBandMalalBook && (detailEntry as any).inventoryQualityParameters && (detailEntry as any).inventoryQualityParameters.length > 0 && (
                                        <div style={{ marginTop: '8px' }}>
                                            {renderHorizontalTable(
                                                'Inventory Quality Parameters', 
                                                '🔬', 
                                                '#7c3aed', 
                                                ['TYPE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', 'STATUS'],
                                                buildBmbQualityRows(),
                                                { isQuality: true }
                                            )}
                                        </div>
                                    )}
                                    {/* Weight Bridge & Place Details for Band Mall Book */}
                                    {(detailEntry as any).isBandMalalBook && (() => {
                                        const hasPartyWb = !!((detailEntry as any).sampleEntry?.partyWbName || (detailEntry as any).partyWbName);
                                        return (
                                            <div style={{ display: 'grid', gridTemplateColumns: hasPartyWb ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                                {/* Mill Weight Bridge Card */}
                                                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1.5px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ fontSize: '13px', color: '#15803d', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>🏢</span> Mill Weight Bridge Details
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>WB Name</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).millWb?.name || '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>WB Number</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).wbNo || 'PENDING'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Gross Weight</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).grossWeight ? `${(detailEntry as any).grossWeight} Kg` : '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Tare Weight</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).tareWeight ? `${(detailEntry as any).tareWeight} Kg` : '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Net Weight</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).netWeight ? `${(detailEntry as any).netWeight} Kg` : '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>WB Status</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).wbStatus ? toTitleCase((detailEntry as any).wbStatus) : '-'}
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: 'span 2' }}>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Approved By</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).wbApprover?.username || (detailEntry as any).wbApprover?.fullName || '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Party Weight Bridge Card (Optional) */}
                                                {hasPartyWb && (
                                                    <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                        <div style={{ fontSize: '13px', color: '#1d4ed8', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>⚖️</span> Party Weight Bridge Details
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>WB Name</div>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                    {(detailEntry as any).sampleEntry?.partyWbName || (detailEntry as any).partyWbName || '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>WB Number</div>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                    {(detailEntry as any).sampleEntry?.wbNo || '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Gross Weight</div>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                    {(detailEntry as any).sampleEntry?.grossWeight ? `${(detailEntry as any).sampleEntry?.grossWeight} Kg` : '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Tare Weight</div>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                    {(detailEntry as any).sampleEntry?.tareWeight ? `${(detailEntry as any).sampleEntry?.tareWeight} Kg` : '-'}
                                                                </div>
                                                            </div>
                                                            <div style={{ gridColumn: 'span 2' }}>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Net Weight</div>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                    {(detailEntry as any).sampleEntry?.netWeight ? `${(detailEntry as any).sampleEntry?.netWeight} Kg` : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Place Card */}
                                                <div style={{ background: '#faf5ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #e9d5ff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ fontSize: '13px', color: '#6d28d9', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>📍</span> Place Details
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Destination Type</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).placeType === 'production' ? 'Production' : (detailEntry as any).placeType === 'kunchinittu' ? 'Kunchinittu' : '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Location Name</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(() => {
                                                                    if ((detailEntry as any).placeType === 'production' && (detailEntry as any).outturn) {
                                                                        return `Outturn: ${(detailEntry as any).outturn.code}`;
                                                                    } else if ((detailEntry as any).placeType === 'kunchinittu') {
                                                                        const kc = (detailEntry as any).placeKunchinittuData?.name || (detailEntry as any).toKunchinittu?.name || '';
                                                                        const wh = (detailEntry as any).placeWarehouse?.name || (detailEntry as any).toWarehouse?.name || '';
                                                                        return kc && wh ? `${kc} (${wh})` : (kc || wh || '-');
                                                                    }
                                                                    return '-';
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Place Status</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).placeStatus ? toTitleCase((detailEntry as any).placeStatus) : '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Approved By</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).placeApprover?.username || (detailEntry as any).placeApproverUser?.username || (detailEntry as any).placeApproverUser?.fullName || (detailEntry as any).placeApprover?.fullName || '-'}
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: 'span 2' }}>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Place Date</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                                                                {(detailEntry as any).placeDate ? new Date((detailEntry as any).placeDate).toLocaleDateString('en-GB') : '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Pricing & Patti - shown first for Completed Lots Pending Patti */}
                                    {!isStaff && completedLotsOrder && (() => {
                                        const callback = (targetLorryTripId && targetRateLinkAction) ? async (rateInfo: any) => {
                                            await targetRateLinkAction(rateInfo);
                                            await refreshProgressData();
                                        } : undefined;
                                        return renderHorizontalTable(
                                            'Price Details',
                                            '💰',
                                            '#2563eb',
                                            ['TYPE', 'REPORTED BY', 'REPORTED AT', 'RATE', 'RATE TYPE', 'SUTE', 'MOISTURE', 'HAMALI', 'BROKERAGE', 'LF', 'EGB', 'CD', 'BANK LOAN', 'PAYMENT', 'REMARKS'],
                                            buildPriceComparisonRows(callback)
                                        );
                                    })()}

                                    {/* Patti Rate Linking Details - for Completed Lots Pending Patti */}
                                    {!isStaff && completedLotsOrder && (() => {
                                        const rawInspections = inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections)
                                            ? inspectionsProgress.previousInspections
                                            : (Array.isArray((detailEntry as any).physicalInspections) ? (detailEntry as any).physicalInspections : []);

                                        const patti = detailEntry.offering || {};

                                        const inspections = rawInspections.filter((insp: any) => {
                                            const isPendingRate = patti?.pendingRateLinkingStatus === 'pending' && String(patti?.pendingRateLinkingData?.targetLorryTripId) === String(insp.id);
                                            return !!insp.linkedPattiRate || isPendingRate;
                                        });

                                        if (inspections.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <div style={{ marginTop: '16px' }}>
                                                <div style={{
                                                    backgroundColor: '#1a237e',
                                                    color: '#ffffff',
                                                    padding: '8px 12px',
                                                    fontWeight: '800',
                                                    fontSize: '12px',
                                                    borderTopLeftRadius: '6px',
                                                    borderTopRightRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span>📋</span> Patti Rate Linking Details
                                                </div>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SL NO</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>DATE</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'left', border: '1px solid #cbd5e1' }}>LORRY NUMBER</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BASE RATE</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SUTE</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>MOISTURE</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>HAMALI</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BROKERAGE</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>LF</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>EGB</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>CD</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BANK LOAN</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PAYMENT</th>
                                                                <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '75px' }}>STATUS</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {inspections.map((insp: any, idx: number) => {
                                                                const tripRate = insp.linkedPattiRate || null;
                                                                const isPendingRate = patti?.pendingRateLinkingStatus === 'pending' && String(patti?.pendingRateLinkingData?.targetLorryTripId) === String(insp.id);

                                                                const getPendingRateLabel = (p: any, pendingData: any) => {
                                                                    if (!pendingData) return 'Rate';
                                                                    const pendingRate = Number(pendingData.finalPrice || pendingData.finalBaseRate || pendingData.rateInfo?.rate || 0);
                                                                    const finalRate = Number(p.finalPrice || p.finalBaseRate || 0);
                                                                    const disputeVersions = Array.isArray(p.disputeVersions) ? p.disputeVersions : [];
                                                                    const isDispute = pendingData.rateInfo?.isDispute || pendingData.isDispute;
                                                                    const isRevision = pendingData.rateInfo?.isRevision || pendingData.isRevision;
                                                                    if (isDispute) {
                                                                        const matchedDisputeIdx = disputeVersions.findIndex((d: any) => Number(d.disputeBaseRate) === pendingRate);
                                                                        if (matchedDisputeIdx !== -1) return `Dispute ${matchedDisputeIdx + 1}`;
                                                                        return 'Dispute';
                                                                    }
                                                                    if (isRevision) return 'Revision';
                                                                    if (pendingRate === finalRate) return 'Final Rate';
                                                                    const offerVersions = Array.isArray(p.offerVersions) ? p.offerVersions : [];
                                                                    const matchedOfferIdx = offerVersions.findIndex((v: any) => Number(v.offerBaseRateValue || v.offeringPrice || 0) === pendingRate);
                                                                    if (matchedOfferIdx !== -1) return `Offer ${matchedOfferIdx + 1}`;
                                                                    return `Rs ${pendingRate}`;
                                                                };

                                                                const activeRateInfo = tripRate ? tripRate : (isPendingRate ? (patti.pendingRateLinkingData.rateInfo || patti.pendingRateLinkingData) : null);
                                                                const rRate = activeRateInfo?.rate;
                                                                const rRateType = activeRateInfo?.rateType || activeRateInfo?.baseRateType;
                                                                const rSute = activeRateInfo?.sute;
                                                                const rSuteUnit = activeRateInfo?.suteUnit;
                                                                const rMoisture = activeRateInfo?.moisture || activeRateInfo?.moistureValue;
                                                                const rHamali = activeRateInfo?.hamali;
                                                                const rHamaliUnit = activeRateInfo?.hamaliUnit;
                                                                const rLf = activeRateInfo?.lf;
                                                                const rLfUnit = activeRateInfo?.lfUnit;

                                                                return (
                                                                    <tr key={insp.id || idx} style={{
                                                                        borderBottom: '1px solid #cbd5e1',
                                                                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                                                                    }}>
                                                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('en-GB') : '-'}</td>
                                                                        <td style={{ padding: '8px', fontWeight: '700', border: '1px solid #cbd5e1' }}>{insp.lorryNumber?.toUpperCase() || '-'}</td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? `Rs ${toNumberText(rRate)} / ${(rRateType || 'PD/WB').replace(/_/g, '/')}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? `${toNumberText(rSute || 0)} / ${formatRateUnitLabel(rSuteUnit || 'per_ton')}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? `${rMoisture}%` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? `Rs ${formatFlexibleValue(rHamali)} / ${formatToggleUnitLabel(rHamaliUnit || 'per_bag')}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (patti.brokerage ? `Rs ${formatFlexibleValue(patti.brokerage)} / ${formatToggleUnitLabel(patti.brokerageUnit || 'per_bag')}` : '-') : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? `Rs ${formatFlexibleValue(rLf)} / ${formatToggleUnitLabel(rLfUnit || 'per_bag')}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (patti.egbValue ? `${formatFlexibleValue(patti.egbValue)} / ${toTitleCase(patti.egbType || 'Mill')}` : '-') : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (patti.cdEnabled && patti.cdValue ? `${formatFlexibleValue(patti.cdValue)} / ${formatToggleUnitLabel(patti.cdUnit || 'percentage')}` : '-') : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (patti.bankLoanEnabled && patti.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(patti.bankLoanValue)} / ${formatToggleUnitLabel(patti.bankLoanUnit || 'per_bag')}` : '-') : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {patti.paymentConditionValue ? `${patti.paymentConditionValue} ${patti.paymentConditionUnit === 'month' ? 'Month' : 'Days'}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                                                                            {isPendingRate ? (
                                                                                <span style={{ color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fef3c7', whiteSpace: 'nowrap' }}>
                                                                                    Pending ({getPendingRateLabel(patti, patti.pendingRateLinkingData)})
                                                                                </span>
                                                                            ) : tripRate ? (
                                                                                <span style={{ color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>Completed</span>
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Progressive Loads - for original progressiveMode (not completedLotsOrder) */}
                                    {!targetLorryTripId && progressiveMode && !completedLotsOrder && inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections) && (() => {
                                        const activeLorryNumber = (detailEntry as any).clickedLorryNumber || (detailEntry as any).lorryNumber || (detailEntry as any).sampleEntry?.lorryNumber;
                                        const insps = inspectionsProgress.previousInspections.filter((insp: any) => {
                                            if (!activeLorryNumber) return true;
                                            return (insp.lorryNumber || '').trim().toLowerCase() === activeLorryNumber.trim().toLowerCase();
                                        });
                                        if (insps.length === 0) return null;
                                        
                                        const renderTripTable = (insp: any, tripIdx: number) => {
                                            const isLorryNotAdded = !insp.lorryNumber || 
                                                ['LOT_AVG', 'BALANCED_LOT'].includes(insp.lorryNumber.toUpperCase().trim()) ||
                                                insp.lorryNumber.toLowerCase().includes('next loading lorry');
                                            const stages = insp.samplingStages || {};
                                            const bagsLoaded = getApprovedFullAvgBags(stages, insp.bags);
                                            const title = isLorryNotAdded
                                                ? <span style={{ color: 'white', fontWeight: 'bold' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                                                : tripIdx === 0
                                                    ? `Load 1 - Loading Sample Details : ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`
                                                    : `Load ${tripIdx + 1} - Lorry Number: ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`;
                                            const isNewRulesMode = inspectionsProgress?.samplingRulesMode === 'new' || detailEntry?.lotAllotment?.samplingRulesMode === 'new';
                                            return renderHorizontalTable(
                                                title,
                                                '🚚',
                                                isNewRulesMode ? '#2563eb' : '#f97316',
                                                ['STAGE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', 'P COLOR', 'ACTIONS'],
                                                buildTripQualityRows(insp, tripIdx),
                                                { isQuality: true }
                                            );
                                        };

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                                                {insps.map((insp, idx) => (
                                                    <div key={idx}>
                                                        {renderTripTable(insp, idx)}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Cooking History */}
                                    {!targetLorryTripId && (!progressiveMode || completedLotsOrder) && renderHorizontalTable(
                                        'Cooking History',
                                        '🍳',
                                        '#2563eb',
                                        ['SI', 'STATUS', 'DONE BY', 'APPROVED BY', 'REMARKS'],
                                        buildCookingRows(),
                                        { compact: true }
                                    )}

                                    {/* Progressive Loads (Lorry) - shown last in Completed Lots Pending Patti */}
                                    {!targetLorryTripId && progressiveMode && completedLotsOrder && inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections) && (() => {
                                        const activeLorryNumber = (detailEntry as any).clickedLorryNumber || (detailEntry as any).lorryNumber || (detailEntry as any).sampleEntry?.lorryNumber;
                                        const insps = inspectionsProgress.previousInspections.filter((insp: any) => {
                                            if (!activeLorryNumber) return true;
                                            return (insp.lorryNumber || '').trim().toLowerCase() === activeLorryNumber.trim().toLowerCase();
                                        });
                                        if (insps.length === 0) return null;
                                        
                                        const renderTripTable = (insp: any, tripIdx: number) => {
                                            const isLorryNotAdded = !insp.lorryNumber || 
                                                ['LOT_AVG', 'BALANCED_LOT'].includes(insp.lorryNumber.toUpperCase().trim()) ||
                                                insp.lorryNumber.toLowerCase().includes('next loading lorry');
                                            const stages = insp.samplingStages || {};
                                            const bagsLoaded = getApprovedFullAvgBags(stages, insp.bags);
                                            const title = isLorryNotAdded
                                                ? <span style={{ color: 'white', fontWeight: 'bold' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                                                : tripIdx === 0
                                                    ? `Load 1 - Loading Sample Details : ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`
                                                    : `Load ${tripIdx + 1} - Lorry Number: ${insp.lorryNumber?.toUpperCase() || 'Lorry'} | Bags Loaded: ${bagsLoaded}`;
                                            const isNewRulesMode = inspectionsProgress?.samplingRulesMode === 'new' || detailEntry?.lotAllotment?.samplingRulesMode === 'new';
                                            return renderHorizontalTable(
                                                title,
                                                '🚚',
                                                isNewRulesMode ? '#2563eb' : '#f97316',
                                                ['STAGE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', 'P COLOR', 'ACTIONS'],
                                                buildTripQualityRows(insp, tripIdx),
                                                { isQuality: true }
                                            );
                                        };

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                                                {insps.map((insp, idx) => (
                                                    <div key={idx}>
                                                        {renderTripTable(insp, idx)}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {targetLorryTripId && (() => {
                                        const allInspections: any[] = detailEntry.physicalInspections || (detailEntry as any).lotAllotment?.physicalInspections || [];
                                        const targetIdx = allInspections.findIndex((i: any) => String(i.id) === String(targetLorryTripId));
                                        const targetInsp = targetIdx !== -1 ? allInspections[targetIdx] : null;
                                        if (!targetInsp) return null;
                                        const lorryNo = targetInsp?.lorryNumber?.toUpperCase() || '';
                                        const bagsLoaded = targetInsp?.bags ?? '';
                                        const isValidLorry = lorryNo && lorryNo !== 'LOT_AVG' && lorryNo !== 'BALANCED_LOT';
                                        
                                        const stages = targetInsp.samplingStages || {};
                                        const findValue = (field: 'moisture' | 'cutting' | 'bend') => {
                                            const keys = ['balanced_lot', 'full_avg', 'half_lorry', 'lot_avg'];
                                            Object.keys(stages).forEach(k => {
                                                if (k.startsWith('nit_avg')) keys.push(k);
                                            });
                                            for (const key of keys) {
                                                const stg = stages[key];
                                                if (!stg) continue;
                                                if (field === 'moisture') {
                                                    if (stg.moistureRaw) return `${stg.moistureRaw}%`;
                                                    if (stg.moisture !== undefined && stg.moisture !== null && String(stg.moisture) !== '0') return `${stg.moisture}%`;
                                                } else if (field === 'cutting') {
                                                    if (stg.cutting1Raw) return `${stg.cutting1Raw}x${stg.cutting2Raw || 0}`;
                                                    if (stg.cutting1 !== undefined && stg.cutting1 !== null && String(stg.cutting1) !== '0') return `${stg.cutting1}x${stg.cutting2 || 0}`;
                                                } else if (field === 'bend') {
                                                    if (stg.bend1Raw) return `${stg.bend1Raw}x${stg.bend2Raw || 0}`;
                                                    if (stg.bend1 !== undefined && stg.bend1 !== null && String(stg.bend1) !== '0') return `${stg.bend1}x${stg.bend2 || 0}`;
                                                }
                                            }
                                            return '-';
                                        };

                                        const isNewRulesMode = inspectionsProgress?.samplingRulesMode === 'new' || detailEntry?.lotAllotment?.samplingRulesMode === 'new';

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                                                {/* Blue Lorry Header */}
                                                <div style={{
                                                    background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                                                    borderRadius: '8px',
                                                    padding: '12px 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    boxShadow: '0 2px 8px rgba(30,64,175,0.25)'
                                                }}>
                                                    <div style={{ fontSize: '22px' }}>🚛</div>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                                                            Linking Rate To Lorry
                                                        </div>
                                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.04em' }}>
                                                            {isValidLorry ? lorryNo : '—'}
                                                            {bagsLoaded !== '' && (
                                                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#bfdbfe', marginLeft: '10px' }}>
                                                                    ({bagsLoaded} bags)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Lorry Trip Details Table (matching outside display) */}
                                                 <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#fff', padding: '1px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                                                     <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center', border: '1px solid #000000' }}>
                                                         <thead>
                                                             <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #000000', height: '26px' }}>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Trip #</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Date</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Lorry No</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Bags</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Moisture</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Cutting</th>
                                                                 <th style={{ padding: '6px 4px', fontWeight: 800, color: '#495057', border: '1px solid #000000', textTransform: 'uppercase' }}>Bend</th>
                                                             </tr>
                                                         </thead>
                                                         <tbody>
                                                             <tr style={{ height: '32px' }}>
                                                                 <td style={{ padding: '6px 4px', color: '#1e293b', border: '1px solid #000000', fontWeight: 500 }}>{targetIdx + 1}</td>
                                                                 <td style={{ padding: '6px 4px', color: '#1e293b', border: '1px solid #000000', fontWeight: 500 }}>{new Date(targetInsp.inspectionDate).toLocaleDateString('en-GB')}</td>
                                                                 <td style={{ padding: '6px 4px', fontWeight: 700, color: '#1e40af', border: '1px solid #000000' }}>{lorryNo || '-'}</td>
                                                                 <td style={{ padding: '6px 4px', fontWeight: 700, color: '#1e293b', border: '1px solid #000000' }}>{getApprovedFullAvgBags(stages, targetInsp.bags)}</td>
                                                                 <td style={{ padding: '6px 4px', fontWeight: 700, color: '#0f766e', border: '1px solid #000000' }}>{findValue('moisture')}</td>
                                                                 <td style={{ padding: '6px 4px', fontWeight: 700, color: '#1e293b', border: '1px solid #000000' }}>{findValue('cutting')}</td>
                                                                 <td style={{ padding: '6px 4px', fontWeight: 700, color: '#1e293b', border: '1px solid #000000' }}>{findValue('bend')}</td>
                                                             </tr>
                                                         </tbody>
                                                     </table>
                                                 </div>

                                                {/* Quality Parameters Table */}
                                                <div>
                                                    {renderHorizontalTable(
                                                        `Lorry Trip ${targetIdx + 1} Quality Parameters`,
                                                        '🔬',
                                                        isNewRulesMode ? '#2563eb' : '#f97316',
                                                        ['STAGE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', 'P COLOR', 'ACTIONS'],
                                                        buildTripQualityRows(targetInsp, targetIdx),
                                                        { isQuality: true }
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Pricing & Offers - hidden for Completed Lots Pending Patti (shown earlier) */}
                                    {!isStaff && !completedLotsOrder && (() => {
                                        const callback = (targetLorryTripId && targetRateLinkAction) ? async (rateInfo: any) => {
                                            await targetRateLinkAction(rateInfo);
                                            await refreshProgressData();
                                        } : undefined;
                                        return renderHorizontalTable(
                                            'Price Details',
                                            '💰',
                                            '#2563eb',
                                            ['TYPE', 'REPORTED BY', 'REPORTED AT', 'RATE', 'RATE TYPE', 'SUTE', 'MOISTURE', 'HAMALI', 'BROKERAGE', 'LF', 'EGB', 'CD', 'BANK LOAN', 'PAYMENT', 'REMARKS'],
                                            buildPriceComparisonRows(callback)
                                        );
                                    })()}
                                </div>



                                {/* GPS & Photos for Location Sample */}
                                {!targetLorryTripId && detailEntry.entryType === 'LOCATION_SAMPLE' && (
                                    <>
                                        <h4 style={{ margin: '12px 0 10px', fontSize: '13px', color: '#e67e22', borderBottom: '2px solid #e67e22', paddingBottom: '6px' }}>📍 Location Details</h4>
                                        {localGps ? (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e0e0e0', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase' }}>GPS Coordinates Captured</div>
                                                    <a
                                                        href={buildMapHref(localGps)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: 'inline-block', padding: '6px 16px', background: '#e67e22', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}
                                                    >
                                                        MAP LINK
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '6px', border: '1px solid #ffedd5', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: '800', textTransform: 'uppercase' }}>GPS Location Skipped</div>
                                                    <button
                                                        onClick={handleCaptureAndSaveGps}
                                                        disabled={isCapturingGps || isSavingGps}
                                                        style={{ 
                                                            padding: '6px 16px', 
                                                            background: '#3498db', 
                                                            color: 'white', 
                                                            borderRadius: '4px', 
                                                            border: 'none',
                                                            fontSize: '11px', 
                                                            fontWeight: '800', 
                                                            cursor: 'pointer',
                                                            opacity: (isCapturingGps || isSavingGps) ? 0.7 : 1
                                                        }}
                                                    >
                                                        {isCapturingGps ? 'Capturing...' : isSavingGps ? 'Saving...' : 'Add GPS'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {(detailEntry as any).godownImageUrl && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>Godown Image</div>
                                                <a href={resolveMediaUrl((detailEntry as any).godownImageUrl)} target="_blank" rel="noopener noreferrer">
                                                    <img src={resolveMediaUrl((detailEntry as any).godownImageUrl)} alt="Godown" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid #e0e0e0' }} />
                                                </a>
                                            </div>
                                        )}
                                        {(detailEntry as any).paddyLotImageUrl && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', fontWeight: '600' }}>Paddy Lot Image</div>
                                                <a href={resolveMediaUrl((detailEntry as any).paddyLotImageUrl)} target="_blank" rel="noopener noreferrer">
                                                    <img src={resolveMediaUrl((detailEntry as any).paddyLotImageUrl)} alt="Paddy Lot" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid #e0e0e0' }} />
                                                </a>
                                            </div>
                                        )}
                                    </>
                                )}
                                                       {/* Patti Rate Linking Details - hidden for Completed Lots Pending Patti (shown earlier) */}
                                {!isStaff && !completedLotsOrder && (() => {
                                    const rawInspections = inspectionsProgress && Array.isArray(inspectionsProgress.previousInspections)
                                        ? inspectionsProgress.previousInspections
                                        : (Array.isArray((detailEntry as any).physicalInspections) ? (detailEntry as any).physicalInspections : []);
                                    
                                    const patti = detailEntry.offering || {};

                                    // Filter to linked trips or trips with pending rate linking requests
                                    const inspections = rawInspections.filter((insp: any) => {
                                        const isPendingRate = patti?.pendingRateLinkingStatus === 'pending' && String(patti?.pendingRateLinkingData?.targetLorryTripId) === String(insp.id);
                                        return !!insp.linkedPattiRate || isPendingRate;
                                    });

                                    // If not in rate linking flow (Party Name click), hide if no linked or pending trips
                                    if (!targetLorryTripId && inspections.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div style={{ marginTop: '16px' }}>
                                            <div style={{
                                                backgroundColor: '#1a237e',
                                                color: '#ffffff',
                                                padding: '8px 12px',
                                                fontWeight: '800',
                                                fontSize: '12px',
                                                borderTopLeftRadius: '6px',
                                                borderTopRightRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <span>📋</span> Patti Rate Linking Details
                                            </div>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                                                    <thead>
                                                        <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SL NO</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>DATE</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'left', border: '1px solid #cbd5e1' }}>LORRY NUMBER</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BASE RATE</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SUTE</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>MOISTURE</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>HAMALI</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BROKERAGE</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>LF</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>EGB</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>CD</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BANK LOAN</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PAYMENT</th>
                                                             <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '75px' }}>STATUS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {inspections.length > 0 ? (
                                                            inspections.map((insp: any, idx: number) => {
                                                                const tripRate = insp.linkedPattiRate || null;
                                                                const isCurrentTrip = targetLorryTripId && String(insp.id) === String(targetLorryTripId);
                                                                const isPendingRate = patti?.pendingRateLinkingStatus === 'pending' && String(patti?.pendingRateLinkingData?.targetLorryTripId) === String(insp.id);

                                                                const getPendingRateLabel = (p: any, pendingData: any) => {
                                                                    if (!pendingData) return 'Rate';
                                                                    const pendingRate = Number(pendingData.finalPrice || pendingData.finalBaseRate || pendingData.rateInfo?.rate || 0);
                                                                    const finalRate = Number(p.finalPrice || p.finalBaseRate || 0);
                                                                    
                                                                    const disputeVersions = Array.isArray(p.disputeVersions) ? p.disputeVersions : [];
                                                                    const isDispute = pendingData.rateInfo?.isDispute || pendingData.isDispute;
                                                                    const isRevision = pendingData.rateInfo?.isRevision || pendingData.isRevision;
                                                                    
                                                                    if (isDispute) {
                                                                        const matchedDisputeIdx = disputeVersions.findIndex((d: any) => Number(d.disputeBaseRate) === pendingRate);
                                                                        if (matchedDisputeIdx !== -1) return `Dispute ${matchedDisputeIdx + 1}`;
                                                                        return 'Dispute';
                                                                    }
                                                                    if (isRevision) return 'Revision';
                                                                    if (pendingRate === finalRate) return 'Final Rate';
                                                                    
                                                                    const offerVersions = Array.isArray(p.offerVersions) ? p.offerVersions : [];
                                                                    const matchedOfferIdx = offerVersions.findIndex((v: any) => Number(v.offerBaseRateValue || v.offeringPrice || 0) === pendingRate);
                                                                    if (matchedOfferIdx !== -1) return `Offer ${matchedOfferIdx + 1}`;
                                                                    
                                                                    return `Rs ${pendingRate}`;
                                                                };

                                                                const activeRateInfo = tripRate ? tripRate : (isPendingRate ? (patti.pendingRateLinkingData.rateInfo || patti.pendingRateLinkingData) : null);
                                                                const rRate = activeRateInfo?.rate;
                                                                const rRateType = activeRateInfo?.rateType || activeRateInfo?.baseRateType;
                                                                const rSute = activeRateInfo?.sute;
                                                                const rSuteUnit = activeRateInfo?.suteUnit;
                                                                const rMoisture = activeRateInfo?.moisture || activeRateInfo?.moistureValue;
                                                                const rHamali = activeRateInfo?.hamali;
                                                                const rHamaliUnit = activeRateInfo?.hamaliUnit;
                                                                const rLf = activeRateInfo?.lf;
                                                                const rLfUnit = activeRateInfo?.lfUnit;

                                                                return (
                                                                    <tr key={insp.id || idx} style={{ 
                                                                        borderBottom: '1px solid #cbd5e1', 
                                                                        backgroundColor: isCurrentTrip ? '#fef9c3' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                                                                        borderLeft: isCurrentTrip ? '4px solid #eab308' : 'none'
                                                                    }}>
                                                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('en-GB') : '-'}</td>
                                                                        <td style={{ padding: '8px', fontWeight: '700', border: '1px solid #cbd5e1' }}>{insp.lorryNumber?.toUpperCase() || '-'}</td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                `Rs ${toNumberText(rRate)} / ${(rRateType || 'PD/WB').replace(/_/g, '/')}`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                `${toNumberText(rSute || 0)} / ${formatRateUnitLabel(rSuteUnit || 'per_ton')}`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                `${rMoisture}%`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                `Rs ${formatFlexibleValue(rHamali)} / ${formatToggleUnitLabel(rHamaliUnit || 'per_bag')}`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                patti.brokerage ? `Rs ${formatFlexibleValue(patti.brokerage)} / ${formatToggleUnitLabel(patti.brokerageUnit || 'per_bag')}` : '-'
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                `Rs ${formatFlexibleValue(rLf)} / ${formatToggleUnitLabel(rLfUnit || 'per_bag')}`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                patti.egbValue ? `${formatFlexibleValue(patti.egbValue)} / ${toTitleCase(patti.egbType || 'Mill')}` : '-'
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                patti.cdEnabled && patti.cdValue ? `${formatFlexibleValue(patti.cdValue)} / ${formatToggleUnitLabel(patti.cdUnit || 'percentage')}` : '-'
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {activeRateInfo ? (
                                                                                patti.bankLoanEnabled && patti.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(patti.bankLoanValue)} / ${formatToggleUnitLabel(patti.bankLoanUnit || 'per_bag')}` : '-'
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                                                                            {patti.paymentConditionValue ? `${patti.paymentConditionValue} ${patti.paymentConditionUnit === 'month' ? 'Month' : 'Days'}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                                                                            {isPendingRate ? (
                                                                                <span style={{ color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fef3c7', whiteSpace: 'nowrap' }}>
                                                                                    Pending ({getPendingRateLabel(patti, patti.pendingRateLinkingData)})
                                                                                </span>
                                                                            ) : tripRate ? (
                                                                                <span style={{ color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>Completed</span>
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan={14} style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', border: '1px solid #cbd5e1' }}>
                                                                    No inspection lorry trips linked to this lot yet.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <button onClick={() => setDetailEntry(null)}
                                    style={{ marginTop: '16px', width: '100%', padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )})()
            }

            {pricingDetail && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        padding: '16px'
                    }}
                    onClick={() => setPricingDetail(null)}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '1200px',
                            borderRadius: '10px',
                            boxShadow: '0 16px 50px rgba(0,0,0,0.25)',
                            overflow: 'hidden',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ background: pricingDetail.mode === 'offer' ? '#1565c0' : '#2e7d32', color: '#fff', padding: '14px 18px' }}>
                            <div style={{ fontSize: '18px', fontWeight: '800' }}>
                                {pricingDetail.mode === 'offer' ? 'Offer Details' : 'Final Details'}
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '4px' }}>
                                {getPartyLabel(pricingDetail.entry)} | {toTitleCase(pricingDetail.entry.variety)} | {toTitleCase(pricingDetail.entry.location)}
                            </div>
                        </div>
                        <div style={{ padding: '16px 18px 18px', overflowY: 'auto' }}>
                            {pricingDetail.entry.offering ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {(() => {
                                        const offering = pricingDetail.entry.offering!;
                                        const versions = Array.isArray(offering.offerVersions) ? offering.offerVersions : [];
                                        const visibleVersions = pricingDetail.mode === 'offer'
                                            ? versions.filter((version: any) => version?.offerBaseRateValue || version?.offeringPrice)
                                            : versions.filter((version: any) => version?.finalPrice || version?.finalBaseRate);

                                        const getChargeText = (value?: number | null, unit?: string | null) => {
                                            if (value === null || value === undefined || Number(value) === 0) return '-';
                                            return `${toNumberText(value)} / ${formatToggleUnitLabel(unit || undefined)}`;
                                        };
                                        const getOfferRateText = (offInfo?: SampleEntry['offering']) => {
                                            if (!offInfo) return '-';
                                            const rateValue = offInfo.offerBaseRateValue ?? offInfo.offeringPrice;
                                            if (!rateValue) return '-';
                                            const typeText = offInfo.baseRateType ? offInfo.baseRateType.replace(/_/g, '/') : '-';
                                            return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offInfo.baseRateUnit || undefined)}`;
                                        };
                                        const getFinalRateText = (offInfo?: SampleEntry['offering']) => {
                                            if (!offInfo) return '-';
                                            const rateValue = offInfo.finalPrice ?? offInfo.finalBaseRate;
                                            if (!rateValue) return '-';
                                            const typeText = offInfo.baseRateType ? offInfo.baseRateType.replace(/_/g, '/') : '-';
                                            return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offInfo.baseRateUnit || undefined)}`;
                                        };
                                        const getOfferSlotLabel = (key?: string | null) => {
                                            const match = String(key || '').toUpperCase().match(/(\d+)/);
                                            return match ? `Offer ${match[1]}` : 'Offer';
                                        };
                                        const getPricingRows = (offInfo: NonNullable<SampleEntry['offering']>, mode: 'offer' | 'final') => {
                                            const isFinalMode = mode === 'final';
                                            const o = offInfo as any;
                                            const isPending = isFinalMode && String(o.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending';
                                            const pendingData = isPending ? (o.pendingManagerValueApprovalData || {}) : {};

                                            const suteValue = isFinalMode
                                                ? (pendingData.finalSute !== undefined ? pendingData.finalSute : offInfo.finalSute)
                                                : offInfo.sute;
                                            const suteUnit = isFinalMode
                                                ? (pendingData.finalSuteUnit !== undefined ? pendingData.finalSuteUnit : offInfo.finalSuteUnit)
                                                : offInfo.suteUnit;
                                            const moistureVal = isFinalMode
                                                ? (pendingData.moistureValue !== undefined ? pendingData.moistureValue : offInfo.moistureValue)
                                                : offInfo.moistureValue;

                                            const suteLabel = isFinalMode && pendingData.finalSute !== undefined ? 'Sute (Pending)' : 'Sute';
                                            const moistureLabel = isFinalMode && pendingData.moistureValue !== undefined ? 'Moisture (Pending)' : 'Moisture';

                                            const baseRows = [
                                                [isFinalMode ? 'Final Rate' : 'Offer Rate', isFinalMode ? getFinalRateText(offInfo) : getOfferRateText(offInfo)],
                                                [suteLabel, suteValue ? `${toNumberText(suteValue)} / ${formatRateUnitLabel(suteUnit || undefined)}` : '-'],
                                                [moistureLabel, moistureVal ? formatMeasurementText(moistureVal, '%') : '-'],
                                                ['Hamali', getChargeText(offInfo.hamali, offInfo.hamaliUnit)],
                                                ['Brokerage', getChargeText(offInfo.brokerage, offInfo.brokerageUnit)],
                                                ['LF', getChargeText(offInfo.lf, offInfo.lfUnit)],
                                                ['EGB', offInfo.egbType === 'mill' ? '0 / Mill' : offInfo.egbType === 'purchase' && offInfo.egbValue !== undefined && offInfo.egbValue !== null ? `${toNumberText(offInfo.egbValue)} / Purchase` : '-'],
                                                ['CD', offInfo.cdEnabled ? offInfo.cdValue ? `${toNumberText(offInfo.cdValue)} / ${formatToggleUnitLabel(offInfo.cdUnit)}` : 'Pending' : '-'],
                                                ['Bank Loan', offInfo.bankLoanEnabled ? offInfo.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(offInfo.bankLoanValue)} / ${formatToggleUnitLabel(offInfo.bankLoanUnit)}` : 'Pending' : '-'],
                                                ['Payment', offInfo.paymentConditionValue ? formatPaymentText(offInfo.paymentConditionValue, offInfo.paymentConditionUnit) : '-']
                                            ];

                                            if (isFinalMode) {
                                                const o = offInfo as any;
                                                const isPending = String(o.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending';
                                                const pendingData = o.pendingManagerValueApprovalData || {};

                                                // Dispute Rate
                                                const hasDispute = (o.disputeBaseRate !== undefined && o.disputeBaseRate !== null && o.disputeBaseRate !== '')
                                                    || (isPending && pendingData.disputeBaseRate !== undefined && pendingData.disputeBaseRate !== null && pendingData.disputeBaseRate !== '');
                                                const displayDisputeRate = o.disputeBaseRate !== undefined && o.disputeBaseRate !== null && o.disputeBaseRate !== ''
                                                    ? o.disputeBaseRate
                                                    : pendingData.disputeBaseRate;
                                                const displayDisputeType = o.disputeBaseRate !== undefined && o.disputeBaseRate !== null && o.disputeBaseRate !== ''
                                                    ? (o.disputeBaseRateType || o.baseRateType || 'PD/WB')
                                                    : (pendingData.disputeBaseRateType || o.baseRateType || 'PD/WB');
                                                const disputeLabel = o.disputeBaseRate !== undefined && o.disputeBaseRate !== null && o.disputeBaseRate !== ''
                                                    ? 'Dispute Rate'
                                                    : 'Dispute Rate (Pending)';

                                                if (hasDispute) {
                                                    baseRows.push([
                                                        disputeLabel,
                                                        `Rs ${formatFlexibleValue(displayDisputeRate)} / ${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`
                                                    ]);
                                                }

                                                // Revised Hamali
                                                const hasRevHamali = (o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== '')
                                                    || (isPending && pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '');
                                                const displayRevHamali = o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== ''
                                                    ? o.revisedHamali
                                                    : pendingData.revisedHamali;
                                                const revHamaliLabel = o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== ''
                                                    ? 'Revised Hamali'
                                                    : 'Revised Hamali (Pending)';

                                                if (hasRevHamali) {
                                                    baseRows.push([
                                                        revHamaliLabel,
                                                        `${formatFlexibleValue(displayRevHamali)} / ${formatToggleUnitLabel(o.hamaliUnit || pendingData.hamaliUnit || 'per_bag')}`
                                                    ]);
                                                }

                                                // Revised LF
                                                const hasRevLf = (o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== '')
                                                    || (isPending && pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '');
                                                const displayRevLf = o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== ''
                                                    ? o.revisedLf
                                                    : pendingData.revisedLf;
                                                const revLfLabel = o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== ''
                                                    ? 'Revised LF'
                                                    : 'Revised LF (Pending)';

                                                if (hasRevLf) {
                                                    baseRows.push([
                                                        revLfLabel,
                                                        `${formatFlexibleValue(displayRevLf)} / ${formatToggleUnitLabel(o.lfUnit || pendingData.lfUnit || 'per_bag')}`
                                                    ]);
                                                }
                                            }
                                            return baseRows;
                                        };

                                        const renderGrid = (rows: any[], keyPrefix: string) => (
                                            <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                                                {rows.map(([label, value]) => (
                                                    <div key={`${keyPrefix}-${String(label)}`} style={{ background: '#f8f9fa', border: '1px solid #dfe3e8', borderRadius: '8px', padding: '10px 12px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#5f6368', marginBottom: '4px' }}>{label}</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937' }}>{value as string}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        );

                                        if (visibleVersions.length === 0) {
                                            return renderGrid(getPricingRows(offering, pricingDetail.mode), 'current');
                                        }

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {[...visibleVersions].sort((left: any, right: any) => {
                                                    const getOfferIndex = (key: string) => {
                                                        const match = String(key || '').match(/\d+/);
                                                        return match ? parseInt(match[0], 10) : 0;
                                                    };
                                                    return getOfferIndex(right.key) - getOfferIndex(left.key);
                                                }).map((version: any, versionIndex: number) => {
                                                    const pricingVersion = pricingDetail.mode === 'offer'
                                                        ? {
                                                            ...offering,
                                                            offerBaseRateValue: version.offerBaseRateValue,
                                                            offeringPrice: version.offeringPrice,
                                                            baseRateType: version.baseRateType || offering.baseRateType,
                                                            baseRateUnit: version.baseRateUnit || offering.baseRateUnit,
                                                            moistureValue: version.moistureValue ?? offering.moistureValue,
                                                            hamali: version.hamali ?? offering.hamali,
                                                            hamaliUnit: version.hamaliUnit || offering.hamaliUnit,
                                                            brokerage: version.brokerage ?? offering.brokerage,
                                                            brokerageUnit: version.brokerageUnit || offering.brokerageUnit,
                                                            lf: version.lf ?? offering.lf,
                                                            lfUnit: version.lfUnit || offering.lfUnit,
                                                            egbValue: version.egbValue ?? offering.egbValue,
                                                            egbType: version.egbType || offering.egbType,
                                                            cdValue: version.cdValue ?? offering.cdValue,
                                                            cdUnit: version.cdUnit || offering.cdUnit,
                                                            bankLoanValue: version.bankLoanValue ?? offering.bankLoanValue,
                                                            bankLoanUnit: version.bankLoanUnit || offering.bankLoanUnit,
                                                            paymentConditionValue: version.paymentConditionValue ?? offering.paymentConditionValue,
                                                            paymentConditionUnit: version.paymentConditionUnit || offering.paymentConditionUnit
                                                        }
                                                        : {
                                                            ...offering,
                                                            finalPrice: version.finalPrice,
                                                            finalBaseRate: version.finalBaseRate,
                                                            finalBaseRateType: version.baseRateType || offering.finalBaseRateType || offering.baseRateType,
                                                            finalBaseRateUnit: version.baseRateUnit || offering.finalBaseRateUnit || offering.baseRateUnit
                                                        };
                                                    return (
                                                        <div key={`${String(version.key || 'version')}-${versionIndex}`} style={{ border: '1px solid #dfe3e8', borderRadius: '10px', padding: '12px', background: '#fff', minWidth: 0 }}>
                                                            <div style={{ fontSize: '12px', fontWeight: '800', color: pricingDetail.mode === 'offer' ? '#1565c0' : '#2e7d32', marginBottom: '10px' }}>
                                                                {pricingDetail.mode === 'offer' ? getOfferSlotLabel(version.key) : (version.key ? `${getOfferSlotLabel(version.key)} Final` : 'Final')}
                                                            </div>
                                                            {renderGrid(getPricingRows(pricingVersion as NonNullable<SampleEntry['offering']>, pricingDetail.mode), `${String(version.key || 'version')}-${versionIndex}`)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div style={{ color: '#999', textAlign: 'center', padding: '12px' }}>No pricing data</div>
                            )}
                            <button
                                onClick={() => setPricingDetail(null)}
                                style={{
                                    marginTop: '16px',
                                    width: '100%',
                                    padding: '9px',
                                    backgroundColor: pricingDetail.mode === 'offer' ? '#1565c0' : '#2e7d32',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {remarksPopup.isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 20000,
                        padding: '16px'
                    }}
                    onClick={() => setRemarksPopup({ isOpen: false, text: '' })}
                >
                    <div
                        style={{ background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '10px', boxShadow: '0 16px 50px rgba(0,0,0,0.25)', padding: '16px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#1f2937', marginBottom: '10px' }}>Remarks</div>
                        <div style={{ fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px' }}>
                            {remarksPopup.text || '-'}
                        </div>
                        <button
                            onClick={() => setRemarksPopup({ isOpen: false, text: '' })}
                            style={{ marginTop: '12px', width: '100%', padding: '9px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {selectedLorryForComparison && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 25000,
                        padding: '16px'
                    }}
                    onClick={() => setSelectedLorryForComparison(null)}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '1200px',
                            borderRadius: '10px',
                            boxShadow: '0 16px 50px rgba(0,0,0,0.25)',
                            overflow: 'hidden',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ background: '#1565c0', color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: '800' }}>
                                    {selectedLorryForComparison.singleLorryMode ? 'Lorry Sampling Stage Comparison' : 'Lorry Progressive Inspection Trips & Comparison'}
                                </div>
                                <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '4px' }}>
                                    {selectedLorryForComparison.singleLorryMode ? (
                                        `Lorry Number: ${selectedLorryForComparison.lorryNumber?.toUpperCase()}`
                                    ) : (
                                        `Party Name: ${selectedLorryForComparison.partyName || 'Direct'} | Variety: ${selectedLorryForComparison.variety} | Allotted: ${selectedLorryForComparison.totalBags} Bags | Inspected: ${selectedLorryForComparison.inspectedBags} Bags`
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLorryForComparison(null)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '30px',
                                    height: '30px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: '16px 18px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {selectedLorryForComparison.previousInspections && selectedLorryForComparison.previousInspections.map((inspection: any, idx: number) => {
                                const stages = inspection.samplingStages || {};
                                const lot = stages.lot_avg || {};
                                const balanced = stages.balanced_lot || {};
                                const half = stages.half_lorry || {};
                                const full = stages.full_avg || {};
                                const nit = stages.nit_avg || {};

                                const formatField = (val: any) => {
                                    if (val === null || val === undefined || val === '') return '-';
                                    return String(val);
                                };

                                const formatMoisture = (stageObj: any) => {
                                    const raw = stageObj.moistureRaw;
                                    const val = stageObj.moisture;
                                    if (raw) return `${raw}%`;
                                    if (val !== undefined && val !== null) return `${val}%`;
                                    return '-';
                                };

                                const formatCutting = (stageObj: any) => {
                                    if (stageObj.cutting1 === undefined || stageObj.cutting1 === null) return '-';
                                    return `${stageObj.cutting1}x${stageObj.cutting2 || 0}`;
                                };

                                const formatBend = (stageObj: any) => {
                                    if (stageObj.bend1 === undefined || stageObj.bend1 === null) return '-';
                                    return `${stageObj.bend1}x${stageObj.bend2 || 0}`;
                                };

                                const renderRow = (name: string, color: string, bgColor: string, stageObj: any, isFull: boolean) => {
                                    const rowHasSmell = stageObj.smellHas === true || String(stageObj.smellHas).trim().toUpperCase() === 'YES';
    const smellTypeNormalized = String(stageObj.smellType || '').trim().toUpperCase();
    const isDarkSmell = rowHasSmell && smellTypeNormalized === 'DARK';
    const isMediumSmell = rowHasSmell && smellTypeNormalized === 'MEDIUM';
    const isLightSmell = rowHasSmell && smellTypeNormalized === 'LIGHT';

    const finalRowBg = isDarkSmell ? '#b91c1c' : (isMediumSmell ? '#fca5a5' : (isLightSmell ? '#fee2e2' : (rowHasSmell ? '#ffebee' : bgColor)));
    const finalTextColor = isDarkSmell ? '#ffffff' : '#1a1a1a';
    const finalKadigaColor = isDarkSmell ? '#ffffff' : '#7c2d12';
                                    const isKadiga = stageObj.kadiga === 'Y' || stageObj.kadiga === 'Yes' || stageObj.kadiga === true || stageObj.kadiga === 'true';
                                    const hasPaddyWb = !!stageObj.paddyWbEnabled;
                                    const hasDiscolor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                                    return (
                                        <tr key={name} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: finalRowBg }}>
                                            <td style={{ padding: '8px 10px', fontWeight: '800', color: isDarkSmell ? '#ffffff' : color }}>
                                                 {name}
                                                 {stageObj?.isEdited && <span style={{ color: '#d97706', fontSize: '9.5px', fontWeight: '900' }}> (Edited)</span>}
                                             </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>
                                                <div>{formatField(stageObj.reportedBy)}</div>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>
                                                {stageObj.reportedAt ? (new Date(stageObj.reportedAt).toLocaleDateString('en-GB') + ', ' + new Date(stageObj.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()) : '-'}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '600' }}>{formatMoisture(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{formatCutting(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{formatBend(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '55px' }}>{(() => { const v = stageObj.grainsCountRaw || stageObj.grainsCount; return (v !== null && v !== undefined && v !== '') ? `(${v})` : '-'; })()}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.mixRaw || stageObj.mix)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{stageObj.smixEnabled ? formatField(stageObj.mixSRaw || stageObj.mixS) || 'Yes' : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{stageObj.lmixEnabled ? formatField(stageObj.mixLRaw || stageObj.mixL) || 'Yes' : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.kanduRaw || stageObj.kandu)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.oilRaw || stageObj.oil)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.skRaw || stageObj.sk)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>{renderBeautifulSmell(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '50px' }}>
                                                {hasPaddyWb ? formatField(stageObj.paddyWbRaw || stageObj.paddyWb) : '-'}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalKadigaColor, fontWeight: '700', width: '50px' }}>
                                                {(() => {
                                                    const hasColor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                                                    const hasKadiga = isKadiga;
                                                    if (!hasColor && !hasKadiga) return '-';
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            {hasColor && <span>{formatField(stageObj.paddyColor)}</span>}
                                                            {hasColor && hasKadiga && <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />}
                                                            {hasKadiga && <span>ಕಡಿಗಾ: Yes</span>}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>{isFull ? formatField(inspection.bags) : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>
                                                {(() => {
                                                    const status = stageObj.approvalStatus || 'approved';
                                                    const isSkipped = stageObj.isSkipped || status === 'skipped';
                                                    if (isSkipped) {
                                                        return <span style={{ color: '#7f8c8d' }}>Skipped</span>;
                                                    }
                                                    if (status === 'hold' || status === 'superseded') {
                                                        return <span style={{ color: '#d97706' }}>Hold</span>;
                                                    }
                                                    if (status === 'pending') {
                                                        return <span style={{ color: '#2563eb' }}>Pending</span>;
                                                    }
                                                    return <span style={{ color: '#16a34a' }}>Approved</span>;
                                                })()}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                                            </td>
                                        </tr>
                                    );
                                };

                                const isLorryNotAdded = !inspection.lorryNumber || 
                                     ['LOT_AVG', 'BALANCED_LOT'].includes(inspection.lorryNumber.toUpperCase().trim()) ||
                                     inspection.lorryNumber.toLowerCase().includes('next loading lorry');

                                return (
                                    <div key={inspection.id} style={{ border: '1px solid #f2cfb6', borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>
                                                {isLorryNotAdded ? (
                                                    <span style={{ color: '#ffcccc', fontWeight: '900' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                                                ) : (
                                                    <>Load {selectedLorryForComparison.loadNumber || (idx + 1)} | Lorry No: {inspection.lorryNumber?.toUpperCase()}</>
                                                )}
                                                {` | Bags Loaded: ${inspection.bags || '-'}`}
                                            </span>
                                            <span>Reported By: {inspection.reportedBy?.username || 'System'} | Date: {new Date(inspection.inspectionDate).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #f2cfb6' }}>
                                                <thead>
                                                    <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'left', border: '1px solid #cbd5e1' }}>SAMPLE / STAGE</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>REPORTED BY</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>REPORTED AT</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>MOISTURE</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>CUTTING</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>BEND</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>GRAINS</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>S MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>L MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>KANDU</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>OIL</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>SK</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '50px' }}>SMELL</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '50px' }}>PADDY WB</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '50px' }}>P COLOR</th>
                                                        
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>LOADED BAGS</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '80px' }}>STATUS</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PHOTO</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const stageKeys = Object.keys(stages)
                                                            .filter(key => stages[key] && stages[key].reportedBy)
                                                            .sort((a, b) => {
                                                                const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || stages[a].updatedAt || 0).getTime();
                                                                const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || stages[b].updatedAt || 0).getTime();
                                                                return timeA - timeB;
                                                            });
                                                        return stageKeys.map((key) => {
                                                            const stageObj = stages[key];
                                                            let name = '';
                                                            let color = '#333';
                                                            let bgColor = '#fff';
                                                            let isFull = false;

                                                            if (key === 'lot_avg') {
                                                                name = 'Lot Avg';
                                                                color = '#000000';
                                                                bgColor = '#ffffff';
                                                            } else if (key.startsWith('lot_avg_hold')) {
                                                                name = 'Lot Avg (Hold)';
                                                                color = '#d97706';
                                                                bgColor = '#fffbeb';
                                                            } else if (key.startsWith('nit_avg')) {
                                                                name = getNitAvgLabel(stageObj.nit || '');
                                                                color = '#000000';
                                                                bgColor = '#ffffff';
                                                            } else if (key === 'half_lorry') {
                                                                name = 'Half Lorry';
                                                                color = '#000000';
                                                                bgColor = '#ffffff';
                                                            } else if (key.startsWith('half_lorry_hold')) {
                                                                name = 'Half Lorry (Hold)';
                                                                color = '#d97706';
                                                                bgColor = '#fffbeb';
                                                            } else if (key === 'full_avg') {
                                                                name = 'Full Avg Lorry';
                                                                color = '#000000';
                                                                bgColor = '#ffffff';
                                                                isFull = true;
                                                            } else if (key.startsWith('full_avg_hold')) {
                                                                name = 'Full Avg Lorry (Hold)';
                                                                color = '#d97706';
                                                                bgColor = '#fffbeb';
                                                                isFull = true;
                                                            } else if (key === 'balanced_lot') {
                                                                name = 'Balanced Lot';
                                                                color = '#000000';
                                                                bgColor = '#ffffff';
                                                            } else if (key.startsWith('balanced_lot_hold')) {
                                                                name = 'Balanced Lot (Hold)';
                                                                color = '#d97706';
                                                                bgColor = '#fffbeb';
                                                            } else {
                                                                name = key;
                                                            }

                                                            return renderRow(name, color, bgColor, stageObj, isFull);
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => setSelectedLorryForComparison(null)}
                                style={{ marginTop: '16px', width: '100%', padding: '9px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {disputeModalData.isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        width: '380px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                        {/* Header Details */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#dc2626' }}>
                                Dispute Rate — {detailEntry.brokerName} / {detailEntry.partyName}
                            </h3>
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                padding: '6px 10px',
                                fontSize: '11px',
                                color: '#475569'
                            }}>
                                Bags: <b>{detailEntry.bags}</b> | Variety: <b>{detailEntry.variety}</b> | Location: <b>{detailEntry.location}</b>
                            </div>
                        </div>

                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Dispute Rate */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Dispute Rate
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={disputeModalData.disputeRate}
                                    onChange={(e) => setDisputeModalData({ ...disputeModalData, disputeRate: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '7px 9px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Rate Type */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Type
                                </label>
                                <select
                                    value={disputeModalData.disputeRateType}
                                    onChange={(e) => setDisputeModalData({ ...disputeModalData, disputeRateType: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '7px 9px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <option value="PD_LOOSE">PD/Loose</option>
                                    <option value="MD_LOOSE">MD/Loose</option>
                                    <option value="PD_WB">PD/WB</option>
                                    <option value="MD_WB">MD/WB</option>
                                </select>
                            </div>

                            {/* Hamali & LF Option */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Hamali & LF Option
                                </label>
                                <select
                                    value={disputeModalData.revisedRateOption}
                                    onChange={(e) => setDisputeModalData({ ...disputeModalData, revisedRateOption: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '7px 9px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#fff'
                                    }}
                                >
                                    <option value="final">Use Final Rate Hamali & LF</option>
                                    <option value="dispute">Use Existing Revised Rate</option>
                                </select>
                            </div>

                            {disputeModalData.revisedRateOption === 'dispute' && (() => {
                                const offering = detailEntry?.offering || {};
                                const pendingQueue = [];
                                if (String(offering.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending') {
                                    try {
                                        const parsed = typeof offering.pendingManagerValueApprovalQueue === 'string'
                                            ? JSON.parse(offering.pendingManagerValueApprovalQueue)
                                            : (offering.pendingManagerValueApprovalQueue || []);
                                        if (Array.isArray(parsed)) pendingQueue.push(...parsed);
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                const pendingRevisions = pendingQueue.filter((request: any) => {
                                    const data = request?.data || {};
                                    return (data.revisedHamali !== undefined && data.revisedHamali !== null && data.revisedHamali !== '')
                                        || (data.revisedLf !== undefined && data.revisedLf !== null && data.revisedLf !== '');
                                });
                                
                                const approvedRevisions = Array.isArray(offering.disputeVersions)
                                    ? offering.disputeVersions.filter((v: any) => v.type === 'revision' || (!v.type && ((v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '') || (v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== ''))))
                                    : [];
                                const hasLegacyRevision = (approvedRevisions.length === 0 && 
                                    ((offering.revisedHamali !== undefined && offering.revisedHamali !== null && offering.revisedHamali !== '') ||
                                     (offering.revisedLf !== undefined && offering.revisedLf !== null && offering.revisedLf !== '')));
                                const legacyRevision = hasLegacyRevision ? [{ id: 'legacy-revision', revisedHamali: offering.revisedHamali, hamaliUnit: offering.hamaliUnit, revisedLf: offering.revisedLf, lfUnit: offering.lfUnit }] : [];
                                const allApprovedRevisions = [...approvedRevisions, ...legacyRevision];
                                const totalRevisions = allApprovedRevisions.length + pendingRevisions.length;

                                if (totalRevisions === 0) {
                                    return (
                                        <div style={{ fontSize: '11px', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '6px 10px', marginTop: '4px' }}>
                                            No revised Hamali & LF rates exist yet for this lot. Please add a revised rate first.
                                        </div>
                                    );
                                }

                                return (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                            Select Revised Rate
                                        </label>
                                        <select
                                            value={disputeModalData.linkedRevisionId}
                                            onChange={(e) => setDisputeModalData({ ...disputeModalData, linkedRevisionId: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '7px 9px',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '4px',
                                                fontSize: '13px',
                                                boxSizing: 'border-box',
                                                backgroundColor: '#fff'
                                            }}
                                        >
                                            <option value="">-- Select Revision --</option>
                                            {allApprovedRevisions.map((rev: any, index: number) => {
                                                const hVal = rev.revisedHamali || offering.revisedHamali || offering.hamali;
                                                const hUnit = rev.hamaliUnit || offering.hamaliUnit || 'per_bag';
                                                const lfVal = rev.revisedLf || offering.revisedLf || offering.lf;
                                                const lfUnit = rev.lfUnit || offering.lfUnit || 'per_bag';
                                                const labelText = `Revision ${index + 1} (Approved): Hamali ${hVal}/${hUnit === 'per_quintal' ? 'Qtl' : 'Bag'}, LF ${lfVal}/${lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}`;
                                                return (
                                                    <option key={rev.id || `approved-${index}`} value={rev.id || 'legacy-revision'}>
                                                        {labelText}
                                                    </option>
                                                );
                                            })}
                                            {pendingRevisions.map((req: any, index: number) => {
                                                const data = req.data || {};
                                                const hVal = data.revisedHamali || offering.hamali;
                                                const hUnit = data.hamaliUnit || offering.hamaliUnit || 'per_bag';
                                                const lfVal = data.revisedLf || offering.lf;
                                                const lfUnit = data.lfUnit || offering.lfUnit || 'per_bag';
                                                const displayNum = allApprovedRevisions.length + index + 1;
                                                const labelText = `Revision ${displayNum} (Pending): Hamali ${hVal}/${hUnit === 'per_quintal' ? 'Qtl' : 'Bag'}, LF ${lfVal}/${lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}`;
                                                return (
                                                    <option key={req.id || `pending-${index}`} value={req.id}>
                                                        {labelText}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                );
                            })()}

                            {/* Sute and Sute Unit */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Sute
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={disputeModalData.sute}
                                        onChange={(e) => setDisputeModalData({ ...disputeModalData, sute: e.target.value })}
                                        style={{
                                            flex: 1,
                                            padding: '7px 9px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            fontSize: '13px',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <select
                                        value={disputeModalData.suteUnit}
                                        onChange={(e) => setDisputeModalData({ ...disputeModalData, suteUnit: e.target.value })}
                                        style={{
                                            width: '100px',
                                            padding: '7px 9px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            fontSize: '13px',
                                            boxSizing: 'border-box',
                                            backgroundColor: '#fff'
                                        }}
                                    >
                                        <option value="per_bag">/Bag</option>
                                        <option value="per_quintal">/Quintal</option>
                                        <option value="per_ton">/Ton</option>
                                    </select>
                                </div>
                            </div>

                            {/* Moisture % */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Moisture %
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={disputeModalData.moistureValue}
                                    onChange={(e) => setDisputeModalData({ ...disputeModalData, moistureValue: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '7px 9px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>



                            {/* Dispute Reason */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                    Dispute Reason
                                </label>
                                <textarea
                                    value={disputeModalData.disputeReason}
                                    onChange={(e) => setDisputeModalData({ ...disputeModalData, disputeReason: e.target.value })}
                                    rows={2}
                                    placeholder="Enter reason for dispute"
                                    style={{
                                        width: '100%',
                                        padding: '7px 9px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        boxSizing: 'border-box',
                                        resize: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{
                            padding: '12px 20px',
                            backgroundColor: '#f8fafc',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => setDisputeModalData(prev => ({ ...prev, isOpen: false }))}
                                disabled={processingAction}
                                style={{
                                    padding: '6px 16px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '12px'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitDisputeFlow}
                                disabled={processingAction}
                                style={{
                                    padding: '6px 16px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    backgroundColor: '#22c55e',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '12px'
                                }}
                            >
                                Save Values
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {confirmModal.isOpen && (
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    type={confirmModal.type}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                />
            )}
        </>
    );
};

