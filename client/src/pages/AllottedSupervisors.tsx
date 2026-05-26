import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

import { API_URL } from '../config/api';
import {
  getDisplayedEntryTypeCode,
  getEntryTypeTextColor,
  getOriginalEntryTypeCode,
  getConvertedEntryTypeCode,
  isConvertedResampleType
} from '../utils/sampleTypeDisplay';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  workflowStatus: string;
  entryType?: string;
  originalEntryType?: string;
  packaging?: string;
  serialNo?: number;
  lorryNumber?: string;
  lotAllotment?: {
    id: string;
    allottedToSupervisorId: number;
    allottedBags?: number;
    closedAt?: string | null;
    supervisor: {
      id: number;
      username: string;
    };
    physicalInspections?: {
      id: string;
      inspectionDate: string;
      lorryNumber: string;
      bags: number;
      cutting1: number;
      cutting2: number;
      bend: number;
      reportedBy: {
        username: string;
      };
    }[];
  };
}

interface Supervisor {
  id: number;
  username: string;
  fullName?: string | null;
  staffType?: string | null;
}

const formatDecimal = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const num = Number(val);
  return isNaN(num) ? val.toString() : num.toString();
};

const handleCuttingInput = (value: string, entryType?: string) => {
  if (entryType === 'RICE_SAMPLE') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return { raw: cleaned, part1: cleaned, part2: '' };
    return { raw: cleaned, part1: cleaned, part2: '' };
  }

  let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return { raw: clean, part1: first, part2: second || '' };
};

const handleBendInput = (value: string, entryType?: string) => {
  if (entryType === 'RICE_SAMPLE') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return { raw: cleaned, part1: cleaned, part2: '' };
    return { raw: cleaned, part1: cleaned, part2: '' };
  }

  let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return { raw: clean, part1: first, part2: second || '' };
};

interface PreviousInspection {
  id: string;
  inspectionDate: string;
  lorryNumber: string;
  bags: number;
  cutting1: number;
  cutting2: number;
  bend: number;
  bend2?: number;
  reportedBy: {
    username: string;
  };
}

interface InspectionProgress {
  totalBags: number;
  inspectedBags: number;
  remainingBags: number;
  progressPercentage: number;
  previousInspections: PreviousInspection[];
}

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
  if (hasResampleFlow) {
    if (entry?.resampleStartAt) return new Date(entry.resampleStartAt);
    if (entry?.lotSelectionAt) return new Date(entry.lotSelectionAt);
    if (entry?.updatedAt) return new Date(entry.updatedAt);
  }
  return new Date(entry.entryDate);
};

const AllottedSupervisors: React.FC = () => {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupervisors, setSelectedSupervisors] = useState<{ [key: string]: number }>({});
  const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});
  const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});
  const [closingEntryId, setClosingEntryId] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [offeringCache, setOfferingCache] = useState<{ [key: string]: any }>({});
  const [editingInspection, setEditingInspection] = useState<{ entryId: string; inspectionId: string; data: any } | null>(null);
  const [editValuesEntry, setEditValuesEntry] = useState<SampleEntry | null>(null);
  const [editValuesData, setEditValuesData] = useState<any>({});
  const [isSavingValues, setIsSavingValues] = useState(false);
  const [detailModalEntry, setDetailModalEntry] = useState<SampleEntry | null>(null);

  const openDetailEntry = async (entry: SampleEntry) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sample-entries/${entry.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailModalEntry((response.data || entry) as SampleEntry);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entry details', 'error');
      setDetailModalEntry(entry);
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalEntries, setTotalEntries] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brokerOptions, setBrokerOptions] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [varietyOptions, setVarietyOptions] = useState<string[]>([]);  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    broker: '',
    variety: '',
    party: '',
    status: ''
  });



  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadSupervisors();
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
  }, [currentPage, filters]);

  const applyFilters = (allEntries: any[]) => {
    return allEntries.filter((entry: any) => {
      // Date filter
      if (filters.startDate) {
        const entryDate = new Date(entry.entryDate);
        const startDate = new Date(filters.startDate);
        if (entryDate < startDate) return false;
      }
      if (filters.endDate) {
        const entryDate = new Date(entry.entryDate);
        const endDate = new Date(filters.endDate);
        if (entryDate > endDate) return false;
      }
      // Broker filter
      if (filters.broker && !entry.brokerName?.toLowerCase().includes(filters.broker.toLowerCase())) {
        return false;
      }
      // Variety filter
      if (filters.variety && !entry.variety?.toLowerCase().includes(filters.variety.toLowerCase())) {
        return false;
      }
      // Party filter
      if (filters.party && !entry.partyName?.toLowerCase().includes(filters.party.toLowerCase())) {
        return false;
      }
      // Status filter
      if (filters.status && entry.workflowStatus !== filters.status) {
        return false;
      }
      return true;
    });
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch entries with multiple statuses to ensure they don't disappear after workflow progresses
      const [lotAllotmentResponse, physicalInspectionResponse, inventoryResponse, ownerFinancialResponse, managerFinancialResponse, finalReviewResponse, completedResponse] = await Promise.all([
        axios.get(`${API_URL}/sample-entries/by-role?status=LOT_ALLOTMENT`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=PHYSICAL_INSPECTION`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=INVENTORY_ENTRY`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=OWNER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=MANAGER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=FINAL_REVIEW`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=COMPLETED`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const lotAllotmentEntries = (lotAllotmentResponse.data as any).entries || [];
      const physicalInspectionEntries = (physicalInspectionResponse.data as any).entries || [];
      const inventoryEntries = (inventoryResponse.data as any).entries || [];
      const ownerFinancialEntries = (ownerFinancialResponse.data as any).entries || [];
      const managerFinancialEntries = (managerFinancialResponse.data as any).entries || [];
      const finalReviewEntries = (finalReviewResponse.data as any).entries || [];
      const completedEntries = (completedResponse.data as any).entries || [];

      // Combine all arrays and remove duplicates
      const allMap = new Map();
      [...lotAllotmentEntries, ...physicalInspectionEntries, ...inventoryEntries, ...ownerFinancialEntries, ...managerFinancialEntries, ...finalReviewEntries, ...completedEntries].forEach((entry: any) => {
        allMap.set(entry.id, entry);
      });
      // Filter out entries that do not have an allotted supervisor
      let allEntries = Array.from(allMap.values()).filter((entry: any) => entry.lotAllotment && entry.lotAllotment.allottedToSupervisorId);

      // Extract unique broker and variety options for dropdowns
      const brokerSet = new Set(allEntries.map((e: any) => e.brokerName).filter(Boolean));
      const varietySet = new Set(allEntries.map((e: any) => e.variety).filter(Boolean));
      const brokers = Array.from(brokerSet).sort();
      const varieties = Array.from(varietySet).sort();
      setBrokerOptions(brokers);
      setVarietyOptions(varieties);

      // Apply filters
      allEntries = applyFilters(allEntries);

      const sortedAllEntries = [...allEntries].sort((a, b) => {
        const dateCompare = getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime();
        if (dateCompare !== 0) return dateCompare;
        const brokerCompare = String(a.brokerName || '').localeCompare(String(b.brokerName || ''));
        if (brokerCompare !== 0) return brokerCompare;
        const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
        const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
        if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      setTotalEntries(sortedAllEntries.length);

      // Apply pagination
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedEntries = sortedAllEntries.slice(startIndex, startIndex + pageSize);
      setEntries(paginatedEntries);

      // Pre-populate selected supervisors with current assignments
      const preSelected: { [key: string]: number } = {};
      allEntries.forEach((entry: SampleEntry) => {
        if (entry.lotAllotment?.allottedToSupervisorId) {
          preSelected[entry.id] = entry.lotAllotment.allottedToSupervisorId;
        }
      });
      setSelectedSupervisors(preSelected);

      // Load offering data in batch
      const offerCache: { [key: string]: any } = {};
      if (allEntries.length > 0) {
        try {
          const ids = allEntries.map((e: SampleEntry) => e.id).join(',');
          const offerRes = await axios.get(`${API_URL}/sample-entries/offering-data-batch?ids=${ids}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (offerRes.data) {
            Object.assign(offerCache, offerRes.data);
          }
        } catch {
          // Fallback to individual calls if batch fails
          for (const entry of allEntries) {
            try {
              const offerRes = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (offerRes.data) offerCache[entry.id] = offerRes.data;
            } catch { /* skip */ }
          }
        }
      }
      setOfferingCache(offerCache);

      // Calculate inspection progress locally for each entry
      const progressCache: { [key: string]: InspectionProgress } = {};
      allEntries.forEach((entry: SampleEntry) => {
        const totalBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
        const inspections = entry.lotAllotment?.physicalInspections || [];
        const inspectedBags = inspections.reduce((sum, inspection) => sum + (inspection.bags || 0), 0);
        const remainingBags = entry.lotAllotment?.closedAt ? 0 : Math.max(0, totalBags - inspectedBags);
        const progressPercentage = entry.lotAllotment?.closedAt ? 100 : (totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0);
        
        progressCache[entry.id] = {
          totalBags,
          inspectedBags,
          remainingBags,
          progressPercentage,
          previousInspections: inspections.map(inspection => ({
            id: inspection.id,
            inspectionDate: inspection.inspectionDate,
            lorryNumber: inspection.lorryNumber,
            bags: inspection.bags,
            cutting1: inspection.cutting1,
            cutting2: inspection.cutting2,
            bend: inspection.bend,
            bend2: (inspection as any).bend2,
            reportedBy: inspection.reportedBy || { username: 'System' }
          }))
        };
      });
      setInspectionProgress(progressCache);

    } catch (error: any) {
      console.error('Error loading allotted entries:', error);
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInspectionProgress = async (entryId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<InspectionProgress>(`${API_URL}/sample-entries/${entryId}/inspection-progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: response.data as InspectionProgress
      }));
    } catch (error: any) {
      console.error('Failed to load inspection progress for', entryId, error);
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: {
          totalBags: 0,
          inspectedBags: 0,
          remainingBags: 0,
          progressPercentage: 0,
          previousInspections: []
        }
      }));
    }
  };

  const loadSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sample-entries/paddy-supervisors?staffType=location`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const locationStaff = (response.data as any).users || [];
      setSupervisors(locationStaff);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load supervisors', 'error');
    }
  };

  const handleSupervisorChange = (entryId: string, supervisorId: number) => {
    setSelectedSupervisors(prev => ({
      ...prev,
      [entryId]: supervisorId
    }));
  };

  const handleReassign = async (entryId: string) => {
    const supervisorId = selectedSupervisors[entryId];
    const entry = entries.find(e => e.id === entryId);

    if (!supervisorId) {
      showNotification('Please select a physical supervisor', 'error');
      return;
    }

    // Check if supervisor actually changed
    if (entry?.lotAllotment?.allottedToSupervisorId === supervisorId) {
      showNotification('Please select a different supervisor to reassign', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // Update existing lot allotment
      await axios.put(
        `${API_URL}/sample-entries/${entryId}/lot-allotment`,
        {
          physicalSupervisorId: supervisorId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Physical supervisor reassigned successfully', 'success');
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to reassign supervisor', 'error');
    }
  };

  const handleCloseLot = async (entryId: string, reason?: string) => {
    const progress = inspectionProgress[entryId];

    if (!progress || progress.inspectedBags === 0) {
      showNotification('Cannot close lot with 0 inspected bags. At least one inspection trip is required.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/close-lot`,
        { reason: reason || `Party did not send remaining ${progress.remainingBags} bags` },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification(
        `Lot closed successfully! ${progress.inspectedBags} bags proceed to inventory. ${progress.remainingBags} bags marked as not received.`,
        'success'
      );
      setIsCloseModalOpen(false);
      setClosingEntryId(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to close lot', 'error');
    }
  };

  const toggleExpand = (entryId: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#2e7d32';
    if (percentage >= 50) return '#d97706';
    return '#dc2626';
  };

  const handleEditInspection = (entryId: string, inspection: PreviousInspection) => {
    const formatEditDecimal = (val: any) => {
      if (val === undefined || val === null || val === '') return '';
      const num = Number(val);
      return isNaN(num) ? val.toString() : num.toString();
    };

    const c1 = formatEditDecimal(inspection.cutting1);
    const c2 = formatEditDecimal(inspection.cutting2);
    const cuttingText = (c2 && c2 !== '0') ? `${c1}x${c2}` : c1;

    const b1 = formatEditDecimal(inspection.bend);
    const b2 = formatEditDecimal(inspection.bend2);
    const bendText = (b2 && b2 !== '0') ? `${b1}x${b2}` : b1;

    setEditingInspection({
      entryId,
      inspectionId: inspection.id,
      data: {
        lorryNumber: inspection.lorryNumber || '',
        bags: inspection.bags?.toString() || '',
        cutting: cuttingText,
        bend: bendText,
        remarks: ''
      }
    });
  };

  const handleOpenEditValues = (entry: SampleEntry) => {
    const o = offeringCache[entry.id] || {};
    setEditValuesEntry(entry);
    setEditValuesData({
      finalBaseRate: o.finalBaseRate?.toString() ?? o.offerBaseRateValue?.toString() ?? '',
      baseRateType: o.baseRateType || 'PD_LOOSE',
      sute: o.finalSute?.toString() ?? o.sute?.toString() ?? '',
      suteUnit: o.finalSuteUnit || o.suteUnit || 'per_bag',
      moistureValue: o.moistureValue?.toString() ?? '',
      hamali: o.hamali?.toString() ?? '',
      hamaliUnit: o.hamaliUnit || 'per_bag',
      brokerage: o.brokerage?.toString() ?? '',
      brokerageUnit: o.brokerageUnit || 'per_bag',
      lf: o.lf?.toString() ?? '',
      lfUnit: o.lfUnit || 'per_bag',
      egbValue: o.egbValue?.toString() ?? '',
      egbType: o.egbType || ((o.egbValue && parseFloat(o.egbValue) > 0) ? 'purchase' : 'mill')
    });
  };

  const handleSaveEditValues = async () => {
    if (!editValuesEntry || isSavingValues) return;
    try {
      setIsSavingValues(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${editValuesEntry.id}/final-price`,
        { ...editValuesData, isFinalized: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Values updated successfully', 'success');
      setEditValuesEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save values', 'error');
    } finally {
      setIsSavingValues(false);
    }
  };

  const handleSaveInspection = async () => {
    if (!editingInspection) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/sample-entries/${editingInspection.entryId}/physical-inspection/${editingInspection.inspectionId}`,
        {
          lorryNumber: editingInspection.data.lorryNumber,
          bags: editingInspection.data.bags ? parseInt(editingInspection.data.bags) : undefined,
          cutting1: (() => { const parts = (editingInspection.data.cutting || '').split(/[xX×]/); return parseFloat(parts[0]?.trim()) || undefined; })(),
          cutting2: (() => { const parts = (editingInspection.data.cutting || '').split(/[xX×]/); return parts.length > 1 ? (parseFloat(parts[1]?.trim()) || 0) : 0; })(),
          bend: (() => { const parts = (editingInspection.data.bend || '').split(/[xX×]/); return parseFloat(parts[0]?.trim()) || undefined; })(),
          bend2: (() => { const parts = (editingInspection.data.bend || '').split(/[xX×]/); return parts.length > 1 ? (parseFloat(parts[1]?.trim()) || 0) : 0; })(),
          remarks: editingInspection.data.remarks || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Inspection updated successfully', 'success');
      setEditingInspection(null);
      await loadInspectionProgress(editingInspection.entryId);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update inspection', 'error');
    }
  };

  // Group entries by Date + Broker
  const groupedEntries: Record<string, Record<string, SampleEntry[]>> = {};
  entries.forEach(entry => {
    const d = getEffectiveDate(entry);
    const dateKey = entry.entryDate
      ? `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
      : 'No Date';
    const brokerKey = entry.brokerName || 'Unknown';
    if (!groupedEntries[dateKey]) groupedEntries[dateKey] = {};
    if (!groupedEntries[dateKey][brokerKey]) groupedEntries[dateKey][brokerKey] = [];
    groupedEntries[dateKey][brokerKey].push(entry);
  });

  return (
    <div>
      {/* Filters hidden */}

      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #999' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No allotted supervisors found</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => (
            <div key={dateKey} style={{ marginBottom: '20px' }}>
              {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                // Sort broker entries by serialNo ascending
                const orderedEntries = [...brokerEntries].sort((a, b) => {
                  const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                  const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                  if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                  return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                });

                return (
                  <div key={brokerName} style={{ marginBottom: '0px' }}>
                    {/* Date bar — only first broker */}
                    {brokerIdx === 0 && (
                      <div style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                        textAlign: 'center', letterSpacing: '0.5px'
                      }}>
                        {dateKey} &nbsp;&nbsp; Paddy Sample
                      </div>
                    )}
                    {/* Broker name bar */}
                    <div style={{
                      background: '#e8eaf6',
                      color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                      display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerIdx + 1}.</span> {brokerName}
                    </div>
                    <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '3.5%' }}>SL No</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '3.5%' }}>Type</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '4.5%' }}>Bags</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '3.5%' }}>Pkg</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '15%' }}>Party Name</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '11%' }}>Paddy Location</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '11%' }}>Variety</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '5.5%' }}>Loaded</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '5.5%' }}>Balance</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', width: '9%' }}>Progress</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '9%' }}>Supervisor</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '9%' }}>Change To</th>
                          <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left',   whiteSpace: 'normal', wordBreak: 'break-word', width: '10%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedEntries.map((entry, index) => {
                          const currentSupervisor = entry.lotAllotment?.supervisor;
                          const hasChanged = currentSupervisor && selectedSupervisors[entry.id] !== currentSupervisor.id;
                          const progress = inspectionProgress[entry.id];
                          const progressPercentage = progress?.progressPercentage || 0;
                          const hasPreviousInspections = progress && progress.previousInspections && progress.previousInspections.length > 0;

                          const formatTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
                          const partyNameText = entry.partyName ? formatTitleCase(entry.partyName).trim() : '';
                          const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
                          const isRLEntry = entry.entryType === 'DIRECT_LOADED_VEHICLE' || (entry as any).originalEntryType === 'DIRECT_LOADED_VEHICLE';
                          const partyLabel = partyNameText || lorryText || '-';
                          const showLorrySecondLine = isRLEntry
                            && !!partyNameText
                            && !!lorryText
                            && partyNameText.toUpperCase() !== lorryText;

                          return (
                            <React.Fragment key={entry.id}>
                              <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#1a1a1a' }}>
                                  {index + 1}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700' }}>
                                  {(() => {
                                    const typeCode = getDisplayedEntryTypeCode(entry);
                                    const isResample = isConvertedResampleType(entry);
                                    if (isResample) {
                                      const orig = getOriginalEntryTypeCode(entry);
                                      const conv = getConvertedEntryTypeCode(entry);
                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                          <span style={{ fontSize: '9px', fontWeight: 800, color: getEntryTypeTextColor(orig) }}>{orig}</span>
                                          <span style={{
                                            display: 'inline-block',
                                            minWidth: '28px',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            textAlign: 'center',
                                            color: conv === 'RL' || conv === 'LS' ? '#fff' : '#166534',
                                            backgroundColor: conv === 'RL' ? '#1565c0' : conv === 'LS' ? '#c2410c' : '#fff',
                                            border: conv === 'MS' ? '1px solid #166534' : 'none'
                                          }}>{conv}</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <span style={{
                                        display: 'inline-block',
                                        minWidth: '28px',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        color: typeCode === 'RL' || typeCode === 'LS' ? '#fff' : '#166534',
                                        backgroundColor: typeCode === 'RL' ? '#1565c0' : typeCode === 'LS' ? '#c2410c' : '#fff',
                                        border: typeCode === 'MS' ? '1px solid #166534' : 'none'
                                      }}>{typeCode}</span>
                                    );
                                  })()}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#1a1a1a' }}>
                                  {entry.lotAllotment?.allottedBags || entry.bags}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', color: '#1a1a1a' }}>
                                  {entry.packaging ? (String(entry.packaging).toLowerCase().includes('kg') ? entry.packaging : `${entry.packaging} Kg`) : '75 Kg'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '12px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span
                                      onClick={() => openDetailEntry(entry)}
                                      style={{
                                        color: '#1565c0',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '13px'
                                      }}
                                    >
                                      {partyLabel}
                                    </span>
                                    {showLorrySecondLine ? (
                                      <div style={{ fontSize: '11px', color: '#1565c0', fontWeight: '600' }}>{lorryText}</div>
                                    ) : null}
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '12px', color: '#1a1a1a' }}>
                                  {entry.location ? formatTitleCase(entry.location) : '-'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '12px', color: '#1a1a1a' }}>
                                  {entry.variety ? formatTitleCase(entry.variety) : '-'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#4CAF50' }}>
                                  {progress?.inspectedBags || 0}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: entry.lotAllotment?.closedAt ? '#d32f2f' : (progress?.remainingBags === 0 ? '#4CAF50' : '#FF9800') }}>
                                  {entry.lotAllotment?.closedAt ? (
                                    <span>0 <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#777' }}>(Closed)</span></span>
                                  ) : (
                                    progress?.remainingBags ?? (entry.lotAllotment?.allottedBags || entry.bags)
                                  )}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                                    <div style={{
                                      flex: 1,
                                      height: '18px',
                                      backgroundColor: '#e0e0e0',
                                      borderRadius: '9px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        height: '100%',
                                        width: `${entry.lotAllotment?.closedAt ? 100 : progressPercentage}%`,
                                        backgroundColor: entry.lotAllotment?.closedAt ? '#7f8c8d' : getProgressColor(progressPercentage),
                                        transition: 'width 0.3s ease',
                                        borderRadius: '9px'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: '600', minWidth: '30px' }}>
                                      {entry.lotAllotment?.closedAt ? 'Closed' : `${progressPercentage.toFixed(0)}%`}
                                    </span>
                                  </div>
                                  {hasPreviousInspections && (
                                    <button
                                      onClick={() => toggleExpand(entry.id)}
                                      style={{
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        marginTop: '3px',
                                        backgroundColor: 'transparent',
                                        color: '#4a90e2',
                                        border: '1px solid #4a90e2',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        display: 'block',
                                        width: '100%'
                                      }}
                                    >
                                      {expandedEntries[entry.id] ? '▲ Hide Details' : `▼ ${progress.previousInspections.length} Trip(s)`}
                                    </button>
                                  )}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '12px', color: '#1a1a1a' }}>
                                  {currentSupervisor ? (
                                    <span style={{
                                      color: '#111',
                                      fontWeight: '600',
                                      padding: '3px 4px',
                                      backgroundColor: '#e3f2fd',
                                      borderRadius: '3px',
                                      border: '1px solid #b3d7ff'
                                    }}>
                                      {currentSupervisor.username}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#999', fontStyle: 'italic' }}>Not assigned</span>
                                  )}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>
                                  <select
                                    value={selectedSupervisors[entry.id] || ''}
                                    onChange={(e) => handleSupervisorChange(entry.id, Number(e.target.value))}
                                    disabled={!!entry.lotAllotment?.closedAt}
                                    style={{
                                      width: '100%',
                                      padding: '3px 4px',
                                      fontSize: '12px',
                                      border: '1px solid #999',
                                      borderRadius: '3px',
                                      backgroundColor: entry.lotAllotment?.closedAt ? '#f5f5f5' : (hasChanged ? '#fff3cd' : 'white'),
                                      color: entry.lotAllotment?.closedAt ? '#777' : '#1a1a1a',
                                      fontWeight: '500',
                                      cursor: entry.lotAllotment?.closedAt ? 'not-allowed' : 'default'
                                    }}
                                  >
                                    <option value="">-- Select --</option>
                                    {supervisors.map(supervisor => (
                                      <option key={supervisor.id} value={supervisor.id}>
                                        {supervisor.fullName || supervisor.username}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', gap: '6px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <button
                                      onClick={() => handleOpenEditValues(entry)}
                                      style={{
                                        fontSize: '10px',
                                        padding: '4px 8px',
                                        backgroundColor: '#3498db',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        width: '100%',
                                        marginBottom: '3px'
                                      }}
                                    >
                                      ✏️ Edit Values
                                    </button>
                                    <button
                                      onClick={() => handleReassign(entry.id)}
                                      disabled={!hasChanged || !!entry.lotAllotment?.closedAt}
                                      style={{
                                        fontSize: '10px',
                                        padding: '4px 8px',
                                        backgroundColor: (hasChanged && !entry.lotAllotment?.closedAt) ? '#FF9800' : '#ccc',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: (hasChanged && !entry.lotAllotment?.closedAt) ? 'pointer' : 'not-allowed',
                                        width: '100%'
                                      }}
                                    >
                                      {(hasChanged && !entry.lotAllotment?.closedAt) ? 'Reassign' : 'No Change'}
                                    </button>
                                    {progressPercentage > 0 && progressPercentage < 100 && !entry.lotAllotment?.closedAt && (
                                      <button
                                        onClick={() => {
                                          const progress = inspectionProgress[entry.id];
                                          if (!progress || progress.inspectedBags === 0) {
                                            showNotification('Cannot close lot with 0 inspected bags. At least one inspection trip is required.', 'error');
                                            return;
                                          }
                                          setClosingEntryId(entry.id);
                                          setIsCloseModalOpen(true);
                                        }}
                                        style={{
                                          fontSize: '10px',
                                          padding: '4px 8px',
                                          backgroundColor: '#f44336',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                          width: '100%',
                                          marginTop: '4px'
                                        }}
                                      >
                                        ❌ Close Lot ({progress?.remainingBags || 0} bags left)
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {expandedEntries[entry.id] && hasPreviousInspections && (
                                <tr>
                                  <td colSpan={13} style={{ padding: '12px', backgroundColor: '#f0f8ff', border: '1px solid #999' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#111' }}>
                                      📋 Inspection Trips ({progress.previousInspections.length}) — {progress.inspectedBags} of {progress.totalBags} bags inspected
                                    </div>
                                    <table style={{ width: '100%', maxWidth: '850px', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #999', marginTop: '6px', tableLayout: 'fixed' }}>
                                      <colgroup>
                                        <col style={{ width: '40px' }} />
                                        <col style={{ width: '90px' }} />
                                        <col style={{ width: '130px' }} />
                                        <col style={{ width: '80px' }} />
                                        <col style={{ width: '90px' }} />
                                        <col style={{ width: '90px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '110px' }} />
                                      </colgroup>
                                      <thead>
                                        <tr style={{ backgroundColor: '#d0e1f9', color: '#111' }}>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Lorry No</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Bags</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Cutting</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Bend</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>By</th>
                                          <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {progress.previousInspections.map((inspection, idx) => (
                                          <tr key={inspection.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                                            <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{idx + 1}</td>
                                            <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                                              {new Date(inspection.inspectionDate).toLocaleDateString()}
                                            </td>
                                            {editingInspection && editingInspection.inspectionId === inspection.id ? (
                                              <>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <input type="text" value={editingInspection.data.lorryNumber}
                                                    onChange={e => setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, lorryNumber: e.target.value.toUpperCase() } })}
                                                    maxLength={10}
                                                    style={{ width: '80px', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px' }} />
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <input type="number" value={editingInspection.data.bags}
                                                    onChange={e => setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, bags: e.target.value } })}
                                                    style={{ width: '60px', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px' }} />
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <input type="text" value={editingInspection.data.cutting}
                                                    placeholder="1×"
                                                    onFocus={() => {
                                                      if (!editingInspection.data.cutting) {
                                                        const res = handleCuttingInput('1×', entry.entryType);
                                                        setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, cutting: res.raw } });
                                                      }
                                                    }}
                                                    onChange={e => {
                                                      const res = handleCuttingInput(e.target.value, entry.entryType);
                                                      setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, cutting: res.raw } });
                                                    }}
                                                    style={{ width: '80px', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px' }} />
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <input type="text" value={editingInspection.data.bend}
                                                    placeholder="1×"
                                                    onFocus={() => {
                                                      if (!editingInspection.data.bend) {
                                                        const res = handleBendInput('1×', entry.entryType);
                                                        setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, bend: res.raw } });
                                                      }
                                                    }}
                                                    onChange={e => {
                                                      const res = handleBendInput(e.target.value, entry.entryType);
                                                      setEditingInspection({ ...editingInspection, data: { ...editingInspection.data, bend: res.raw } });
                                                    }}
                                                    style={{ width: '70px', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px' }} />
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', fontSize: '11px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{inspection.reportedBy?.username || '-'}</td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={handleSaveInspection}
                                                      style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '600' }}>💾 Save</button>
                                                    <button onClick={() => setEditingInspection(null)}
                                                      style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✖</button>
                                                  </div>
                                                </td>
                                              </>
                                            ) : (
                                              <>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{inspection.lorryNumber}</td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#1a1a1a' }}>
                                                  {inspection.bags}
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                                                  {formatDecimal(inspection.cutting1)} {inspection.cutting2 && Number(inspection.cutting2) !== 0 ? `× ${formatDecimal(inspection.cutting2)}` : ''}
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                                                  {formatDecimal(inspection.bend)} {inspection.bend2 && Number(inspection.bend2) !== 0 ? `× ${formatDecimal(inspection.bend2)}` : ''}
                                                </td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{inspection.reportedBy?.username || '-'}</td>
                                                <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>
                                                  <div style={{ display: 'flex', gap: '3px', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <button onClick={() => handleEditInspection(entry.id, inspection)}
                                                      style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '600', width: '80px' }}>✏️ Edit</button>
                                                  </div>
                                                </td>
                                              </>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {Math.ceil(totalEntries / pageSize) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px', alignItems: 'center', marginBottom: '12px' }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', background: currentPage === 1 ? '#f5f5f5' : 'white' }}>First</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', background: currentPage === 1 ? '#f5f5f5' : 'white' }}>Prev</button>
          <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {currentPage} of {Math.ceil(totalEntries / pageSize)} ({totalEntries} total)</span>
          <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalEntries / pageSize), p + 1))} disabled={currentPage === Math.ceil(totalEntries / pageSize)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: currentPage === Math.ceil(totalEntries / pageSize) ? 'not-allowed' : 'pointer', background: currentPage === Math.ceil(totalEntries / pageSize) ? '#f5f5f5' : 'white' }}>Next</button>
          <button onClick={() => setCurrentPage(Math.ceil(totalEntries / pageSize))} disabled={currentPage === Math.ceil(totalEntries / pageSize)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: currentPage === Math.ceil(totalEntries / pageSize) ? 'not-allowed' : 'pointer', background: currentPage === Math.ceil(totalEntries / pageSize) ? '#f5f5f5' : 'white' }}>Last</button>
        </div>
      )}

      {/* Edit Values Modal */}
      {editValuesEntry && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '10px', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '8px', fontSize: '14px' }}>
              ✏️ Edit Values — {editValuesEntry.brokerName} / {editValuesEntry.partyName}
            </h3>
            <div style={{ background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', marginBottom: '10px', fontSize: '11px', textAlign: 'center' }}>
              Bags: <b>{editValuesEntry.bags}</b> | Variety: <b>{editValuesEntry.variety}</b> | Location: <b>{editValuesEntry.location}</b>
            </div>
            {/* Form fields */}
            <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Final Base Rate</label>
                <input type="number" step="0.01" value={editValuesData.finalBaseRate}
                  onChange={e => setEditValuesData({ ...editValuesData, finalBaseRate: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Base Rate Type</label>
                <select value={editValuesData.baseRateType} onChange={e => setEditValuesData({ ...editValuesData, baseRateType: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', boxSizing: 'border-box' }}>
                  <option value="PD_LOOSE">PD/Loose</option>
                  <option value="PD_WB">PD/WB</option>
                  <option value="MD_WB">MD/WB</option>
                  <option value="MD_LOOSE">MD/Loose</option>
                </select>
              </div>
            </div>
            <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Sute</label>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <input type="number" step="0.01" value={editValuesData.sute}
                    onChange={e => setEditValuesData({ ...editValuesData, sute: e.target.value })}
                    style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', minWidth: 0 }} />
                  <select value={editValuesData.suteUnit} onChange={e => setEditValuesData({ ...editValuesData, suteUnit: e.target.value })}
                    style={{ padding: '4px', fontSize: '10px', border: '1px solid #3498db', borderRadius: '3px', minWidth: '55px' }}>
                    <option value="per_bag">/Bag</option>
                    <option value="per_ton">/Ton</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Moisture %</label>
                <input type="number" step="0.01" value={editValuesData.moistureValue}
                  onChange={e => setEditValuesData({ ...editValuesData, moistureValue: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div  className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Hamali</label>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <input type="number" step="0.01" value={editValuesData.hamali}
                    onChange={e => setEditValuesData({ ...editValuesData, hamali: e.target.value })}
                    style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', minWidth: 0 }} />
                  <select value={editValuesData.hamaliUnit} onChange={e => setEditValuesData({ ...editValuesData, hamaliUnit: e.target.value })}
                    style={{ padding: '4px', fontSize: '10px', border: '1px solid #3498db', borderRadius: '3px', minWidth: '50px' }}>
                    <option value="per_bag">/Bag</option>
                    <option value="per_quintal">/Qtl</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Brokerage</label>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <input type="number" step="0.01" value={editValuesData.brokerage}
                    onChange={e => setEditValuesData({ ...editValuesData, brokerage: e.target.value })}
                    style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', minWidth: 0 }} />
                  <select value={editValuesData.brokerageUnit} onChange={e => setEditValuesData({ ...editValuesData, brokerageUnit: e.target.value })}
                    style={{ padding: '4px', fontSize: '10px', border: '1px solid #3498db', borderRadius: '3px', minWidth: '50px' }}>
                    <option value="per_bag">/Bag</option>
                    <option value="per_quintal">/Qtl</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>LF</label>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <input type="number" step="0.01" value={editValuesData.lf}
                    onChange={e => setEditValuesData({ ...editValuesData, lf: e.target.value })}
                    style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: '1px solid #3498db', borderRadius: '3px', minWidth: 0 }} />
                  <select value={editValuesData.lfUnit} onChange={e => setEditValuesData({ ...editValuesData, lfUnit: e.target.value })}
                    style={{ padding: '4px', fontSize: '10px', border: '1px solid #3498db', borderRadius: '3px', minWidth: '50px' }}>
                    <option value="per_bag">/Bag</option>
                    <option value="per_quintal">/Qtl</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>EGB</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                  <input type="radio" value="mill" checked={editValuesData.egbType === 'mill'}
                    onChange={() => setEditValuesData({ ...editValuesData, egbType: 'mill', egbValue: '0' })} /> Mill
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                  <input type="radio" value="purchase" checked={editValuesData.egbType === 'purchase'}
                    onChange={() => setEditValuesData({ ...editValuesData, egbType: 'purchase' })} /> Purchase
                </label>
                <input type="number" step="0.01" value={editValuesData.egbValue}
                  onChange={e => setEditValuesData({ ...editValuesData, egbValue: e.target.value })}
                  disabled={editValuesData.egbType === 'mill'}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px', border: `1px solid ${editValuesData.egbType === 'mill' ? '#ccc' : '#3498db'}`, borderRadius: '3px', backgroundColor: editValuesData.egbType === 'mill' ? '#f5f5f5' : 'white', minWidth: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <button onClick={() => setEditValuesEntry(null)} disabled={isSavingValues}
                style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleSaveEditValues} disabled={isSavingValues}
                style={{ padding: '6px 18px', border: 'none', borderRadius: '4px', background: isSavingValues ? '#95a5a6' : '#27ae60', color: 'white', fontWeight: 700, cursor: isSavingValues ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                {isSavingValues ? 'Saving...' : '💾 Save Values'}
              </button>
            </div>
          </div>
        </div>
      )}
      {closingEntryId && (
        <ConfirmationModal
          isOpen={isCloseModalOpen}
          title="Close Lot Early"
          message={`Are you sure you want to close this lot?\n\nParty: ${entries.find(e => e.id === closingEntryId)?.partyName || 'Unknown'}\nAllotted: ${inspectionProgress[closingEntryId]?.totalBags || 0} bags\nInspected: ${inspectionProgress[closingEntryId]?.inspectedBags || 0} bags\nRemaining (not sent): ${inspectionProgress[closingEntryId]?.remainingBags || 0} bags\n\nThe inspected bags will proceed to inventory, and the remaining bags will be marked as not received.`}
          type="confirm"
          showInput={true}
          inputPlaceholder="Reason for closing lot (optional)..."
          confirmText="Close Lot"
          cancelText="Cancel"
          onConfirm={(reason) => {
            handleCloseLot(closingEntryId, reason);
          }}
          onCancel={() => {
            setIsCloseModalOpen(false);
            setClosingEntryId(null);
          }}
        />
      )}
      {detailModalEntry && (
        <SampleEntryDetailModal
          detailEntry={detailModalEntry as any}
          detailMode="history"
          onClose={() => setDetailModalEntry(null)}
          showCollectorLoginPair={false}
        />
      )}
    </div>
  );
};

export default AllottedSupervisors;
