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

    // Sub-tab state
    const [currentPattiTab, setCurrentPattiTab] = useState<'pending' | 'completed'>('pending');

    // States for patti calculation modal
    const [selectedEntryForPatti, setSelectedEntryForPatti] = useState<any | null>(null);
    const [isPattiReadOnly, setIsPattiReadOnly] = useState<boolean>(false);

    // State for opening the detail patti modal
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<any | null>(null);
    const [targetLorryTripId, setTargetLorryTripId] = useState<string | null>(null);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params: Record<string, string> = { 
                pageSize: String(pageSize),
                pattiStatus: currentPattiTab
            };
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
    }, [activeCursor, filters, excludeEntryType, currentPattiTab]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // Reset pagination when tab changes
    useEffect(() => {
        setActiveCursor(null);
        setCursorStack([null]);
    }, [currentPattiTab]);

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
            <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '16px', gap: '8px' }}>
                <button
                    onClick={() => setCurrentPattiTab('pending')}
                    style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: '700',
                        backgroundColor: currentPattiTab === 'pending' ? '#3498db' : '#f8f9fa',
                        color: currentPattiTab === 'pending' ? 'white' : '#495057',
                        border: '1px solid #ddd',
                        borderBottom: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px 4px 0 0'
                    }}
                >
                    Pending Patti
                </button>
                <button
                    onClick={() => setCurrentPattiTab('completed')}
                    style={{
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: '700',
                        backgroundColor: currentPattiTab === 'completed' ? '#3498db' : '#f8f9fa',
                        color: currentPattiTab === 'completed' ? 'white' : '#495057',
                        border: '1px solid #ddd',
                        borderBottom: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px 4px 0 0'
                    }}
                >
                    Completed Patti
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
                    return (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontWeight: '600' }}>
                            {currentPattiTab === 'completed' ? 'No completed patti lots found' : 'No completed lots with pending patti found'}
                        </div>
                    );
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
                                                                            onClick={() => {
                                                                                setSelectedEntryForPatti(entry);
                                                                                setIsPattiReadOnly(currentPattiTab === 'completed');
                                                                            }}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '3px 4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: '700',
                                                                                backgroundColor: currentPattiTab === 'completed' ? '#3b82f6' : '#27ae60',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                textAlign: 'center'
                                                                            }}
                                                                        >
                                                                            {currentPattiTab === 'completed' ? 'View Patti' : 'Patti'}
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
                                                                                        🚚 LORRY WISE LINKED FINAL RATE DETAIL ({progress.previousInspections.length})
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
                            const payNum = Number(payVal);
                            const payDisplay = payVal != null && payVal !== '' ? (isFinite(payNum) ? String(parseFloat(payNum.toFixed(2))) : payVal) : '';
                            return payDisplay !== '' ? `${payDisplay} ${payUnit === 'month' ? 'Month' : 'Days'}` : '-';
                        })()
                    ) : (
                        '-'
                    )}
                </td>
                <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center' }}>
                    {insp.linkedPattiRate ? (
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>
                            Rs {toNumberText(insp.linkedPattiRate.rate)} ({(() => { const t = insp.linkedPattiRate.rateType || 'WB'; return t === 'PD_LOOSE' ? 'PD/Loose' : t === 'MD_LOOSE' ? 'MD/Loose' : String(t).replace(/_/g, '/'); })()})
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

            {/* Render Patti Calculation Modal */}
            {selectedEntryForPatti && (
                <PattiCalculationModal
                    entry={selectedEntryForPatti}
                    isReadOnly={isPattiReadOnly}
                    onClose={() => setSelectedEntryForPatti(null)}
                    onSaved={() => {
                        setSelectedEntryForPatti(null);
                        fetchEntries();
                    }}
                />
            )}
        </div>
    );
};

// Patti Calculation Modal Component
// Patti Calculation Modal Component
interface PattiCalculationModalProps {
    entry: any;
    isReadOnly: boolean;
    onClose: () => void;
    onSaved: () => void;
}

interface CustomPattiItem {
    id: string;
    label: string;
    amount: number | string;
}

const PattiCalculationModal: React.FC<PattiCalculationModalProps> = ({ entry, isReadOnly, onClose, onSaved }) => {
    const inspections = entry.lotAllotment?.physicalInspections || [];
    const pattiTrips = inspections.filter((insp: any) => insp.linkedPattiRate != null)
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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

    // Additions & Deductions & Per-Lorry Packaging State
    const savedPatti = entry.pattiRecord || {};
    const initialLorryPackagings = savedPatti.lorryPackagings || {};
    const pkgKg = Number(String(entry.packaging || '75').replace(/[^0-9.]/g, '')) || 75;

    const [lorryPackagings] = useState<{ [key: string]: number }>(() => {
        const initial: { [key: string]: number } = {};
        pattiTrips.forEach((insp: any) => {
            if (initialLorryPackagings[insp.id] !== undefined) {
                initial[insp.id] = Number(initialLorryPackagings[insp.id]);
            } else {
                const lorryPkg = insp.sampleEntry?.packaging || entry.packaging || '75';
                initial[insp.id] = Number(String(lorryPkg).replace(/[^0-9.]/g, '')) || 75;
            }
        });
        return initial;
    });

    const [hamaliRate, setHamaliRate] = useState<number>(savedPatti.hamaliRate !== undefined ? Number(savedPatti.hamaliRate) : 12);
    const [hamaliUnit, setHamaliUnit] = useState<string>(savedPatti.hamaliUnit || 'per_bag');

    const [brokerageRate, setBrokerageRate] = useState<number>(savedPatti.brokerageRate !== undefined ? Number(savedPatti.brokerageRate) : 11);
    const [brokerageUnit, setBrokerageUnit] = useState<string>(savedPatti.brokerageUnit || 'per_qtl');

    const [lessDf, setLessDf] = useState<number>(savedPatti.lessDf !== undefined ? Number(savedPatti.lessDf) : 0);
    const [lessWb, setLessWb] = useState<number>(savedPatti.lessWb !== undefined ? Number(savedPatti.lessWb) : 0);

    // Dynamic custom additions (+ Add)
    const [customAdditions, setCustomAdditions] = useState<CustomPattiItem[]>(() => {
        if (Array.isArray(savedPatti.customAdditions) && savedPatti.customAdditions.length > 0) {
            return savedPatti.customAdditions.map((item: any, idx: number) => ({
                id: item.id || `add-${idx}-${Date.now()}`,
                label: item.label || '',
                amount: item.amount !== undefined ? item.amount : ''
            }));
        }
        return [];
    });

    // Dynamic custom deductions (- Less)
    const [customDeductions, setCustomDeductions] = useState<CustomPattiItem[]>(() => {
        if (Array.isArray(savedPatti.customDeductions) && savedPatti.customDeductions.length > 0) {
            return savedPatti.customDeductions.map((item: any, idx: number) => ({
                id: item.id || `less-${idx}-${Date.now()}`,
                label: item.label || '',
                amount: item.amount !== undefined ? item.amount : ''
            }));
        }
        return [];
    });

    const handleAddAdditionRow = () => {
        setCustomAdditions(prev => [...prev, { id: `add-${Date.now()}`, label: '', amount: '' }]);
    };

    const handleRemoveAdditionRow = (id: string) => {
        setCustomAdditions(prev => prev.filter(r => r.id !== id));
    };

    const handleUpdateAdditionRow = (id: string, field: 'label' | 'amount', value: any) => {
        setCustomAdditions(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleAddDeductionRow = () => {
        setCustomDeductions(prev => [...prev, { id: `less-${Date.now()}`, label: '', amount: '' }]);
    };

    const handleRemoveDeductionRow = (id: string) => {
        setCustomDeductions(prev => prev.filter(r => r.id !== id));
    };

    const handleUpdateDeductionRow = (id: string, field: 'label' | 'amount', value: any) => {
        setCustomDeductions(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    // Calculate totals of patti-linked trips dynamically based on current lorry packaging state
    const calculatedTrips = pattiTrips.map((insp: any) => {
        const bags = Number(getApprovedFullAvgBags(insp.samplingStages || {}, insp.bags) || 0);
        const netWt = Number(insp.lorryTransitDetail?.netWeight || 0);
        const sute = Number(insp.linkedPattiRate?.sute || 0);
        const shoot = Math.round(sute * bags); // Rounded integer with no decimals
        const suteNetWt = Math.round(Math.max(0, netWt - shoot));
        const rate = Number(insp.linkedPattiRate?.rate || 0);
        
        // Fetch customized or default packaging size for this lorry
        const lorryPkgDefault = insp.sampleEntry?.packaging || entry.packaging || '75';
        const kg = lorryPackagings[insp.id] || Number(String(lorryPkgDefault).replace(/[^0-9.]/g, '')) || 75;
        const amount = Math.round((suteNetWt * rate) / kg);
        const unloadingDate = insp.lorryTransitDetail?.placeDate || insp.inspectionDate;

        return {
            id: insp.id,
            unloadingDate,
            bags,
            kg,
            variety: entry.variety,
            netWt,
            shoot,
            suteNetWt,
            rate,
            amount,
            lorryNo: insp.lorryNumber?.toUpperCase() || '-'
        };
    });

    const totalBags = calculatedTrips.reduce((sum, t) => sum + t.bags, 0);
    const totalNetWt = calculatedTrips.reduce((sum, t) => sum + t.netWt, 0);
    const totalShoot = Math.round(calculatedTrips.reduce((sum, t) => sum + t.shoot, 0));
    const totalSuteNetWt = Math.round(calculatedTrips.reduce((sum, t) => sum + t.suteNetWt, 0));
    const totalLorryAmount = calculatedTrips.reduce((sum, t) => sum + t.amount, 0);

    // Hamali calculation: if per_qtl -> (totalNetWt / 100) * rate, if per_bag -> totalBags * rate
    const hamaliAmount = Number((
        hamaliUnit === 'per_qtl'
            ? ((totalNetWt / 100) * hamaliRate)
            : (totalBags * hamaliRate)
    ).toFixed(2));

    // Brokerage calculation: if per_qtl -> (totalNetWt / 100) * rate (using Gross Net.wt, not sute net wt), if per_bag -> totalBags * rate
    const brokerageAmount = Number((
        brokerageUnit === 'per_bag'
            ? (totalBags * brokerageRate)
            : ((totalNetWt / 100) * brokerageRate)
    ).toFixed(2));

    const totalCustomAdditions = customAdditions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalCustomDeductions = customDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const totalAdditions = Number((hamaliAmount + brokerageAmount + totalCustomAdditions).toFixed(2));
    const totalDeductions = Number((Number(lessDf) + Number(lessWb) + totalCustomDeductions).toFixed(2));
    const grandTotal = Math.round(totalLorryAmount + totalAdditions - totalDeductions);

    // Left side stats
    const avgWbPerBag = totalBags > 0 ? (totalNetWt / totalBags).toFixed(2) : '0';
    const avgRate = totalSuteNetWt > 0 ? Math.round((grandTotal / totalSuteNetWt) * pkgKg) : 0;

    const [isSavingPatti, setIsSavingPatti] = useState(false);

    const handleSave = async () => {
        if (isSavingPatti) return;
        try {
            setIsSavingPatti(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/sample-entries/${entry.id}/patti`, {
                hamaliRate,
                hamaliUnit,
                hamaliAmount,
                brokerageRate,
                brokerageUnit,
                brokerageAmount,
                customAdditions,
                lessDf,
                lessWb,
                customDeductions,
                totalAmount: totalLorryAmount,
                grandTotal,
                avgWbPerBag: Number(avgWbPerBag),
                avgRate,
                lorryPackagings
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Patti Record saved successfully!');
            onSaved();
        } catch (err: any) {
            console.error('Error saving patti:', err);
            toast.error(err.response?.data?.error || 'Failed to save Patti Record');
        } finally {
            setIsSavingPatti(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1050
        }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .patti-print-area, .patti-print-area * {
                        visibility: visible;
                    }
                    .patti-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />
            
            <div className="patti-print-area" style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '8px',
                width: '92%',
                maxWidth: '920px',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #333', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', color: '#111827', fontWeight: '800', letterSpacing: '0.5px' }}>
                            KBD
                        </h2>
                        <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px', fontWeight: '600' }}>
                            Party: <span style={{ color: '#111827' }}>{entry.partyName}</span> | Location: <span style={{ color: '#111827' }}>{entry.location}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151' }}>Date: {new Date().toLocaleDateString('en-GB')}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#e5e7eb', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                Pkg: {entry.packaging || 75} Kg
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                Type: {entry.rateType || entry.sampleType || (entry.wbInputType === 'party' ? 'PD' : 'WB') || 'PD/WB'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px', border: '1px solid #000' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #000' }}>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '700' }}>un.date</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '700' }}>Bags</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontWeight: '700' }}>Verity</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '700' }}>Net.wt</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '700' }}>Shoot</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '700' }}>Net.wt</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '700' }}>Rate</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '700' }}>Amount</th>
                            <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontWeight: '700' }}>Lorry</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calculatedTrips.map((trip, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                    {trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-GB') : '-'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{trip.bags}</td>
                                <td style={{ border: '1px solid #000', padding: '6px' }}>{trip.variety}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{trip.netWt}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>{trip.shoot}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '600' }}>{trip.suteNetWt}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{trip.rate}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: '600' }}>{trip.amount.toLocaleString('en-IN')}</td>
                                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: '700' }}>{trip.lorryNo}</td>
                            </tr>
                        ))}
                        {/* Totals Row */}
                        <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #000', borderBottom: '2px solid #000', fontWeight: '800' }}>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Total</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{totalBags}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{totalNetWt}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#dc2626' }}>{totalShoot}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{totalSuteNetWt}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{totalLorryAmount.toLocaleString('en-IN')}</td>
                            <td style={{ border: '1px solid #000', padding: '8px' }}></td>
                        </tr>
                    </tbody>
                </table>

                {/* Bottom Calculations Layout: Left Stats + Right Breakdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', gap: '20px', flexWrap: 'wrap' }}>
                    {/* Left Side: Avg Stats */}
                    <div style={{ flex: 1, minWidth: '220px', padding: '12px 16px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#dc2626', marginBottom: '14px' }}>
                            Avg WB Per Bag: {avgWbPerBag}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#dc2626', lineHeight: '1.4' }}>
                            Avg Rate &nbsp;: {avgRate.toLocaleString('en-IN')}
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>
                                {pkgKg} Kg Bag
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Calculation Breakdown */}
                    <div style={{ width: '100%', maxWidth: '440px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '2px solid #000', marginBottom: '6px', fontSize: '14px' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a' }}>Lorry Total Amount:</span>
                            <span style={{ fontWeight: '800', color: '#0f172a' }}>Rs {totalLorryAmount.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Hamali */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                            <span style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>Add: Hamali @</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    readOnly
                                    value={hamaliRate}
                                    style={{ width: '55px', padding: '3px', textAlign: 'center', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f1f5f9', color: '#334155', fontWeight: '700', cursor: 'not-allowed' }}
                                />
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                                    {hamaliUnit === 'per_qtl' ? '/ qtl' : '/ bag'}
                                </span>
                            </div>
                            <span style={{ fontWeight: '600' }}>Rs {hamaliAmount.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Brokerage */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                            <span style={{ whiteSpace: 'nowrap', fontWeight: '500' }}>Add: Brokerage @</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="number"
                                    readOnly
                                    value={brokerageRate}
                                    style={{ width: '55px', padding: '3px', textAlign: 'center', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f1f5f9', color: '#334155', fontWeight: '700', cursor: 'not-allowed' }}
                                />
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                                    {brokerageUnit === 'per_bag' ? '/ bag' : '/ qtl'}
                                </span>
                            </div>
                            <span style={{ fontWeight: '600' }}>Rs {brokerageAmount.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Dynamic Custom Additions */}
                        {customAdditions.map((item) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                                <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '14px' }}>+</span>
                                <input
                                    type="text"
                                    disabled={isReadOnly}
                                    placeholder="Addition Description (Alphanumeric)"
                                    value={item.label}
                                    onChange={(e) => handleUpdateAdditionRow(item.id, 'label', e.target.value)}
                                    style={{ flex: 1, padding: '3px 6px', fontSize: '12px', border: '1.5px solid #16a34a', borderRadius: '3px', boxSizing: 'border-box' }}
                                />
                                <input
                                    type="number"
                                    disabled={isReadOnly}
                                    placeholder="Amount"
                                    value={item.amount}
                                    onChange={(e) => handleUpdateAdditionRow(item.id, 'amount', e.target.value)}
                                    style={{ width: '85px', padding: '3px 6px', fontSize: '12px', border: '1.5px solid #16a34a', borderRadius: '3px', textAlign: 'right', boxSizing: 'border-box' }}
                                />
                                {!isReadOnly && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAdditionRow(item.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}
                                        title="Remove row"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Button to add dynamic addition row */}
                        {!isReadOnly && (
                            <div style={{ padding: '3px 0' }}>
                                <button
                                    type="button"
                                    onClick={handleAddAdditionRow}
                                    style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    + Add Addition Row
                                </button>
                            </div>
                        )}

                        {/* Sub Total (Additions) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', color: '#16a34a', fontWeight: '700' }}>
                            <span>Total Additions:</span>
                            <span>Rs {totalAdditions.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Less DF */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                            <span>Less: DF:</span>
                            <input
                                type="number"
                                disabled={isReadOnly}
                                value={lessDf}
                                onChange={(e) => setLessDf(Number(e.target.value))}
                                style={{ width: '80px', padding: '2px', textAlign: 'right', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
                            />
                            <span style={{ fontWeight: '600', color: '#dc2626' }}>- Rs {Number(lessDf).toLocaleString('en-IN')}</span>
                        </div>

                        {/* Less WB */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                            <span>Less: WB:</span>
                            <input
                                type="number"
                                disabled={isReadOnly}
                                value={lessWb}
                                onChange={(e) => setLessWb(Number(e.target.value))}
                                style={{ width: '80px', padding: '2px', textAlign: 'right', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
                            />
                            <span style={{ fontWeight: '600', color: '#dc2626' }}>- Rs {Number(lessWb).toLocaleString('en-IN')}</span>
                        </div>

                        {/* Dynamic Custom Deductions */}
                        {customDeductions.map((item) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                                <span style={{ color: '#dc2626', fontWeight: '800', fontSize: '14px' }}>-</span>
                                <input
                                    type="text"
                                    disabled={isReadOnly}
                                    placeholder="Deduction Description (Alphanumeric)"
                                    value={item.label}
                                    onChange={(e) => handleUpdateDeductionRow(item.id, 'label', e.target.value)}
                                    style={{ flex: 1, padding: '3px 6px', fontSize: '12px', border: '1.5px solid #dc2626', borderRadius: '3px', boxSizing: 'border-box' }}
                                />
                                <input
                                    type="number"
                                    disabled={isReadOnly}
                                    placeholder="Amount"
                                    value={item.amount}
                                    onChange={(e) => handleUpdateDeductionRow(item.id, 'amount', e.target.value)}
                                    style={{ width: '85px', padding: '3px 6px', fontSize: '12px', border: '1.5px solid #dc2626', borderRadius: '3px', textAlign: 'right', boxSizing: 'border-box' }}
                                />
                                {!isReadOnly && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveDeductionRow(item.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}
                                        title="Remove row"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}

                        {/* Button to add dynamic deduction row */}
                        {!isReadOnly && (
                            <div style={{ padding: '3px 0' }}>
                                <button
                                    type="button"
                                    onClick={handleAddDeductionRow}
                                    style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    - Add Deduction Row
                                </button>
                            </div>
                        )}

                        {/* Grand Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #000', borderBottom: '2px double #000', marginTop: '8px', fontSize: '15px', fontWeight: '800', color: '#1e3a8a' }}>
                            <span>Grand Total:</span>
                            <span>Rs {grandTotal.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            backgroundColor: '#f9fafb'
                        }}
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '700'
                        }}
                    >
                        🖨️ Print Patti
                    </button>
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={isSavingPatti}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: isSavingPatti ? '#6ee7b7' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSavingPatti ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: '700'
                            }}
                        >
                            {isSavingPatti ? '⏳ Saving Patti...' : '💾 Save & Complete Patti'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompletedLots;
