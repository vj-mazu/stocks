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

const getPendingDisputeRequests = (offering: any) => normalizePendingManagerApprovalQueue(offering).filter((request: any) => {
  const data = request?.data || {};
  return data.disputeBaseRate !== undefined && data.disputeBaseRate !== null && data.disputeBaseRate !== '';
});

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
  const [editMode, setEditMode] = useState<'dispute' | 'hmlf' | null>(null);
  const [editValuesData, setEditValuesData] = useState<any>({});
  const [isSavingValues, setIsSavingValues] = useState(false);
  const [detailModalEntry, setDetailModalEntry] = useState<SampleEntry | null>(null);
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);

  const resolveMediaUrl = (value?: string | null) => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const baseUrl = API_URL.replace(/\/api\/?$/, '');
    return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
  };

  const handlePartyClick = async (entry: any) => {
    let progress = inspectionProgress[entry.id];
    if (!progress) {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/sample-entries/${entry.id}/inspection-progress`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        progress = response.data;
        setInspectionProgress(prev => ({ ...prev, [entry.id]: progress }));
      } catch (err) {
        console.error('Error loading inspection progress for comparison:', err);
      } finally {
        setLoading(false);
      }
    }

    if (progress && progress.previousInspections && progress.previousInspections.length > 0) {
      setSelectedLorryForComparison({
        partyName: entry.partyName || entry.lorryNumber || 'DIRECT LOADED VEHICLE',
        variety: entry.variety || '',
        location: entry.location || '',
        totalBags: progress.totalBags,
        inspectedBags: progress.inspectedBags,
        remainingBags: progress.remainingBags,
        previousInspections: progress.previousInspections,
        lotAllotment: entry.lotAllotment,
        singleLorryMode: false
      });
    } else {
      showNotification('No progressive physical inspection trips loaded/submitted yet for this lot.', 'error');
    }
  };

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

  const loadEntries = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
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
          previousInspections: (() => {
            let mapped = inspections.map(inspection => ({
              id: inspection.id,
              inspectionDate: inspection.inspectionDate,
              lorryNumber: inspection.lorryNumber,
              bags: inspection.bags,
              cutting1: inspection.cutting1,
              cutting2: inspection.cutting2,
              bend: inspection.bend,
              bend2: (inspection as any).bend2,
              samplingStages: (inspection as any).samplingStages || {},
              reportedBy: inspection.reportedBy || { username: 'System' }
            }));

            if (mapped.length > 1) {
              const lotAvgIdx = mapped.findIndex(i => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
              if (lotAvgIdx !== -1) {
                const realLorryInsp = mapped.find(i => (i.lorryNumber || '').trim().toUpperCase() !== 'LOT_AVG');
                if (realLorryInsp) {
                  const lotAvgInsp = mapped[lotAvgIdx];
                  if (lotAvgInsp.samplingStages && lotAvgInsp.samplingStages.lot_avg) {
                    if (!realLorryInsp.samplingStages) realLorryInsp.samplingStages = {};
                    if (!realLorryInsp.samplingStages.lot_avg) {
                      realLorryInsp.samplingStages.lot_avg = lotAvgInsp.samplingStages.lot_avg;
                    }
                  }
                  mapped = mapped.filter((_, idx) => idx !== lotAvgIdx);
                }
              }
            }
            return mapped;
          })()
        };
      });
      setInspectionProgress(progressCache);

    } catch (error: any) {
      console.error('Error loading allotted entries:', error);
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      if (!isSilent) setLoading(false);
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

  const formatEditDecimal = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(val);
    return isNaN(num) ? val.toString() : num.toString();
  };

  const handleEditInspection = (entryId: string, inspection: PreviousInspection) => {

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

  const handleOpenEditValues = (entry: SampleEntry, mode: 'dispute' | 'hmlf') => {
    const o = offeringCache[entry.id] || {};
    setEditValuesEntry(entry);
    setEditMode(mode);
    setEditValuesData({
      finalBaseRate: formatEditDecimal(o.finalBaseRate ?? o.offerBaseRateValue),
      baseRateType: o.baseRateType || 'PD_LOOSE',
      sute: formatEditDecimal(o.finalSute ?? o.sute),
      suteUnit: o.finalSuteUnit || o.suteUnit || 'per_bag',
      moistureValue: formatEditDecimal(o.moistureValue),
      hamali: formatEditDecimal(o.hamali),
      hamaliUnit: o.hamaliUnit || 'per_bag',
      brokerage: formatEditDecimal(o.brokerage),
      brokerageUnit: o.brokerageUnit || 'per_bag',
      lf: formatEditDecimal(o.lf),
      lfUnit: o.lfUnit || 'per_bag',
      egbValue: formatEditDecimal(o.egbValue),
      egbType: o.egbType || ((o.egbValue && parseFloat(o.egbValue) > 0) ? 'purchase' : 'mill'),
      disputeBaseRate: formatEditDecimal(o.disputeBaseRate ?? o.finalBaseRate ?? o.offerBaseRateValue),
      disputeBaseRateType: o.disputeBaseRateType || o.baseRateType || 'PD_LOOSE',
      revisedHamali: formatEditDecimal(o.revisedHamali ?? o.hamali),
      revisedLf: formatEditDecimal(o.revisedLf ?? o.lf),
      revisedRateOption: o.revisedRateOption || 'final',
      linkedDisputeRequestId: '',
      linkedRevisionId: '',
      disputeReason: (Array.isArray(o.disputeVersions) && [...o.disputeVersions].reverse().find((v: any) => v.type === 'dispute')?.disputeReason) || o.disputeReason || ''
    });
  };

  const handleHamaliToggle = async (entry: SampleEntry, enabled: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entry.id}/final-price`,
        { hamaliEnabled: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification(`Hamali set to ${enabled ? 'Yes' : 'No'}`, 'success');
      loadEntries();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to update Hamali', 'error');
    }
  };

  const handleSaveEditValues = async () => {
    if (!editValuesEntry || isSavingValues) return;
    try {
      setIsSavingValues(true);
      const token = localStorage.getItem('token');
      
      const payload: any = { isFinalized: true };
      const isManager = user?.role === 'manager';
      if (isManager) {
        payload.fillMissingValues = true;
      }
      
      if (editMode === 'dispute') {
        payload.disputeBaseRate = editValuesData.disputeBaseRate;
        payload.disputeBaseRateType = editValuesData.disputeBaseRateType;
        payload.finalSute = editValuesData.sute;
        payload.finalSuteUnit = editValuesData.suteUnit;
        payload.moistureValue = editValuesData.moistureValue;
        payload.revisedRateOption = editValuesData.revisedRateOption;
        if (editValuesData.revisedRateOption === 'dispute') {
          payload.linkedRevisionId = editValuesData.linkedRevisionId;
        } else {
          payload.revisedHamali = null;
          payload.revisedLf = null;
          payload.linkedRevisionId = null;
        }
        payload.disputeReason = editValuesData.disputeReason;
      } else if (editMode === 'hmlf') {
        const o = offeringCache[editValuesEntry.id] || {};
        const pendingDisputeRequests = getPendingDisputeRequests(o);
        const hasApprovedDispute = !(o.disputeBaseRate === undefined || o.disputeBaseRate === null || o.disputeBaseRate === '');
        if (editValuesData.revisedRateOption === 'dispute') {
          if (!hasApprovedDispute && pendingDisputeRequests.length === 0) {
            showNotification('Cannot set revised rate for dispute: no dispute rate exists for this lot. Please set a dispute rate first.', 'error');
            setIsSavingValues(false);
            return;
          }
          if (pendingDisputeRequests.length > 0 && !String(editValuesData.linkedDisputeRequestId || '').trim()) {
            showNotification('Please select which dispute this HM/LF revision belongs to.', 'error');
            setIsSavingValues(false);
            return;
          }
        }
        payload.revisedHamali = editValuesData.revisedHamali;
        payload.hamaliUnit = editValuesData.hamaliUnit;
        payload.revisedLf = editValuesData.revisedLf;
        payload.lfUnit = editValuesData.lfUnit;
        payload.revisedRateOption = editValuesData.revisedRateOption;
        if (editValuesData.revisedRateOption === 'dispute' && String(editValuesData.linkedDisputeRequestId || '').trim()) {
          payload.linkedDisputeRequestId = editValuesData.linkedDisputeRequestId;
        }
      }
      
      await axios.post(
        `${API_URL}/sample-entries/${editValuesEntry.id}/final-price`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Values updated successfully', 'success');
      setEditValuesEntry(null);
      setEditMode(null);
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
                          const isRLEntry = entry.entryType === 'DIRECT_LOADED_VEHICLE' || 
                                            entry.entryType === 'READY_LORRY' || 
                                            (entry as any).originalEntryType === 'DIRECT_LOADED_VEHICLE' || 
                                            (entry as any).originalEntryType === 'READY_LORRY';
                          const partyLabel = isRLEntry ? (lorryText || partyNameText || '-') : (partyNameText || lorryText || '-');
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
                                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{partyNameText}</div>
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
                                     {(() => {
                                       const o = offeringCache[entry.id] || {};
                                        const pendingQueue = String(o.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending'
                                          ? normalizePendingManagerApprovalQueue(o)
                                          : [];
                                        const pendingDisputeCount = pendingQueue.filter((request: any) => {
                                          const data = request?.data || {};
                                          return data.disputeBaseRate !== undefined && data.disputeBaseRate !== null && data.disputeBaseRate !== '';
                                        }).length;
                                        const pendingRevisionCount = pendingQueue.filter((request: any) => {
                                          const data = request?.data || {};
                                          return (data.revisedHamali !== undefined && data.revisedHamali !== null && data.revisedHamali !== '')
                                            || (data.revisedLf !== undefined && data.revisedLf !== null && data.revisedLf !== '');
                                        }).length;
                                        const hasPendingDispute = pendingDisputeCount > 0;
                                        const hasPendingRevision = pendingRevisionCount > 0;

                                       return (
                                         <>
                                            {hasPendingDispute ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '3px', marginBottom: '3px' }}>
                                                <div style={{
                                                  fontSize: '9px',
                                                  padding: '4px 6px',
                                                  backgroundColor: '#ffebee',
                                                  color: '#c62828',
                                                  border: '1px solid #c62828',
                                                  borderRadius: '3px',
                                                  textAlign: 'center',
                                                  width: '100%',
                                                  fontWeight: '800'
                                                }}>
                                                  ⚖️ Dispute Pending
                                                </div>
                                                {user?.role === 'admin' && (
                                                  <button
                                                    onClick={() => handleOpenEditValues(entry, 'dispute')}
                                                    style={{
                                                      fontSize: '10px',
                                                      padding: '4px 8px',
                                                      backgroundColor: '#f39c12',
                                                      color: 'white',
                                                      border: 'none',
                                                      borderRadius: '3px',
                                                      cursor: 'pointer',
                                                      width: '100%',
                                                      fontWeight: '700'
                                                    }}
                                                  >
                                                    Update Dispute
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => handleOpenEditValues(entry, 'dispute')}
                                                style={{
                                                  fontSize: '10px',
                                                  padding: '4px 8px',
                                                  backgroundColor: '#e74c3c',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer',
                                                  width: '100%',
                                                  marginBottom: '3px',
                                                  fontWeight: '700'
                                                }}
                                              >
                                                ⚖️ Dispute Rate
                                              </button>
                                            )}

                                            {hasPendingRevision ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '3px', marginBottom: '3px' }}>
                                                <div style={{
                                                  fontSize: '9px',
                                                  padding: '4px 6px',
                                                  backgroundColor: '#f3e5f5',
                                                  color: '#6a1b9a',
                                                  border: '1px solid #6a1b9a',
                                                  borderRadius: '3px',
                                                  textAlign: 'center',
                                                  width: '100%',
                                                  fontWeight: '800'
                                                }}>
                                                  ⚙️ Revision Pending
                                                </div>
                                                {user?.role === 'admin' && (
                                                  <button
                                                    onClick={() => handleOpenEditValues(entry, 'hmlf')}
                                                    style={{
                                                      fontSize: '10px',
                                                      padding: '4px 8px',
                                                      backgroundColor: '#f39c12',
                                                      color: 'white',
                                                      border: 'none',
                                                      borderRadius: '3px',
                                                      cursor: 'pointer',
                                                      width: '100%',
                                                      fontWeight: '700'
                                                    }}
                                                  >
                                                    Update Revision
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => handleOpenEditValues(entry, 'hmlf')}
                                                style={{
                                                  fontSize: '10px',
                                                  padding: '4px 8px',
                                                  backgroundColor: '#8e44ad',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '3px',
                                                  cursor: 'pointer',
                                                  width: '100%',
                                                  marginBottom: '3px',
                                                  fontWeight: '700'
                                                }}
                                              >
                                                ⚙️ Revise HM | LF
                                              </button>
                                            )}
                                         </>
                                       );
                                      })()}

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
                                  <td colSpan={13} style={{ padding: '12px', backgroundColor: '#fdf6f0', border: '1px solid #000' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: '#1a237e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>📋 Lorry Loaded ({progress.previousInspections.length}) — {progress.inspectedBags} of {progress.totalBags} bags inspected</span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000', backgroundColor: '#ffffff' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f5f5f5', color: '#000', borderBottom: '1px solid #000' }}>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '4%' }}>#</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Date</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Lorry No</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Bags</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Moisture</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Cutting</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Bend</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'left', width: '10%' }}>By</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Status</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Actions Link</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>LF</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Hamali</th>
                                          <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Dispute</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {progress.previousInspections.map((inspection, idx) => {
                                          const stages = inspection.samplingStages || {};
                                          // Find latest available stage
                                          const latestStage = stages.full_avg?.reportedBy ? stages.full_avg : (stages.half_lorry?.reportedBy ? stages.half_lorry : (stages.lot_avg?.reportedBy ? stages.lot_avg : null));
                                          
                                          const moistureVal = latestStage ? (latestStage.moistureRaw ? `${latestStage.moistureRaw}%` : (latestStage.moisture !== undefined && latestStage.moisture !== null ? `${latestStage.moisture}%` : '-')) : '-';
                                          const cuttingVal = latestStage ? (latestStage.cutting1 !== undefined && latestStage.cutting1 !== null ? `${latestStage.cutting1}×${latestStage.cutting2 || 0}` : '-') : '-';
                                          const bendVal = latestStage ? (latestStage.bend1 !== undefined && latestStage.bend1 !== null ? `${latestStage.bend1}×${latestStage.bend2 || 0}` : '-') : '-';
                                          const o = offeringCache[entry.id] || {};

                                          return (
                                            <tr key={inspection.id} style={{ borderBottom: '1px solid #000' }}>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{idx + 1}</td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                                {new Date(inspection.inspectionDate).toLocaleDateString('en-GB')}
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: '700' }}>
                                                <span
                                                  onClick={() => setSelectedLorryForComparison({ lorryNumber: inspection.lorryNumber, previousInspections: [inspection], lotAllotment: entry.lotAllotment, singleLorryMode: true })}
                                                  style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer' }}
                                                >
                                                  {inspection.lorryNumber?.toUpperCase()}
                                                </span>
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{stages.full_avg?.actualBags || inspection.bags || '-'}</td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600', color: '#d05d00' }}>{moistureVal}</td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{cuttingVal}</td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{bendVal}</td>
                                              <td style={{ border: '1px solid #000', padding: '6px' }}>{inspection.reportedBy?.username || '-'}</td>
                                              <td style={{ 
                                                border: '1px solid #000', 
                                                padding: '6px', 
                                                textAlign: 'center', 
                                                fontWeight: '700', 
                                                color: (() => {
                                                  const stages = inspection.samplingStages || {};
                                                  if (stages.full_avg?.approvalStatus === 'approved') return '#2e7d32'; // Pass
                                                  if (stages.full_avg?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                                  if (stages.nit_avg?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                                  if (stages.nit_avg?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                                  if (stages.half_lorry?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                                  if (stages.half_lorry?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                                  if (stages.lot_avg?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                                  if (stages.lot_avg?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                                  if (stages.balanced_lot?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                                  if (stages.balanced_lot?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                                  return '#64748b';
                                                })()
                                              }}>
                                                {(() => {
                                                  const stages = inspection.samplingStages || {};
                                                  if (stages.full_avg?.approvalStatus === 'approved') return 'Pass';
                                                  if (stages.full_avg?.approvalStatus === 'pending') return 'Pending: Full Lorry';
                                                  if (stages.nit_avg?.approvalStatus === 'approved') return 'Approved: Nit Avg';
                                                  if (stages.nit_avg?.approvalStatus === 'pending') return 'Pending: Nit Avg';
                                                  if (stages.half_lorry?.approvalStatus === 'approved') return 'Approved: Half Lorry';
                                                  if (stages.half_lorry?.approvalStatus === 'pending') return 'Pending: Half Lorry';
                                                  if (stages.lot_avg?.approvalStatus === 'approved') return 'Approved: Lot Avg';
                                                  if (stages.lot_avg?.approvalStatus === 'pending') return 'Pending: Lot Avg';
                                                  if (stages.balanced_lot?.approvalStatus === 'approved') return 'Approved: Balanced Lot';
                                                  if (stages.balanced_lot?.approvalStatus === 'pending') return 'Pending: Balanced Lot';
                                                  return 'Pending';
                                                })()}
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                                <span
                                                  onClick={() => handleOpenEditValues(entry, 'hmlf')}
                                                  style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                  Final Rate
                                                </span>
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                                <span
                                                  onClick={() => handleOpenEditValues(entry, 'hmlf')}
                                                  style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                  Payment
                                                </span>
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                                  <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                                    <input
                                                      type="radio"
                                                      name={`hamali-${entry.id}`}
                                                      checked={o.hamaliEnabled === true}
                                                      onChange={() => handleHamaliToggle(entry, true)}
                                                    /> Yes
                                                  </label>
                                                  <label style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                                    <input
                                                      type="radio"
                                                      name={`hamali-${entry.id}`}
                                                      checked={o.hamaliEnabled === false || o.hamaliEnabled === undefined || o.hamaliEnabled === null}
                                                      onChange={() => handleHamaliToggle(entry, false)}
                                                    /> No
                                                  </label>
                                                </div>
                                              </td>
                                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                                <span
                                                  onClick={() => handleOpenEditValues(entry, 'dispute')}
                                                  style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                  Settle
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
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

      {/* Edit Dispute / HM-LF Modal */}
      {editValuesEntry && (() => {
        const o = offeringCache[editValuesEntry.id] || {};
        const origHamaliVal = o.hamali !== undefined && o.hamali !== null && o.hamali !== '' ? formatDecimal(o.hamali) : '';
        const origHamaliUnit = o.hamaliUnit === 'per_quintal' ? '/Qtl' : '/Bag';
        const hasRevisedHamali = o.revisedHamali !== undefined && o.revisedHamali !== null && o.revisedHamali !== '';
        const revisedHamaliVal = hasRevisedHamali ? formatDecimal(o.revisedHamali) : '';
        const revisedHamaliText = revisedHamaliVal ? ` | Revised: ₹${revisedHamaliVal}${origHamaliUnit}` : '';
        const origHamaliText = origHamaliVal ? ` (Original: ₹${origHamaliVal}${origHamaliUnit}${revisedHamaliText})` : '';

        const origLfVal = o.lf !== undefined && o.lf !== null && o.lf !== '' ? formatDecimal(o.lf) : '';
        const origLfUnit = o.lfUnit === 'per_quintal' ? '/Qtl' : '/Bag';
        const hasRevisedLf = o.revisedLf !== undefined && o.revisedLf !== null && o.revisedLf !== '';
        const revisedLfVal = hasRevisedLf ? formatDecimal(o.revisedLf) : '';
        const revisedLfText = revisedLfVal ? ` | Revised: ₹${revisedLfVal}${origLfUnit}` : '';
        const origLfText = origLfVal ? ` (Original: ₹${origLfVal}${origLfUnit}${revisedLfText})` : '';

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {editMode === 'dispute' ? (
              <>
                <h3 style={{ marginTop: 0, color: '#e74c3c', borderBottom: '2px solid #e74c3c', paddingBottom: '8px', fontSize: '14px', fontWeight: '800' }}>
                  Dispute Rate — {editValuesEntry.brokerName} / {editValuesEntry.partyName}
                </h3>
                <div style={{ background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', marginBottom: '10px', fontSize: '11px', textAlign: 'center' }}>
                  Bags: <b>{editValuesEntry.bags}</b> | Variety: <b>{editValuesEntry.variety}</b> | Location: <b>{editValuesEntry.location}</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Dispute Rate</label>
                    <input type="number" step="0.01" value={editValuesData.disputeBaseRate}
                      onChange={e => setEditValuesData({ ...editValuesData, disputeBaseRate: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Type</label>
                    <select value={editValuesData.disputeBaseRateType} onChange={e => setEditValuesData({ ...editValuesData, disputeBaseRateType: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                      <option value="PD_LOOSE">PD/Loose</option>
                      <option value="PD_WB">PD/WB</option>
                      <option value="MD_WB">MD/WB</option>
                      <option value="MD_LOOSE">MD/Loose</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Sute</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" step="0.01" value={editValuesData.sute}
                        onChange={e => setEditValuesData({ ...editValuesData, sute: e.target.value })}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: 0 }} />
                      <select value={editValuesData.suteUnit} onChange={e => setEditValuesData({ ...editValuesData, suteUnit: e.target.value })}
                        style={{ padding: '8px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: '80px' }}>
                        <option value="per_bag">/Bag</option>
                        <option value="per_ton">/Ton</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Moisture %</label>
                    <input type="number" step="0.01" value={editValuesData.moistureValue}
                      onChange={e => setEditValuesData({ ...editValuesData, moistureValue: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Hamali & LF Option</label>
                    <select value={editValuesData.revisedRateOption} onChange={e => setEditValuesData({ ...editValuesData, revisedRateOption: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                      <option value="final">Use Final Rate Hamali & LF</option>
                      <option value="dispute">Use Existing Revised Rate</option>
                    </select>
                  </div>
                  {editValuesData.revisedRateOption === 'dispute' && (() => {
                    const offering = editValuesEntry ? (offeringCache[editValuesEntry.id] || {}) : {};
                    const pendingQueue = String(offering.pendingManagerValueApprovalStatus || '').toLowerCase() === 'pending'
                      ? normalizePendingManagerApprovalQueue(offering)
                      : [];
                    const pendingRevisions = pendingQueue.filter((request: any) => {
                      const data = request?.data || {};
                      return (data.revisedHamali !== undefined && data.revisedHamali !== null && data.revisedHamali !== '')
                        || (data.revisedLf !== undefined && data.revisedLf !== null && data.revisedLf !== '');
                    });
                    
                    const approvedRevisions = Array.isArray(offering.disputeVersions)
                      ? offering.disputeVersions.filter((v: any) => v.type === 'revision' || ((v.revisedHamali !== undefined && v.revisedHamali !== null && v.revisedHamali !== '') || (v.revisedLf !== undefined && v.revisedLf !== null && v.revisedLf !== '')))
                      : [];
                    const hasLegacyRevision = (approvedRevisions.length === 0 && 
                      ((offering.revisedHamali !== undefined && offering.revisedHamali !== null && offering.revisedHamali !== '') ||
                       (offering.revisedLf !== undefined && offering.revisedLf !== null && offering.revisedLf !== '')));
                    const legacyRevision = hasLegacyRevision ? [{ id: 'legacy-revision', revisedHamali: offering.revisedHamali, hamaliUnit: offering.hamaliUnit, revisedLf: offering.revisedLf, lfUnit: offering.lfUnit }] : [];
                    const allApprovedRevisions = [...approvedRevisions, ...legacyRevision];

                    const totalRevisions = allApprovedRevisions.length + pendingRevisions.length;

                    if (totalRevisions === 0) {
                      return (
                        <div style={{ fontSize: '11px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 10px' }}>
                          No revised Hamali & LF rates exist yet for this lot. Please add a revised rate first.
                        </div>
                      );
                    }

                    return (
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Select Revised Rate</label>
                        <select
                          value={editValuesData.linkedRevisionId || ''}
                          onChange={e => setEditValuesData({ ...editValuesData, linkedRevisionId: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                        >
                          <option value="">-- Select Revision --</option>
                          {allApprovedRevisions.map((rev: any, index: number) => {
                            const hVal = rev.revisedHamali || offering.revisedHamali || offering.hamali;
                            const hUnit = rev.hamaliUnit || offering.hamaliUnit || 'per_bag';
                            const lfVal = rev.revisedLf || offering.revisedLf || offering.lf;
                            const lfUnit = rev.lfUnit || offering.lfUnit || 'per_bag';
                            const labelText = `Revision ${index + 1} (Approved): Hamali ${hVal}/${hUnit === 'per_quintal' ? 'Qtl' : 'Bag'}, LF ${lfVal}/${lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}`;
                            return (
                              <option key={`approved-rev-${rev.id || index}`} value={rev.id || `approved-rev-${index}`}>
                                {labelText}
                              </option>
                            );
                          })}
                          {pendingRevisions.map((request: any, index: number) => {
                            const data = request?.data || {};
                            const displayNum = allApprovedRevisions.length + index + 1;
                            const hVal = data.revisedHamali || offering.hamali;
                            const hUnit = data.hamaliUnit || offering.hamaliUnit || 'per_bag';
                            const lfVal = data.revisedLf || offering.lf;
                            const lfUnit = data.lfUnit || offering.lfUnit || 'per_bag';
                            const labelText = `Revision ${displayNum} (Pending): Hamali ${hVal}/${hUnit === 'per_quintal' ? 'Qtl' : 'Bag'}, LF ${lfVal}/${lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}`;
                            return (
                              <option key={`pending-rev-${request.id || index}`} value={request.id}>
                                {labelText}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })()}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Dispute Reason</label>
                    <input type="text" placeholder="Enter reason for dispute" value={editValuesData.disputeReason || ''}
                      onChange={e => setEditValuesData({ ...editValuesData, disputeReason: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, color: '#8e44ad', borderBottom: '2px solid #8e44ad', paddingBottom: '8px', fontSize: '14px', fontWeight: '800' }}>
                  HM | LF — {editValuesEntry.brokerName} / {editValuesEntry.partyName}
                </h3>
                <div style={{ background: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', marginBottom: '10px', fontSize: '11px', textAlign: 'center' }}>
                  Bags: <b>{editValuesEntry.bags}</b> | Variety: <b>{editValuesEntry.variety}</b> | Location: <b>{editValuesEntry.location}</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Revised Hamali{origHamaliText}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" step="0.01" value={editValuesData.revisedHamali}
                        onChange={e => setEditValuesData({ ...editValuesData, revisedHamali: e.target.value })}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: 0 }} />
                      <select value={editValuesData.hamaliUnit} onChange={e => setEditValuesData({ ...editValuesData, hamaliUnit: e.target.value })}
                        style={{ padding: '8px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: '80px' }}>
                        <option value="per_bag">/Bag</option>
                        <option value="per_quintal">/Qtl</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Revised LF{origLfText}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="number" step="0.01" value={editValuesData.revisedLf}
                        onChange={e => setEditValuesData({ ...editValuesData, revisedLf: e.target.value })}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: 0 }} />
                      <select value={editValuesData.lfUnit} onChange={e => setEditValuesData({ ...editValuesData, lfUnit: e.target.value })}
                        style={{ padding: '8px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: '80px' }}>
                        <option value="per_bag">/Bag</option>
                        <option value="per_quintal">/Qtl</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Rate Target</label>
                    <select value={editValuesData.revisedRateOption} onChange={e => setEditValuesData({ ...editValuesData, revisedRateOption: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                      <option value="dispute">Add for Dispute</option>
                      <option value="final">Add for Final Rate</option>
                    </select>
                  </div>
                  {editValuesData.revisedRateOption === 'dispute' && (() => {
                    const offering = editValuesEntry ? (offeringCache[editValuesEntry.id] || {}) : {};
                    const pendingDisputes = getPendingDisputeRequests(offering);
                    
                    const approvedDisputes = Array.isArray(offering.disputeVersions)
                      ? offering.disputeVersions.filter((v: any) => v.type === 'dispute' || (v.disputeBaseRate !== undefined && v.disputeBaseRate !== null && v.disputeBaseRate !== ''))
                      : [];
                    const hasLegacyApproved = (offering.disputeBaseRate !== undefined && offering.disputeBaseRate !== null && offering.disputeBaseRate !== '') && !approvedDisputes.some((d: any) => d.id === 'legacy-approved');
                    const legacyApprovedDisputes = hasLegacyApproved
                      ? [{ id: 'legacy-approved', disputeBaseRate: offering.disputeBaseRate, disputeBaseRateType: offering.disputeBaseRateType || 'PD/WB' }]
                      : [];
                    const allApprovedDisputes = [...approvedDisputes, ...legacyApprovedDisputes];

                    const totalDisputes = allApprovedDisputes.length + pendingDisputes.length;

                    if (totalDisputes === 0) {
                      return (
                        <div style={{ fontSize: '11px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 10px' }}>
                          No dispute exists yet for this lot. Please add a dispute rate first.
                        </div>
                      );
                    }

                    if (totalDisputes === 1) {
                      const single = allApprovedDisputes.length === 1 ? allApprovedDisputes[0] : pendingDisputes[0].data;
                      const rateVal = single.disputeBaseRate || single.data?.disputeBaseRate;
                      const typeVal = single.disputeBaseRateType || single.data?.disputeBaseRateType || 'PD/WB';
                      return (
                        <div style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px' }}>
                          Will apply to current dispute {rateVal} ({typeVal})
                        </div>
                      );
                    }

                    return (
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#334155' }}>Select Dispute</label>
                        <select
                          value={editValuesData.linkedDisputeRequestId || ''}
                          onChange={e => setEditValuesData({ ...editValuesData, linkedDisputeRequestId: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                        >
                          <option value="">-- Select Dispute --</option>
                          {allApprovedDisputes.map((disp: any, index: number) => (
                            <option key={`approved-${disp.id || index}`} value={disp.id || `approved-${index}`}>
                              {`Dispute ${index + 1} (Approved): ${disp.disputeBaseRate} (${disp.disputeBaseRateType || 'PD/WB'})`}
                            </option>
                          ))}
                          {pendingDisputes.map((request: any, index: number) => {
                            const data = request?.data || {};
                            const displayNum = allApprovedDisputes.length + index + 1;
                            return (
                              <option key={`pending-${request.id || index}`} value={request.id}>
                                {`Dispute ${displayNum} (Pending): ${data.disputeBaseRate} (${data.disputeBaseRateType || 'PD/WB'})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '14px' }}>
              <button onClick={() => { setEditValuesEntry(null); setEditMode(null); }} disabled={isSavingValues}
                style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={handleSaveEditValues} disabled={isSavingValues}
                style={{ padding: '6px 18px', border: 'none', borderRadius: '4px', background: isSavingValues ? '#95a5a6' : '#27ae60', color: 'white', fontWeight: 700, cursor: isSavingValues ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                {isSavingValues ? 'Saving...' : 'Save Values'}
              </button>
            </div>
          </div>
        </div>
      ); })()}
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
          progressiveMode={true}
          onClose={() => {
            setDetailModalEntry(null);
            loadEntries(true);
          }}
          showCollectorLoginPair={false}
          onUpdate={() => loadEntries(true)}
        />
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
            zIndex: 20000,
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
                    <tr style={{ borderBottom: '1px solid #000000', backgroundColor: bgColor }}>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', fontWeight: '800', color: color }}>
                        {name}
                        {name === 'Nit Avg' && stageObj.nit && (
                          <span style={{ color: '#ef6c00', marginLeft: '5px' }}>({stageObj.nit})</span>
                        )}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.reportedBy)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>
                        {stageObj.reportedAt ? new Date(stageObj.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600' }}>{formatMoisture(stageObj)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600', width: '55px' }}>{formatCutting(stageObj)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '600', width: '55px' }}>{formatBend(stageObj)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '55px' }}>({formatField(stageObj.grainsCountRaw || stageObj.grainsCount)})</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{formatField(stageObj.mixRaw || stageObj.mix)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{stageObj.smixEnabled ? formatField(stageObj.mixSRaw || stageObj.mixS) || 'Yes' : '-'}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{stageObj.lmixEnabled ? formatField(stageObj.mixLRaw || stageObj.mixL) || 'Yes' : '-'}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{formatField(stageObj.kanduRaw || stageObj.kandu)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{formatField(stageObj.oilRaw || stageObj.oil)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '45px' }}>{formatField(stageObj.skRaw || stageObj.sk)}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '50px' }}>{stageObj.smellHas ? 'Yes' : '-'}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500', width: '50px' }}>{stageObj.paddyWbEnabled ? formatField(stageObj.paddyWbRaw || stageObj.paddyWb) : '-'}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '700' }}>{isFull ? formatField(stageObj.actualBags || inspection.bags) : '-'}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px 10px', textAlign: 'center' }}>
                        {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                      </td>
                    </tr>
                  );
                };

                const isLorryNotAdded = !inspection.lorryNumber || 
                  ['LOT_AVG', 'BALANCED_LOT'].includes(inspection.lorryNumber.toUpperCase().trim()) ||
                  inspection.lorryNumber.toLowerCase().includes('next loading lorry');

                const tripHeaderLabel = isLorryNotAdded
                  ? <span style={{ color: 'white', fontWeight: '900' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                  : idx === 0
                    ? `Load 1 - Loading Sample Details : ${inspection.lorryNumber?.toUpperCase() || ''}`
                    : `Load ${idx + 1} - Lorry Number: ${inspection.lorryNumber?.toUpperCase() || ''}`;

                return (
                  <div key={inspection.id} style={{ border: '1px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{tripHeaderLabel} | Bags Loaded: {stages.full_avg?.actualBags || inspection.bags || '-'}</span>
                      <span>Reported By: {inspection.reportedBy?.username || 'System'} | Date: {new Date(inspection.inspectionDate).toLocaleDateString()}</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #000000' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #000000' }}>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'left', border: '1px solid #000000' }}>SAMPLE / STAGE</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000' }}>REPORTED BY</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000' }}>REPORTED AT</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000' }}>MOISTURE</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '55px' }}>CUTTING</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '55px' }}>BEND</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '55px' }}>GRAINS</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>MIX</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>S MIX</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>L MIX</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>KANDU</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>OIL</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '45px' }}>SK</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '50px' }}>SMELL</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000', width: '50px' }}>PADDY WB</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000' }}>LOADED BAGS</th>
                            <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center', border: '1px solid #000000' }}>PHOTO</th>
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
    </div>
  );
};
export default AllottedSupervisors;
