import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../utils/toast';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

interface SampleEntry {
    id: string;
    entryDate: string;
    brokerName: string;
    variety: string;
    partyName: string;
    location: string;
    bags: number;
    packaging: string;
    workflowStatus: string;
    qualityParameters?: any;
    offering?: any;
    creator?: { username: string };
    entryType?: string;
    lorryNumber?: string;
    lotAllotment?: {
        id: number;
        allottedBags: number;
        allottedToSupervisorId: number;
        closedAt: string | null;
        supervisor?: {
            id: number;
            username: string;
            fullName: string | null;
        };
        physicalInspections?: any[];
    };
    createdAt?: string;
}

interface InspectionProgress {
    totalBags: number;
    inspectedBags: number;
    remainingBags: number;
    progressPercentage: number;
    previousInspections: any[];
}

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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

const formatPackagingLabel = (value?: string | number | null) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    const normalized = raw.toLowerCase();
    if (normalized === '0' || normalized === 'loose') return 'Loose';
    if (normalized === '75' || normalized === '75 kg') return '75 Kg';
    if (normalized === '40' || normalized === '40 kg') return '40 Kg';
    if (normalized === '26' || normalized === '26 kg') return '26 Kg';
    if (normalized === '50' || normalized === '50 kg') return '50 Kg';
    return `${raw} Kg`;
};

const getDisplayedEntryTypeCode = (entry: any) => {
    const type = entry.entryType || entry.originalEntryType || 'MS';
    if (type === 'MILL_SAMPLE') return 'MS';
    if (type === 'LOCATION_SAMPLE') return 'LS';
    if (type === 'DIRECT_LOADED_VEHICLE') return 'DV';
    if (type === 'READY_LORRY') return 'RL';
    return 'MS';
};

const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#4caf50'; // Green
    if (percentage >= 50) return '#ff9800';  // Orange
    return '#f44336';                         // Red
};

const getEntryTypeTextColor = (code: string) => {
    if (code === 'MS') return '#166534';
    if (code === 'LS') return '#c2410c';
    if (code === 'RL') return '#1565c0';
    if (code === 'DV') return '#b7791f';
    return '#1e293b';
};

const getOriginalEntryTypeCode = (entry: any) => {
    const type = entry.originalEntryType || entry.entryType || 'MS';
    if (type === 'MILL_SAMPLE') return 'MS';
    if (type === 'LOCATION_SAMPLE') return 'LS';
    if (type === 'DIRECT_LOADED_VEHICLE') return 'DV';
    if (type === 'READY_LORRY') return 'RL';
    return 'MS';
};

const getConvertedEntryTypeCode = (entry: any) => {
    const type = entry.entryType || 'MS';
    if (type === 'MILL_SAMPLE') return 'MS';
    if (type === 'LOCATION_SAMPLE') return 'LS';
    if (type === 'DIRECT_LOADED_VEHICLE') return 'DV';
    if (type === 'READY_LORRY') return 'RL';
    return 'MS';
};

const isConvertedResampleType = (entry: any) => {
    return !!entry.originalEntryType && entry.originalEntryType !== entry.entryType;
};

const formatShortDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '-';
    }
};

interface CompletedLotsProps {
    excludeEntryType?: string;
}

const CompletedLots: React.FC<CompletedLotsProps> = ({ excludeEntryType }) => {
    const { user } = useAuth();
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeCursor, setActiveCursor] = useState<string | null>(null);
    const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [nextPageCursor, setNextPageCursor] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
    const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});
    const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});
    const pageSize = 50;

    // State for opening the detail patti modal
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<any | null>(null);
    const [targetLorryTripId, setTargetLorryTripId] = useState<string | null>(null);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params: Record<string, string> = { pageSize: String(pageSize) };
            if (activeCursor) {
                params.cursor = activeCursor;
            }
            if (filters.broker) params.broker = filters.broker;
            if (filters.variety) params.variety = filters.variety;
            if (filters.party) params.party = filters.party;
            if (filters.location) params.location = filters.location;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (excludeEntryType) params.excludeEntryType = excludeEntryType;

            const res = await axios.get(`${API_URL}/sample-entries/tabs/completed-lots`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const data = res.data as any;
            const fetchedEntries = data.entries || [];
            setEntries(fetchedEntries);
            setHasNextPage(data.pagination?.hasNextPage || false);
            setNextPageCursor(data.pagination?.nextCursor || null);

            // Compute inspection progress details locally
            const progressCache: { [key: string]: InspectionProgress } = {};
            fetchedEntries.forEach((entry: any) => {
                const totalBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
                const inspections = entry.lotAllotment?.physicalInspections || [];
                const inspectedBags = inspections.reduce((sum: number, inspection: any) => sum + (inspection.bags || 0), 0);
                const remainingBags = entry.lotAllotment?.closedAt ? 0 : Math.max(0, totalBags - inspectedBags);
                const progressPercentage = entry.lotAllotment?.closedAt ? 100 : Math.min(100, (totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0));
                
                progressCache[entry.id] = {
                    totalBags,
                    inspectedBags,
                    remainingBags,
                    progressPercentage,
                    previousInspections: [...inspections].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                };
            });
            setInspectionProgress(progressCache);

        } catch (err) {
            console.error('Error fetching completed lots:', err);
        }
        setLoading(false);
    }, [activeCursor, filters, excludeEntryType]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const toggleExpand = (entryId: string) => {
        setExpandedEntries(prev => ({
            ...prev,
            [entryId]: !prev[entryId]
        }));
    };

    const handleNextPage = () => {
        if (nextPageCursor) {
            setCursorStack(prev => [...prev, nextPageCursor]);
            setActiveCursor(nextPageCursor);
        }
    };

    const handlePrevPage = () => {
        if (cursorStack.length > 1) {
            const newStack = [...cursorStack];
            newStack.pop();
            const prevCursor = newStack[newStack.length - 1];
            setCursorStack(newStack);
            setActiveCursor(prevCursor);
        }
    };

    const handleActionClick = () => {
        toast.info("Still not updated");
    };

    const handleOpenDetailModal = (entry: SampleEntry) => {
        setSelectedEntryForDetail(entry);
        setTargetLorryTripId(null);
    };

    return (
        <div>
            {/* Sub-tab view mimicking screenshot */}
            <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '16px' }}>
                <button
                    style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: '700',
                        backgroundColor: '#f8f9fa',
                        color: '#495057',
                        border: '1px solid #ddd',
                        borderBottom: 'none',
                        borderRight: '3px solid #3498db',
                        cursor: 'default',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    Pending Patti
                </button>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: '600' }}>Showing {entries.length} completed lots</span>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}
                >
                    {showFilters ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
            </div>

            {showFilters && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                    {(['broker', 'variety', 'party', 'location'] as const).map(key => (
                        <input key={key} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} value={filters[key]}
                            onChange={e => setFilters({ ...filters, [key]: e.target.value })}
                            style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }} />
                    ))}
                    <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <button onClick={() => { setActiveCursor(null); setCursorStack([null]); fetchEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>Apply</button>
                    <button onClick={() => { setFilters({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' }); setActiveCursor(null); setCursorStack([null]); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>Clear</button>
                </div>
            )}
            {(() => {
                const groupedEntries: { [date: string]: { [broker: string]: SampleEntry[] } } = {};
                entries.forEach((entry) => {
                    const d = new Date(entry.entryDate);
                    const dateKey = entry.entryDate
                        ? `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
                        : 'No Date';
                    const brokerKey = entry.brokerName || 'Unknown';
                    if (!groupedEntries[dateKey]) groupedEntries[dateKey] = {};
                    if (!groupedEntries[dateKey][brokerKey]) groupedEntries[dateKey][brokerKey] = [];
                    groupedEntries[dateKey][brokerKey].push(entry);
                });

                if (loading) {
                    return <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontWeight: '600' }}>Loading...</div>;
                }
                if (entries.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontWeight: '600' }}>No completed lots with pending patti found</div>;
                }

                return Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => (
                    <div key={dateKey} style={{ marginBottom: '15px' }}>
                        {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                            return (
                                <div key={brokerName} style={{ marginBottom: '5px' }}>
                                    {brokerIdx === 0 && (
                                        <div style={{
                                            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                                            color: 'white',
                                            padding: '6px 10px',
                                            fontWeight: '700',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {dateKey}
                                        </div>
                                    )}
                                    <div style={{
                                        background: '#e8eaf6',
                                        color: '#000',
                                        padding: '3px 10px',
                                        fontWeight: '700',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        borderBottom: '1px solid #c5cae9'
                                    }}>
                                        <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerIdx + 1}.</span> {brokerName}
                                    </div>
                                    <div style={{ overflowX: 'auto', border: '1px solid #000' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000' }}>
                                            <thead>
                                                <tr style={{ background: '#1a237e', color: 'white', borderBottom: '1px solid #000' }}>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '3%' }}>SL No</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '4%' }}>Type</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '4.5%' }}>Bags</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '4%' }}>Pkg</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '16%' }}>Party Name</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Paddy Location</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Variety</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Loaded</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Balance</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Progress</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '11%' }}>Allotted Supervisor</th>
                                                    <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '11%' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {brokerEntries.map((entry, idx) => {
                                                    const progress = inspectionProgress[entry.id];
                                                    const progressPercentage = progress?.progressPercentage || 0;
                                                    const hasPreviousInspections = progress && progress.previousInspections && progress.previousInspections.length > 0;
                                                    const currentSupervisor = entry.lotAllotment?.supervisor;
                                                    const supervisorName = currentSupervisor ? (currentSupervisor.fullName || currentSupervisor.username) : '-';

                                                    const isRLEntry = entry.entryType === 'DIRECT_LOADED_VEHICLE' || 
                                                                      entry.entryType === 'READY_LORRY' || 
                                                                      (entry as any).originalEntryType === 'DIRECT_LOADED_VEHICLE' || 
                                                                      (entry as any).originalEntryType === 'READY_LORRY';
                                                    const partyLabel = isRLEntry ? (entry.lorryNumber?.toUpperCase() || toTitleCase(entry.partyName) || '-') : (toTitleCase(entry.partyName) || entry.lorryNumber?.toUpperCase() || '-');

                                                    return (
                                                        <React.Fragment key={entry.id}>
                                                            <tr style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9f9f9', borderBottom: '1px solid #000' }}>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '700' }}>
                                                                    {idx + 1}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '700' }}>
                                                                    {(() => {
                                                                        const typeCode = getDisplayedEntryTypeCode(entry);
                                                                        const isResample = isConvertedResampleType(entry);
                                                                        if (isResample) {
                                                                            const orig = getOriginalEntryTypeCode(entry);
                                                                            const conv = getConvertedEntryTypeCode(entry);
                                                                            return (
                                                                                <span style={{ color: getEntryTypeTextColor(orig) }}>
                                                                                    {orig}➡️<span style={{ color: getEntryTypeTextColor(conv) }}>{conv}</span>
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return <span style={{ color: getEntryTypeTextColor(typeCode) }}>{typeCode}</span>;
                                                                    })()}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '700' }}>{entry.bags}</td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center' }}>{formatPackagingLabel(entry.packaging)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700' }}>
                                                                    <div style={{ color: '#1e3a8a', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleOpenDetailModal(entry)}>
                                                                        {partyLabel}
                                                                    </div>
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px' }}>{toTitleCase(entry.location)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px' }}>{entry.variety}</td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '700', color: '#1e3a8a' }}>
                                                                    {progress?.inspectedBags || 0}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '700', color: (progress?.remainingBags || 0) > 0 ? '#b91c1c' : '#1e293b' }}>
                                                                    {progress?.remainingBags || 0}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                                                                        <div style={{
                                                                            flex: 1,
                                                                            height: '18px',
                                                                            backgroundColor: '#e0e0e0',
                                                                            borderRadius: '9px',
                                                                            overflow: 'hidden',
                                                                            minWidth: '70px'
                                                                        }}>
                                                                            <div style={{
                                                                                height: '100%',
                                                                                width: `${progressPercentage}%`,
                                                                                backgroundColor: getProgressColor(progressPercentage),
                                                                                transition: 'width 0.3s ease',
                                                                                borderRadius: '9px'
                                                                            }} />
                                                                        </div>
                                                                        <span style={{ fontSize: '10px', fontWeight: '600', minWidth: '45px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                            {`${progressPercentage.toFixed(0)}%`}
                                                                        </span>
                                                                    </div>
                                                                    {hasPreviousInspections && (
                                                                        <button onClick={() => toggleExpand(entry.id)} style={{ fontSize: '9px', padding: '2px 6px', marginTop: '3px', border: '1px solid #94a3b8', borderRadius: '3px', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
                                                                            {expandedEntries[entry.id] === true ? '🔼 Hide Lorry' : '🔽 Show Lorry'}
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                                                    {supervisorName}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                                                                        <button
                                                                            onClick={handleActionClick}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '3px 4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: '700',
                                                                                backgroundColor: '#27ae60',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                textAlign: 'center'
                                                                            }}
                                                                        >
                                                                            Patti
                                                                        </button>
                                                                        <button
                                                                            onClick={handleActionClick}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '3px 4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: '700',
                                                                                backgroundColor: '#27ae60',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                textAlign: 'center'
                                                                            }}
                                                                        >
                                                                            - Advance
                                                                        </button>
                                                                        <button
                                                                            onClick={handleActionClick}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '3px 4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: '700',
                                                                                backgroundColor: '#27ae60',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                textAlign: 'center'
                                                                            }}
                                                                        >
                                                                            + Broker Advance
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* Expanded Lorry Trips table block (Collapsible manually) */}
                                                            {expandedEntries[entry.id] === true && hasPreviousInspections && (
                                                                <tr>
                                                                    <td colSpan={12} style={{ padding: '8px', backgroundColor: '#fdf6f0', border: '1px solid #000' }}>
                                                                        {(() => {
                                                                            const getValueWithFallback = (field: 'moisture' | 'cutting' | 'bend', currentIdx: number) => {
                                                                                const currentLorry = (progress.previousInspections[currentIdx]?.lorryNumber || '').trim().toUpperCase();
                                                                                const hasSameLorryPrevious = progress.previousInspections.some((insp: any, i: number) => 
                                                                                    i < currentIdx && (insp.lorryNumber || '').trim().toUpperCase() === currentLorry
                                                                                );
                                                                                
                                                                                const collectStages = (insp: any) => {
                                                                                    const stgList = insp.samplingStages || {};
                                                                                    const stagesToCheck: any[] = [];
                                                                                    const balancedLotKey = Object.keys(stgList).find(key => key === 'balanced_lot' || key.startsWith('balanced_lot_hold_'));
                                                                                    const balancedLotStage = balancedLotKey ? stgList[balancedLotKey] : null;
                                                                                    if (balancedLotStage?.reportedBy) stagesToCheck.push(balancedLotStage);
                                                                                    if (stgList.full_avg?.reportedBy) stagesToCheck.push(stgList.full_avg);
                                                                                    if (stgList.half_lorry?.reportedBy) stagesToCheck.push(stgList.half_lorry);
                                                                                    const nitKeys = Object.keys(stgList)
                                                                                        .filter(k => k.startsWith('nit_avg') && stgList[k]?.reportedBy)
                                                                                        .sort((a, b) => {
                                                                                            if (a === 'nit_avg') return -1;
                                                                                            if (b === 'nit_avg') return 1;
                                                                                            const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                                                                                            const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                                                                                            return numB - numA;
                                                                                        });
                                                                                    nitKeys.forEach(k => stagesToCheck.push(stgList[k]));
                                                                                    const lotAvgKey = Object.keys(stgList).find(key => key === 'lot_avg' || key.startsWith('lot_avg_hold_'));
                                                                                    const lotAvgStage = lotAvgKey ? stgList[lotAvgKey] : null;
                                                                                    if (lotAvgStage?.reportedBy) stagesToCheck.push(lotAvgStage);
                                                                                    return stagesToCheck;
                                                                                };
                                                                                
                                                                                const extractNonZero = (stg: any) => {
                                                                                    if (!stg) return null;
                                                                                    if (field === 'moisture') {
                                                                                        if (stg.moistureRaw) return `${stg.moistureRaw}%`;
                                                                                        if (stg.moisture !== undefined && stg.moisture !== null && String(stg.moisture).trim() !== '' && String(stg.moisture).trim() !== '-') {
                                                                                            return `${stg.moisture}%`;
                                                                                        }
                                                                                    } else if (field === 'cutting') {
                                                                                        if (stg.cutting1 !== undefined && stg.cutting1 !== null && String(stg.cutting1).trim() !== '' && String(stg.cutting1).trim() !== '-') {
                                                                                            const c1 = parseFloat(stg.cutting1);
                                                                                            const c2 = parseFloat(stg.cutting2) || 0;
                                                                                            if (!isNaN(c1) && c2 > 0) return `${isNaN(c1) || c1 === 0 ? 1 : c1}×${c2}`;
                                                                                        }
                                                                                    } else if (field === 'bend') {
                                                                                        if (stg.bend1 !== undefined && stg.bend1 !== null && String(stg.bend1).trim() !== '' && String(stg.bend1).trim() !== '-') {
                                                                                            const b1 = parseFloat(stg.bend1);
                                                                                            const b2 = parseFloat(stg.bend2) || 0;
                                                                                            if (!isNaN(b1) && b2 > 0) return `${isNaN(b1) || b1 === 0 ? 1 : b1}×${b2}`;
                                                                                        }
                                                                                    }
                                                                                    return null;
                                                                                };
                                                                                
                                                                                const extractAny = (stg: any) => {
                                                                                    if (!stg) return null;
                                                                                    if (field === 'cutting') {
                                                                                        if (stg.cutting1 !== undefined && stg.cutting1 !== null && String(stg.cutting1).trim() !== '' && String(stg.cutting1).trim() !== '-') {
                                                                                            const c1 = parseFloat(stg.cutting1);
                                                                                            const c2 = parseFloat(stg.cutting2) || 0;
                                                                                            return `${isNaN(c1) || c1 === 0 ? 1 : c1}×${c2}`;
                                                                                        }
                                                                                    } else if (field === 'bend') {
                                                                                        if (stg.bend1 !== undefined && stg.bend1 !== null && String(stg.bend1).trim() !== '' && String(stg.bend1).trim() !== '-') {
                                                                                            const b1 = parseFloat(stg.bend1);
                                                                                            const b2 = parseFloat(stg.bend2) || 0;
                                                                                            return `${isNaN(b1) || b1 === 0 ? 1 : b1}×${b2}`;
                                                                                        }
                                                                                    }
                                                                                    return null;
                                                                                };
                                                                                
                                                                                // Pass 1: Non-zero values — same lorry first, then any if no same lorry exists
                                                                                for (let i = currentIdx; i >= 0; i--) {
                                                                                    const insp = progress.previousInspections[i];
                                                                                    if (!insp) continue;
                                                                                    if (i !== currentIdx && hasSameLorryPrevious) {
                                                                                        const prevLorry = (insp.lorryNumber || '').trim().toUpperCase();
                                                                                        if (prevLorry !== currentLorry) continue;
                                                                                    }
                                                                                    for (const stg of collectStages(insp)) {
                                                                                        const val = extractNonZero(stg);
                                                                                        if (val) return val;
                                                                                    }
                                                                                }
                                                                                
                                                                                // Pass 2: Any values (even zero) for cutting/bend — same lorry first, then any
                                                                                for (let i = currentIdx; i >= 0; i--) {
                                                                                    const insp = progress.previousInspections[i];
                                                                                    if (!insp) continue;
                                                                                    if (i !== currentIdx && hasSameLorryPrevious) {
                                                                                        const prevLorry = (insp.lorryNumber || '').trim().toUpperCase();
                                                                                        if (prevLorry !== currentLorry) continue;
                                                                                    }
                                                                                    for (const stg of collectStages(insp)) {
                                                                                        const val = extractAny(stg);
                                                                                        if (val) return val;
                                                                                    }
                                                                                }
                                                                                
                                                                                return '-';
                                                                            };

                                                                            const getApprovedFullAvgBags = (stages: any, defaultBags: number) => {
                                                                                if (stages.balanced_lot?.approvalStatus === 'approved') return stages.balanced_lot.actualBags || defaultBags;
                                                                                if (stages.full_avg?.approvalStatus === 'approved') return stages.full_avg.actualBags || defaultBags;
                                                                                if (stages.half_lorry?.approvalStatus === 'approved') return stages.half_lorry.actualBags || defaultBags;
                                                                                const keys = Object.keys(stages).filter(k => k.startsWith('nit_avg'));
                                                                                for (const k of keys) {
                                                                                    if (stages[k]?.approvalStatus === 'approved') return stages[k].actualBags || defaultBags;
                                                                                }
                                                                                if (stages.lot_avg?.approvalStatus === 'approved') return stages.lot_avg.actualBags || defaultBags;
                                                                                return defaultBags;
                                                                            };

                                                                            return (
                                                                                <>
                                                                                    <div style={{ fontSize: '12px', fontWeight: '800', marginBottom: '4px', color: '#1a237e' }}>
                                                                                        🚚 LORRY TRIP FINAL RATE DETAILS ({progress.previousInspections.length})
                                                                                    </div>
                                                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000', backgroundColor: '#ffffff' }}>
                                                                                        <thead>
                                                                                            <tr style={{ backgroundColor: '#f1f5f9', color: '#000', borderBottom: '1px solid #000' }}>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '4%' }}>SL No</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Date</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'left', width: '15%' }}>Lorry No</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Bags</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Moisture</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Cutting</th>
                                                                                                <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Bend</th><th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Sute</th>
                      <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Payment Days</th>
                      <th style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700', textAlign: 'center', width: '20%' }}>Final Rate</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {progress.previousInspections.map((insp: any, iIdx: number) => {
                                                                                                const stages = insp.samplingStages || {};
                                                                                                const moistureVal = getValueWithFallback('moisture', iIdx);
                                                                                                const cuttingVal = getValueWithFallback('cutting', iIdx);
                                                                                                const bendVal = getValueWithFallback('bend', iIdx);
 
                                                                                                return (
                                                                                                    <tr key={insp.id || iIdx} style={{ borderBottom: '1px solid #000', backgroundColor: iIdx % 2 === 0 ? '#ffffff' : '#f9f9f9' }}>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>{iIdx + 1}</td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center' }}>
                                                                                                            {new Date(insp.inspectionDate).toLocaleDateString('en-GB')}
                                                                                                        </td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', fontWeight: '700' }}>
                                                                                                            {insp.lorryNumber?.toUpperCase() || '-'}
                                                                                                        </td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>{getApprovedFullAvgBags(stages, insp.bags) || '-'}</td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>{moistureVal}</td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>{cuttingVal}</td>
                                                                                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>{bendVal}</td><td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>
                    {insp.linkedPattiRate ? (
                        insp.linkedPattiRate.sute !== undefined && insp.linkedPattiRate.sute !== null
                            ? `Rs ${toNumberText(insp.linkedPattiRate.sute)} / ${insp.linkedPattiRate.suteUnit === 'per_bag' ? 'Bag' : 'Ton'}`
                            : '0'
                    ) : (
                        '-'
                    )}
                </td>
                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontWeight: '600' }}>
                    {insp.linkedPattiRate ? (
                        (() => {
                            // Payment condition comes from the entry's offering/patti that was linked to this trip
                            const payVal = entry.offering?.paymentConditionValue;
                            const payUnit = entry.offering?.paymentConditionUnit || 'Days';
                            return payVal != null && payVal !== '' ? `${payVal} ${payUnit === 'month' ? 'Month' : 'Days'}` : '-';
                        })()
                    ) : (
                        '-'
                    )}
                </td>
                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center' }}>
                    {insp.linkedPattiRate ? (
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>
                            Rs {insp.linkedPattiRate.rate} ({insp.linkedPattiRate.rateType === 'PD_LOOSE' ? 'Loose' : insp.linkedPattiRate.rateType || 'WB'})
                        </span>
                    ) : (
                        <span style={{ color: '#d97706', fontWeight: '700' }}>Pending</span>
                    )}
                </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ));
            })()}

            {/* Cursor Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <button 
                    disabled={cursorStack.length <= 1} 
                    onClick={handlePrevPage} 
                    style={{ 
                        padding: '6px 12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px', 
                        cursor: cursorStack.length <= 1 ? 'not-allowed' : 'pointer', 
                        background: cursorStack.length <= 1 ? '#f5f5f5' : 'white',
                        fontWeight: '700',
                        color: '#111827'
                    }}
                >
                    ← Prev
                </button>
                <span style={{ padding: '6px 12px', fontSize: '13px', color: '#111827', fontWeight: '800' }}>
                    Page {cursorStack.length}
                </span>
                <button 
                    disabled={!hasNextPage} 
                    onClick={handleNextPage} 
                    style={{ 
                        padding: '6px 12px', 
                        border: '1px solid #ddd', 
                        borderRadius: '4px', 
                        cursor: !hasNextPage ? 'not-allowed' : 'pointer', 
                        background: !hasNextPage ? '#f5f5f5' : 'white',
                        fontWeight: '700',
                        color: '#111827'
                    }}
                >
                    Next →
                </button>
            </div>
 
            {/* Render Patti Linking Details popup modal */}
            {selectedEntryForDetail && (
                <SampleEntryDetailModal
                    detailEntry={selectedEntryForDetail}
                    detailMode="history"
                    progressiveMode={true}
                    completedLotsOrder={true}
                    onClose={() => setSelectedEntryForDetail(null)}
                    showCollectorLoginPair={true}
                    targetLorryTripId={targetLorryTripId || undefined}
                />
            )}
        </div>
    );
};
 
export default CompletedLots;
