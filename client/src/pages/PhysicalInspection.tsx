import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  workflowStatus: string;
  offeringPrice?: number;
  priceType?: string;
  finalPrice?: number;
  entryType?: string;
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

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

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
  samplingStages?: any;
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

const PhysicalInspection: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});
  const [activeTab, setActiveTab] = useState<'paddy' | 'rice'>('paddy');
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
  const [detailModalEntry, setDetailModalEntry] = useState<any>(null);
  const [expandedEntries, setExpandedEntries] = useState<{ [key: string]: boolean }>({});

  const toggleExpand = (entryId: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

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
        entryId: entry.id,
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

  // Inspection form data
  const [inspectionData, setInspectionData] = useState<{
    [key: string]: {
      inspectionDate: string;
      lorryNumber: string;
      remarks: string;
    }
  }>({});

  const [selectedStage, setSelectedStage] = useState<{ [entryId: string]: string }>({});
  const [activeCards, setActiveCards] = useState<{ [entryId: string]: string[] }>({});
  const [samplingStageData, setSamplingStageData] = useState<{
    [entryId: string]: {
      [stage: string]: {
        moisture: string;
        dryMoisture: string;
        dryMoistureValue?: string;
        grainsCount: string;
        cutting: string;
        bend: string;
        mix: string;
        smixEnabled: string;
        mixS: string;
        lmixEnabled: string;
        mixL: string;
        sk: string;
        kandu: string;
        oil: string;
        smellHas: string;
        smellType?: string;
        paddyWbEnabled: string;
        paddyWb: string;
        actualBags?: string;
        stageImage: File | null;
        reportedBy: string;
        isLocked?: boolean;
        imageUrl?: string | null;
      }
    }
  }>({});

  const selectedEntryRef = useRef<string | null>(null);
  const inspectionDataRef = useRef<any>({});

  useEffect(() => {
    selectedEntryRef.current = selectedEntry;
  }, [selectedEntry]);

  useEffect(() => {
    inspectionDataRef.current = inspectionData;
  }, [inspectionData]);

  useEffect(() => {
    loadEntries();
    const interval = setInterval(() => {
      loadEntries(true);
    }, 12000); // Silent background reload every 12 seconds
    return () => clearInterval(interval);
  }, []);

  const syncActiveLorryStages = (entryId: string, lorryNo: string, currentProgress: InspectionProgress) => {
    const cleanLorry = lorryNo.trim().toUpperCase();
    const prevLorryInspection = currentProgress?.previousInspections?.find(
      i => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );

    if (prevLorryInspection && prevLorryInspection.samplingStages) {
      const stages = prevLorryInspection.samplingStages || {};
      const stageKeys = Object.keys(stages);
      
      const newStageData: any = {};
      stageKeys.forEach(key => {
        const dbStage = stages[key] || {};
        newStageData[key] = {
          moisture: dbStage.moisture !== null && dbStage.moisture !== undefined ? dbStage.moisture.toString() : '',
          dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
          dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
          grainsCount: dbStage.grainsCount !== null && dbStage.grainsCount !== undefined ? dbStage.grainsCount.toString() : '',
          cutting: dbStage.cutting1 !== null && dbStage.cutting2 !== undefined ? `${dbStage.cutting1}×${dbStage.cutting2}` : (dbStage.cutting1 !== null ? `${dbStage.cutting1}` : ''),
          bend: dbStage.bend1 !== null && dbStage.bend2 !== undefined ? `${dbStage.bend1}×${dbStage.bend2}` : (dbStage.bend1 !== null ? `${dbStage.bend1}` : ''),
          mix: dbStage.mix || '',
          smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
          mixS: dbStage.mixS || dbStage.mix_s || '',
          lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
          mixL: dbStage.mixL || dbStage.mix_l || '',
          sk: dbStage.sk || '',
          kandu: dbStage.kandu || '',
          oil: dbStage.oil || '',
          smellHas: dbStage.smellHas ? 'Yes' : 'No',
          smellType: dbStage.smellType || '',
          paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
          paddyWb: dbStage.paddyWb !== null && dbStage.paddyWb !== undefined ? dbStage.paddyWb.toString() : '',
          actualBags: dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : '',
          imageUrl: dbStage.imageUrl || null,
          reportedBy: dbStage.reportedBy || 'System',
          approvalStatus: dbStage.approvalStatus || 'approved',
          isLocked: true
        };
      });

      // Avoid infinite loop by checking for changes first
      let hasChanges = false;
      setActiveCards(prev => {
        const currentActive = prev[entryId] || [];
        const combined = Array.from(new Set([...currentActive, ...stageKeys]));
        if (currentActive.length !== combined.length || currentActive.some((val, idx) => combined[idx] !== val)) {
          hasChanges = true;
          return {
            ...prev,
            [entryId]: combined
          };
        }
        return prev;
      });

      setSamplingStageData(prev => {
        const currentVal = prev[entryId] || {};
        let dataChanged = false;
        stageKeys.forEach(k => {
          if (!currentVal[k] || currentVal[k].approvalStatus !== newStageData[k].approvalStatus || !currentVal[k].isLocked) {
            dataChanged = true;
          }
        });
        if (dataChanged) {
          return {
            ...prev,
            [entryId]: {
              ...currentVal,
              ...newStageData
            }
          };
        }
        return prev;
      });
    }
  };

  const loadEntries = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const token = localStorage.getItem('token');

      // Query for multiple statuses - LOT_ALLOTMENT, PHYSICAL_INSPECTION, INVENTORY_ENTRY, OWNER_FINANCIAL, MANAGER_FINANCIAL, FINAL_REVIEW, COMPLETED
      // This ensures lots don't disappear after first save or after completion
      const [lotAllotmentResponse, physicalInspectionResponse, inventoryEntryResponse, ownerFinancialResponse, managerFinancialResponse, finalReviewResponse, completedResponse] = await Promise.all([
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
      const inventoryEntryEntries = (inventoryEntryResponse.data as any).entries || [];
      const ownerFinancialEntries = (ownerFinancialResponse.data as any).entries || [];
      const managerFinancialEntries = (managerFinancialResponse.data as any).entries || [];
      const finalReviewEntries = (finalReviewResponse.data as any).entries || [];
      const completedEntries = (completedResponse.data as any).entries || [];

      // Combine all lists and remove duplicates
      const allMap = new Map();
      [...lotAllotmentEntries, ...physicalInspectionEntries, ...inventoryEntryEntries, ...ownerFinancialEntries, ...managerFinancialEntries, ...finalReviewEntries, ...completedEntries].forEach(entry => {
        allMap.set(entry.id, entry);
      });
      const allEntries = Array.from(allMap.values());
      setEntries(allEntries);

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
            samplingStages: (inspection as any).samplingStages,
            reportedBy: inspection.reportedBy || { username: 'System' }
          }))
        };
      });
      setInspectionProgress(progressCache);

      // Automatically sync stages for active lorry selection
      const activeEntry = selectedEntryRef.current;
      if (activeEntry) {
        const activeLorry = inspectionDataRef.current[activeEntry]?.lorryNumber;
        const currentProgress = progressCache[activeEntry];
        if (activeLorry && currentProgress) {
          syncActiveLorryStages(activeEntry, activeLorry, currentProgress);
        }
      }
    } catch (error: any) {
      if (!isSilent) {
        showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
      }
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
      console.error('Failed to load inspection progress:', error);
      console.error('Error response:', error.response?.data);
      // Set default progress if API fails
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

  const handleInputChange = (entryId: string, field: string, value: string | number) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value
      }
    }));
  };

  const handleStageInputChange = (entryId: string, stage: string, field: string, value: any) => {
    let finalValue = value;

    if (field === 'cutting' || field === 'bend') {
      let clean = String(value || '').replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
      const xCount = (clean.match(/×/g) || []).length;
      if (xCount > 1) {
        const idx = clean.indexOf('×');
        clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
      }
      if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
        clean = clean + '×';
      }
      const parts = clean.split('×');
      const first = (parts[0] || '').substring(0, 1);
      const second = (parts[1] || '').substring(0, 4);
      clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
      finalValue = clean;
    } else if (field === 'moisture' || field === 'dryMoistureValue' || field === 'grainsCount' || field === 'mix' || field === 'mixS' || field === 'mixL' || field === 'sk' || field === 'kandu' || field === 'oil' || field === 'paddyWb') {
      const alphaFields = ['mix', 'mixS', 'mixL', 'oil', 'kandu', 'sk'];
      let cleaned = '';

      if (alphaFields.includes(field)) {
        cleaned = String(value || '').replace(/[^0-9.a-zA-Z]/g, '');
        const alphaMatch = cleaned.match(/[a-zA-Z]/g);
        if (alphaMatch && alphaMatch.length > 1) {
          let firstAlphaFound = false;
          cleaned = Array.from(cleaned).filter(char => {
            if (/[a-zA-Z]/.test(char)) {
              if (!firstAlphaFound) {
                firstAlphaFound = true;
                return true;
              }
              return false;
            }
            return true;
          }).join('');
        }
      } else {
        cleaned = String(value || '').replace(/[^0-9.]/g, '');
      }

      if (field === 'grainsCount') {
        if (cleaned.length > 3) return;
      } else {
        if (cleaned.length > 7) return;
      }
      finalValue = cleaned;
    }

    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [stage]: {
          ...prev[entryId]?.[stage],
          [field]: finalValue
        }
      }
    }));
  };

  const handleLorryNumberChange = (entryId: string, lorryNo: string) => {
    handleInputChange(entryId, 'lorryNumber', lorryNo.toUpperCase());

    const cleanLorry = lorryNo.trim().toUpperCase();
    const progress = inspectionProgress[entryId];
    const prevLorryInspection = progress?.previousInspections?.find(
      i => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );

    if (prevLorryInspection && prevLorryInspection.samplingStages) {
      const stages = prevLorryInspection.samplingStages || {};
      const stageKeys = Object.keys(stages);
      
      const newStageData: any = {};
      stageKeys.forEach(key => {
        const dbStage = stages[key] || {};
        newStageData[key] = {
          moisture: dbStage.moisture !== null && dbStage.moisture !== undefined ? dbStage.moisture.toString() : '',
          dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
          dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
          grainsCount: dbStage.grainsCount !== null && dbStage.grainsCount !== undefined ? dbStage.grainsCount.toString() : '',
          cutting: dbStage.cutting1 !== null && dbStage.cutting1 !== undefined ? `${dbStage.cutting1}${dbStage.cutting2 ? `×${dbStage.cutting2}` : ''}` : '',
          bend: dbStage.bend1 !== null && dbStage.bend1 !== undefined ? `${dbStage.bend1}${dbStage.bend2 ? `×${dbStage.bend2}` : ''}` : '',
          mix: dbStage.mix || '',
          smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
          mixS: dbStage.mixS || dbStage.mix_s || '',
          lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
          mixL: dbStage.mixL || dbStage.mix_l || '',
          sk: dbStage.sk || '',
          kandu: dbStage.kandu || '',
          oil: dbStage.oil || '',
          smellHas: dbStage.smellHas ? 'Yes' : 'No',
          smellType: dbStage.smellType || '',
          paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
          paddyWb: dbStage.paddyWb !== null && dbStage.paddyWb !== undefined ? dbStage.paddyWb.toString() : '',
          actualBags: dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : '',
          imageUrl: dbStage.imageUrl || null,
          reportedBy: dbStage.reportedBy || 'System',
          approvalStatus: dbStage.approvalStatus || 'approved',
          isLocked: true
        };
      });

      setActiveCards(prev => ({
        ...prev,
        [entryId]: stageKeys
      }));

      setSamplingStageData(prev => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          ...newStageData
        }
      }));
    } else {
      setActiveCards(prev => ({
        ...prev,
        [entryId]: []
      }));
      setSamplingStageData(prev => ({
        ...prev,
        [entryId]: {}
      }));
    }
  };

  const handleAddStage = (entryId: string) => {
    const stage = selectedStage[entryId];
    if (!stage) {
      showNotification('Please select a sampling stage from the dropdown', 'error');
      return;
    }

    const currentActive = activeCards[entryId] || [];
    if (currentActive.includes(stage)) {
      showNotification('This card is already open', 'error');
      return;
    }

    if (samplingStageData[entryId]?.[stage]) {
      showNotification('This stage has already been added/saved for this lorry', 'error');
      return;
    }



    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [stage]: {
          moisture: '',
          dryMoisture: 'N',
          dryMoistureValue: '',
          grainsCount: '',
          cutting: '',
          bend: '',
          mix: '',
          smixEnabled: 'N',
          mixS: '',
          lmixEnabled: 'N',
          mixL: '',
          sk: '',
          kandu: '',
          oil: '',
          smellHas: 'No',
          smellType: '',
          paddyWbEnabled: 'N',
          paddyWb: '',
          actualBags: '',
          stageImage: null,
          reportedBy: user?.username || 'System',
          isLocked: false
        }
      }
    }));

    setActiveCards(prev => ({
      ...prev,
      [entryId]: [...currentActive, stage]
    }));
  };

  const handleSaveStage = async (entryId: string, stage: string) => {
    const data = inspectionData[entryId];
    const stageVal = samplingStageData[entryId]?.[stage];
    const progress = inspectionProgress[entryId];
    const isLorryOptional = stage === 'lot_avg';

    if (!data || (!data.lorryNumber && !isLorryOptional)) {
      showNotification('Lorry number is required', 'error');
      return;
    }

    if (!stageVal) return;

    if (stage === 'full_avg' && (!stageVal.actualBags || Number(stageVal.actualBags) <= 0)) {
      showNotification('Loaded Bags is required for Full Avg Lorry', 'error');
      return;
    }

    const cuttingParts = (stageVal.cutting || '').split(/[xX×]/);
    const cutting1 = parseFloat(cuttingParts[0]?.trim()) || 0;
    const cutting2 = cuttingParts.length > 1 ? (parseFloat(cuttingParts[1]?.trim()) || 0) : 0;

    const bendParts = (stageVal.bend || '').split(/[xX×]/);
    const bend1 = parseFloat(bendParts[0]?.trim()) || 0;
    const bend2 = bendParts.length > 1 ? (parseFloat(bendParts[1]?.trim()) || 0) : 0;

    if (stage === 'full_avg' && progress) {
      const actualBags = Number(stageVal.actualBags);
      const totalInspected = progress.previousInspections
        .filter(i => (i.lorryNumber || '').trim().toUpperCase() !== data.lorryNumber.trim().toUpperCase())
        .reduce((sum, i) => sum + (i.bags || 0), 0);
      const remainingBags = progress.totalBags - totalInspected;

      if (actualBags > remainingBags) {
        showNotification(`Cannot inspect ${actualBags} bags. Only ${remainingBags} bags remaining.`, 'error');
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('inspectionDate', data.inspectionDate);
      formData.append('lorryNumber', data.lorryNumber || '');
      formData.append('stage', stage);
      formData.append('moisture', stageVal.moisture || '0');
      formData.append('dryMoisture', stageVal.dryMoisture === 'Y' ? (stageVal.dryMoistureValue || '1') : '0');
      formData.append('dryMoistureRaw', stageVal.dryMoisture === 'Y' ? (stageVal.dryMoistureValue || 'Y') : 'N');
      formData.append('grainsCount', stageVal.grainsCount || '0');
      formData.append('cutting1', cutting1.toString());
      formData.append('cutting2', cutting2.toString());
      formData.append('bend1', bend1.toString());
      formData.append('bend2', bend2.toString());
      formData.append('mix', stageVal.mix || '0');
      formData.append('smixEnabled', stageVal.smixEnabled === 'Y' ? 'true' : 'false');
      formData.append('mixS', stageVal.smixEnabled === 'Y' ? stageVal.mixS || '' : '');
      formData.append('lmixEnabled', stageVal.lmixEnabled === 'Y' ? 'true' : 'false');
      formData.append('mixL', stageVal.lmixEnabled === 'Y' ? stageVal.mixL || '' : '');
      formData.append('sk', stageVal.sk || '0');
      formData.append('kandu', stageVal.kandu || '0');
      formData.append('oil', stageVal.oil || '0');
      formData.append('smellHas', stageVal.smellHas === 'Yes' ? 'true' : 'false');
      formData.append('smellType', stageVal.smellHas === 'Yes' ? (stageVal.smellType || '') : '');
      formData.append('paddyWbEnabled', stageVal.paddyWbEnabled === 'Y' ? 'true' : 'false');
      formData.append('paddyWb', stageVal.paddyWb || '0');
      formData.append('remarks', data.remarks || '');
      formData.append('reportedBy', user?.username || 'System');

      if (stage === 'full_avg') {
        formData.append('actualBags', stageVal.actualBags || '0');
      }

      if (stageVal.stageImage) {
        formData.append('stageImage', stageVal.stageImage);
      }

      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      showNotification(`${stage.toUpperCase().replace('_', ' ')} saved successfully`, 'success');
      
      setSamplingStageData(prev => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          [stage]: {
            ...prev[entryId]?.[stage],
            isLocked: true
          }
        }
      }));

      await loadEntries();

      // Reset form states if Full Avg Lorry is saved (trip is completed)
      if (stage === 'full_avg') {
        setSelectedEntry(null);
        setActiveCards(prev => ({
          ...prev,
          [entryId]: []
        }));
        setSamplingStageData(prev => ({
          ...prev,
          [entryId]: {}
        }));
        setInspectionData(prev => ({
          ...prev,
          [entryId]: {
            inspectionDate: new Date().toISOString().split('T')[0],
            lorryNumber: '',
            remarks: ''
          }
        }));
      }
    } catch (error: any) {
      showNotification(error.response?.data?.error || `Failed to save ${stage}`, 'error');
    }
  };

  const initializeInspectionData = (entryId: string) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        inspectionDate: new Date().toISOString().split('T')[0],
        lorryNumber: '',
        remarks: ''
      }
    }));
    setSelectedStage(prev => ({
      ...prev,
      [entryId]: 'lot_avg'
    }));
    setActiveCards(prev => ({
      ...prev,
      [entryId]: []
    }));
    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: {}
    }));
    setSelectedEntry(entryId);
  };

  const handleResumeLorry = (entryId: string, lorryNumber: string, stages: any) => {
    const cleanLorry = lorryNumber.trim().toUpperCase();
    
    // Set inspection entry form state
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        inspectionDate: new Date().toISOString().split('T')[0],
        lorryNumber: cleanLorry,
        remarks: ''
      }
    }));

    // Parse the stages
    const stageKeys = Object.keys(stages || {});
    const newStageData: any = {};
    stageKeys.forEach(key => {
      const dbStage = stages[key] || {};
      newStageData[key] = {
        moisture: dbStage.moisture !== null && dbStage.moisture !== undefined ? dbStage.moisture.toString() : '',
        dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
        dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
        grainsCount: dbStage.grainsCount !== null && dbStage.grainsCount !== undefined ? dbStage.grainsCount.toString() : '',
        cutting: dbStage.cutting1 !== null && dbStage.cutting1 !== undefined ? `${dbStage.cutting1}${dbStage.cutting2 ? `×${dbStage.cutting2}` : ''}` : '',
        bend: dbStage.bend1 !== null && dbStage.bend1 !== undefined ? `${dbStage.bend1}${dbStage.bend2 ? `×${dbStage.bend2}` : ''}` : '',
        mix: dbStage.mix || '',
        smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
        mixS: dbStage.mixS || dbStage.mix_s || '',
        lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
        mixL: dbStage.mixL || dbStage.mix_l || '',
        sk: dbStage.sk || '',
        kandu: dbStage.kandu || '',
        oil: dbStage.oil || '',
        smellHas: dbStage.smellHas ? 'Yes' : 'No',
        smellType: dbStage.smellType || '',
        paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
        paddyWb: dbStage.paddyWb !== null && dbStage.paddyWb !== undefined ? dbStage.paddyWb.toString() : '',
        actualBags: dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : '',
        imageUrl: dbStage.imageUrl || null,
        reportedBy: dbStage.reportedBy || 'System',
        approvalStatus: dbStage.approvalStatus || 'approved',
        isLocked: true
      };
    });

    // Set stage data
    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: newStageData
    }));

    // Set active cards
    setActiveCards(prev => ({
      ...prev,
      [entryId]: stageKeys
    }));

    // Determine next stage
    const lotStage = stages.lot_avg || {};
    const halfStage = stages.half_lorry || {};
    let nextStage = 'lot_avg';
    if (lotStage.approvalStatus === 'approved') {
      nextStage = 'half_lorry';
    }
    if (halfStage.approvalStatus === 'approved') {
      nextStage = 'full_avg';
    }

    setSelectedStage(prev => ({
      ...prev,
      [entryId]: nextStage
    }));

    // Open/show the form entry
    setSelectedEntry(entryId);

    // Scroll to the panel
    setTimeout(() => {
      const element = document.getElementById(`lorry-loading-panel-${entryId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  };


  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#2e7d32';
    if (percentage >= 50) return '#d97706';
    return '#dc2626';
  };

  const isLocationStaffUser = (user?.role === 'staff' || user?.role === 'paddy_supervisor') && user?.staffType === 'location';
  const isLegacyPhysicalSupervisor = user?.role === 'physical_supervisor' || user?.role === 'paddy_supervisor';

  if (user && !isLocationStaffUser && !isLegacyPhysicalSupervisor) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        <h2 style={{ marginBottom: '10px', color: '#333' }}>Access Denied</h2>
        <p>Only assigned location staff can access this page.</p>
      </div>
    );
  }

  const filteredEntries = entries.filter(entry => {
    if (activeTab === 'paddy') {
      return entry.entryType !== 'RICE_SAMPLE';
    } else {
      return entry.entryType === 'RICE_SAMPLE';
    }
  });

  return (
    <div style={{ padding: '0px 20px 20px 20px' }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '10px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <button
          onClick={() => setActiveTab('paddy')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderBottom: activeTab === 'paddy' ? '3px solid #4a90e2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'paddy' ? '#4a90e2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Paddy Loading
        </button>
        <button
          onClick={() => setActiveTab('rice')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderBottom: activeTab === 'rice' ? '3px solid #4a90e2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'rice' ? '#4a90e2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Rice Loading
        </button>
      </div>

      <div style={{
        overflowX: 'auto',
        backgroundColor: 'white',
        border: '1px solid #999'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '60px' }}>SL No</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Date</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '100px' }}>Broker</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Party</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Location</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Variety</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Total</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Loaded</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Balance</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Progress</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No lots allotted for inspection</td></tr>
            ) : (
              filteredEntries.map((entry, index) => {
                const progress = inspectionProgress[entry.id];
                const progressPercentage = progress?.progressPercentage || 0;

                // Check if this is a new lot (different from previous)
                const prevEntry = filteredEntries[index - 1];
                const isNewLot = !prevEntry || prevEntry.id !== entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '3px solid #666' }}>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                        {index + 1}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.brokerName}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                        <div 
                          onClick={() => setDetailModalEntry(entry)}
                          style={{ fontWeight: '700', color: '#1565c0', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {entry.partyName && entry.partyName.trim() ? toTitleCase(entry.partyName) : (entry.lorryNumber ? entry.lorryNumber.toUpperCase() : 'Lorry Details')}
                        </div>
                        {entry.lorryNumber && entry.partyName && entry.partyName.trim() && (
                          <div 
                            onClick={() => setDetailModalEntry(entry)}
                            style={{ fontSize: '12px', color: '#1565c0', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {entry.lorryNumber.toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.location}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.variety}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>
                        {progress?.totalBags?.toLocaleString('en-IN') || entry.bags?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', color: '#4CAF50', fontWeight: '700' }}>
                        {progress?.inspectedBags || 0}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', color: entry.lotAllotment?.closedAt ? '#d32f2f' : '#FF9800', fontWeight: '700' }}>
                        {entry.lotAllotment?.closedAt ? (
                           <span>0 <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#777' }}>(Closed)</span></span>
                        ) : (
                          progress?.remainingBags?.toLocaleString('en-IN') || entry.bags?.toLocaleString('en-IN')
                        )}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '6px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{
                              flex: 1,
                              height: '20px',
                              backgroundColor: '#e0e0e0',
                              borderRadius: '10px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${entry.lotAllotment?.closedAt ? 100 : progressPercentage}%`,
                                backgroundColor: entry.lotAllotment?.closedAt ? '#7f8c8d' : getProgressColor(progressPercentage),
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '35px' }}>
                              {entry.lotAllotment?.closedAt ? 'Closed' : `${progressPercentage.toFixed(0)}%`}
                            </span>
                          </div>
                          {progress && progress.previousInspections && progress.previousInspections.length > 0 && (
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              style={{
                                alignSelf: 'flex-start',
                                fontSize: '11px',
                                padding: '2px 6px',
                                fontWeight: '700',
                                backgroundColor: '#1565c0',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                marginTop: '2px'
                              }}
                            >
                              {expandedEntries[entry.id] ? '▲ Hide Trips' : `▼ View ${progress.previousInspections.length} Trip(s)`}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '6px', textAlign: 'left' }}>
                        <button
                          onClick={() => initializeInspectionData(entry.id)}
                          disabled={progressPercentage >= 100 || !!entry.lotAllotment?.closedAt}
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            fontWeight: '700',
                            backgroundColor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt) ? '#ccc' : (selectedEntry === entry.id ? '#FF9800' : '#4CAF50'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {entry.lotAllotment?.closedAt ? 'Closed' : (progressPercentage >= 100 ? 'Complete' : (selectedEntry === entry.id ? 'Editing...' : 'Add Lorry Load'))}
                        </button>
                      </td>
                    </tr>

                    {/* Show previous inspections history with beautiful inline comparative orange grid */}
                    {expandedEntries[entry.id] && progress && progress.previousInspections && progress.previousInspections.length > 0 && (
                      <tr style={{ borderBottom: '3px solid #444' }}>
                        <td colSpan={11} style={{ padding: '12px', backgroundColor: '#fdf6f0', border: '1px solid #000', borderBottom: '3px solid #444' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px', color: '#1a237e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📋 Lorry Loading Details ({progress.previousInspections.length})</span>
                          </div>
                          
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000', backgroundColor: '#ffffff' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f5f5f5', color: '#000', borderBottom: '1px solid #000' }}>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '5%' }}>#</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '11%' }}>Date</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'left', width: '15%' }}>Lorry No</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Bags</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Moisture</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Cutting</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Bend</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'left', width: '11%' }}>By</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '11%' }}>Status</th>
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Action</th>
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

                                return (
                                  <tr key={inspection.id} style={{ borderBottom: '1px solid #000' }}>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                      {new Date(inspection.inspectionDate).toLocaleDateString('en-GB')}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: '700' }}>
                                      <span
                                        onClick={() => setSelectedLorryForComparison({ entryId: entry.id, lorryNumber: inspection.lorryNumber, previousInspections: [inspection], lotAllotment: entry.lotAllotment, singleLorryMode: true })}
                                        style={{ color: '#1565c0', textDecoration: 'underline', cursor: 'pointer' }}
                                      >
                                        {inspection.lorryNumber?.toUpperCase()}
                                      </span>
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{inspection.bags || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600', color: '#d05d00' }}>{moistureVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{cuttingVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{bendVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px' }}>{inspection.reportedBy?.username || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '700', color: entry.lotSelectionDecision === 'FAIL' ? '#d32f2f' : (entry.lotSelectionDecision?.startsWith('PASS') ? '#2e7d32' : '#f39c12') }}>
                                      {entry.lotSelectionDecision ? (entry.lotSelectionDecision.toUpperCase().startsWith('PASS') ? 'Pass' : 'Fail') : 'Pending'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages)}
                                        style={{
                                          fontSize: '11px',
                                          padding: '3px 8px',
                                          fontWeight: '700',
                                          backgroundColor: '#27ae60',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✍️ Resume
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}

                    {/* Inspection form */}
                    {selectedEntry === entry.id && (
                      <tr id={`lorry-loading-panel-${entry.id}`}>
                        <td colSpan={11} style={{ padding: '15px', backgroundColor: '#fafafa', border: '1px solid #999' }}>
                          <div style={{
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            width: '100%'
                          }}>
                            {/* Left Panel: Lorry Loading Details */}
                            <div style={{
                              width: '320px',
                              backgroundColor: '#ffffff',
                              padding: '16px 20px',
                              borderRadius: '8px',
                              border: '2px solid #27ae60',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }}>
                              <div style={{
                                backgroundColor: '#27ae60',
                                color: 'white',
                                padding: '8px 12px',
                                margin: '-16px -20px 16px -20px',
                                borderTopLeftRadius: '6px',
                                borderTopRightRadius: '6px',
                                fontWeight: '700',
                                fontSize: '14px',
                                textAlign: 'center'
                              }}>
                                🚛 Lorry Loading Details
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Loaded Date *
                                  </label>
                                  <input
                                    type="date"
                                    value={inspectionData[entry.id]?.inspectionDate || ''}
                                    onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '12px',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#f5f5f5'
                                    }}
                                  />
                                  <span style={{ fontSize: '10px', color: '#c0392b', fontWeight: '600' }}>Freezed</span>
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Lorry number *
                                  </label>
                                  <input
                                    type="text"
                                    value={inspectionData[entry.id]?.lorryNumber || ''}
                                    onChange={(e) => handleLorryNumberChange(entry.id, e.target.value)}
                                    placeholder="ENTER LORRY NUMBER"
                                    maxLength={12}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '12px',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      fontWeight: '600',
                                      backgroundColor: '#fff',
                                      textTransform: 'uppercase'
                                    }}
                                  />
                                  {progress && progress.previousInspections && progress.previousInspections.length > 0 && (
                                    <div style={{ marginTop: '6px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '4px' }}>
                                        Resume Active Lorry:
                                      </span>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {Array.from(new Set(progress.previousInspections.map(i => i.lorryNumber?.toUpperCase()).filter(Boolean))).map(lorryNo => (
                                          <span
                                            key={lorryNo}
                                            onClick={() => {
                                              handleInputChange(entry.id, 'lorryNumber', lorryNo);
                                              handleLorryNumberChange(entry.id, lorryNo);

                                              const inspection = progress.previousInspections.find(i => i.lorryNumber?.toUpperCase() === lorryNo);
                                              if (inspection) {
                                                const stages = inspection.samplingStages || {};
                                                const lotStage = stages.lot_avg || {};
                                                const halfStage = stages.half_lorry || {};
                                                let nextStage = 'lot_avg';
                                                if (lotStage.approvalStatus === 'approved') {
                                                  nextStage = 'half_lorry';
                                                }
                                                if (halfStage.approvalStatus === 'approved') {
                                                  nextStage = 'full_avg';
                                                }
                                                setSelectedStage(prev => ({
                                                  ...prev,
                                                  [entry.id]: nextStage
                                                }));
                                              }
                                            }}
                                            style={{
                                              fontSize: '11px',
                                              padding: '3px 8px',
                                              backgroundColor: '#e8f4fd',
                                              color: '#1e88e5',
                                              border: '1px solid #bbdefb',
                                              borderRadius: '12px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            🚛 {lorryNo}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Sampling *
                                  </label>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <select
                                      value={selectedStage[entry.id] || ''}
                                      onChange={(e) => setSelectedStage(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                      style={{
                                        flex: 1,
                                        padding: '8px',
                                        fontSize: '12px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: '#fff'
                                      }}
                                    >
                                      <option value="lot_avg" disabled={!!samplingStageData[entry.id]?.['lot_avg']}>1. Lot Avg Sampling</option>
                                      <option value="half_lorry" disabled={!!samplingStageData[entry.id]?.['half_lorry']}>2. Half Lorry Sampling</option>
                                      <option value="full_avg" disabled={!!samplingStageData[entry.id]?.['full_avg']}>3. Full Avg Lorry Sampling</option>
                                      <option value="nit_avg" disabled={!!samplingStageData[entry.id]?.['nit_avg']}>4. Nit Avg Sampling</option>
                                    </select>
                                    <button
                                      onClick={() => handleAddStage(entry.id)}
                                      type="button"
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#e74c3c',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Submit
                                    </button>
                                  </div>
                                </div>

                                <div style={{ borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', gap: '10px', marginTop: '10px' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedEntry(null);
                                      setActiveCards(prev => ({ ...prev, [entry.id]: [] }));
                                      setSamplingStageData(prev => ({ ...prev, [entry.id]: {} }));
                                      setInspectionData(prev => ({
                                        ...prev,
                                        [entry.id]: {
                                          inspectionDate: new Date().toISOString().split('T')[0],
                                          lorryNumber: '',
                                          remarks: ''
                                        }
                                      }));
                                    }}
                                    style={{
                                      flex: 1,
                                      fontSize: '12px',
                                      padding: '8px 12px',
                                      fontWeight: '700',
                                      backgroundColor: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Right Section: Progressive Stage Sampling Cards */}
                            <div style={{
                              flex: 1,
                              display: 'flex',
                              gap: '20px',
                              flexWrap: 'wrap',
                              alignItems: 'flex-start',
                              justifyContent: 'center'
                            }}>
                              {(activeCards[entry.id] || []).map((stage) => {
                                const cardData = samplingStageData[entry.id]?.[stage] || {
                                  moisture: '',
                                  dryMoisture: 'N',
                                  dryMoistureValue: '',
                                  grainsCount: '',
                                  cutting: '',
                                  bend: '',
                                  mix: '',
                                  smixEnabled: 'N',
                                  mixS: '',
                                  lmixEnabled: 'N',
                                  mixL: '',
                                  sk: '',
                                  kandu: '',
                                  oil: '',
                                  smellHas: 'No',
                                  smellType: '',
                                  paddyWbEnabled: 'N',
                                  paddyWb: '',
                                  actualBags: '',
                                  reportedBy: user?.username || 'System',
                                  isLocked: false
                                };
                                const isLocked = !!cardData.isLocked;
                                const getCardHeader = () => {
                                  if (stage === 'lot_avg') return { title: 'Add Lot Avg Sampling', color: '#e67e22', border: '2px solid #e67e22' };
                                  if (stage === 'half_lorry') return { title: 'Half Lorry Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
                                  if (stage === 'nit_avg') return { title: 'Nit Avg Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
                                  return { title: 'Full Avg Lorry Sampling', color: '#2980b9', border: '2px solid #2980b9' };
                                };

                                const cardStyle = getCardHeader();

                                return (
                                  <div key={stage} style={{
                                    width: '380px',
                                    backgroundColor: '#ffffff',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: cardStyle.border,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                                    opacity: isLocked ? 0.85 : 1
                                  }}>
                                    <div style={{
                                      fontSize: '13px',
                                      fontWeight: '700',
                                      color: cardStyle.color,
                                      borderBottom: `2px solid ${cardStyle.color}1a`,
                                      paddingBottom: '6px',
                                      marginBottom: '12px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <span>{cardStyle.title}</span>
                                      {isLocked && (() => {
                                        const appStatus = cardData.approvalStatus || 'approved';
                                        if (appStatus === 'pending') {
                                          return (
                                            <span style={{
                                              fontSize: '9px',
                                              padding: '2px 6px',
                                              backgroundColor: '#f39c12',
                                              color: 'white',
                                              borderRadius: '10px',
                                              fontWeight: 'bold'
                                            }}>Pending</span>
                                          );
                                        }
                                        return (
                                          <span style={{
                                            fontSize: '9px',
                                            padding: '2px 6px',
                                            backgroundColor: '#2ecc71',
                                            color: 'white',
                                            borderRadius: '10px',
                                            fontWeight: 'bold'
                                          }}>Approved</span>
                                        );
                                      })()}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
                                      {stage === 'full_avg' && (
                                        <div style={{ backgroundColor: '#fcf8e3', padding: '8px', borderRadius: '4px', border: '1px solid #faebcc', marginBottom: '4px' }}>
                                          <label style={{ display: 'block', fontWeight: '700', color: '#8a6d3b', marginBottom: '3px' }}>
                                            Actual bags (this lorry) * Loaded Bags
                                          </label>
                                          <input
                                            type="number"
                                            disabled={isLocked}
                                            value={cardData.actualBags || ''}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'actualBags', e.target.value)}
                                            placeholder={`Max remaining: ${progress?.remainingBags || entry.bags}`}
                                            style={{
                                              width: '100%',
                                              padding: '6px',
                                              fontSize: '11px',
                                              border: '1px solid #ccc',
                                              borderRadius: '4px',
                                              backgroundColor: isLocked ? '#f5f5f5' : '#fff'
                                            }}
                                          />
                                        </div>
                                      )}

                                      {/* Row 1: Moisture, Dry Moisture, Grains */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Moisture *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.moisture}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'moisture', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Dry Moisture</label>
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.dryMoisture === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'dryMoisture', 'Y')} /> Y</label>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.dryMoisture === 'N'} onChange={() => handleStageInputChange(entry.id, stage, 'dryMoisture', 'N')} /> N</label>
                                          </div>
                                          {cardData.dryMoisture === 'Y' && (
                                            <input
                                              type="text"
                                              disabled={isLocked}
                                              value={cardData.dryMoistureValue || ''}
                                              onChange={(e) => handleStageInputChange(entry.id, stage, 'dryMoistureValue', e.target.value)}
                                              placeholder="Dry Value"
                                              style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                            />
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Grains Count *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.grainsCount}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'grainsCount', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                      </div>

                                      {/* Row 2: Cutting, Bend, Mix */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Cutting *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.cutting}
                                            placeholder="1×"
                                            onFocus={() => {
                                              if (!cardData.cutting) {
                                                const res = handleCuttingInput('1×', entry.entryType);
                                                handleStageInputChange(entry.id, stage, 'cutting', res.raw);
                                              }
                                            }}
                                            onChange={(e) => {
                                              const res = handleCuttingInput(e.target.value, entry.entryType);
                                              handleStageInputChange(entry.id, stage, 'cutting', res.raw);
                                            }}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Bend *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.bend}
                                            placeholder="1×"
                                            onFocus={() => {
                                              if (!cardData.bend) {
                                                const res = handleBendInput('1×', entry.entryType);
                                                handleStageInputChange(entry.id, stage, 'bend', res.raw);
                                              }
                                            }}
                                            onChange={(e) => {
                                              const res = handleBendInput(e.target.value, entry.entryType);
                                              handleStageInputChange(entry.id, stage, 'bend', res.raw);
                                            }}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Mix *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.mix}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'mix', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                      </div>

                                      {/* Row 3: SMix, LMix, SK */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>SMix</label>
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.smixEnabled === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'smixEnabled', 'Y')} /> Y</label>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.smixEnabled === 'N'} onChange={() => { handleStageInputChange(entry.id, stage, 'smixEnabled', 'N'); handleStageInputChange(entry.id, stage, 'mixS', ''); }} /> N</label>
                                          </div>
                                          {cardData.smixEnabled === 'Y' && (
                                            <input
                                              type="text"
                                              disabled={isLocked}
                                              value={cardData.mixS}
                                              onChange={(e) => handleStageInputChange(entry.id, stage, 'mixS', e.target.value)}
                                              style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                            />
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>LMix</label>
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.lmixEnabled === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'lmixEnabled', 'Y')} /> Y</label>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.lmixEnabled === 'N'} onChange={() => { handleStageInputChange(entry.id, stage, 'lmixEnabled', 'N'); handleStageInputChange(entry.id, stage, 'mixL', ''); }} /> N</label>
                                          </div>
                                          {cardData.lmixEnabled === 'Y' && (
                                            <input
                                              type="text"
                                              disabled={isLocked}
                                              value={cardData.mixL}
                                              onChange={(e) => handleStageInputChange(entry.id, stage, 'mixL', e.target.value)}
                                              style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                            />
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>SK *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.sk}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'sk', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                      </div>

                                      {/* Row 4: Kandu, Oil, Smell */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Kandu *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.kandu}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'kandu', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Oil *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={cardData.oil}
                                            onChange={(e) => handleStageInputChange(entry.id, stage, 'oil', e.target.value)}
                                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Smell</label>
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.smellHas === 'Yes'} onChange={() => handleStageInputChange(entry.id, stage, 'smellHas', 'Yes')} /> Yes</label>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.smellHas === 'No'} onChange={() => { handleStageInputChange(entry.id, stage, 'smellHas', 'No'); handleStageInputChange(entry.id, stage, 'smellType', ''); }} /> No</label>
                                          </div>
                                          {cardData.smellHas === 'Yes' && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <label><input type="radio" disabled={isLocked} checked={cardData.smellType === 'Light'} onChange={() => handleStageInputChange(entry.id, stage, 'smellType', 'Light')} /> Light</label>
                                              <label><input type="radio" disabled={isLocked} checked={cardData.smellType === 'Medium'} onChange={() => handleStageInputChange(entry.id, stage, 'smellType', 'Medium')} /> Medium</label>
                                              <label><input type="radio" disabled={isLocked} checked={cardData.smellType === 'Dark'} onChange={() => handleStageInputChange(entry.id, stage, 'smellType', 'Dark')} /> Dark</label>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Row 5: Paddy WB */}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ width: '100px' }}>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB</label>
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'Y')} /> Y</label>
                                            <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'N'} onChange={() => handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'N')} /> N</label>
                                          </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          {cardData.paddyWbEnabled === 'Y' && (
                                            <>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB Value *</label>
                                              <input
                                                type="text"
                                                disabled={isLocked}
                                                value={cardData.paddyWb}
                                                onChange={(e) => handleStageInputChange(entry.id, stage, 'paddyWb', e.target.value)}
                                                style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                              />
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Footer: Image and Reported By */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '4px' }}>
                                        <div>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Upload Photo (Optional)</label>
                                          {isLocked ? (
                                            cardData.imageUrl ? (
                                              <a href={`${cardData.imageUrl}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#3498db', fontWeight: 'bold' }}>🖼️ View Photo</a>
                                            ) : (
                                              <span style={{ fontStyle: 'italic', color: '#999' }}>No photo uploaded</span>
                                            )
                                          ) : (
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => handleStageInputChange(entry.id, stage, 'stageImage', e.target.files?.[0] || null)}
                                              style={{ width: '100%', fontSize: '11px' }}
                                            />
                                          )}
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Sample Reported By *</label>
                                          <input
                                            type="text"
                                            disabled
                                            value={cardData.reportedBy}
                                            style={{
                                              width: '100%',
                                              padding: '5px',
                                              fontSize: '11px',
                                              border: '1px solid #ddd',
                                              borderRadius: '4px',
                                              backgroundColor: '#f5f5f5',
                                              color: '#666',
                                              fontWeight: 'bold'
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {!isLocked && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                          <button
                                            onClick={() => handleSaveStage(entry.id, stage)}
                                            style={{
                                              flex: 1,
                                              padding: '6px',
                                              backgroundColor: '#27ae60',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              fontSize: '11px'
                                            }}
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => {
                                              setActiveCards(prev => ({
                                                ...prev,
                                                [entry.id]: (prev[entry.id] || []).filter(k => k !== stage)
                                              }));
                                            }}
                                            style={{
                                              padding: '6px 12px',
                                              backgroundColor: '#95a5a6',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              fontSize: '11px'
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
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
                    <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: bgColor }}>
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
                    <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Trip #{idx + 1} | Lorry No: {inspection.lorryNumber?.toUpperCase()} | Bags Loaded: {inspection.bags || '-'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Reported By: {inspection.reportedBy?.username || 'System'} | Date: {new Date(inspection.inspectionDate).toLocaleDateString()}</span>
                        <button
                          onClick={() => {
                            const entryId = selectedLorryForComparison.entryId || inspection.sampleEntryId;
                            
                            // Close comparison modal
                            setSelectedLorryForComparison(null);

                            // Resume lorry
                            handleResumeLorry(entryId, inspection.lorryNumber, stages);
                          }}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            fontWeight: '700',
                            backgroundColor: '#2ecc71',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          ✍️ Resume
                        </button>
                      </div>
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
      {detailModalEntry && (
        <SampleEntryDetailModal
          detailEntry={detailModalEntry}
          onClose={() => setDetailModalEntry(null)}
        />
      )}
    </div>
  );
};

export default PhysicalInspection;
