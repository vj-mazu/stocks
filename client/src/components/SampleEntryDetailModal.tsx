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
        showLorrySecondLine: !!lorryText && cleanPartyName.toUpperCase() !== lorryText
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
        const tone = upperLabel === 'LIGHT' ? '#e67e22' : (upperLabel === 'MEDIUM' ? '#f39c12' : '#c62828');
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
            tone: '#c62828'
        };
    }

    return null;
};



export const SampleEntryDetailModal = ({ detailEntry, detailMode, onClose, onUpdate, showCollectorLoginPair = false, progressiveMode = false }: { detailEntry: SampleEntry, detailMode: 'quick' | 'history' | 'summary' | 'full', onClose: () => void, onUpdate?: (gpsCoordinates?: string) => void | Promise<void>, showCollectorLoginPair?: boolean, progressiveMode?: boolean }) => {
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
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [cookingInput, setCookingInput] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isCapturingGps, setIsCapturingGps] = useState(false);
    const [isSavingGps, setIsSavingGps] = useState(false);
    const [localGps, setLocalGps] = useState<string | null>((detailEntry as any).gpsCoordinates || null);
    const [remarksPopup, setRemarksPopup] = useState({ isOpen: false, text: '' });
    const [pricingDetail, setPricingDetail] = useState<{ entry: SampleEntry, mode: 'offer' | 'final' } | null>(null);
    const [inspectionsProgress, setInspectionsProgress] = useState<any>(null);
    const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);

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
                } catch (err) {
                    console.error('Error fetching inspection progress in modal:', err);
                }
            };
            fetchInspectionProgress();
        }
    }, [detailEntry]);

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

    const renderHorizontalTable = (title: string, icon: string, headerColor: string, columns: string[], rows: any[], options: { isQuality?: boolean; compact?: boolean } = {}) => {
        if (rows.length === 0) return null;
        const isCompact = options.compact === true;

        return (
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', width: isCompact ? 'fit-content' : '100%', maxWidth: '100%', alignSelf: 'flex-start' }}>
                {/* Section Header - gradient bar */}
                <div style={{
                    background: `linear-gradient(135deg, ${headerColor}, ${headerColor}cc)`,
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px' }}>{icon}</span>
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 700, letterSpacing: '0.4px', fontStyle: 'italic' }}>{title}</span>
                    </div>
                    {options.isQuality && detailEntry.lorryNumber && (
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 900, letterSpacing: '1px' }}>
                            {detailEntry.lorryNumber.toUpperCase()}
                        </span>
                    )}
                </div>
                {/* Table */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: isCompact ? 'fit-content' : '100%', maxWidth: '100%' }}>
                    <table style={{ width: isCompact ? 'auto' : '100%', minWidth: isCompact ? '760px' : undefined, borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #dee2e6' }}>
                                {columns.map((col, i) => (
                                    <th key={i} style={{
                                        padding: '6px 6px',
                                        textAlign: 'left',
                                        color: '#495057',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        fontSize: '10px',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '0.3px',
                                        borderRight: i < columns.length - 1 ? '1px solid #e9ecef' : 'none'
                                    }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => {
                                if (row && row.type === 'header') {
                                    return (
                                        <tr key={i} style={{ backgroundColor: '#e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                                            <td colSpan={columns.length} style={{ padding: '8px 12px', fontWeight: '800', color: '#1e293b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {row.content}
                                            </td>
                                        </tr>
                                    );
                                }
                                if (row && row.type === 'spacer') {
                                    return (
                                        <tr key={i} style={{ height: '12px', backgroundColor: 'transparent' }}>
                                            <td colSpan={columns.length} style={{ padding: 0, height: '12px', border: 'none' }}></td>
                                        </tr>
                                    );
                                }
                                return (
                                    <tr key={i} style={{
                                        backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafb',
                                        borderBottom: '1px solid #e9ecef'
                                    }}>
                                        {row.map((cell: any, j: number) => (
                                            <td key={j} style={{
                                                padding: '6px 6px',
                                                color: '#1e293b',
                                                fontWeight: j === 0 ? 700 : 500,
                                                whiteSpace: j === 0 ? 'normal' : 'nowrap',
                                                fontSize: '11px',
                                                borderRight: j < row.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                maxWidth: j === 0 ? '160px' : undefined,
                                                wordBreak: j === 0 ? 'break-word' : undefined
                                            }}>
                                                {cell}
                                            </td>
                                        ))}
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

            const rowData = [
                <span style={{ color: '#c2410c' }}>{label} Sample</span>,
                getCollectorLabel(attempt.reportedBy),
                formatShortDateTime(reportedAt) || '-',
                moisture,
                cutting,
                bend,
                grains,
                formatQ(attempt.mixRaw, attempt.mix),
                formatQ(attempt.mixSRaw, attempt.mixS),
                formatQ(attempt.mixLRaw, attempt.mixL),
                formatQ(attempt.kanduRaw, attempt.kandu),
                formatQ(attempt.oilRaw, attempt.oil),
                formatQ(attempt.skRaw, attempt.sk),
                formatQ(attempt.wbRRaw, attempt.wbR),
                formatQ(attempt.wbBkRaw, attempt.wbBk),
                formatQ(attempt.wbTRaw, attempt.wbT),
                <span style={{ fontWeight: 600, color: '#475569' }}>{getQualityAttemptSmellLabel(detailEntry, attempt).toUpperCase()}</span>,
                formatQ(attempt.paddyWbRaw, attempt.paddyWb)
            ];

            if (progressiveMode) {
                rowData.push('-');
            }

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
                    if (stageObj.cutting1 === undefined || stageObj.cutting1 === null || String(stageObj.cutting1) === '0') return '-';
                    return `${stageObj.cutting1}x${stageObj.cutting2 || 0}`;
                };

                const formatStageBend = (stageObj: any) => {
                    if (stageObj.bend1 === undefined || stageObj.bend1 === null || String(stageObj.bend1) === '0') return '-';
                    return `${stageObj.bend1}x${stageObj.bend2 || 0}`;
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

                // Add header row for the Lorry/Trip
                rows.push({
                    type: 'header',
                    content: `Trip #${tripIdx + 1} - Lorry Number: ${insp.lorryNumber?.toUpperCase() || 'Lorry'}`
                });

                const getPendingStageOfTrip = (currentInsp: any) => {
                    const stg = currentInsp.samplingStages || {};
                    if (stg.lot_avg?.approvalStatus === 'pending') return { key: 'lot_avg', label: 'Lot Avg' };
                    if (stg.half_lorry?.approvalStatus === 'pending') return { key: 'half_lorry', label: 'Half Lorry' };
                    if (stg.nit_avg?.approvalStatus === 'pending') return { key: 'nit_avg', label: 'Nit Avg' };
                    if (stg.full_avg?.approvalStatus === 'pending') return { key: 'full_avg', label: 'Full Lorry' };
                    return null;
                };

                const pendingStage = getPendingStageOfTrip(insp);

                const makeRow = (labelElement: any, stageObj: any, stageKey: string) => {
                    if (!stageObj || !stageObj.reportedBy) return null;
                    const reportedAt = stageObj.reportedAt;
                    
                    let actionsCell: any = '-';
                    if (canApprove) {
                        if (pendingStage && pendingStage.key === stageKey) {
                            actionsCell = (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => handleApproveProgressiveStage(detailEntry.id, insp.id, stageKey, pendingStage.label)}
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
                        } else if (!pendingStage && (insp.isComplete || stages.full_avg?.approvalStatus === 'approved') && stageKey === 'full_avg') {
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
                            actionsCell = <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '10px' }}>Approved</span>;
                        } else if (stageObj.approvalStatus === 'rejected') {
                            actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                        } else if (!pendingStage && stageKey === 'full_avg') {
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
                            actionsCell = <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '10px' }}>Approved</span>;
                        } else if (stageObj.approvalStatus === 'rejected') {
                            actionsCell = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '10px' }}>Rejected</span>;
                        } else if (stageObj.approvalStatus === 'pending') {
                            actionsCell = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '10px' }}>Pending Approval</span>;
                        }
                    }

                    return [
                        labelElement,
                        getCollectorLabel(stageObj.reportedBy),
                        reportedAt ? (new Date(reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || '-') : '-',
                        formatStageMoisture(stageObj),
                        formatStageCutting(stageObj),
                        formatStageBend(stageObj),
                        formatStageGrains(stageObj),
                        formatQ(stageObj.mixRaw, stageObj.mix),
                        stageObj.smixEnabled ? formatQ(stageObj.mixSRaw, stageObj.mixS) || 'Yes' : '-',
                        stageObj.lmixEnabled ? formatQ(stageObj.mixLRaw, stageObj.mixL) || 'Yes' : '-',
                        formatQ(stageObj.kanduRaw, stageObj.kandu),
                        formatQ(stageObj.oilRaw, stageObj.oil),
                        formatQ(stageObj.skRaw, stageObj.sk),
                        formatQ(stageObj.wbRRaw, stageObj.wbR),
                        formatQ(stageObj.wbBkRaw, stageObj.wbBk),
                        formatQ(stageObj.wbTRaw, stageObj.wbT),
                        <span style={{ fontWeight: 600, color: '#475569' }}>{stageObj.smellHas ? 'YES' : '-'}</span>,
                        stageObj.paddyWbEnabled ? formatQ(stageObj.paddyWbRaw, stageObj.paddyWb) : '-',
                        actionsCell
                    ];
                };

                const stageKeys = [
                    { key: 'lot_avg', label: 'Lot Avg' },
                    { key: 'half_lorry', label: 'Half Lorry' },
                    { key: 'full_avg', label: 'Full Avg Lorry' },
                    { key: 'nit_avg', label: 'Nit Avg' }
                ];

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
                                        singleLorryMode: true
                                    });
                                }}
                                style={{ color: '#000000', textDecoration: 'underline', cursor: 'pointer', fontWeight: 900 }}
                                title="Click to view side-by-side stage comparison"
                            >
                                {label}
                            </span>
                        );
                        const stageRow = makeRow(labelElement, stageObj, key);
                        if (stageRow) rows.push(stageRow);
                    }
                });
            });
        }

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

    const buildPriceComparisonRows = () => {
        const o = detailEntry.offering;
        if (!o) return [];

        const rows: any[] = [];
        const versions = Array.isArray(o.offerVersions) ? o.offerVersions : [];
        
        // Add historical offers
        versions.forEach((v: any, i: number) => {
            const reporterName = getCollectorWithRole(v.updatedByFullName || v.createdByFullName || v.updatedBy || v.createdBy || o.updatedBy || o.createdBy);
            const reporterDate = formatShortDateTime(v.updatedAt || v.createdAt || (o as any).updatedAt || (o as any).createdAt) || '-';
            const suteVal = v.sute ?? o.sute;
            const suteUnitVal = v.suteUnit ?? o.suteUnit;
            const egbTypeVal = v.egbType ?? o.egbType;
            rows.push([
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Offer {i + 1}</span>,
                reporterName,
                reporterDate,
                `Rs ${toNumberText(v.offerBaseRateValue || v.offeringPrice || 0, 0)}`,
                `${(v.baseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(v.baseRateUnit || o.baseRateUnit)}`,
                suteVal ? `${toNumberText(suteVal, 2)} / ${formatRateUnitLabel(suteUnitVal || 'per_ton')}` : '-',
                v.moistureValue ?? o.moistureValue ? formatMeasurementText(v.moistureValue ?? o.moistureValue, '%') : '-',
                v.hamali ? formatFlexibleValue(v.hamali) : '-',
                v.brokerage ? formatFlexibleValue(v.brokerage) : '-',
                v.lf ? formatFlexibleValue(v.lf) : '-',
                formatUnitValueText(v.egbValue ?? o.egbValue ?? 0, toTitleCase(egbTypeVal || 'Mill')),
                v.cdValue ? formatFlexibleValue(v.cdValue) : '-',
                v.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(v.bankLoanValue)}` : '-',
                formatPaymentText(v.paymentConditionValue || o.paymentConditionValue || 15, v.paymentConditionUnit || o.paymentConditionUnit || 'Days'),
                '-'
            ]);
        });

        // Add Final Rate row if finalized
        if ((o as any).isFinalized || o.finalPrice || o.finalBaseRate) {
            const finalReporter = getCollectorWithRole((o as any).finalReportedBy || (o as any).updatedByFullName || o.updatedBy || o.createdBy);
            const finalDate = formatShortDateTime((o as any).finalReportedAt || (o as any).updatedAt || (o as any).createdAt) || '-';
            rows.push([
                <span style={{ color: '#16a34a', fontWeight: 700 }}>Final Rate</span>,
                finalReporter,
                finalDate,
                <span style={{ fontWeight: 700 }}>Rs {toNumberText(o.finalPrice || o.finalBaseRate || 0, 0)}</span>,
                `${(o.finalBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`,
                `${toNumberText(o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(o.finalSuteUnit || o.suteUnit || 'per_ton')}`,
                o.moistureValue ? formatMeasurementText(o.moistureValue, '%') : '-',
                o.hamali ? formatFlexibleValue(o.hamali) : '-',
                o.brokerage ? formatFlexibleValue(o.brokerage) : '-',
                o.lf ? formatFlexibleValue(o.lf) : '-',
                formatUnitValueText(o.egbValue ?? 0, toTitleCase(o.egbType || 'Mill')),
                o.cdValue ? formatFlexibleValue(o.cdValue) : '-',
                o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(o.bankLoanValue)}` : '-',
                <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>,
                '-'
            ]);
        }

        // Check for approved or pending dispute rates or revised Hamali/LF as separate entries
        const isPending = String((o as any).pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending';
        const pendingQueue = normalizePendingManagerApprovalQueue(o);

        // Track printed disputes and revisions so we don't duplicate approved ones
        let approvedDisputePrinted = false;
        let approvedRevisionPrinted = false;

        // Process pending queue requests
        if (pendingQueue.length > 0 && isPending) {
            pendingQueue.forEach((request: any, idx: number) => {
                const pendingData = request.data || {};
                const isDispute = pendingData.disputeBaseRate !== undefined && pendingData.disputeBaseRate !== null && pendingData.disputeBaseRate !== '';
                const isRevision = (pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '')
                    || (pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '');

                if (!isDispute && !isRevision) return;

                const disputeReporter = getCollectorWithRole(request.requestedByName || o.updatedByFullName || o.createdByFullName || o.updatedBy || o.createdBy);
                const disputeDate = formatShortDateTime(request.requestedAt || (o as any).updatedAt || (o as any).createdAt) || '-';

                let rowLabel = '';
                if (isDispute) {
                    rowLabel = `Dispute Request (Pending)`;
                } else {
                    const target = pendingData.revisedRateOption === 'dispute' ? 'Dispute' : 'Final Rate';
                    let linkLabel = '';
                    if (pendingData.revisedRateOption === 'dispute') {
                        if (pendingData.__linkedDisputeRequestId) {
                            const linkedIdx = pendingQueue.findIndex((req: any) => req.id === pendingData.__linkedDisputeRequestId);
                            linkLabel = ` (Linked to Dispute Request ${linkedIdx !== -1 ? linkedIdx + 1 : ''})`;
                        } else if (pendingData.__linkedDisputeLabel) {
                            linkLabel = ` (Linked to ${pendingData.__linkedDisputeLabel})`;
                        } else if (o.disputeBaseRate) {
                            linkLabel = ` (Linked to Dispute Rate)`;
                        }
                    }
                    rowLabel = `Revised HM/LF for ${target}${linkLabel} (Pending)`;
                }

                // Rate values
                const displayDisputeRate = isDispute ? pendingData.disputeBaseRate : (o.disputeBaseRate || o.finalPrice || o.finalBaseRate || 0);
                const displayDisputeType = isDispute ? (pendingData.disputeBaseRateType || o.baseRateType || 'PD/WB') : (o.disputeBaseRateType || o.baseRateType || 'PD/WB');

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
                        o.disputeBaseRate ? (
                            <span>Rs {formatFlexibleValue(o.disputeBaseRate)}</span>
                        ) : (
                            <span>Rs {toNumberText(o.finalPrice || o.finalBaseRate || 0, 0)}</span>
                        )
                    ),
                    // RATE TYPE
                    isDispute ? (
                        <span style={{ color: '#dc2626' }}>{`${displayDisputeType.replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                    ) : (
                        o.disputeBaseRate ? (
                            <span>{`${(o.disputeBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                        ) : (
                            <span>{`${(o.finalBaseRateType || o.baseRateType || 'PD/WB').replace(/_/g, '/')} / ${formatRateUnitLabel(o.finalBaseRateUnit || o.baseRateUnit)}`}</span>
                        )
                    ),
                    // SUTE
                    <span>{`${toNumberText(pendingData.finalSute || o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(pendingData.finalSuteUnit || o.finalSuteUnit || o.suteUnit || 'per_ton')}`}</span>,
                    // MOISTURE
                    pendingData.moistureValue || o.moistureValue ? formatMeasurementText(pendingData.moistureValue || o.moistureValue, '%') : '-',
                    // HAMALI
                    hasHamaliChanged ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            {formatFlexibleValue(displayRevisedHamali)} / {formatToggleUnitLabel(pendingData.hamaliUnit || o.hamaliUnit || 'per_bag')}
                        </span>
                    ) : (
                        o.revisedHamali ? (
                            <span>{formatFlexibleValue(o.revisedHamali)} / {formatToggleUnitLabel(o.hamaliUnit || 'per_bag')}</span>
                        ) : (
                            o.hamali ? formatFlexibleValue(o.hamali) : '-'
                        )
                    ),
                    // BROKERAGE
                    o.brokerage ? formatFlexibleValue(o.brokerage) : '-',
                    // LF
                    hasLfChanged ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            {formatFlexibleValue(displayRevisedLf)} / {formatToggleUnitLabel(pendingData.lfUnit || o.lfUnit || 'per_bag')}
                        </span>
                    ) : (
                        o.revisedLf ? (
                            <span>{formatFlexibleValue(o.revisedLf)} / {formatToggleUnitLabel(o.lfUnit || 'per_bag')}</span>
                        ) : (
                            o.lf ? formatFlexibleValue(o.lf) : '-'
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
        const disputeVersions = Array.isArray((o as any).disputeVersions) ? (o as any).disputeVersions : [];
        if (disputeVersions.length > 0) {
            let disputeCount = 0;
            let revisionCount = 0;

            disputeVersions.forEach((v: any) => {
                const isDispute = v.type === 'dispute' || (v.disputeBaseRate !== undefined && v.disputeBaseRate !== null && v.disputeBaseRate !== '');
                const isRevision = v.type === 'revision' || (v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '')
                    || (v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '');

                if (!isDispute && !isRevision) return;

                let rowLabel = '';
                if (isDispute) {
                    disputeCount++;
                    rowLabel = `Dispute ${disputeCount}`;
                } else if (isRevision) {
                    revisionCount++;
                    const target = v.revisedRateOption === 'dispute' ? 'Dispute' : 'Final Rate';
                    let linkLabel = '';
                    if (v.revisedRateOption === 'dispute') {
                        if (v.linkedDisputeRequestId) {
                            const linkedIdx = disputeVersions.filter((d: any) => d.type === 'dispute' || d.disputeBaseRate).findIndex((d: any) => d.id === v.linkedDisputeRequestId);
                            linkLabel = ` (Linked to Dispute ${linkedIdx !== -1 ? linkedIdx + 1 : ''})`;
                        } else if (v.linkedDisputeLabel) {
                            linkLabel = ` (Linked to ${v.linkedDisputeLabel})`;
                        } else {
                            linkLabel = ` (Linked to Dispute Rate)`;
                        }
                    }
                    rowLabel = `Revised HM/LF ${revisionCount} for ${target}${linkLabel}`;
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

                const hamaliVal = v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '' ? v.revisedHamali : o.hamali;
                const hasHamali = v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '';
                const hamaliUnitVal = v.hamaliUnit || o.hamaliUnit || 'per_bag';

                const lfVal = v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '' ? v.revisedLf : o.lf;
                const hasLf = v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '';
                const lfUnitVal = v.lfUnit || o.lfUnit || 'per_bag';

                rows.push([
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{rowLabel}</span>,
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
                    <span>{`${toNumberText(v.finalSute || o.finalSute || o.sute || 0, 2)} / ${formatRateUnitLabel(v.finalSuteUnit || o.finalSuteUnit || o.suteUnit || 'per_ton')}`}</span>,
                    // MOISTURE
                    v.moistureValue || o.moistureValue ? formatMeasurementText(v.moistureValue || o.moistureValue, '%') : '-',
                    // HAMALI
                    hasHamali ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {formatFlexibleValue(v.revisedHamali)} / {formatToggleUnitLabel(hamaliUnitVal)}
                        </span>
                    ) : (
                        o.hamali ? formatFlexibleValue(o.hamali) : '-'
                    ),
                    // BROKERAGE
                    o.brokerage ? formatFlexibleValue(o.brokerage) : '-',
                    // LF
                    hasLf ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {formatFlexibleValue(v.revisedLf)} / {formatToggleUnitLabel(lfUnitVal)}
                        </span>
                    ) : (
                        o.lf ? formatFlexibleValue(o.lf) : '-'
                    ),
                    // EGB
                    formatUnitValueText(v.egbValue ?? o.egbValue ?? 0, toTitleCase(v.egbType || o.egbType || 'Mill')),
                    // CD
                    v.cdValue || o.cdValue ? formatFlexibleValue(v.cdValue || o.cdValue) : '-',
                    // BANK LOAN
                    v.bankLoanValue || o.bankLoanValue ? `Rs ${formatIndianCurrencyFlexible(v.bankLoanValue || o.bankLoanValue)}` : '-',
                    // PAYMENT
                    <span style={{ fontWeight: 600 }}>{formatPaymentText(v.paymentConditionValue || o.paymentConditionValue || 15, v.paymentConditionUnit || o.paymentConditionUnit || 'Days')}</span>,
                    v.disputeReason || v.reason || '-'
                ]);
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
                        o.hamali ? formatFlexibleValue(o.hamali) : '-'
                    ),
                    // BROKERAGE
                    o.brokerage ? formatFlexibleValue(o.brokerage) : '-',
                    // LF
                    o.revisedLf ? (
                        <span>{formatFlexibleValue(o.revisedLf)} / {formatToggleUnitLabel(o.lfUnit || 'per_bag')}</span>
                    ) : (
                        o.lf ? formatFlexibleValue(o.lf) : '-'
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
                const target = o.revisedRateOption === 'dispute' ? 'Dispute' : 'Final Rate';

                rows.push([
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Revised HM/LF for {target}</span>,
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
                    o.brokerage ? formatFlexibleValue(o.brokerage) : '-',
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
                                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{value || '-'}</div>
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
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                                            style={{ fontSize: '15px', fontWeight: '700', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            title={`Click to view all entries for ${partyName}`}
                                                        >
                                                            {partyDisplay.label}
                                                        </span>
                                                    ) : (
                                                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {partyDisplay.label}
                                                            {partyDisplay.showLorrySecondLine ? (
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
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
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
                                                            style={{ fontSize: '14px', fontWeight: '700', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }}
                                                            title={`Click to view all entries at ${locationName}`}
                                                        >
                                                            {locationName}
                                                        </span>
                                                    ) : (
                                                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{toTitleCase(detailEntry.location || '-')}</div>
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
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collected By</div>
                                        {(() => {
                                            const collectedByDisplay = getCollectedByDisplay(detailEntry);
                                            if (collectedByDisplay.secondary) {
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                                        {(() => {
                                                            const primaryLine = splitCollectedByLine(collectedByDisplay.primary);
                                                            return (
                                                                <span style={{ fontSize: '14px', fontWeight: '700' }}>
                                                                    <span style={{ color: collectedByDisplay.highlightPrimary ? '#9c27b0' : '#1e293b' }}>{primaryLine.text}</span>
                                                                    {primaryLine.accent ? <><span style={{ color: '#94a3b8' }}> | </span><span style={{ color: '#9c27b0' }}>{primaryLine.accent}</span></> : null}
                                                                </span>
                                                            );
                                                        })()}
                                                        <div style={{ borderTop: '1px solid #cbd5e1' }} />
                                                        {(() => {
                                                            const secondaryLine = splitCollectedByLine(collectedByDisplay.secondary);
                                                            return (
                                                                <span style={{ fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                                        <div style={{ fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                            <div style={{ fontSize: '10px', color: '#e67e22', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allotted Loading Supervisor</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#ef6c00' }}>
                                                {toTitleCase(detailEntry.lotAllotment.supervisor.fullName || detailEntry.lotAllotment.supervisor.username)}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: getPopupSmellSummary(detailEntry as any) ? undefined : 'none' }}>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Smell</div>
                                        {(() => {
                                            const s = getPopupSmellSummary(detailEntry as any);
                                            if (!s) return null;
                                            return (
                                                <div style={{ fontSize: '14px', fontWeight: '800', color: s.tone }}>
                                                    {s.value} Smell
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* Standardized Horizontal Tables Section */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                    {/* Quality Parameters */}
                                    {renderHorizontalTable(
                                        'Quality Parameters', 
                                        '🔬', 
                                        '#f97316', 
                                        progressiveMode 
                                            ? ['SAMPLE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS COUNT', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB', 'ACTIONS']
                                            : ['SAMPLE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS COUNT', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB'],
                                        buildQualityRows(),
                                        { isQuality: true }
                                    )}

                                    {/* Cooking History */}
                                    {renderHorizontalTable(
                                        'Cooking History',
                                        '🍳',
                                        '#2563eb',
                                        ['SI', 'STATUS', 'DONE BY', 'APPROVED BY', 'REMARKS'],
                                        buildCookingRows(),
                                        { compact: true }
                                    )}


                                    {/* Pricing & Offers */}
                                    {!isStaff && renderHorizontalTable(
                                        'Price Details',
                                        '💰',
                                        '#2563eb',
                                        ['TYPE', 'REPORTED BY', 'REPORTED AT', 'RATE', 'RATE TYPE', 'SUTE', 'MOISTURE', 'HAMALI', 'BROKERAGE', 'LF', 'EGB', 'CD', 'BANK LOAN', 'PAYMENT', 'REMARKS'],
                                        buildPriceComparisonRows()
                                    )}
                                </div>



                                {/* GPS & Photos for Location Sample */}
                                {detailEntry.entryType === 'LOCATION_SAMPLE' && (
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
                                            const suteValue = isFinalMode ? offInfo.finalSute : offInfo.sute;
                                            const suteUnit = isFinalMode ? offInfo.finalSuteUnit : offInfo.suteUnit;
                                            const baseRows = [
                                                [isFinalMode ? 'Final Rate' : 'Offer Rate', isFinalMode ? getFinalRateText(offInfo) : getOfferRateText(offInfo)],
                                                ['Sute', suteValue ? `${toNumberText(suteValue)} / ${formatRateUnitLabel(suteUnit || undefined)}` : '-'],
                                                ['Moisture', offInfo.moistureValue ? formatMeasurementText(offInfo.moistureValue, '%') : '-'],
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
                                const half = stages.half_lorry || {};
                                const full = stages.full_avg || {};

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
                                    return (
                                        <tr key={name} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: bgColor }}>
                                            <td style={{ padding: '8px 10px', fontWeight: '800', color: color }}>{name}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.reportedBy)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>
                                                {stageObj.reportedAt ? new Date(stageObj.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600' }}>{formatMoisture(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600' }}>{formatCutting(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600' }}>{formatBend(stageObj)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>({formatField(stageObj.grainsCountRaw || stageObj.grainsCount)})</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.mixRaw || stageObj.mix)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{stageObj.smixEnabled ? formatField(stageObj.mixSRaw || stageObj.mixS) || 'Yes' : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{stageObj.lmixEnabled ? formatField(stageObj.mixLRaw || stageObj.mixL) || 'Yes' : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.kanduRaw || stageObj.kandu)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.oilRaw || stageObj.oil)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.skRaw || stageObj.sk)}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{stageObj.smellHas ? 'Yes' : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{stageObj.paddyWbEnabled ? formatField(stageObj.paddyWbRaw || stageObj.paddyWb) : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '700' }}>{isFull ? formatField(inspection.bags) : '-'}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                                            </td>
                                        </tr>
                                    );
                                };

                                return (
                                    <div key={inspection.id} style={{ border: '1px solid #f2cfb6', borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Trip #{idx + 1} | Lorry No: {inspection.lorryNumber?.toUpperCase()} | Bags Loaded: {inspection.bags || '-'}</span>
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
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>CUTTING</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>BEND</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>GRAINS COUNT</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>S MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>L MIX</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>KANDU</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>OIL</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SK</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>SMELL</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PADDY WB</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>LOADED BAGS</th>
                                                        <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PHOTO</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {lot && lot.reportedBy && renderRow('Lot Avg', '#d05d00', '#fffaf5', lot, false)}
                                                    {half && half.reportedBy && renderRow('Half Lorry', '#b45309', '#fffdfa', half, false)}
                                                    {full && full.reportedBy && renderRow('Full Avg Lorry', '#15803d', '#fffaf0', full, true)}
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
