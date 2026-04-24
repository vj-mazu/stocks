import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

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
}

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
const formatFlexibleValue = (value: any, digits = 2) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value).trim() || '-';
    const fixed = num.toFixed(digits);
    return fixed
        .replace(/(\.\d*?[1-9])0+$/, '$1')
        .replace(/\.00$/, '');
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



export const SampleEntryDetailModal = ({ detailEntry, detailMode, onClose, onUpdate }: { detailEntry: SampleEntry, detailMode: 'quick' | 'history' | 'summary' | 'full', onClose: () => void, onUpdate?: (gpsCoordinates?: string) => void | Promise<void> }) => {
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [cookingInput, setCookingInput] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isCapturingGps, setIsCapturingGps] = useState(false);
    const [isSavingGps, setIsSavingGps] = useState(false);
    const [localGps, setLocalGps] = useState<string | null>((detailEntry as any).gpsCoordinates || null);
    const [remarksPopup, setRemarksPopup] = useState({ isOpen: false, text: '' });
    const [pricingDetail, setPricingDetail] = useState<{ entry: SampleEntry, mode: 'offer' | 'final' } | null>(null);

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

    const getCollectorWithRole = (value?: string | null) => {
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
    const buildOrderedCollectorNames = (values: Array<string | null | undefined>) => values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, arr) => (
            arr.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
        ));
    const getCollectedByDisplay = (entry: SampleEntry) => {
        let rawCollector = getOriginalCollector(entry) || '';
        if (rawCollector.includes('|')) {
            const parts = rawCollector.split('|').map(s => s.trim());
            if (parts.length >= 2) {
                return { primary: getCollectorLabel(parts[1]), secondary: getCollectorLabel(parts[0]), highlightPrimary: false };
            }
        }
        const collectorLabel = getCollectorLabel(rawCollector || null);
        const extractCollectorNames = (items: any[]) => items.map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.sampleCollectedBy || item.name || '';
            return '';
        });
        const resampleTimeline = Array.isArray((entry as any)?.resampleCollectedTimeline) ? (entry as any).resampleCollectedTimeline : [];
        const resampleHistory = Array.isArray((entry as any)?.resampleCollectedHistory) ? (entry as any).resampleCollectedHistory : [];
        const orderedCollectorNames = buildOrderedCollectorNames([
            rawCollector,
            ...extractCollectorNames(resampleTimeline),
            ...extractCollectorNames(resampleHistory),
            entry.sampleCollectedBy
        ]);
        const secondaryCollector = orderedCollectorNames.length > 1
            ? getCollectorLabel(orderedCollectorNames[orderedCollectorNames.length - 1] || null)
            : null;
        return {
            primary: collectorLabel !== '-' ? collectorLabel : getCreatorLabel(entry),
            secondary: secondaryCollector && secondaryCollector !== collectorLabel ? secondaryCollector : null,
            highlightPrimary: false
        };
    };



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
        const has100g = isProvidedNumeric((attempt as any).grainsCountRaw, attempt.grainsCount);
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
                    gap: '8px'
                }}>
                    <span style={{ fontSize: '15px' }}>{icon}</span>
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 700, letterSpacing: '0.4px', fontStyle: 'italic' }}>{title}</span>
                </div>
                {/* Table */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: isCompact ? 'fit-content' : '100%', maxWidth: '100%' }}>
                    <table style={{ width: isCompact ? 'auto' : '100%', minWidth: isCompact ? '760px' : undefined, borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #dee2e6' }}>
                                {columns.map((col, i) => (
                                    <th key={i} style={{
                                        padding: '8px 8px',
                                        textAlign: 'left',
                                        color: '#495057',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        fontSize: '10.5px',
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
                            {rows.map((row, i) => (
                                <tr key={i} style={{
                                    backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafb',
                                    borderBottom: '1px solid #e9ecef'
                                }}>
                                    {row.map((cell: any, j: number) => (
                                        <td key={j} style={{
                                            padding: '7px 8px',
                                            color: '#1e293b',
                                            fontWeight: j === 0 ? 700 : 500,
                                            whiteSpace: 'nowrap',
                                            fontSize: '12px',
                                            borderRight: j < row.length - 1 ? '1px solid #f1f5f9' : 'none'
                                        }}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const buildQualityRows = () => {
        const attempts = getQualityAttemptsForEntry(detailEntry);
        if (attempts.length === 0) return [];

        return attempts.map((attempt: any, idx: number) => {
            const label = getSamplingLabel(attempt.attemptNo || idx + 1);
            const reportedAt = attempt.updatedAt || attempt.createdAt;
            
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

            return [
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
        });
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
                formatPaymentText(v.paymentConditionValue || o.paymentConditionValue || 15, v.paymentConditionUnit || o.paymentConditionUnit || 'Days')
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
                <span style={{ fontWeight: 600 }}>{formatPaymentText(o.paymentConditionValue || 15, o.paymentConditionUnit || 'Days')}</span>
            ]);
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
                                <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: getPopupSmellSummary(detailEntry as any) ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px', maxWidth: '100%' }}>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Party Name</div>
                                        {(() => {
                                            const partyDisplay = getPartyDisplayParts(detailEntry);
                                            const partyName = toTitleCase(detailEntry.partyName || '').trim();
                                            const hasParty = partyName && partyName !== '-';
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
                                                                    alert(`Found ${entries.length} entries for party "${partyName}"`);
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
                                                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partyDisplay.label}</div>
                                                    )}
                                                    {partyDisplay.showLorrySecondLine ? (
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1565c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{partyDisplay.lorryText}</div>
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
                                                                    alert(`Found ${entries.length} entries at location "${locationName}"`);
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
                                                                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
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
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: collectedByDisplay.highlightPrimary ? '#9c27b0' : '#1e293b' }}>
                                                            {collectedByDisplay.primary}
                                                        </span>
                                                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {collectedByDisplay.secondary}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: collectedByDisplay.highlightPrimary ? '#9c27b0' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {collectedByDisplay.primary}
                                                </div>
                                            );
                                        })()}
                                    </div>
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
                                        ['SAMPLE', 'REPORTED BY', 'REPORTED AT', 'MOISTURE', 'CUTTING', 'BEND', 'GRAINS COUNT', 'MIX', 'S MIX', 'L MIX', 'KANDU', 'OIL', 'SK', 'WB-R', 'WB-BK', 'WB-T', 'SMELL', 'PADDY WB'],
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
                                        'Price Comparison',
                                        '💰',
                                        '#2563eb',
                                        ['TYPE', 'REPORTED BY', 'REPORTED AT', 'RATE', 'RATE TYPE', 'SUTE', 'MOISTURE', 'HAMALI', 'BROKERAGE', 'LF', 'EGB', 'CD', 'BANK LOAN', 'PAYMENT'],
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
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localGps)}`}
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
                                            return [
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
        </>
    );
};
