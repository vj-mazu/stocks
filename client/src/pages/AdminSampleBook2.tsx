import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';
import { getConvertedEntryTypeCode, getDisplayedEntryTypeCode, getEntryTypeTextColor, getOriginalEntryTypeCode, isConvertedResampleType } from '../utils/sampleTypeDisplay';
import { getDisplayQualityParameters } from '../utils/sampleEntryQualityModalLogic';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

/**
 * AdminSampleBook2 — Broker-Grouped Sample Book
 * Same data as AdminSampleBook but rendered in the staff-style
 * broker-grouped design (date bar → red broker bar → table).
 */

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
    smellHas?: boolean;
    smellType?: string | null;
    workflowStatus: string;
    lotSelectionDecision?: string;
    lotSelectionAt?: string;
    resampleStartAt?: string;
    cancelRemarks?: string;
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
        offerVersions?: Array<{
            key: string;
            offerBaseRateValue?: number;
            baseRateType?: string;
            baseRateUnit?: string;
            offeringPrice?: number;
            finalPrice?: number;
            finalBaseRate?: number;
            moistureValue?: number;
            sute?: number;
            suteUnit?: string;
            finalSute?: number;
            finalSuteUnit?: string;
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
    staffEntryEditAllowance?: number;
    staffQualityEditAllowance?: number;
    failRemarks?: string | null;
    entryEditApprovalStatus?: string | null;
    entryEditApprovalReason?: string | null;
    entryEditApprovalRequestedAt?: string | null;
    entryEditApprovalRequestedByName?: string | null;
    qualityEditApprovalStatus?: string | null;
    qualityEditApprovalReason?: string | null;
    qualityEditApprovalRequestedAt?: string | null;
    qualityEditApprovalRequestedByName?: string | null;
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const buildMapHref = (value: any) => {
    const raw = typeof value === 'object' && value !== null
        ? `${value.lat},${value.lng}`
        : String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
};
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
    const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
    
    // FIXED: For DIRECT_LOADED_VEHICLE with empty partyName, use lorryNumber as primary label
    if (entry.entryType === 'DIRECT_LOADED_VEHICLE' && !partyNameText && lorryText) {
        return {
            label: lorryText,
            lorryText,
            showLorrySecondLine: false
        };
    }
    
    return {
        label: partyNameText || lorryText || '-',
        lorryText,
        showLorrySecondLine: entry.entryType === 'DIRECT_LOADED_VEHICLE'
            && !!partyNameText
            && !!lorryText
            && partyNameText.toUpperCase() !== lorryText
    };
};
const toNumberText = (value: any, digits = 2) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits).replace(/\.00$/, '') : '-';
};
const formatIndianCurrency = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num)
        ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
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
const formatDateInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getEffectiveDate = (entry: any) => {
  const hasResampleFlow = String(entry?.lotSelectionDecision || '').trim().toUpperCase() === 'FAIL'
    || (Array.isArray(entry?.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0)
    || (Array.isArray(entry?.resampleCollectedHistory) && entry.resampleCollectedHistory.length > 0)
    || Number(entry?.qualityReportAttempts || 0) > 1;

  if (hasResampleFlow && Array.isArray(entry?.resampleCollectedTimeline) && entry.resampleCollectedTimeline.length > 0) {
    const lastAssigned = entry.resampleCollectedTimeline[entry.resampleCollectedTimeline.length - 1];
    if (lastAssigned && lastAssigned.date) {
      return new Date(lastAssigned.date);
    }
  }
  return new Date(entry.entryDate);
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
  const hasDetailedQuality =
    isProvidedNumeric(attempt?.cutting1Raw, attempt?.cutting1) ||
    isProvidedNumeric(attempt?.bend1Raw, attempt?.bend1) ||
    isProvidedAlpha(attempt?.mixRaw, attempt?.mix) ||
    isProvidedAlpha(attempt?.mixSRaw, attempt?.mixS) ||
    isProvidedAlpha(attempt?.mixLRaw, attempt?.mixL) ||
    isProvidedAlpha(attempt?.kanduRaw, attempt?.kandu) ||
    isProvidedAlpha(attempt?.oilRaw, attempt?.oil) ||
    isProvidedAlpha(attempt?.skRaw, attempt?.sk);

  return hasMoisture && (hasGrains || hasDetailedQuality);
};
const hasResampleWbActivationSnapshot = (attempt: any) =>
    isProvidedNumeric(attempt?.moistureRaw, attempt?.moisture)
    && isProvidedNumeric(attempt?.wbRRaw, attempt?.wbR)
    && isProvidedNumeric(attempt?.wbBkRaw, attempt?.wbBk)
    && isProvidedNumeric(attempt?.grainsCountRaw, attempt?.grainsCount);
const hasExplicitDetailedQualityRaw = (attempt: any) =>
    String(attempt?.cutting1Raw ?? '').trim() !== ''
    || String(attempt?.bend1Raw ?? '').trim() !== ''
    || String(attempt?.mixRaw ?? '').trim() !== ''
    || String(attempt?.mixSRaw ?? '').trim() !== ''
    || String(attempt?.mixLRaw ?? '').trim() !== ''
    || String(attempt?.kanduRaw ?? '').trim() !== ''
    || String(attempt?.oilRaw ?? '').trim() !== ''
    || String(attempt?.skRaw ?? '').trim() !== '';
const hasDisplayableQualitySnapshot = (attempt: any) =>
    hasQualitySnapshot(attempt) || hasResampleWbActivationSnapshot(attempt);

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

    const qpAll = (normalizedBaseAttempts.length > 0) 
        ? normalizedBaseAttempts.map((attempt: any, index: number) => ({
            ...attempt,
            attemptNo: Number(attempt?.attemptNo) || index + 1
        }))
        : (currentQuality && hasDisplayableQualitySnapshot(currentQuality) ? [{ ...currentQuality, attemptNo: 1 }] : []);

    const _toTime = (v?: string | null) => { if (!v) return 0; const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };
    const _resampleTimeline = Array.isArray(entry?.resampleCollectedTimeline) ? entry.resampleCollectedTimeline : [];
    const _resampleHistory = Array.isArray(entry?.resampleCollectedHistory) ? entry.resampleCollectedHistory : [];
    const _hasResampleCollector = _resampleTimeline.length > 0 || _resampleHistory.length > 0;
    
    if (_hasResampleCollector) {
        let _collectorName = '';
        let _collectedDate: string | null = null;
        if (_resampleTimeline.length > 0) {
            const last = _resampleTimeline[_resampleTimeline.length - 1];
            if (typeof last === 'string') { _collectorName = last; }
            else if (last && typeof last === 'object') { _collectorName = last.sampleCollectedBy || last.name || ''; _collectedDate = last.date || null; }
        } else if (_resampleHistory.length > 0) {
            const last = _resampleHistory[_resampleHistory.length - 1];
            _collectorName = typeof last === 'string' ? last : (last?.name || last?.sampleCollectedBy || '');
        }

        const _resampleStart = _toTime(entry?.resampleStartAt || entry?.resampleTriggeredAt || entry?.resampleDecisionAt || _collectedDate);
        const _hasPostResampleQuality = qpAll.some((qp: any) => {
            const qpTime = _toTime(qp?.updatedAt || qp?.createdAt);
            return qpTime > 0 && _resampleStart > 0 && qpTime >= (_resampleStart - 2000);
        });

        if (!_hasPostResampleQuality && _collectorName) {
            const nextAttemptNo = qpAll.length > 0 ? Math.max(...qpAll.map((q: any) => Number(q.attemptNo || 0))) + 1 : 2;
            qpAll.push({
                _isPhantomRow: true,
                attemptNo: nextAttemptNo,
                reportedBy: _collectorName,
                updatedAt: _collectedDate,
                createdAt: _collectedDate,
            });
        }
    }
    return qpAll;
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
    sources.push(entry);

    for (const source of sources) {
        const smellHas = source?.smellHas;
        const smellType = source?.smellType;
        if (smellHas || (smellType && String(smellType).trim())) {
            return toTitleCase(smellType || 'Yes');
        }
    }

    return '-';
};
const getPopupSmellSummary = (entry: any) => {
    const smellLabel = getQualityAttemptSmellLabel(entry);
    if (smellLabel !== '-') {
        return {
            label: 'Smell',
            value: smellLabel,
            tone: String(smellLabel || '').trim().toUpperCase() === 'LIGHT' ? '#e67e22' : '#c62828'
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

interface AdminSampleBook2Props {
    entryType?: string;
    excludeEntryType?: string;
    approvalMode?: 'hidden' | 'embedded' | 'only';
    onApprovalCountChange?: (count: number) => void;
}

type PricingDetailState = {
    entry: SampleEntry;
    mode: 'offer' | 'final';
};
type SupervisorUser = {
    id: number;
    username: string;
    fullName?: string | null;
};

const AdminSampleBook2: React.FC<AdminSampleBook2Props> = ({ entryType, excludeEntryType, approvalMode = 'hidden', onApprovalCountChange }) => {
    const isRiceBook = entryType === 'RICE_SAMPLE';
    const tableMinWidth = isRiceBook ? '100%' : '1500px';
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [approvalEntries, setApprovalEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
    const [activeView, setActiveView] = useState<'sample-book' | 'edit-approvals'>(approvalMode === 'only' ? 'edit-approvals' : 'sample-book');

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 100;

    // Filters
    const [filtersVisible, setFiltersVisible] = useState(false);
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterBroker, setFilterBroker] = useState('');
    const [filterVariety, setFilterVariety] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterCollectedBy, setFilterCollectedBy] = useState('');
    const [filterType, setFilterType] = useState('');

    // Detail popup
    const [detailEntry, setDetailEntry] = useState<SampleEntry | null>(null);
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
    const [pricingDetail, setPricingDetail] = useState<PricingDetailState | null>(null);
    const [remarksPopup, setRemarksPopup] = useState<{ isOpen: boolean; text: string }>({ isOpen: false, text: '' });
    const [recheckModal, setRecheckModal] = useState<{ isOpen: boolean; entry: SampleEntry | null }>({ isOpen: false, entry: null });
    const renderTabBadge = (count: number, background: string) => (
        count > 0 ? (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '18px',
                    height: '18px',
                    marginLeft: '6px',
                    padding: '0 6px',
                    borderRadius: '999px',
                    background,
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    lineHeight: 1
                }}
            >
                {count}
            </span>
        ) : null
    );
    const getCollectorLabel = (value?: string | number | null) => {
        if (value === undefined || value === null) return '-';
        const rawStr = String(value).trim();
        if (!rawStr) return '-';
        if (rawStr.toLowerCase() === 'broker office sample') return 'Broker Office Sample';
        
        const match = supervisors.find((sup) => 
            String(sup.id) === rawStr ||
            String(sup.username || '').trim().toLowerCase() === rawStr.toLowerCase() ||
            String(sup.fullName || '').trim().toLowerCase() === rawStr.toLowerCase()
        );
        if (match?.fullName) return toTitleCase(match.fullName);
        if (match?.username) return toTitleCase(match.username);
        return toTitleCase(rawStr);
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
    const buildOrderedCollectorNames = (values: Array<string | null | undefined>) => values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => (
            arr.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
        ));
    const getResampleCollectorNames = (entry: SampleEntry) => {
        const extractNames = (items: any[]) => items
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') return item.sampleCollectedBy || item.name || '';
                return '';
            })
            .map((value) => String(value || '').trim())
            .filter((value) => value && value.toLowerCase() !== 'broker office sample');
        const resampleTimeline = Array.isArray((entry as any)?.resampleCollectedTimeline) ? (entry as any).resampleCollectedTimeline : [];
        const resampleHistory = Array.isArray((entry as any)?.resampleCollectedHistory) ? (entry as any).resampleCollectedHistory : [];
        return Array.from(new Set([...extractNames(resampleTimeline), ...extractNames(resampleHistory)]));
    };
    const getCollectedByDisplay = (entry: SampleEntry) => {
        let rawCollector = getOriginalCollector(entry) || '';
        if (rawCollector.includes('|')) {
            const parts = rawCollector.split('|').map(s => s.trim());
            if (parts.length >= 2) {
                return { primary: getCollectorLabel(parts[1]), secondary: getCollectorLabel(parts[0]), highlightPrimary: false };
            }
        }
        const collectorLabel = getCollectorLabel(rawCollector || null);
        const orderedCollectorNames = buildOrderedCollectorNames([
            rawCollector,
            ...getResampleCollectorNames(entry),
            entry.sampleCollectedBy
        ]);
        const secondaryCollector = orderedCollectorNames.length > 1
            ? getCollectorLabel(orderedCollectorNames[orderedCollectorNames.length - 1] || null)
            : null;
        return {
            primary: collectorLabel !== '-' ? collectorLabel : '-',
            secondary: secondaryCollector && secondaryCollector !== collectorLabel ? secondaryCollector : null,
            highlightPrimary: false
        };
    };

    const handleRecheck = async (type: string) => {
        if (!recheckModal.entry) return;
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/sample-entries/${recheckModal.entry.id}/recheck`, { recheckType: type }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success((response.data as any).message || 'Recheck initiated successfully');
            setRecheckModal({ isOpen: false, entry: null });
            loadEntries();
        } catch (error: any) {
            console.error('Failed to initiate recheck', error);
            const msg = error.response?.data?.error || 'Failed to initiate recheck';
            toast.error(msg);
        }
    };

    useEffect(() => {
        const loadSupervisors = async () => {
            try {
                const token = localStorage.getItem('token');
                const normalizeUsers = (users: any[]) => users
                    .filter((u: any) => u && (u.username || u.fullName))
                    .map((u: any) => ({
                        id: u.id,
                        username: String(u.username || '').trim(),
                        fullName: String(u.fullName || u.username || '').trim()
                    }));

                let mergedUsers: SupervisorUser[] = [];

                // Try /admin/users first (has Admin, Manager, Owner names)
                try {
                    const adminResponse = await axios.get(`${API_URL}/admin/users`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    const adminData: any = adminResponse.data;
                    const adminUsers = Array.isArray(adminData) ? adminData : (adminData.users || []);
                    mergedUsers = normalizeUsers(adminUsers);
                } catch (_adminError) {
                    // Fallback to paddy-supervisors
                    const supervisorResponse = await axios.get(`${API_URL}/sample-entries/paddy-supervisors`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                    const supervisorData: any = supervisorResponse.data;
                    const supervisorUsers = Array.isArray(supervisorData)
                        ? supervisorData
                        : (supervisorData.users || supervisorData.data || []);
                    mergedUsers = normalizeUsers(supervisorUsers);
                }

                // Deduplicate by id, username, fullName
                const unique = new Map<string, SupervisorUser>();
                mergedUsers.forEach((user) => {
                    const idKey = String(user.id || '').trim();
                    if (idKey && !unique.has(idKey)) unique.set(idKey, user);
                });
                setSupervisors(Array.from(unique.values()));
            } catch (error) {
                console.error('Error loading users:', error);
            }
        };
        loadSupervisors();
    }, []);

    useEffect(() => {
        if (approvalMode !== 'only') {
            loadEntries();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, approvalMode]);

    useEffect(() => {
        if (approvalMode === 'only' || activeView === 'edit-approvals') {
            loadApprovalEntries();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView, approvalMode]);

    useEffect(() => {
        setActiveView(approvalMode === 'only' ? 'edit-approvals' : 'sample-book');
    }, [approvalMode]);

    const normalizeCollectedByFilter = (value: string) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.toLowerCase() === 'broker office sample') return 'Broker Office Sample';
        const match = supervisors.find((sup) => {
            const username = String(sup.username || '').trim().toLowerCase();
            const fullName = String(sup.fullName || '').trim().toLowerCase();
            return raw.toLowerCase() === username || (fullName && raw.toLowerCase() === fullName);
        });
        return match?.username || raw;
    };

    const loadEntries = async (
        fFrom?: string,
        fTo?: string,
        fBroker?: string,
        fVariety?: string,
        fLocation?: string,
        fCollectedBy?: string,
        fType?: string
    ) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params: any = { page, pageSize: PAGE_SIZE };

            const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
            const dTo = fTo !== undefined ? fTo : filterDateTo;
            const b = fBroker !== undefined ? fBroker : filterBroker;
            const v = fVariety !== undefined ? fVariety : filterVariety;
            const l = fLocation !== undefined ? fLocation : filterLocation;
            const cb = fCollectedBy !== undefined ? fCollectedBy : filterCollectedBy;
            const t = fType !== undefined ? fType : filterType;

            if (dFrom) params.startDate = dFrom;
            if (dTo) params.endDate = dTo;
            if (b) params.broker = b;
            if (v) params.variety = v;
            if (l) params.location = l;
            if (cb) params.collectedBy = normalizeCollectedByFilter(cb);
            if (t) params.sampleType = t;
            if (entryType) params.entryType = entryType;
            if (excludeEntryType) params.excludeEntryType = excludeEntryType;

            const response = await axios.get(`${API_URL}/sample-entries/ledger/all`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data as any;
            setEntries(data.entries || []);
            if (data.total != null) {
                setTotal(data.total);
                setTotalPages(data.totalPages || Math.ceil(data.total / PAGE_SIZE));
            }
        } catch (error) {
            console.error('Failed to load entries', error);
        } finally {
            setLoading(false);
        }
    };
    const loadApprovalEntries = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/sample-entries/tabs/edit-approvals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const nextEntries = (response.data as any)?.entries || [];
            setApprovalEntries(nextEntries);
        } catch (error) {
            console.error('Error loading edit approvals:', error);
            toast.error('Failed to load edit approvals');
        } finally {
            setLoading(false);
        }
    };
    const handleApprovalDecision = async (entry: SampleEntry, type: 'entry' | 'quality', decision: 'approve' | 'reject') => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sample-entries/${entry.id}/edit-approval-decision`, { type, decision }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`${type === 'quality' ? 'Quality' : 'Entry'} edit request ${decision}d`);
            loadApprovalEntries();
            loadEntries();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update approval request');
        }
    };

    const handleApplyFilters = () => {
        setPage(1);
        setTimeout(() => {
            loadEntries();
        }, 0);
    };

    const handleClearFilters = () => {
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterBroker('');
        setFilterVariety('');
        setFilterLocation('');
        setFilterCollectedBy('');
        setFilterType('');
        setPage(1);
        setTimeout(() => {
            loadEntries('', '', '', '', '', '', '');
        }, 0);
    };

    const handleQuickDateFilter = (preset: 'today' | 'yesterday' | 'last7') => {
        const endDate = new Date();
        const startDate = new Date(endDate);

        if (preset === 'today') {
            // keep today only
        } else if (preset === 'yesterday') {
            startDate.setDate(startDate.getDate() - 1);
            endDate.setDate(endDate.getDate() - 1);
        } else {
            startDate.setDate(startDate.getDate() - 6);
        }

        const startValue = formatDateInputValue(startDate);
        const endValue = formatDateInputValue(endDate);
        setFilterDateFrom(startValue);
        setFilterDateTo(endValue);
        setPage(1);
        setTimeout(() => {
            loadEntries(startValue, endValue, filterBroker, filterVariety, filterLocation, filterCollectedBy, filterType);
        }, 0);
    };

    const filteredEntries = useMemo(() => {
        if (isRiceBook) {
            return entries.filter((entry) => {
                const qp = getDisplayQualityParameters(entry) || {};
                const hasQuality = qp && isProvidedNumeric((qp as any).moistureRaw, qp.moisture) && (
                    isProvidedNumeric((qp as any).cutting1Raw, qp.cutting1)
                    || isProvidedNumeric((qp as any).bend1Raw, qp.bend1)
                    || isProvidedAlpha((qp as any).mixRaw, qp.mix)
                    || isProvidedAlpha((qp as any).mixSRaw, qp.mixS)
                    || isProvidedAlpha((qp as any).mixLRaw, qp.mixL)
                    || isProvidedAlpha((qp as any).skRaw, qp.sk)
                );
                return !!hasQuality;
            });
        }

        return entries.filter((entry) => {
            const qp = getDisplayQualityParameters(entry) as any || {};
            const hasQualityRecord = !!(qp && (qp.reportedBy || qp.id));
            if (!hasQualityRecord) return true; // Pending entries should show
            const hasMoisture = qp && isProvidedNumeric(qp.moistureRaw, qp.moisture);
            const hasGrains = qp && isProvidedNumeric(qp.grainsCountRaw, qp.grainsCount);
            if (!hasMoisture || !hasGrains) return true; // Pending (partial) shows
            const hasCutting1 = qp && isProvidedNumeric(qp.cutting1Raw, qp.cutting1);
            const hasCutting2 = qp && isProvidedNumeric(qp.cutting2Raw, qp.cutting2);
            const hasBend1 = qp && isProvidedNumeric(qp.bend1Raw, qp.bend1);
            const hasBend2 = qp && isProvidedNumeric(qp.bend2Raw, qp.bend2);
            const hasMix = qp && isProvidedAlpha(qp.mixRaw, qp.mix);
            const hasKandu = qp && isProvidedAlpha(qp.kanduRaw, qp.kandu);
            const hasOil = qp && isProvidedAlpha(qp.oilRaw, qp.oil);
            const hasSk = qp && isProvidedAlpha(qp.skRaw, qp.sk);
            const hasAnyDetail = hasCutting1 || hasCutting2 || hasBend1 || hasBend2 || hasMix || hasKandu || hasOil || hasSk;
            if (!hasAnyDetail) return true; // 100g completed
            const isFullQuality = hasCutting1 && hasCutting2 && hasBend1 && hasBend2 && hasMix && hasKandu && hasOil && hasSk;
            return true; // Pending (partial) shows
        });
    }, [entries, isRiceBook]);

    // Get unique brokers
    const brokersList = useMemo(() => {
        return Array.from(new Set(filteredEntries.map(e => e.brokerName))).sort();
    }, [filteredEntries]);
    const varietiesList = useMemo(() => {
        return Array.from(new Set(filteredEntries.map((entry) => entry.variety).filter(Boolean))).sort();
    }, [filteredEntries]);

    // Group entries by date then broker
    const groupedEntries = useMemo(() => {
        const sorted = [...filteredEntries].sort((a, b) => {
            const dateA = getEffectiveDate(a).getTime();
            const dateB = getEffectiveDate(b).getTime();
            if (dateA !== dateB) return dateB - dateA; // Primary sort: Date DESC
            const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
            const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
            if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Secondary sort: CreatedAt ASC for stable Sl No
        });
        const grouped: Record<string, Record<string, typeof sorted>> = {};
        sorted.forEach(entry => {
            const dateKey = getEffectiveDate(entry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const brokerKey = entry.brokerName || 'Unknown';
            if (!grouped[dateKey]) grouped[dateKey] = {};
            if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
            grouped[dateKey][brokerKey].push(entry);
        });
        return grouped;
    }, [filteredEntries]);

    // Status badge helper
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

    const getQualityTypeMeta = (attempt: any) => {
        if (!attempt) return { label: 'Pending', variant: 'default' };
        const hasWbOnlyResampleActivation = hasResampleWbActivationSnapshot(attempt) && !hasExplicitDetailedQualityRaw(attempt);
        const hasFullQuality = isProvidedNumeric((attempt as any).cutting1Raw, attempt.cutting1)
            || isProvidedNumeric((attempt as any).bend1Raw, attempt.bend1)
            || isProvidedAlpha((attempt as any).mixRaw, attempt.mix)
            || isProvidedAlpha((attempt as any).mixSRaw, attempt.mixS)
            || isProvidedAlpha((attempt as any).mixLRaw, attempt.mixL);
        const has100g = hasResampleWbActivationSnapshot(attempt);
        if (hasWbOnlyResampleActivation) return { label: '100-Gms', variant: 'resample-wb' };
        if (hasFullQuality) return { label: 'Done', variant: 'default' };
        if (hasResampleWbActivationSnapshot(attempt)) return { label: '100-Gms', variant: 'resample-wb' };
        if (has100g) return { label: '100-Gms', variant: 'default' };
        return { label: 'Pending', variant: 'default' };
    };

    const getQualityTypeStyle = (label: string, variant?: string) => {
        if (label === 'Done') return { bg: '#c8e6c9', color: '#2e7d32' };
        if (label === '100-Gms' && variant === 'resample-wb') return { bg: '#ede9fe', color: '#6d28d9' };
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

const buildQualityStatusRows = (entry: SampleEntry) => {
        const attemptsSorted = getQualityAttemptsForEntry(entry);
        const isHardFailed = String(entry.workflowStatus || '').toUpperCase() === 'FAILED';
        const isFailDecision = String(entry.lotSelectionDecision || '').toUpperCase() === 'FAIL' && String(entry.workflowStatus || '').toUpperCase() !== 'FAILED';
        const isQualityRecheckPending = (entry as any).qualityPending === true
            || ((entry as any).qualityPending == null && (entry as any).recheckRequested === true && (entry as any).recheckType !== 'cooking');
        const isCookingOnlyRecheck = (entry as any).cookingPending === true && !isQualityRecheckPending;
        const previousDecision = (entry as any).recheckPreviousDecision || null;
        const hasCookingHistory = buildCookingStatusRows(entry).length > 0;
        const isCookingDrivenResample = String(entry.lotSelectionDecision || '').toUpperCase() === 'FAIL' && hasCookingHistory;
        const isConvertedLocationResample = String(entry.entryType || '').toUpperCase() === 'LOCATION_SAMPLE'
            && !!String((entry as any)?.originalEntryType || '').trim()
            && String((entry as any)?.originalEntryType || '').toUpperCase() !== 'LOCATION_SAMPLE';
        const hasResampleCollectorHistory = (Array.isArray((entry as any)?.resampleCollectedTimeline) && (entry as any).resampleCollectedTimeline.length > 0)
            || (Array.isArray((entry as any)?.resampleCollectedHistory) && (entry as any).resampleCollectedHistory.length > 0);
        const isSpecialTriggeredResamplePending = !isHardFailed
            && isConvertedLocationResample
            && hasCookingHistory
            && hasResampleCollectorHistory
            && attemptsSorted.length <= 1
            && String(entry.lotSelectionDecision || '').toUpperCase() !== 'FAIL';
        const hasCurrentResampleQuality = attemptsSorted.length > 1;
        
        // FIXED: Check if resample quality is complete (has all required fields)
        const hasCompleteResampleQuality = hasCurrentResampleQuality && attemptsSorted.length >= 2 && (() => {
            const latestAttempt = attemptsSorted[attemptsSorted.length - 1];
            return isProvidedNumeric((latestAttempt as any).moistureRaw, latestAttempt.moisture)
                && hasResampleWbActivationSnapshot(latestAttempt);
        })();
        
        const rows = attemptsSorted.map((attempt: any, idx: number) => {
            const isLast = idx === attemptsSorted.length - 1;
            let status = mapQualityDecisionToStatus(entry.lotSelectionDecision);

            // LINE-WISE logic: 1st attempt stays Pass, only the failed attempt shows Fail
            if (isHardFailed && attemptsSorted.length > 1) {
                status = isLast ? 'Fail' : 'Pass';
            } else if (isFailDecision) {
                if (attemptsSorted.length <= 1) {
                    status = 'Pass';
                } else {
                    status = isLast ? 'Pending' : 'Pass';
                }
            } else if (isLast && isQualityRecheckPending && !isCookingOnlyRecheck) {
                status = mapQualityDecisionToStatus(previousDecision || entry.lotSelectionDecision);
            } else if (isLast && isCookingDrivenResample) {
                status = 'Pass';
            }

            if (entry.workflowStatus === 'CANCELLED' && status === 'Pending') {
                status = '';
            }

            const qualityType = getQualityTypeMeta(attempt);
            return {
                type: qualityType.label,
                typeVariant: qualityType.variant,
                status
            };
        });

        if (entry.workflowStatus === 'CANCELLED') {
            return rows;
        }

        if (rows.length === 0) {
            if (isFailDecision) {
                const isSmellEntry = entry.failRemarks && entry.failRemarks.toLowerCase().includes('smell');
                if (isSmellEntry) return []; // Return empty for smell auto-fail
                return [{ type: 'Pending', typeVariant: 'default', status: 'Resampling' }];
            }
            if (isSpecialTriggeredResamplePending) {
                return [{ type: 'Pending', typeVariant: 'default', status: 'Pass' }];
            }
            if (isQualityRecheckPending && !isCookingOnlyRecheck) {
                return [{ type: 'Recheck', typeVariant: 'default', status: 'Rechecking' }];
            }
            return [];
        }

        // FIXED: Show resample status correctly
        // If FAIL decision and no resample quality yet, show "Pending/Resampling"
        if (isFailDecision && !hasCurrentResampleQuality) {
            const isSmellEntry = entry.failRemarks && entry.failRemarks.toLowerCase().includes('smell');
            if (!isSmellEntry) {
                rows.push({ type: 'Pending', typeVariant: 'default', status: 'Resampling' });
            }
        } 
        // If FAIL decision and resample quality exists but only 1 row (shouldn't happen but handle it)
        else if (isFailDecision && hasCurrentResampleQuality && rows.length === 1) {
            const onlyRow = rows[0];
            const isWbOnlyResampleRow = onlyRow?.type === '100-Gms' && onlyRow?.typeVariant === 'resample-wb';
            if (!isWbOnlyResampleRow) {
                rows.unshift({ type: 'Done', typeVariant: 'default', status: 'Pass' });
            }
        }
        // If FAIL decision and resample quality is complete, don't add extra row (it's already in rows)
        // The entry should now show in "Resample Pending" with the latest quality status
        else if (isQualityRecheckPending && !isCookingOnlyRecheck) {
            rows.push({ type: 'Recheck', typeVariant: 'default', status: 'Rechecking' });
        } else if (isSpecialTriggeredResamplePending) {
            rows.push({ type: 'Pending', typeVariant: 'default', status: 'Pass' });
        } else if (isCookingDrivenResample && !hasCurrentResampleQuality && attemptsSorted.length <= 1 && String(entry.workflowStatus || '').toUpperCase() !== 'FAILED') {
            rows.push({ type: 'Pending', typeVariant: 'default', status: 'Resampling' });
        }

        return rows;
    };

    const buildCookingStatusRows = (entry: SampleEntry) => {
        const cr = entry.cookingReport;
        const d = entry.lotSelectionDecision;
        const isSmellFail = String(entry.workflowStatus || '').toUpperCase() === 'FAILED'
            && String(entry.failRemarks || '').toLowerCase().includes('smell');
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

        if (isSmellFail && rows.length === 0) {
            return [];
        }

        if (String(d || '').toUpperCase() === 'FAIL' && rows.length === 0 && !hasStoredCookingHistory) {
            return [];
        }

        const cookingRequired =
            hasStoredCookingHistory
            || Boolean(cr?.status)
            || Boolean(pendingDone)
            || isCookingRecheckPending
            || String(d || '').toUpperCase() === 'PASS_WITH_COOKING'
            || entry.workflowStatus === 'COOKING_REPORT'
            || entry.workflowStatus === 'FINAL_REPORT'
            || entry.workflowStatus === 'LOT_ALLOTMENT'
            || entry.workflowStatus === 'COMPLETED';

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
        } else if (rows.length === 0 && cookingRequired) {
            // Show Pending only after the lot has actually entered the cooking flow.
            rows.push({
                status: 'Pending',
                remarks: '',
                doneBy: '',
                doneDate: null,
                approvedBy: '',
                approvedDate: null
            });
        }

        return rows;
    };

    const cookingBadge = (entry: SampleEntry) => {
        const rows = buildCookingStatusRows(entry);
        if (entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING' && rows.length === 0) {
            return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
        }
        const displayRows = rows;
        if (displayRows.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {displayRows.map((row, idx) => {
                    const style = getStatusStyle(row.status);
                    return (
                        <div
                            key={`${entry.id}-cook-status-${idx}`}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                width: '100%',
                                padding: '3px 2px',
                                borderBottom: idx === displayRows.length - 1 ? 'none' : '1px solid #000'
                            }}
                        >
                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#334155' }}>
                                {getSamplingLabel(idx + 1)}
                            </span>
                            <span style={{ background: style.bg, color: style.color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                                {row.status}
                            </span>
                            {row.status === 'Pass Without Cooking' && (
                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', marginTop: '1px' }}>
                                    NA | NA
                                </div>
                            )}
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

    const qualityBadge = (entry: SampleEntry) => {
        const rows = buildQualityStatusRows(entry);
        const isLightSmell = entry.smellHas && String(entry.smellType || '').toUpperCase() === 'LIGHT';

        if (rows.length === 0) {
            if (entry.workflowStatus === 'CANCELLED') return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
            
            // Check if it's a smell auto-fail decision or already failed due to smell
            const isAnyFailChoice = String(entry.lotSelectionDecision || '').toUpperCase() === 'FAIL' || entry.workflowStatus === 'FAILED';
            const isSmellEntry = entry.failRemarks && entry.failRemarks.toLowerCase().includes('smell');
            if (isAnyFailChoice && isSmellEntry) {
                const smellLabel = toTitleCase(entry.failRemarks!.replace(/^failed:\s*/i, '').trim());
                return (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        <span style={{ background: '#fff3e0', color: '#c62828', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                            {smellLabel}
                        </span>
                    </div>
                );
            }

            return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}><span style={{ background: '#f5f5f5', color: '#c62828', padding: '2px 6px', borderRadius: '10px', fontSize: '9px' }}>Pending</span></div>;
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                {rows.map((row, idx) => {
                    const typeStyle = getQualityTypeStyle(row.type, (row as any).typeVariant);
                    const statusStyle = row.status ? getStatusStyle(row.status) : { bg: 'transparent', color: 'transparent' };
                    return (
                        <div key={`${entry.id}-quality-row-${idx}`} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#334155' }}>
                                {getSamplingLabel(idx + 1)}
                            </span>
                            <span style={{ background: typeStyle.bg, color: typeStyle.color, padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>{row.type}</span>
                            {row.status ? (
                                <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>{row.status}</span>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    };

    const openEntryDetail = async (entry: SampleEntry) => {
        try {
            setDetailLoadingId(entry.id);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/sample-entries/${entry.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const fullEntry = (response.data || entry) as SampleEntry;
            setDetailEntry(fullEntry);
        } catch (error: any) {
            console.error('Failed to load entry detail', error);
            toast.error(error.response?.data?.error || 'Failed to load entry details');
            setDetailEntry(entry);
        } finally {
            setDetailLoadingId(null);
        }
    };
    useEffect(() => {
        onApprovalCountChange?.(approvalEntries.length);
    }, [approvalEntries.length, onApprovalCountChange]);

    const getWorkflowStatusMeta = (status?: string | null) => {
        const key = String(status || '').trim().toUpperCase();
        const colors: Record<string, { bg: string; color: string; label: string }> = {
            STAFF_ENTRY: { bg: '#fff8e1', color: '#f57f17', label: 'Pending' },
            QUALITY_CHECK: { bg: '#fff8e1', color: '#e65100', label: 'Pending' },
            LOT_SELECTION: { bg: '#fff8e1', color: '#f57f17', label: 'Pending' },
            COOKING_REPORT: { bg: '#fff8e1', color: '#f57f17', label: 'Pending' },
            FINAL_REPORT: { bg: '#fff8e1', color: '#283593', label: 'Pending' },
            LOT_ALLOTMENT: { bg: '#fff8e1', color: '#006064', label: 'Pending' },
            PENDING_ALLOTTING_SUPERVISOR: { bg: '#fff8e1', color: '#880e4f', label: 'Pending' },
            PHYSICAL_INSPECTION: { bg: '#ffe0b2', color: '#bf360c', label: 'Physical Inspection' },
            INVENTORY_ENTRY: { bg: '#f1f8e9', color: '#33691e', label: 'Inventory Entry' },
            COMPLETED: { bg: '#c8e6c9', color: '#1b5e20', label: 'Completed' },
            CANCELLED: { bg: '#f8bbd0', color: '#880e4f', label: 'Cancelled' },
            FAILED: { bg: '#e74c3c', color: '#ffffff', label: 'Failed' }
        };
        return colors[key] || {
            bg: '#f5f5f5',
            color: '#666',
            label: key ? toTitleCase(key.toLowerCase().replace(/_/g, ' ')) : 'Pending'
        };
    };

    const statusBadge = (entry: SampleEntry) => {
        const qp = getDisplayQualityParameters(entry) as any || {};
        const qualityRows = buildQualityStatusRows(entry);
        const cookingRows = buildCookingStatusRows(entry);
        const latestQuality = qualityRows.length > 0 ? qualityRows[qualityRows.length - 1] : null;
        const latestCooking = cookingRows.length > 0 ? cookingRows[cookingRows.length - 1] : null;
        const hasDetailedQuality = !!(qp
            && isProvidedNumeric((qp as any).cutting1Raw, qp.cutting1)
            && isProvidedNumeric((qp as any).cutting2Raw, qp.cutting2)
            && isProvidedNumeric((qp as any).bend1Raw, qp.bend1)
            && isProvidedNumeric((qp as any).bend2Raw, qp.bend2)
            && isProvidedAlpha((qp as any).mixRaw, qp.mix)
            && isProvidedAlpha((qp as any).kanduRaw, qp.kandu)
            && isProvidedAlpha((qp as any).oilRaw, qp.oil)
            && isProvidedAlpha((qp as any).skRaw, qp.sk));
        const has100GmsOnly = !!(
            qp
            && isProvidedNumeric((qp as any).moistureRaw, qp.moisture)
            && isProvidedNumeric((qp as any).grainsCountRaw, qp.grainsCount)
            && !hasDetailedQuality
        );
        const statusRows: Array<{ label: string; subLabel?: string; bg: string; color: string }> = [];

        if (entry.lotSelectionDecision === 'SOLDOUT' || (entry.workflowStatus === 'COMPLETED' && (entry.offering?.finalPrice || entry.offering?.finalBaseRate))) {
            statusRows.push({ label: 'Sold Out', bg: '#800000', color: '#ffffff' });
        } else if (entry.workflowStatus === 'FAILED' || latestCooking?.status === 'Fail' || latestQuality?.status === 'Fail') {
            const isSmellEntry = entry.failRemarks && entry.failRemarks.toLowerCase().includes('smell');
            if (isSmellEntry) {
                const smellPart = entry.failRemarks!.replace(/^failed:\s*/i, '').trim();
                // Swap: show smell type as label, and 'Fail' as subLabel (below smell)
                statusRows.push({ label: 'Fail', subLabel: toTitleCase(smellPart), bg: '#ffebee', color: '#c62828' });
            } else {
                statusRows.push({ label: 'Fail', bg: '#ffebee', color: '#c62828' });
            }
        } else if (entry.lotSelectionDecision === 'FAIL' && entry.workflowStatus !== 'FAILED') {
            statusRows.push({ label: 'Resample', bg: '#fff3e0', color: '#f57c00' });
        } else if (
            entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING'
            || (entry.lotSelectionDecision === 'PASS_WITH_COOKING' && (latestCooking?.status === 'Pass' || latestCooking?.status === 'Medium'))
        ) {
            statusRows.push({ label: has100GmsOnly ? '100-Gms Done' : 'Pass', bg: has100GmsOnly ? '#fff8e1' : '#c8e6c9', color: has100GmsOnly ? '#f57f17' : '#1b5e20' });
        } else if (latestQuality?.type === '100-Gms') {
            statusRows.push({ label: '100-Gms Done', bg: '#fff8e1', color: '#f57f17' });
        } else if (latestQuality?.type === 'Done' && entry.workflowStatus !== 'STAFF_ENTRY') {
            statusRows.push({ label: 'Pending', bg: '#fff8e1', color: '#f57f17' });
        } else {
            statusRows.push(getWorkflowStatusMeta(entry.workflowStatus));
        }

        if (entry.workflowStatus === 'CANCELLED') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                    <button
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (entry.cancelRemarks) {
                                setRemarksPopup({ isOpen: true, text: String(entry.cancelRemarks || '') });
                            }
                        }}
                        style={{
                            fontSize: '9px',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            backgroundColor: '#f8bbd0',
                            color: '#880e4f',
                            fontWeight: '800',
                            lineHeight: '1.2',
                            whiteSpace: 'normal',
                            textAlign: 'center',
                            border: '1px solid #d81b60',
                            cursor: entry.cancelRemarks ? 'pointer' : 'default',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        Cancelled
                    </button>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                {statusRows.map((row, idx) => {
                    const isSmellFail = row.label === 'Fail' && row.subLabel?.toLowerCase().includes('smell');
                    const isFailWithRemarks = (row.label === 'Fail' || row.label.startsWith('Failed:')) && entry.failRemarks && !isSmellFail;
                    if (isFailWithRemarks) {
                        return (
                            <div key={`${entry.id}-status-group-${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <button
                                    key={`${entry.id}-status-${idx}`}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRemarksPopup({ isOpen: true, text: String(entry.failRemarks || '') });
                                    }}
                                    style={{
                                        fontSize: '9px',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: row.bg,
                                        color: row.color,
                                        fontWeight: '700',
                                        lineHeight: '1.2',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'center',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {row.label} 🔍
                                </button>
                                {row.subLabel && (
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e88e5', marginTop: '3px', textAlign: 'center' }}>
                                        {row.subLabel}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return (
                        <div key={`${entry.id}-status-group-${idx}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span
                                style={{
                                    fontSize: '9px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: row.bg,
                                    color: row.color,
                                    fontWeight: '700',
                                    lineHeight: '1.2',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'center',
                                    border: '1px solid rgba(0,0,0,0.1)'
                                }}
                            >
                                {row.label}
                            </span>
                            {row.subLabel && (
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e88e5', marginTop: '3px', textAlign: 'center' }}>
                                    {row.subLabel}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const getChargeText = (value?: number | null, unit?: string | null) => {
        if (value === null || value === undefined || String(value).trim() === '') return '-';
        return `${toNumberText(value)} / ${formatToggleUnitLabel(unit || undefined)}`;
    };

    const getOfferRateText = (offering?: SampleEntry['offering']) => {
        if (!offering) return '-';
        const rateValue = offering.offerBaseRateValue ?? offering.offeringPrice;
        if (!rateValue) return '-';
        const typeText = offering.baseRateType ? offering.baseRateType.replace(/_/g, '/') : '-';
        return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offering.baseRateUnit)}`;
    };
    const getOfferSlotLabel = (key?: string | null) => {
        const match = String(key || '').toUpperCase().match(/(\d+)/);
        return match ? `Offer ${match[1]}` : 'Offer';
    };
    const getLatestOfferVersion = (offering?: SampleEntry['offering']) => {
        if (!offering) return null;
        const versions = Array.isArray(offering.offerVersions)
            ? offering.offerVersions.filter((version) => version?.offerBaseRateValue || version?.offeringPrice)
            : [];
        if (versions.length > 0) return versions[versions.length - 1];
        if (offering.offerBaseRateValue || offering.offeringPrice) {
            return {
                key: 'OFFER_1',
                offerBaseRateValue: offering.offerBaseRateValue,
                offeringPrice: offering.offeringPrice,
                baseRateType: offering.baseRateType,
                baseRateUnit: offering.baseRateUnit
            };
        }
        return null;
    };

    const getFinalRateText = (offering?: SampleEntry['offering']) => {
        if (!offering) return '-';
        const rateValue = offering.finalPrice ?? offering.finalBaseRate;
        if (!rateValue) return '-';
        const typeText = offering.baseRateType ? offering.baseRateType.replace(/_/g, '/') : '-';
        return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offering.baseRateUnit)}`;
    };
    const getLatestFinalVersion = (offering?: SampleEntry['offering']) => {
        if (!offering) return null;
        const versions = Array.isArray(offering.offerVersions)
            ? offering.offerVersions.filter((version) => version?.finalPrice || version?.finalBaseRate)
            : [];
        if (versions.length > 0) return versions[versions.length - 1];
        if (offering.finalPrice || offering.finalBaseRate) {
            return {
                key: 'FINAL',
                finalPrice: offering.finalPrice,
                finalBaseRate: offering.finalBaseRate,
                baseRateType: offering.finalBaseRateType || offering.baseRateType,
                baseRateUnit: offering.finalBaseRateUnit || offering.baseRateUnit
            };
        }
        return null;
    };

    const getPricingRows = (offering: NonNullable<SampleEntry['offering']>, mode: 'offer' | 'final') => {
        const isFinalMode = mode === 'final';
        const suteValue = isFinalMode ? offering.finalSute : offering.sute;
        const suteUnit = isFinalMode ? offering.finalSuteUnit : offering.suteUnit;

        return [
            [isFinalMode ? 'Final Rate' : 'Offer Rate', isFinalMode ? getFinalRateText(offering) : getOfferRateText(offering)],
            ['Sute', suteValue ? `${toNumberText(suteValue)} / ${formatRateUnitLabel(suteUnit)}` : '-'],
            ['Moisture', offering.moistureValue ? `${toNumberText(offering.moistureValue)}%` : '-'],
            ['Hamali', getChargeText(offering.hamali, offering.hamaliUnit)],
            ['Brokerage', getChargeText(offering.brokerage, offering.brokerageUnit)],
            ['LF', getChargeText(offering.lf, offering.lfUnit)],
            ['EGB', offering.egbType === 'mill'
                ? '0 / Mill'
                : offering.egbType === 'purchase' && offering.egbValue !== undefined && offering.egbValue !== null
                    ? `${toNumberText(offering.egbValue)} / Purchase`
                    : '-'],
            ['CD', offering.cdEnabled
                ? offering.cdValue
                    ? `${toNumberText(offering.cdValue)} / ${formatToggleUnitLabel(offering.cdUnit)}`
                    : 'Pending'
                : '-'],
            ['Bank Loan', offering.bankLoanEnabled
                ? offering.bankLoanValue
                    ? `Rs ${formatIndianCurrency(offering.bankLoanValue)} / ${formatToggleUnitLabel(offering.bankLoanUnit)}`
                    : 'Pending'
                : '-'],
            ['Payment', offering.paymentConditionValue
                ? `${offering.paymentConditionValue} ${offering.paymentConditionUnit === 'month' ? 'Month' : 'Days'}`
                : '-']
        ];
    };



    return (
        <div>
            {approvalMode === 'embedded' ? (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveView('sample-book')}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', background: activeView === 'sample-book' ? '#1565c0' : '#cbd5e1', color: activeView === 'sample-book' ? '#fff' : '#1e293b' }}
                    >
                        Paddy Sample Book
                    </button>
                    <button
                        onClick={() => setActiveView('edit-approvals')}
                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', background: activeView === 'edit-approvals' ? '#7c3aed' : '#cbd5e1', color: activeView === 'edit-approvals' ? '#fff' : '#1e293b' }}
                    >
                        Approval For Edit
                        {renderTabBadge(approvalEntries.length, '#6d28d9')}
                    </button>
                </div>
            ) : null}
            {/* Filter Bar */}
            {activeView === 'sample-book' ? (
            <div style={{ marginBottom: '0px' }}>
                <button onClick={() => setFiltersVisible(!filtersVisible)}
                    style={{ padding: '7px 16px', backgroundColor: filtersVisible ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {filtersVisible ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
                {filtersVisible && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginRight: '4px' }}>
                            {[
                                { label: 'Today', value: 'today' as const },
                                { label: 'Yesterday', value: 'yesterday' as const },
                                { label: 'Last 7 Days', value: 'last7' as const }
                            ].map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => handleQuickDateFilter(preset.value)}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '16px',
                                        border: '1px solid #90caf9',
                                        background: '#e3f2fd',
                                        color: '#1565c0',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>From Date</label>
                            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
                            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
                            <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                                <option value="">All Brokers</option>
                                {brokersList.map((b, i) => <option key={i} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Variety</label>
                            <select value={filterVariety} onChange={e => setFilterVariety(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                                <option value="">All Varieties</option>
                                {varietiesList.map((v, i) => <option key={i} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Type</label>
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '120px', backgroundColor: 'white' }}>
                                <option value="">All Types</option>
                                <option value="MS">MS</option>
                                <option value="LS">LS</option>
                                <option value="RL">RL</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Collected By</label>
                            <input
                                type="text"
                                value={filterCollectedBy}
                                onChange={e => setFilterCollectedBy(e.target.value)}
                                placeholder="Search collector..."
                                list="admin-book-collected-by"
                                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '150px' }}
                            />
                            <datalist id="admin-book-collected-by">
                                <option value="Broker Office Sample" />
                                {supervisors.map((sup) => (
                                    <option key={sup.id} value={sup.fullName || sup.username} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Location</label>
                            <input
                                type="text"
                                value={filterLocation}
                                onChange={e => setFilterLocation(e.target.value)}
                                placeholder="Search location..."
                                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '150px' }}
                            />
                        </div>
                        {(filterDateFrom || filterDateTo || filterBroker || filterVariety || filterLocation || filterCollectedBy || filterType) && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleApplyFilters} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#3498db', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Apply</button>
                                <button onClick={handleClearFilters}
                                    style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            ) : null}

            {activeView === 'edit-approvals' ? (
                <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #000', marginTop: '12px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
                    ) : approvalEntries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No edit approvals pending</div>
                    ) : (
                        <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#1f2a44', color: '#fff' }}>
                                    {['Sl No', 'Type', 'Bags', 'Pkg', 'Party Name', 'Paddy Location', 'Variety', 'Request', 'Reason', 'Requested By', 'Requested At', 'Action'].map((header) => (
                                        <th key={header} style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap', textAlign: 'left', verticalAlign: 'middle' }}>{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {approvalEntries.map((entry, index) => {
                                    const entryPending = String(entry.entryEditApprovalStatus || '').toLowerCase() === 'pending';
                                    const qualityPending = String(entry.qualityEditApprovalStatus || '').toLowerCase() === 'pending';
                                    const requestType = qualityPending ? 'Request For Quality Parameters' : 'Request For Sample Entry';
                                    const requestReason = qualityPending ? (entry.qualityEditApprovalReason || '-') : (entry.entryEditApprovalReason || '-');
                                    const requestedBy = qualityPending ? (entry.qualityEditApprovalRequestedByName || getCreatorLabel(entry)) : (entry.entryEditApprovalRequestedByName || getCreatorLabel(entry));
                                    const requestedAt = qualityPending ? entry.qualityEditApprovalRequestedAt : entry.entryEditApprovalRequestedAt;
                                    const partyDisplay = getPartyDisplayParts(entry);
                                    return (
                                        <tr key={`${entry.id}-${requestType}`} style={{ background: index % 2 === 0 ? '#fff7ed' : '#ffffff' }}>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700 }}>{index + 1}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700', color: isConvertedResampleType(entry) ? getEntryTypeTextColor(getDisplayedEntryTypeCode(entry)) : undefined }}>
                                                {isConvertedResampleType(entry)
                                                    ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}><span style={{ fontSize: '10px', color: '#888' }}>{getOriginalEntryTypeCode(entry)}</span><span style={{ color: getEntryTypeTextColor(getOriginalEntryTypeCode(entry)) }}>{getConvertedEntryTypeCode(entry)}</span></div>
                                                    : getDisplayedEntryTypeCode(entry)}
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>{entry.bags}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>{entry.packaging}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', verticalAlign: 'middle', minWidth: '180px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEntryDetail(entry)}
                                                        disabled={detailLoadingId === entry.id}
                                                        style={{ background: 'transparent', border: 'none', color: '#1565c0', textDecoration: 'underline', cursor: detailLoadingId === entry.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '13px', padding: 0, textAlign: 'left', opacity: detailLoadingId === entry.id ? 0.7 : 1 }}
                                                    >
                                                        {partyDisplay.label}
                                                    </button>
                                                    {partyDisplay.showLorrySecondLine ? (
                                                        <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: 600 }}>{partyDisplay.lorryText}</div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', verticalAlign: 'middle' }}>{toTitleCase(entry.location || '-')}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', verticalAlign: 'middle' }}>{toTitleCase(entry.variety || '-')}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'left', verticalAlign: 'middle', fontWeight: '700', color: '#7c3aed', minWidth: '170px' }}>{requestType}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', minWidth: '180px', verticalAlign: 'middle', lineHeight: 1.4 }}>{requestReason}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', verticalAlign: 'middle' }}>{requestedBy}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{formatShortDateTime(requestedAt || null) || '-'}</td>
                                            <td style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <button onClick={() => handleApprovalDecision(entry, qualityPending ? 'quality' : 'entry', 'approve')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Approve</button>
                                                    <button onClick={() => handleApprovalDecision(entry, qualityPending ? 'quality' : 'entry', 'reject')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: '#c62828', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Reject</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : null}

            {activeView === 'sample-book' ? (
            <>
            {/* Entries grouped by Date → Broker */}
            <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #000' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
                ) : Object.keys(groupedEntries).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries found</div>
                ) : (
                    Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => {
                        let brokerSeq = 0;
                        return (
                            <div key={dateKey} style={{ marginBottom: '20px' }}>
                                {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                                    const orderedEntries = [...brokerEntries].sort((a, b) => {
                                        const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                                        const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                                        if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                                    });
                                    brokerSeq++;
                                    return (
                                        <div key={brokerName} style={{ marginBottom: '12px' }}>
                                            {/* Date + Paddy Sample bar — only first broker */}
                                            {brokerIdx === 0 && <div style={{
                                                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                                                color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                                                textAlign: 'center', letterSpacing: '0.5px', minWidth: tableMinWidth
                                            }}>
                                                {(() => { const d = getEffectiveDate(brokerEntries[0]); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                                                &nbsp;&nbsp;{entryType === 'RICE_SAMPLE' ? 'Rice Sample' : 'Paddy Sample'}
                                            </div>}
                                            {/* Broker name bar */}
                                            <div style={{
                                                background: '#e8eaf6',
                                                color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                                                display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9', minWidth: tableMinWidth
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerSeq}.</span> {toTitleCase(brokerName)}
                                            </div>
                                            {/* Table */}
                                            <table style={{ width: '100%', minWidth: tableMinWidth, borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: '1px solid #000' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: entryType === 'RICE_SAMPLE' ? '#4a148c' : '#1a237e', color: 'white' }}>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>SL No</th>
                                                        {!isRiceBook && <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Type</th>}
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bags</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Pkg</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Party Name</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>{entryType === 'RICE_SAMPLE' ? 'Rice Location' : 'Paddy Location'}</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Variety</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Sample Collected By</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '11%' }}>Quality Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: isRiceBook ? '12%' : '8.5%' }}>Cooking Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '7%' }}>Offer</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Final</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '8.5%' }}>Status</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '9%' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderedEntries.map((entry, idx) => {
                                                        const qp = getDisplayQualityParameters(entry) || {};
                                                        const cr = entry.cookingReport;
                                                        const latestOfferVersion = getLatestOfferVersion(entry.offering);
                                                        const latestFinalVersion = getLatestFinalVersion(entry.offering);
                                                        const cookingFail = entry.lotSelectionDecision === 'PASS_WITH_COOKING' && cr && cr.status && cr.status.toLowerCase() === 'fail';
                                                        const cookingStatusKey = String(cr?.status || '').toUpperCase();
                                                        const isCancelled = entry.workflowStatus === 'CANCELLED';
                                                        const isFailedSmell = entry.workflowStatus === 'FAILED' && entry.failRemarks && entry.failRemarks.toLowerCase().includes('smell');
                                                        const isLightSmell = entry.smellHas && String(entry.smellType || '').toUpperCase() === 'LIGHT';
                                                        const isResampleRow =
                                                            entry.lotSelectionDecision === 'FAIL'
                                                            && entry.workflowStatus !== 'FAILED'
                                                            && !['PASS', 'MEDIUM'].includes(cookingStatusKey)
                                                            && !entry.offering?.finalPrice;
                                                        const rowBg = isCancelled
                                                            ? '#f8bbd0'
                                                            : isFailedSmell
                                                                ? '#ffebee'
                                                                : isLightSmell
                                                                    ? '#fff9c4'
                                                                    : isResampleRow
                                                                        ? '#fff3e0'
                                                                        : cookingFail
                                                                            ? '#fff0f0'
                                                                            : entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff';

                                                        const fallback = entryType === 'RICE_SAMPLE' ? '--' : '-';
                                                        const fmtVal = (v: any, forceDecimal = false, precision = 2) => {
                                                            if (v == null || v === '') return fallback;
                                                            const n = Number(v);
                                                            if (isNaN(n) || n === 0) return fallback;
                                                            if (forceDecimal) return n.toFixed(1);
                                                            if (precision > 2) return String(parseFloat(n.toFixed(precision)));
                                                            return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
                                                        };
                                                        const hasFullQuality = qp && (
                                                            isProvidedNumeric((qp as any).cutting1Raw, qp.cutting1)
                                                            || isProvidedNumeric((qp as any).bend1Raw, qp.bend1)
                                                            || isProvidedAlpha((qp as any).mixRaw, qp.mix)
                                                            || isProvidedAlpha((qp as any).mixSRaw, qp.mixS)
                                                            || isProvidedAlpha((qp as any).mixLRaw, qp.mixL)
                                                        );
                                                        return (
                                                            <tr key={entry.id} style={{ backgroundColor: rowBg }}>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '600', textAlign: 'center', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                                                                {!isRiceBook && (
                                                                    <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                        {isConvertedResampleType(entry)
                                                                            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}><span style={{ fontSize: '10px', color: '#888' }}>{getOriginalEntryTypeCode(entry)}</span><span style={{ color: getEntryTypeTextColor(getOriginalEntryTypeCode(entry)) }}>{getConvertedEntryTypeCode(entry)}</span></div>
                                                                            : <span style={{ color: getEntryTypeTextColor(getDisplayedEntryTypeCode(entry)) }}>{getDisplayedEntryTypeCode(entry)}</span>}
                                                                    </td>
                                                                )}
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>{entry.bags || '0'}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{Number(entry.packaging) === 0 ? 'Loose' : `${entry.packaging || '75'} kg`}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '14px', color: '#1565c0', fontWeight: '600', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {(() => {
                                                                        const partyDisplay = getPartyDisplayParts(entry);
                                                                        return (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => openEntryDetail(entry)}
                                                                                        disabled={detailLoadingId === entry.id}
                                                                                        style={{ 
                                                                                            background: 'transparent', 
                                                                                            border: 'none', 
                                                                                            color: '#1565c0', 
                                                                                            textDecoration: 'underline', 
                                                                                            cursor: detailLoadingId === entry.id ? 'wait' : 'pointer', 
                                                                                            fontWeight: '800', 
                                                                                            fontSize: '14.5px', 
                                                                                            padding: 0, 
                                                                                            textAlign: 'left',
                                                                                            letterSpacing: '-0.2px',
                                                                                            opacity: detailLoadingId === entry.id ? 0.7 : 1
                                                                                        }}
                                                                                    >
                                                                                        {partyDisplay.label}
                                                                                    </button>
                                                                                {partyDisplay.showLorrySecondLine ? (
                                                                                    <div style={{ fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{partyDisplay.lorryText}</div>
                                                                                ) : null}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                 <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                                    {toTitleCase(entry.location) || '-'}
                                                                    {entry.entryType === 'LOCATION_SAMPLE' && (entry as any).gpsCoordinates && (() => {
                                                                        const gps = (entry as any).gpsCoordinates;
                                                                        const query = typeof gps === 'object' ? `${gps.lat},${gps.lng}` : gps;
                                                                        return (
                                                                            <a 
                                                                                href={buildMapHref(query)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                title="View on Map"
                                                                                style={{ marginLeft: '4px', textDecoration: 'none', fontSize: '14px' }}
                                                                            >
                                                                                <span role="img" aria-label="Location pin">{'\u{1F4CD}'}</span>
                                                                            </a>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>{toTitleCase(entry.variety)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                                    {(() => {
                                                                        const collectedByDisplay = getCollectedByDisplay(entry);
                                                                        if (collectedByDisplay.secondary) {
                                                                            return (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                                                    <span style={{ color: '#333', fontSize: '13px', fontWeight: '600' }}>
                                                                                        {collectedByDisplay.primary}
                                                                                    </span>
                                                                                    <span style={{ color: '#94a3b8', fontWeight: '800', fontSize: '11px' }}>|</span>
                                                                                    <span style={{ color: '#1e293b', fontSize: '12px', fontWeight: '600' }}>
                                                                                        {collectedByDisplay.secondary}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <span style={{ color: '#333', fontSize: '13px', fontWeight: '600' }}>
                                                                                {collectedByDisplay.primary}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                                    {(() => {
                                                                        const smellType = entry.smellType || (entry.qualityParameters as any)?.smellType;
                                                                        const smellHasVal = entry.smellHas ?? (entry.qualityParameters as any)?.smellHas;
                                                                        const isSmellFail = String(entry.failRemarks || '').toLowerCase().includes('smell');
                                                                        if (smellHasVal && smellType && !isSmellFail) {
                                                                            const smellColor = smellType.toUpperCase() === 'DARK' ? '#dc2626' : smellType.toUpperCase() === 'MEDIUM' ? '#ea580c' : '#ca8a04';
                                                                            return (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                    <div style={{ fontSize: '8px', color: smellColor, fontWeight: '700' }}>{toTitleCase(smellType)} Smell</div>
                                                                                    {qualityBadge(entry)}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return qualityBadge(entry);
                                                                    })()}
                                                                </td>
                                                                <td style={{
                                                                    border: '1px solid #000',
                                                                    padding: '3px 4px',
                                                                    fontSize: '11px',
                                                                    textAlign: isRiceBook ? 'left' : 'center',
                                                                    whiteSpace: 'normal',
                                                                    lineHeight: '1.2',
                                                                    verticalAlign: 'middle',
                                                                    minWidth: isRiceBook ? undefined : '104px'
                                                                }}>
                                                                    {cookingBadge(entry)}
                                                                </td>
                                                                <td
                                                                    onClick={() => latestOfferVersion ? setPricingDetail({ entry, mode: 'offer' }) : null}
                                                                    style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: '116px', cursor: latestOfferVersion ? 'pointer' : 'default' }}
                                                                >
                                                                    {latestOfferVersion ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', width: '100%' }}>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '800' }}>{getOfferSlotLabel((latestOfferVersion as any).key)}</span>
                                                                            <span style={{ fontWeight: '700', color: '#1565c0', fontSize: '11px' }}>
                                                                                Rs {toNumberText((latestOfferVersion as any).offerBaseRateValue || (latestOfferVersion as any).offeringPrice || 0)}
                                                                            </span>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '700', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.2' }}>
                                                                                {String((latestOfferVersion as any).baseRateType || entry.offering?.baseRateType || '').replace(/_/g, '/')}
                                                                            </span>
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                                <td
                                                                    onClick={() => latestFinalVersion ? setPricingDetail({ entry, mode: 'final' }) : null}
                                                                    style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: '104px', cursor: latestFinalVersion ? 'pointer' : 'default' }}
                                                                >
                                                                    {latestFinalVersion ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', width: '100%' }}>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '800' }}>{(latestFinalVersion as any).key === 'FINAL' ? 'Final' : getOfferSlotLabel((latestFinalVersion as any).key)}</span>
                                                                            <span style={{ fontWeight: '700', color: '#2e7d32', fontSize: '11px' }}>
                                                                                Rs {toNumberText((latestFinalVersion as any).finalPrice || (latestFinalVersion as any).finalBaseRate || 0)}
                                                                            </span>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '700', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.2' }}>
                                                                                {String((latestFinalVersion as any).baseRateType || entry.offering?.baseRateType || '').replace(/_/g, '/')}
                                                                            </span>
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'normal', minWidth: '108px' }}>{statusBadge(entry)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'normal', minWidth: '120px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEntryDetail(entry)}
                                                                            disabled={detailLoadingId === entry.id}
                                                                            style={{ padding: '3px 8px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: detailLoadingId === entry.id ? 'wait' : 'pointer', fontWeight: '700', opacity: detailLoadingId === entry.id ? 0.7 : 1 }}
                                                                        >
                                                                            {detailLoadingId === entry.id ? 'Opening...' : 'View'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setRecheckModal({ isOpen: true, entry })}
                                                                            style={{ padding: '3px 8px', background: '#ef6c00', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}
                                                                        >
                                                                            Recheck
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
            </>
            ) : null}

            {/* Recheck Modal */}
            {recheckModal.isOpen && recheckModal.entry && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '360px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '800', color: '#1a237e' }}>Initiate Recheck</h3>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                            Select the type of recheck for <strong>{getPartyLabel(recheckModal.entry)}</strong>:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => handleRecheck('quality')} style={{ padding: '10px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Quality Parameters Recheck</button>
                            <button onClick={() => handleRecheck('cooking')} style={{ padding: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cooking Report Recheck</button>
                            <button onClick={() => handleRecheck('both')} style={{ padding: '10px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Both (Quality & Cooking)</button>
                        </div>
                        <button onClick={() => setRecheckModal({ isOpen: false, entry: null })} style={{ marginTop: '16px', width: '100%', padding: '8px', backgroundColor: '#eee', color: '#666', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Detail Popup — same design as AdminSampleBook */}
            {
                detailEntry && (
                    <SampleEntryDetailModal
                        detailEntry={detailEntry as any}
                        detailMode="history"
                        onClose={() => setDetailEntry(null)}
                    />
                )
            }

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
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px 0', marginTop: '12px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page <= 1 ? '#eee' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                    ← Prev
                </button>
                <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} &nbsp;({total} total)</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page >= totalPages ? '#eee' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                    Next →
                </button>
            </div>
        </div>
    );
};

export default AdminSampleBook2;
