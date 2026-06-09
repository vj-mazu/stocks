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

      // Removed setActiveCards from here. We only want to update the background data, 
      // not force completed stages to suddenly appear as active forms in the UI.

      setSamplingStageData(prev => {
        const currentVal = prev[entryId] || {};
        let dataChanged = false;
        stageKeys.forEach(k => {
          if (!currentVal[k] || currentVal[k].approvalStatus !== newStageData[k].approvalStatus || !currentVal[k].isLocked) {
            dataChanged = true;
          }
        });
        if (dataChanged) {
          // Preserve any unlocked (currently being edited) entries — especially new nit_avg forms
          const merged = { ...currentVal };
          Object.keys(newStageData).forEach(k => {
            // Only overwrite if the current entry is locked or doesn't exist
            if (!merged[k] || merged[k].isLocked) {
              merged[k] = newStageData[k];
            }
          });
          return {
            ...prev,
            [entryId]: merged
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

            // Sort progressive trips chronologically: first load first
            mapped.sort((a, b) => {
              const getEarliestTimestamp = (insp: any) => {
                const stages = insp.samplingStages || {};
                let earliest: number | null = null;
                for (const key in stages) {
                  const stage = stages[key];
                  if (stage && stage.reportedAt) {
                    const t = new Date(stage.reportedAt).getTime();
                    if (!earliest || t < earliest) earliest = t;
                  }
                }
                const createdAtTime = insp.createdAt ? new Date(insp.createdAt).getTime() : null;
                const inspectionDateTime = insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null;
                return earliest || createdAtTime || inspectionDateTime || (Number(insp.id) * 1000) || 9999999999999;
              };
              return getEarliestTimestamp(a) - getEarliestTimestamp(b);
            });

            return mapped;
          })()
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
      
      const data = response.data;
      if (data && data.previousInspections) {
        data.previousInspections.sort((a: any, b: any) => {
          const getEarliestTimestamp = (insp: any) => {
            const stages = insp.samplingStages || {};
            let earliest: number | null = null;
            for (const key in stages) {
              const stage = stages[key];
              if (stage && stage.reportedAt) {
                const t = new Date(stage.reportedAt).getTime();
                if (!earliest || t < earliest) earliest = t;
              }
            }
            const createdAtTime = insp.createdAt ? new Date(insp.createdAt).getTime() : null;
            const inspectionDateTime = insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null;
            return earliest || createdAtTime || inspectionDateTime || (Number(insp.id) * 1000) || 9999999999999;
          };
          return getEarliestTimestamp(a) - getEarliestTimestamp(b);
        });
      }
      
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: data
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
        if (cleaned.length > 6) return;
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
      // Check if date has changed (not today)
      const todayStr = new Date().toISOString().split('T')[0];
      if (prevLorryInspection.inspectionDate && prevLorryInspection.inspectionDate !== todayStr) {
        showNotification('Cannot resume or edit this trip because the date has changed. Please start a new trip.', 'error');
        handleInputChange(entryId, 'lorryNumber', '');
        return;
      }

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
          nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
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

      // Automatically determine and select the next logical stage
      const lotStage = stages.lot_avg || {};
      const nitStage = stages.nit_avg || {};
      const halfStage = stages.half_lorry || {};
      const fullStage = stages.full_avg || {};
      let nextStage = 'lot_avg';
      
      if (lotStage.approvalStatus === 'approved') nextStage = 'nit_avg';
      if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && lotStage.approvalStatus === 'approved')) nextStage = 'half_lorry';
      if (halfStage.approvalStatus === 'approved') nextStage = 'full_avg';
      if (fullStage.approvalStatus === 'approved') nextStage = 'balanced_lot';

      setSelectedStage(prev => ({
        ...prev,
        [entryId]: nextStage
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

  const isStageApprovedForLot = (entryId: string, stageKey: string) => {
    if (samplingStageData[entryId]?.[stageKey]?.isLocked && samplingStageData[entryId]?.[stageKey]?.approvalStatus === 'approved') {
      return true;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    
    // Check if approved with current lorry number
    const approvedWithCurrent = prevInsps.some(insp => {
      const targetLorry = cleanLorry || (stageKey === 'lot_avg' ? 'LOT_AVG' : (stageKey === 'balanced_lot' ? 'BALANCED_LOT' : ''));
      const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === targetLorry;
      return lorryMatch && insp.samplingStages?.[stageKey]?.approvalStatus === 'approved';
    });
    if (approvedWithCurrent) return true;

    // Fallback for lot_avg on the first real lorry load
    if (stageKey === 'lot_avg' && cleanLorry && cleanLorry !== 'LOT_AVG' && cleanLorry !== 'BALANCED_LOT') {
      const priorRealLorries = prevInsps.filter(insp => {
        const l = (insp.lorryNumber || '').trim().toUpperCase();
        return l !== cleanLorry && l !== 'LOT_AVG' && l !== 'BALANCED_LOT';
      });
      if (priorRealLorries.length === 0) {
        // This is the first real lorry load. Check if lot_avg is approved under 'LOT_AVG'
        return prevInsps.some(insp => {
          const l = (insp.lorryNumber || '').trim().toUpperCase();
          return l === 'LOT_AVG' && insp.samplingStages?.lot_avg?.approvalStatus === 'approved';
        });
      }
    }

    return false;
  };

  const isAnyFullAvgSavedOrApproved = (entryId: string) => {
    if (samplingStageData[entryId]?.full_avg) {
      return true;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (!cleanLorry) return false;
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry === cleanLorry && insp.samplingStages?.full_avg;
    });
  };

  const isBalancedLotDisabled = (entryId: string) => {
    if (isStageLockedForLot(entryId, 'balanced_lot')) {
      return true;
    }
    if (!isAnyFullAvgSavedOrApproved(entryId)) {
      return true;
    }
    return false;
  };

  const isStageLockedForLot = (entryId: string, stageKey: string) => {
    if (stageKey.startsWith('nit_avg')) {
      return false;
    }
    if (samplingStageData[entryId]?.[stageKey]?.isLocked) {
      return true;
    }
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    if (stageKey === 'lot_avg') {
      return prevInsps.some(insp => 
        insp.samplingStages?.[stageKey] || (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG'
      );
    }
    if (stageKey === 'balanced_lot') {
      return prevInsps.some(insp => 
        insp.samplingStages?.[stageKey] || (insp.lorryNumber || '').trim().toUpperCase() === 'BALANCED_LOT'
      );
    }
    if (stageKey === 'nit_avg') {
      return false;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    return prevInsps.some(insp => {
      const targetLorry = cleanLorry;
      const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === targetLorry;
      return lorryMatch && insp.samplingStages?.[stageKey];
    });
  };

  const isLorryFreezed = (entryId: string, currentLorryNum: string) => {
    if (!currentLorryNum) return false;
    const cleanLorry = currentLorryNum.trim().toUpperCase();
    if (!cleanLorry) return false;
    
    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections) return false;
    
    // Find matching inspection trip
    const trip = progress.previousInspections.find(
      (t: any) => (t.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );
    if (!trip) return false;
    
    const stages = trip.samplingStages || {};
    // If any stage is submitted (reportedBy is set) and is either pending or approved
    return Object.values(stages).some(
      (stg: any) => stg && stg.reportedBy && (stg.approvalStatus === 'pending' || stg.approvalStatus === 'approved')
    );
  };

  const isTripMissingBalancedLotRestrictive = (trip: any) => {
    const lorry = (trip.lorryNumber || '').trim().toUpperCase();
    if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
    
    const stages = trip.samplingStages || {};
    const hasFullAvg = stages.full_avg && stages.full_avg.approvalStatus === 'approved';
    const hasBalancedLot = stages.balanced_lot && (stages.balanced_lot.approvalStatus === 'approved' || stages.balanced_lot.approvalStatus === 'pending');
    
    if (hasFullAvg && !hasBalancedLot) {
      if (trip.inspectionDate) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const tripDate = new Date(trip.inspectionDate);
        const tripDateStr = tripDate.toISOString().split('T')[0];
        
        if (tripDateStr === todayStr) {
          return true;
        }
      }
    }
    return false;
  };

  const isLotAvgRequiredForLorry = (entryId: string, cleanLorry: string) => {
    if (!cleanLorry) return true;
    
    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections || progress.previousInspections.length === 0) {
      return true;
    }
    
    // Filter out inspections for the current lorry and dummy trips
    const priorInsps = progress.previousInspections.filter(
      i => {
        const lorry = (i.lorryNumber || '').trim().toUpperCase();
        return lorry !== cleanLorry && lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
      }
    );
    
    if (priorInsps.length === 0) {
      // No prior lorry loads on this lot, so lot_avg is required
      return true;
    }
    
    // Find the most recent prior inspection by date
    const sortedPrior = [...priorInsps].sort((a, b) => 
      new Date(a.inspectionDate).getTime() - new Date(b.inspectionDate).getTime()
    );
    const mostRecentPrior = sortedPrior[sortedPrior.length - 1];
    
    // Check if balanced_lot was recorded for the most recent prior lorry or on its same day
    const hasBalancedOnLastLorry = progress.previousInspections.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      if (lorry === mostRecentPrior.lorryNumber.trim().toUpperCase() && insp.samplingStages?.balanced_lot) {
        return true;
      }
      if (lorry === 'BALANCED_LOT' && insp.samplingStages?.balanced_lot) {
        const inspDate = new Date(insp.inspectionDate).toDateString();
        const lastLorryDate = new Date(mostRecentPrior.inspectionDate).toDateString();
        if (inspDate === lastLorryDate) return true;
      }
      return false;
    });
    
    return !hasBalancedOnLastLorry;
  };

  const handleAddStage = (entryId: string) => {
    let stage = selectedStage[entryId];
    if (!stage) {
      showNotification('Please select a sampling stage from the dropdown', 'error');
      return;
    }

    const currentActive = activeCards[entryId] || [];
    const existingStages = samplingStageData[entryId] || {};
    
    if (stage === 'nit_avg') {
      // Collect ALL existing nit_avg keys from both local state AND database progress
      const allNitKeys = new Set<string>();
      
      // Check local samplingStageData
      Object.keys(existingStages).forEach(k => {
        if (k.startsWith('nit_avg')) allNitKeys.add(k);
      });
      
      // Also check database progress (previousInspections) for saved nit_avg keys
      const progress = inspectionProgress[entryId];
      const currentLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
      if (progress?.previousInspections) {
        progress.previousInspections.forEach(insp => {
          const lorry = (insp.lorryNumber || '').trim().toUpperCase();
          if (lorry === currentLorry && insp.samplingStages) {
            Object.keys(insp.samplingStages).forEach(k => {
              if (k.startsWith('nit_avg')) allNitKeys.add(k);
            });
          }
        });
      }
      
      // Also check activeCards for any nit_avg cards currently open
      currentActive.forEach(k => {
        if (k.startsWith('nit_avg')) allNitKeys.add(k);
      });
      
      if (allNitKeys.has('nit_avg')) {
        let suffix = 2;
        while (allNitKeys.has(`nit_avg_${suffix}`)) {
          suffix++;
        }
        stage = `nit_avg_${suffix}`;
      }
    }

    if (currentActive.includes(stage)) {
      showNotification('This card is already open', 'error');
      return;
    }

    if (isStageLockedForLot(entryId, stage)) {
      if (stage !== 'nit_avg' || !isAnyFullAvgSavedOrApproved(entryId)) {
        showNotification('This stage has already been added/saved for this lot', 'error');
        return;
      }
    }

    const currentLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (stage !== 'lot_avg' && stage !== 'balanced_lot') {
      if (!currentLorry || currentLorry === 'LOT_AVG' || currentLorry === 'BALANCED_LOT') {
        showNotification('Please enter a valid lorry number first', 'error');
        return;
      }
    }

    if (stage !== 'lot_avg' && isLotAvgRequiredForLorry(entryId, currentLorry)) {
      const hasLotAvg = isStageLockedForLot(entryId, 'lot_avg') || isStageApprovedForLot(entryId, 'lot_avg');
      if (!hasLotAvg) {
        showNotification(`This trip must start with Lot Average (lot_avg) first.`, 'error');
        return;
      }
    }

    if (stage === 'balanced_lot') {
      if (!isAnyFullAvgSavedOrApproved(entryId)) {
        showNotification('Cannot add Balanced Lot stage until Full Avg is saved or approved', 'error');
        return;
      }
      const tripDate = inspectionData[entryId]?.inspectionDate;
      const todayStr = new Date().toISOString().split('T')[0];
      if (tripDate && tripDate !== todayStr) {
        showNotification('Cannot add Balanced Lot on a different date from the trip date. Please start a new trip.', 'error');
        return;
      }
    }
    if (stage === 'lot_avg') {
      if (isStageLockedForLot(entryId, 'balanced_lot')) {
        showNotification('Cannot add Lot Avg stage because Balanced Lot has already been added', 'error');
        return;
      }
    }
    if (stage === 'full_avg') {
      const halfApproved = isStageApprovedForLot(entryId, 'half_lorry');
      const nitApproved = isStageApprovedForLot(entryId, 'nit_avg');
      if (!halfApproved && !nitApproved) {
        showNotification('Cannot add Full Avg stage until Half Lorry or Nit Avg is approved by Manager', 'error');
        return;
      }
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
    const isLorryOptional = stage === 'lot_avg' || stage === 'balanced_lot';

    let lorryNum = (data?.lorryNumber || '').trim().toUpperCase();
    if (!lorryNum && isLorryOptional) {
      lorryNum = stage === 'lot_avg' ? 'LOT_AVG' : 'BALANCED_LOT';
    }

    if (!isLorryOptional && (lorryNum === 'LOT_AVG' || lorryNum === 'BALANCED_LOT')) {
      showNotification('Please enter a valid lorry number', 'error');
      return;
    }

    if (!lorryNum) {
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
        .filter(i => (i.lorryNumber || '').trim().toUpperCase() !== lorryNum)
        .reduce((sum, i) => sum + (i.bags || 0), 0);
      const remainingBags = progress.totalBags - totalInspected;

      if (actualBags > remainingBags) {
        showNotification(`Cannot inspect ${actualBags} bags. Only ${remainingBags} bags remaining.`, 'error');
        return;
      }
    }

    if (stage.startsWith('nit_avg') && (!stageVal.nit || !stageVal.nit.trim())) {
      showNotification('Nit is required for Nit Avg Sampling', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('inspectionDate', data.inspectionDate);
      formData.append('lorryNumber', lorryNum);
      formData.append('stage', stage.startsWith('nit_avg') ? 'nit_avg' : stage);
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

      if (stage.startsWith('nit_avg')) {
        formData.append('nit', stageVal.nit || '');
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

      // Automatically close active card and return to main table
      setSelectedEntry(null);
      setActiveCards(prev => ({
        ...prev,
        [entryId]: []
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
    // Check if there is an incomplete trip to resume
    const progress = inspectionProgress[entryId];
    let incompleteTrip = null;
    let nextStage = 'lot_avg';
    
    if (progress && progress.previousInspections && progress.previousInspections.length > 0) {
      incompleteTrip = progress.previousInspections.find(trip => {
        const lorry = (trip.lorryNumber || '').trim().toUpperCase();
        if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
        
        const stages = trip.samplingStages || {};
        const hasApprovedFullAvg = stages.full_avg && stages.full_avg.approvalStatus === 'approved';
        const hasPending = Object.values(stages).some((stg: any) => stg.approvalStatus === 'pending');
        const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip);
        
        return !hasApprovedFullAvg || hasPending || isMissingBalanced;
      });
      
      if (incompleteTrip) {
        const stages = incompleteTrip.samplingStages || {};
        const lotStage = stages.lot_avg || {};
        const nitStage = stages.nit_avg || {};
        const halfStage = stages.half_lorry || {};
        const fullStage = stages.full_avg || {};
        
        const pendingStageKey = Object.keys(stages).find(k => stages[k]?.approvalStatus === 'pending');
        
        if (pendingStageKey) {
          nextStage = pendingStageKey;
        } else {
          // Determine logical next stage based on what's missing or pending
          if (lotStage.approvalStatus === 'approved') nextStage = 'nit_avg';
          if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && lotStage.approvalStatus === 'approved')) nextStage = 'half_lorry';
          if (halfStage.approvalStatus === 'approved') nextStage = 'full_avg';
          if (fullStage.approvalStatus === 'approved') nextStage = 'balanced_lot';
        }
      }
    }

    if (incompleteTrip) {
      setInspectionData(prev => ({
        ...prev,
        [entryId]: {
          inspectionDate: incompleteTrip.inspectionDate || new Date().toISOString().split('T')[0],
          lorryNumber: incompleteTrip.lorryNumber || '',
          remarks: ''
        }
      }));
      setSelectedStage(prev => ({
        ...prev,
        [entryId]: nextStage
      }));
      setActiveCards(prev => ({
        ...prev,
        [entryId]: []
      }));
      
      // Parse the stages and populate samplingStageData
      const stages = incompleteTrip.samplingStages || {};
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
          nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
          imageUrl: dbStage.imageUrl || null,
          reportedBy: dbStage.reportedBy || 'System',
          approvalStatus: dbStage.approvalStatus || 'approved',
          isLocked: true
        };
      });
      
      setSamplingStageData(prev => ({
        ...prev,
        [entryId]: newStageData
      }));
    } else {
      setInspectionData(prev => ({
        ...prev,
        [entryId]: {
          inspectionDate: new Date().toISOString().split('T')[0],
          lorryNumber: '',
          remarks: ''
        }
      }));
      
      // Select logical default next stage instead of hardcoded 'lot_avg'
      let defaultStage = 'lot_avg';
      if (progress && progress.previousInspections && progress.previousInspections.length > 0) {
        const hasAnyLotAvg = progress.previousInspections.some(insp => 
          insp.samplingStages?.lot_avg || (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG'
        );
        if (hasAnyLotAvg) {
          defaultStage = 'half_lorry';
        }
        const realPrior = progress.previousInspections.filter(i => {
          const lorry = (i.lorryNumber || '').trim().toUpperCase();
          return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
        });
        if (realPrior.length > 0) {
          const sorted = [...realPrior].sort((a, b) => 
            new Date(a.inspectionDate).getTime() - new Date(b.inspectionDate).getTime()
          );
          const mostRecent = sorted[sorted.length - 1];
          const hasBalancedOnMostRecent = progress.previousInspections.some(insp => {
            const lorry = (insp.lorryNumber || '').trim().toUpperCase();
            if (lorry === mostRecent.lorryNumber.trim().toUpperCase() && insp.samplingStages?.balanced_lot) {
              return true;
            }
            if (lorry === 'BALANCED_LOT' && insp.samplingStages?.balanced_lot) {
              const inspDate = new Date(insp.inspectionDate).toDateString();
              const lastLorryDate = new Date(mostRecent.inspectionDate).toDateString();
              if (inspDate === lastLorryDate) return true;
            }
            return false;
          });
          if (hasBalancedOnMostRecent) {
            defaultStage = 'half_lorry';
          }
        }
      }
      
      setSelectedStage(prev => ({
        ...prev,
        [entryId]: defaultStage
      }));
      setActiveCards(prev => ({
        ...prev,
        [entryId]: []
      }));
      setSamplingStageData(prev => ({
        ...prev,
        [entryId]: {}
      }));
    }
    
    setSelectedEntry(entryId);
  };

  const handleResumeLorry = (entryId: string, lorryNumber: string, stages: any, inspectionDate?: string, onlyBalanced?: boolean) => {
    const cleanLorry = lorryNumber.trim().toUpperCase();
    
    // If date has changed, do not allow resuming/editing the trip
    const todayStr = new Date().toISOString().split('T')[0];
    if (inspectionDate && inspectionDate !== todayStr) {
      showNotification('Cannot resume or edit this trip because the date has changed. Please start a new trip.', 'error');
      return;
    }
    
    // Set inspection entry form state
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        inspectionDate: inspectionDate || new Date().toISOString().split('T')[0],
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
        nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
        imageUrl: dbStage.imageUrl || null,
        reportedBy: dbStage.reportedBy || 'System',
        approvalStatus: dbStage.approvalStatus || 'approved',
        isLocked: true
      };
    });

    // Set stage data
    const stageDataWithBalanced = { ...newStageData };
    if (onlyBalanced) {
      stageDataWithBalanced['balanced_lot'] = {
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
    }

    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: onlyBalanced ? { ...prev[entryId], ...stageDataWithBalanced } : newStageData
    }));

    // Set active cards
    setActiveCards(prev => ({
      ...prev,
      [entryId]: onlyBalanced ? ['balanced_lot'] : stageKeys
    }));

    // Determine next stage
    const lotStage = stages.lot_avg || {};
    const nitStage = stages.nit_avg || {};
    const halfStage = stages.half_lorry || {};
    const fullStage = stages.full_avg || {};
    let nextStage = 'lot_avg';
    
    if (lotStage.approvalStatus === 'approved') {
      nextStage = 'nit_avg';
    }
    if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && lotStage.approvalStatus === 'approved')) {
      nextStage = 'half_lorry';
    }
    if (halfStage.approvalStatus === 'approved') {
      nextStage = 'full_avg';
    }
    if (fullStage.approvalStatus === 'approved') {
      nextStage = 'balanced_lot';
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
      if (entry.entryType === 'RICE_SAMPLE') return false;
    } else {
      if (entry.entryType !== 'RICE_SAMPLE') return false;
    }
    // Hide completed/closed lots
    const isClosed = !!entry.lotAllotment?.closedAt;
    const isWorkflowCompleted = entry.workflowStatus === 'COMPLETED';
    if (isClosed || isWorkflowCompleted) return false;
    return true;
  });

  return (
    <div style={{ padding: '0px 20px 20px 20px' }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '10px',
        borderBottom: '2px solid #e0e0e0',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
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

                const hasPendingStage = (() => {
                  if (!progress || !progress.previousInspections) return false;
                  return progress.previousInspections.some(trip => {
                    const stages = trip.samplingStages || {};
                    return Object.values(stages).some((stg: any) => stg && stg.approvalStatus === 'pending');
                  });
                })();

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
                          {progress?.previousInspections && progress.previousInspections.length > 0 && (
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              style={{
                                fontSize: '10px',
                                padding: '3px 6px',
                                marginTop: '4px',
                                backgroundColor: 'transparent',
                                color: '#4a90e2',
                                border: '1px solid #4a90e2',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'block',
                                width: '100%',
                                fontWeight: '600'
                              }}
                            >
                              {expandedEntries[entry.id] ? '▲ Hide Details' : `▼ ${progress.previousInspections.length} Trip(s)`}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '6px', textAlign: 'left' }}>
                        <button
                          onClick={() => initializeInspectionData(entry.id)}
                          disabled={progressPercentage >= 100 || !!entry.lotAllotment?.closedAt || hasPendingStage}
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            fontWeight: '700',
                            backgroundColor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt || hasPendingStage) ? '#ccc' : (selectedEntry === entry.id ? '#FF9800' : '#4CAF50'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt || hasPendingStage) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {(() => {
                            if (entry.lotAllotment?.closedAt) return 'Closed';
                            if (progressPercentage >= 100) return 'Complete';
                            if (hasPendingStage) return 'Awaiting Approval';
                            if (selectedEntry === entry.id) return 'Editing...';
                            
                            const hasIncompleteTrip = (() => {
                              const progress = inspectionProgress[entry.id];
                              if (!progress || !progress.previousInspections) return false;
                              return progress.previousInspections.some(trip => {
                                const lorry = (trip.lorryNumber || '').trim().toUpperCase();
                                if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
                                const stages = trip.samplingStages || {};
                                const hasApprovedFullAvg = stages.full_avg && stages.full_avg.approvalStatus === 'approved';
                                const hasPending = Object.values(stages).some((stg: any) => stg.approvalStatus === 'pending');
                                const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip);
                                return !hasApprovedFullAvg || hasPending || isMissingBalanced;
                              });
                            })();
                            
                            const hasApprovedLotAvg = (() => {
                              const progress = inspectionProgress[entry.id];
                              if (!progress || !progress.previousInspections) return false;
                              return progress.previousInspections.some(trip => {
                                const lorry = (trip.lorryNumber || '').trim().toUpperCase();
                                const stages = trip.samplingStages || {};
                                return lorry === 'LOT_AVG' && (stages.lot_avg?.approvalStatus === 'approved' || trip.cutting1 !== undefined);
                              });
                            })();
                             
                            return (hasIncompleteTrip || hasApprovedLotAvg) ? 'Add Sample' : 'Add Lorry Load';
                          })()}
                        </button>
                      </td>
                    </tr>
                    {expandedEntries[entry.id] && progress?.previousInspections && progress.previousInspections.length > 0 && (
                      <tr>
                        <td colSpan={11} style={{ padding: '12px', backgroundColor: '#fdf6f0', border: '1px solid #666', borderBottom: '3px solid #666' }}>
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
                                <th style={{ border: '1px solid #000', padding: '6px', fontWeight: '700', textAlign: 'center', width: '9%' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {progress.previousInspections.map((inspection, idx) => {
                                const stages = inspection.samplingStages || {};
                                const latestStage = stages.full_avg?.reportedBy ? stages.full_avg : (stages.half_lorry?.reportedBy ? stages.half_lorry : (stages.lot_avg?.reportedBy ? stages.lot_avg : null));
                                
                                const moistureVal = latestStage ? (latestStage.moistureRaw ? `${latestStage.moistureRaw}%` : (latestStage.moisture !== undefined && latestStage.moisture !== null ? `${latestStage.moisture}%` : '-')) : '-';
                                const cuttingVal = latestStage ? (latestStage.cutting1 !== undefined && latestStage.cutting1 !== null ? `${latestStage.cutting1}×${latestStage.cutting2 || 0}` : '-') : '-';
                                const bendVal = latestStage ? (latestStage.bend1 !== undefined && latestStage.bend1 !== null ? `${latestStage.bend1}×${latestStage.bend2 || 0}` : '-') : '-';
                                const o = (entry as any).offering || {};

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
                                      {(() => {
                                        const stages = inspection.samplingStages || {};
                                        const hasLotAvg = !!stages.lot_avg;
                                        const hasHalf = !!stages.half_lorry;
                                        const hasFull = !!stages.full_avg;
                                        const hasBalanced = !!stages.balanced_lot;

                                        // If dummy LOT_AVG trip
                                        const isLorryLotAvg = (inspection.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG';
                                        if (isLorryLotAvg) {
                                          if (stages.lot_avg?.approvalStatus === 'pending') {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                          }
                                          if (stages.lot_avg?.approvalStatus === 'approved') {
                                            return <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                          }
                                        }

                                        // If balanced lot is pending or approved
                                        if (hasBalanced) {
                                          if (stages.balanced_lot.approvalStatus === 'pending') {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Balanced Lot: Pending</span>;
                                          }
                                          return <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                        }

                                        // Check if incomplete trip to resume
                                        const isTripIncomplete = !hasFull || stages.full_avg.approvalStatus !== 'approved';
                                        if (isTripIncomplete) {
                                          // If it has any pending stages, wait for manager to approve before resuming
                                          const hasPendingStages = Object.values(stages).some((stg: any) => stg.approvalStatus === 'pending');
                                          if (hasPendingStages) {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                          }

                                          return (
                                            <button
                                              onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
                                              style={{
                                                backgroundColor: '#27ae60',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                padding: '3px 8px',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Resume
                                            </button>
                                          );
                                        }

                                        // If full_avg is approved but not balanced, and it's today
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const isToday = inspection.inspectionDate && inspection.inspectionDate.split('T')[0] === todayStr;
                                        if (isToday && !hasBalanced) {
                                          return (
                                            <button
                                              onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, true)}
                                              style={{
                                                backgroundColor: '#f2711c',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                padding: '3px 8px',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              ⚖️ Balanced Lot
                                            </button>
                                          );
                                        }

                                        return <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                      })()}
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
                                    disabled={isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) || (user?.role !== 'admin' && user?.role !== 'manager' && !isLocationStaffUser && !isLegacyPhysicalSupervisor)}
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
                                  {isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) && (
                                    <span style={{ fontSize: '10px', color: '#c0392b', fontWeight: '600', display: 'block', marginTop: '2px' }}>Freezed</span>
                                  )}
                                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Lorry number *
                                  </label>
                  <input
                    type="text"
                    value={inspectionData[entry.id]?.lorryNumber || ''}
                    onChange={(e) => handleLorryNumberChange(entry.id, e.target.value)}
                    disabled={!!(inspectionData[entry.id]?.lorryNumber && progress?.previousInspections?.some(trip => trip.lorryNumber === inspectionData[entry.id]?.lorryNumber && trip.lorryNumber !== 'LOT_AVG'))}
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
                      backgroundColor: (inspectionData[entry.id]?.lorryNumber && progress?.previousInspections?.some(trip => trip.lorryNumber === inspectionData[entry.id]?.lorryNumber && trip.lorryNumber !== 'LOT_AVG')) ? '#e0e0e0' : '#fff',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Sampling *
                                  </label>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                      <select
                                        value={selectedStage[entry.id] || ''}
                                        onChange={(e) => setSelectedStage(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                        disabled={isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber)}
                                        style={{
                                          flex: 1,
                                          padding: '8px',
                                          fontSize: '12px',
                                          border: '1px solid #ccc',
                                          borderRadius: '4px',
                                          backgroundColor: isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) ? '#e0e0e0' : '#fff'
                                        }}
                                      >
                                        <option value="lot_avg" disabled={isStageLockedForLot(entry.id, 'lot_avg') || isStageLockedForLot(entry.id, 'balanced_lot')}>1. Lot Avg Sampling</option>
                                        <option value="nit_avg" disabled={isStageLockedForLot(entry.id, 'nit_avg')}>2. Nit Avg Sampling</option>
                                        <option value="half_lorry" disabled={isStageLockedForLot(entry.id, 'half_lorry')}>3. Half Lorry Sampling</option>
                                        <option value="full_avg" disabled={(!isStageApprovedForLot(entry.id, 'half_lorry') && !isStageApprovedForLot(entry.id, 'nit_avg')) || isStageLockedForLot(entry.id, 'full_avg')}>4. Full Avg Lorry Sampling</option>
                                        <option value="balanced_lot" disabled={isBalancedLotDisabled(entry.id)}>5. Balanced Lot Sampling</option>
                                      </select>
                                    <button
                                      onClick={() => handleAddStage(entry.id)}
                                      type="button"
                                      disabled={isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber)}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) ? '#ccc' : '#e74c3c',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: '700',
                                        cursor: isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) ? 'not-allowed' : 'pointer',
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

                            {/* Centered Modal Overlay for Active Sampling Cards */}
                            {activeCards[entry.id] && activeCards[entry.id].length > 0 && (
                              <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10000,
                                padding: '20px'
                              }}>
                                <div style={{
                                  position: 'relative',
                                  display: 'flex',
                                  gap: '20px',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  maxHeight: '90vh',
                                  overflowY: 'auto',
                                  padding: '10px'
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
                                      if (stage === 'lot_avg') return { title: 'Lot Avg Sampling', color: '#e67e22', border: '2px solid #e67e22' };
                                      if (stage === 'balanced_lot') return { title: 'Balanced Lot Sampling', color: '#e67e22', border: '2px solid #e67e22' };
                                      if (stage === 'half_lorry') return { title: 'Half Lorry Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
                                      if (stage.startsWith('nit_avg')) return { title: 'Nit Avg Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
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
                                          fontSize: '18px',
                                          fontWeight: '700',
                                          color: cardStyle.color,
                                          borderBottom: `2px solid ${cardStyle.color}1a`,
                                          paddingBottom: '8px',
                                          marginBottom: '12px',
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          textAlign: 'center'
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
                                          {stage.startsWith('nit_avg') && (
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                              <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>
                                                  Nit Number *
                                                </label>
                                                <input
                                                  type="text"
                                                  disabled={isLocked}
                                                  value={cardData.nit || ''}
                                                  onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                    if (val.length <= 2) {
                                                      handleStageInputChange(entry.id, stage, 'nit', val);
                                                    }
                                                  }}
                                                  maxLength={2}
                                                  placeholder="ENTER NIT"
                                                  style={{
                                                    width: '100%',
                                                    padding: '5px',
                                                    fontSize: '11px',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    backgroundColor: isLocked ? '#f5f5f5' : '#fff'
                                                  }}
                                                />
                                              </div>
                                              <div style={{ flex: 1 }}></div>
                                              <div style={{ flex: 1 }}></div>
                                            </div>
                                          )}

                                          {stage === 'full_avg' && (
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                              <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>
                                                  Loaded Bags *
                                                </label>
                                                <input
                                                  type="number"
                                                  disabled={isLocked}
                                                  value={cardData.actualBags || ''}
                                                  onChange={(e) => handleStageInputChange(entry.id, stage, 'actualBags', e.target.value)}
                                                  placeholder={`Max: ${progress?.remainingBags || entry.bags}`}
                                                  style={{
                                                    width: '100%',
                                                    padding: '5px',
                                                    fontSize: '11px',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    backgroundColor: isLocked ? '#f5f5f5' : '#fff'
                                                  }}
                                                />
                                              </div>
                                              <div style={{ flex: 1 }}></div>
                                              <div style={{ flex: 1 }}></div>
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
                                            <div style={{ flex: 1 }}>
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
                                            <div style={{ flex: 1 }}></div>
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

                                          {isLocked && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                              <button
                                                onClick={() => {
                                                  setActiveCards(prev => ({
                                                    ...prev,
                                                    [entry.id]: (prev[entry.id] || []).filter(k => k !== stage)
                                                  }));
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '8px',
                                                  backgroundColor: '#94a3b8',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  fontWeight: '700',
                                                  cursor: 'pointer',
                                                  fontSize: '11px'
                                                }}
                                              >
                                                Close Form
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
                    <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{tripHeaderLabel} | Bags Loaded: {stages.full_avg?.actualBags || inspection.bags || '-'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {(() => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const isToday = inspection.inspectionDate && inspection.inspectionDate.split('T')[0] === todayStr;
                          const stages = inspection.samplingStages || {};
                          const hasFullAvg = !!stages.full_avg;
                          const hasBalanced = !!stages.balanced_lot;

                          if (isToday && hasFullAvg && !hasBalanced && selectedLorryForComparison.entryId) {
                            return (
                              <button
                                onClick={() => {
                                  setSelectedLorryForComparison(null);
                                  handleResumeLorry(selectedLorryForComparison.entryId, inspection.lorryNumber, inspection.samplingStages || {}, inspection.inspectionDate, true);
                                }}
                                style={{
                                  backgroundColor: '#ffffff',
                                  color: '#f26202',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 10px',
                                  fontWeight: 'bold',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                ⚖️ Add Balanced Lot
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <span>Reported By: {inspection.reportedBy?.username || 'System'} | Date: {new Date(inspection.inspectionDate).toLocaleDateString()}</span>
                      </div>
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
                          {Object.keys(stages)
                             .filter(k => k.startsWith('nit_avg'))
                             .sort((a, b) => {
                               if (a === 'nit_avg') return -1;
                               if (b === 'nit_avg') return 1;
                               const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                               const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                               return numA - numB;
                             })
                             .map((key, index) => {
                               const stageObj = stages[key];
                               if (stageObj && stageObj.reportedBy) {
                                 return renderRow(
                                   index === 0 ? 'Nit Avg' : `Nit Avg ${index + 1}`,
                                   '#6b21a8',
                                   '#faf5ff',
                                   stageObj,
                                   false
                                 );
                               }
                               return null;
                             })
                           }
                          {half && half.reportedBy && renderRow('Half Lorry', '#b45309', '#fffdfa', half, false)}
                          {full && full.reportedBy && renderRow('Full Avg Lorry', '#15803d', '#fffaf0', full, true)}
                          {stages.balanced_lot && stages.balanced_lot.reportedBy && renderRow('Balanced Lot', '#d05d00', '#fffaf5', stages.balanced_lot, false)}
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
      {/* Lorry Loading Details Modal */}
      {selectedEntry && (!activeCards[selectedEntry] || activeCards[selectedEntry].length === 0) && (() => {
        const entry = entries.find(e => e.id === selectedEntry);
        if (!entry) return null;
        const progress = inspectionProgress[entry.id];
        
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '650px',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#27ae60',
                color: 'white',
                padding: '14px 18px',
                fontWeight: '700',
                fontSize: '16px',
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>🚛 Lorry Loading Details</span>
                <button
                  onClick={() => setSelectedEntry(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '4px' }}>
                  <strong>Party:</strong> {entry.partyName && entry.partyName.trim() && entry.partyName.toUpperCase() !== 'DIRECT LOADED VEHICLE' ? toTitleCase(entry.partyName) : (entry.lorryNumber ? entry.lorryNumber.toUpperCase() : 'DIRECT LOADED VEHICLE')}<br />
                  <strong>Variety:</strong> {entry.variety} | <strong>Allotted:</strong> {progress?.totalBags || entry.bags} Bags
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                    Loaded Date *
                  </label>
                  <input
                    type="date"
                    value={inspectionData[entry.id]?.inspectionDate || ''}
                    onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                    disabled={user?.role !== 'admin' && user?.role !== 'manager' && !isLocationStaffUser && !isLegacyPhysicalSupervisor}
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
                    Lorry number
                  </label>
                  <input
                    type="text"
                    value={inspectionData[entry.id]?.lorryNumber || ''}
                    onChange={(e) => handleLorryNumberChange(entry.id, e.target.value)}
                    disabled={!!(inspectionData[entry.id]?.lorryNumber && progress?.previousInspections?.some(trip => trip.lorryNumber === inspectionData[entry.id]?.lorryNumber && trip.lorryNumber !== 'LOT_AVG'))}
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
                      backgroundColor: (inspectionData[entry.id]?.lorryNumber && progress?.previousInspections?.some(trip => trip.lorryNumber === inspectionData[entry.id]?.lorryNumber && trip.lorryNumber !== 'LOT_AVG')) ? '#e0e0e0' : '#fff',
                      textTransform: 'uppercase'
                    }}
                  />
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
                      <option value="lot_avg" disabled={isStageLockedForLot(entry.id, 'lot_avg') || isStageLockedForLot(entry.id, 'balanced_lot')}>1. Lot Avg Sampling</option>
                      <option value="nit_avg" disabled={isStageLockedForLot(entry.id, 'nit_avg')}>2. Nit Avg Sampling</option>
                      <option value="half_lorry" disabled={isStageLockedForLot(entry.id, 'half_lorry')}>3. Half Lorry Sampling</option>
                      <option value="full_avg" disabled={(!isStageApprovedForLot(entry.id, 'half_lorry') && !isStageApprovedForLot(entry.id, 'nit_avg')) || isStageLockedForLot(entry.id, 'full_avg')}>4. Full Avg Lorry Sampling</option>
                      <option value="balanced_lot" disabled={isBalancedLotDisabled(entry.id)}>5. Balanced Lot Sampling</option>
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
                    onClick={() => setSelectedEntry(null)}
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
          </div>
        );
      })()}

      {/* Centered Modal Overlay for Active Sampling Cards */}
      {selectedEntry && activeCards[selectedEntry] && activeCards[selectedEntry].length > 0 && (() => {
        const entry = entries.find(e => e.id === selectedEntry);
        if (!entry) return null;
        const progress = inspectionProgress[entry.id];
        const activeCardsList = activeCards[entry.id] || [];
        
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              gap: '20px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '10px'
            }}>
              {activeCardsList.map((stage) => {
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
                  if (stage === 'lot_avg') return { title: 'Lot Avg Sampling', color: '#e67e22', border: '2px solid #e67e22' };
                  if (stage === 'balanced_lot') return { title: 'Balanced Lot Sampling', color: '#e67e22', border: '2px solid #e67e22' };
                  if (stage === 'half_lorry') return { title: 'Half Lorry Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
                  if (stage.startsWith('nit_avg')) return { title: 'Nit Avg Sampling', color: '#8e44ad', border: '2px solid #8e44ad' };
                  return { title: 'Full Avg Lorry Sampling', color: '#2980b9', border: '2px solid #2980b9' };
                };

                const cardStyle = getCardHeader();

                return (
                  <div key={stage} style={{
                    width: '90%',
                    maxWidth: '850px',
                    backgroundColor: '#ffffff',
                    padding: '28px 36px',
                    borderRadius: '12px',
                    border: cardStyle.border,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    opacity: isLocked ? 0.85 : 1
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: cardStyle.color,
                      borderBottom: `2px solid ${cardStyle.color}1a`,
                      paddingBottom: '10px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'center'
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
                            }}>Pending Approval</span>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '13px' }}>
                      {stage.startsWith('nit_avg') && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>
                              Nit Number *
                            </label>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={cardData.nit || ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                if (val.length <= 2) {
                                  handleStageInputChange(entry.id, stage, 'nit', val);
                                }
                              }}
                              maxLength={2}
                              placeholder="ENTER NIT"
                              style={{
                                width: '100%',
                                padding: '5px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: isLocked ? '#f5f5f5' : '#fff'
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}></div>
                          <div style={{ flex: 1 }}></div>
                        </div>
                      )}

                      {stage === 'full_avg' && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>
                              Loaded Bags *
                            </label>
                            <input
                              type="number"
                              disabled={isLocked}
                              value={cardData.actualBags || ''}
                              onChange={(e) => handleStageInputChange(entry.id, stage, 'actualBags', e.target.value)}
                              placeholder={`Max: ${progress?.remainingBags || entry.bags}`}
                              style={{
                                width: '100%',
                                padding: '5px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: isLocked ? '#f5f5f5' : '#fff'
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}></div>
                          <div style={{ flex: 1 }}></div>
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
                        <div style={{ flex: 1 }}>
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
                        <div style={{ flex: 1 }}></div>
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
                              fontSize: '12px'
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
                              setSelectedEntry(null);
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#95a5a6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {isLocked && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={() => {
                              setActiveCards(prev => ({
                                ...prev,
                                [entry.id]: (prev[entry.id] || []).filter(k => k !== stage)
                              }));
                              setSelectedEntry(null);
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              backgroundColor: '#94a3b8',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Close Form
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {detailModalEntry && (
        <SampleEntryDetailModal
          detailEntry={detailModalEntry}
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
    </div>
  );
};

export default PhysicalInspection;
