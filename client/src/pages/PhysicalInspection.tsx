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
  samplingRulesMode?: string;
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
  const [isSaving, setIsSaving] = useState<{ [entryId: string]: boolean }>({});
  const [activeSkipConfirm, setActiveSkipConfirm] = useState<{ [inspectionId: string]: boolean }>({});



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
      tripId?: string;
      inspectionDate: string;
      lorryNumber: string;
      remarks: string;
      samplingRulesMode?: string;
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
        paddyColorEnabled: string;
        paddyColor: string;
        kadiga: string;
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
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
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

            const getInspectionSortTime = (insp: any) => {
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

            if (mapped.length > 1) {
              const lotAvgIdx = mapped.findIndex(i => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
              if (lotAvgIdx !== -1) {
                const realLorries = mapped
                  .filter(i => {
                    const lorry = (i.lorryNumber || '').trim().toUpperCase();
                    return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
                  })
                  .sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
                const realLorryInsp = realLorries[0];
                if (realLorryInsp) {
                  const lotAvgInsp = mapped[lotAvgIdx];
                  const lotAvgHappenedBeforeFirstLoad = getInspectionSortTime(lotAvgInsp) <= getInspectionSortTime(realLorryInsp);
                  if (lotAvgHappenedBeforeFirstLoad && lotAvgInsp.samplingStages && lotAvgInsp.samplingStages.lot_avg) {
                    if (!realLorryInsp.samplingStages) realLorryInsp.samplingStages = {};
                    if (!realLorryInsp.samplingStages.lot_avg) {
                      realLorryInsp.samplingStages.lot_avg = lotAvgInsp.samplingStages.lot_avg;
                    }
                    mapped = mapped.filter((_, idx) => idx !== lotAvgIdx);
                  }
                }
              }
            }

            // Sort progressive trips chronologically: first load first
            mapped.sort((a, b) => {
              return getInspectionSortTime(a) - getInspectionSortTime(b);
            });

            return mapped;
          })(),
          samplingRulesMode: entry.lotAllotment?.samplingRulesMode
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
      // Check if date has changed (not today) - disabled restriction to allow resuming/editing past trips

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
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
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
      
      const isNewCrop = getRulesMode(entryId) === 'new';
      let nextStage = 'lot_avg';
      if (!isLotAvgRequiredForLorry(entryId, cleanLorry)) {
        nextStage = isNewCrop ? 'half_lorry' : 'nit_avg';
      }
      
      if (isNewCrop) {
        if (hasHoldOnPreviousDay(stages)) {
          nextStage = 'lot_avg';
        } else if ((isStageApprovedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry)) && !stages.half_lorry) {
          nextStage = 'half_lorry';
        } else if (stages.half_lorry && !stages.full_avg) {
          nextStage = 'full_avg';
        } else if (stages.full_avg && !stages.balanced_lot) {
          nextStage = 'balanced_lot';
        }
      } else {
        const isLotAvgApproved = isStageApprovedForLot(entryId, 'lot_avg');
        if (isLotAvgApproved) nextStage = 'nit_avg';
        if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && isLotAvgApproved)) nextStage = 'half_lorry';
        if (halfStage.approvalStatus === 'approved') nextStage = 'full_avg';
        if (fullStage.approvalStatus === 'approved') nextStage = 'balanced_lot';
      }

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

  const validateStageBeforeSave = (stage: string, stageVal: any, entryId: string) => {
    const isNewMode = getRulesMode(entryId) === 'new';

    if (isNewMode) {
      if (stageVal.moisture === undefined || stageVal.moisture === null || String(stageVal.moisture).trim() === '') {
        return 'Moisture is required';
      }
      if (stageVal.dryMoisture === 'Y' && !String(stageVal.dryMoistureValue || '').trim()) {
        return 'Dry Moisture value is required';
      }
      if (stageVal.smellHas === undefined || stageVal.smellHas === null || String(stageVal.smellHas).trim() === '') {
        return 'Smell Yes/No is required';
      }
      if (stageVal.smellHas === 'Yes' && !String(stageVal.smellType || '').trim()) {
        return 'Smell type is required';
      }
      if (!String(stageVal.paddyColor || '').trim()) {
        return 'Paddy discolor is required';
      }
      const kadiga = stageVal.kadiga;
      if (!kadiga || !['Y', 'N', 'Yes', 'No'].includes(kadiga)) {
        return 'ಕಡಿಗಾ Yes/No is required';
      }
      if (stage.startsWith('nit_avg') && !String(stageVal.nit || '').trim()) {
        return 'Nit is required for Nit Avg Sampling';
      }
      if (stage === 'full_avg' && (!stageVal.actualBags || Number(stageVal.actualBags) <= 0)) {
        return 'Loaded Bags is required for Full Avg Lorry';
      }
      return null;
    }

    const requiredFields = [
      ['moisture', 'Moisture'],
      ['cutting', 'Cutting'],
      ['bend', 'Bend'],
      ['grainsCount', 'Grains'],
      ['mix', 'Mix'],
      ['kandu', 'Kandu'],
      ['oil', 'Oil'],
      ['sk', 'SK'],
      ['smellHas', 'Smell Yes/No'],
      ['paddyWbEnabled', 'Paddy WB Yes/No']
    ];

    for (const [field, label] of requiredFields) {
      if (stageVal[field] === undefined || stageVal[field] === null || String(stageVal[field]).trim() === '') {
        return `${label} is required`;
      }
    }

    if (stageVal.dryMoisture === 'Y' && !String(stageVal.dryMoistureValue || '').trim()) {
      return 'Dry Moisture value is required';
    }
    if (stageVal.smixEnabled === 'Y' && !String(stageVal.mixS || '').trim()) {
      return 'S Mix value is required';
    }
    if (stageVal.lmixEnabled === 'Y' && !String(stageVal.mixL || '').trim()) {
      return 'L Mix value is required';
    }
    if (stageVal.smellHas === 'Yes' && !String(stageVal.smellType || '').trim()) {
      return 'Smell type is required';
    }
    if (stageVal.paddyWbEnabled === 'Y' && !String(stageVal.paddyWb || '').trim()) {
      return 'Paddy WB value is required';
    }
    if (!String(stageVal.paddyColor || '').trim()) {
      return 'Paddy discolor is required';
    }
    const kadiga = stageVal.kadiga;
    if (!kadiga || !['Y', 'N', 'Yes', 'No'].includes(kadiga)) {
      return 'ಕಡಿಗಾ Yes/No is required';
    }
    if (stage.startsWith('nit_avg') && !String(stageVal.nit || '').trim()) {
      return 'Nit is required for Nit Avg Sampling';
    }
    if (stage === 'full_avg' && (!stageVal.actualBags || Number(stageVal.actualBags) <= 0)) {
      return 'Loaded Bags is required for Full Avg Lorry';
    }
    return null;
  };

  const isStageApprovedForLot = (entryId: string, stageKey: string) => {
    if (samplingStageData[entryId]?.[stageKey]?.isLocked && samplingStageData[entryId]?.[stageKey]?.approvalStatus === 'approved') {
      return true;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    
    if (cleanLorry) {
      // Check if approved with current lorry number
      const approvedWithCurrent = prevInsps.some(insp => {
        const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
        const stages = insp.samplingStages || {};
        if (stageKey === 'nit_avg') {
          return lorryMatch && Object.keys(stages).some(key => key === 'nit_avg' || key.startsWith('nit_avg_') ? stages[key]?.approvalStatus === 'approved' : false);
        }
        return lorryMatch && stages?.[stageKey]?.approvalStatus === 'approved';
      });
      if (approvedWithCurrent) return true;
    }

    if (getRulesMode(entryId) === 'new') {
      if (stageKey === 'lot_avg') {
        const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
        const todayStr = new Date().toLocaleDateString('en-GB');
        return prevInsps.some(insp => {
          const lorry = (insp.lorryNumber || '').trim().toUpperCase();
          const isDummy = lorry === 'LOT_AVG' || !lorry;
          const isMatch = isDummy || lorry === cleanLorry;
          const isApproved = insp.samplingStages?.lot_avg?.approvalStatus === 'approved';
          
          const inspDateStr = insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('en-GB') : '';
          const isToday = inspDateStr === todayStr;
          
          return isMatch && isApproved && isToday;
        });
      }
    }

    // Fallback for lot_avg on any real lorry load (first or subsequent)
    if (stageKey === 'lot_avg' && cleanLorry !== 'LOT_AVG' && cleanLorry !== 'BALANCED_LOT') {
      const lotAvgInsps = prevInsps.filter(insp => (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
      if (lotAvgInsps.length > 0) {
        const priorRealLorries = prevInsps.filter(insp => {
          const l = (insp.lorryNumber || '').trim().toUpperCase();
          return l !== cleanLorry && l !== 'LOT_AVG' && l !== 'BALANCED_LOT';
        });

        if (priorRealLorries.length === 0) {
          // No prior real lorries, so check if any LOT_AVG is approved
          return lotAvgInsps.some(insp => insp.samplingStages?.lot_avg?.approvalStatus === 'approved');
        } else {
          // We have prior real lorries. Find the sorting times
          const getInspectionSortTime = (insp: any) => {
            const stages = insp.samplingStages || {};
            let earliest = null;
            for (const key in stages) {
              const stageValue = stages[key];
              if (stageValue && stageValue.reportedAt) {
                const t = new Date(stageValue.reportedAt).getTime();
                if (!earliest || t < earliest) {
                  earliest = t;
                }
              }
            }
            return earliest || (insp.createdAt ? new Date(insp.createdAt).getTime() : null) || (insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null) || (Number(insp.id) * 1000) || 9999999999999;
          };

          const sortedLorries = [...priorRealLorries].sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
          const lastRealLorry = sortedLorries[sortedLorries.length - 1];
          const lastRealLorryTime = getInspectionSortTime(lastRealLorry);

          // Check if there is a LOT_AVG saved AFTER the last real lorry load that is approved
          return lotAvgInsps.some(insp => {
            const lotAvgTime = getInspectionSortTime(insp);
            return lotAvgTime >= lastRealLorryTime && insp.samplingStages?.lot_avg?.approvalStatus === 'approved';
          });
        }
      }
    }

    return false;
  };

  const getEntryById = (entryId: string) => entries.find(entry => entry.id === entryId);

  const isLocationSampleEntry = (entryId: string) => getEntryById(entryId)?.entryType === 'LOCATION_SAMPLE';

  const isCurrentTripFullAvgApproved = (entryId: string) => {
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (!cleanLorry) return false;
    const localFull = samplingStageData[entryId]?.full_avg;
    if (localFull?.approvalStatus === 'approved') return true;
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry === cleanLorry && insp.samplingStages?.full_avg?.approvalStatus === 'approved';
    });
  };

  const getCurrentTripStages = (entryId: string) => {
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const trip = prevInsps.find(insp => (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry);
    return {
      ...(trip?.samplingStages || {}),
      ...(samplingStageData[entryId] || {})
    };
  };

  const isFirstRealLorryTrip = (entryId: string, cleanLorry: string) => {
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const priorRealLorries = prevInsps.filter(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry !== cleanLorry && lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
    });
    return priorRealLorries.length === 0;
  };

  const isStageApprovedForFirstTripLotAvg = (entryId: string) => {
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const hasPriorRealLorry = prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
    });
    if (hasPriorRealLorry) return false;
    return prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry === 'LOT_AVG' && insp.samplingStages?.lot_avg?.approvalStatus === 'approved';
    });
  };

  const hasCurrentTripNitOrHalf = (entryId: string) => {
    const stages = getCurrentTripStages(entryId);
    return !!stages.half_lorry || Object.keys(stages).some(key => key === 'nit_avg' || key.startsWith('nit_avg_'));
  };

  const isStagePendingForLot = (entryId: string, stageKey: string) => {
    if (samplingStageData[entryId]?.[stageKey] && samplingStageData[entryId]?.[stageKey]?.approvalStatus === 'pending') {
      return true;
    }
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const stages = insp.samplingStages || {};
      if (stageKey === 'nit_avg') {
        return Object.keys(stages).some(key => (key === 'nit_avg' || key.startsWith('nit_avg_')) && stages[key]?.approvalStatus === 'pending');
      }
      return stages[stageKey]?.approvalStatus === 'pending';
    });
  };

  const isStageSubmittedForLot = (entryId: string, stageKey: string) => {
    if (samplingStageData[entryId]?.[stageKey]) {
      return true;
    }
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const stages = insp.samplingStages || {};
      return !!stages[stageKey];
    });
  };

  const isStageVisibleForEntry = (entryId: string, stageKey: string) => {
    const isNewCrop = getRulesMode(entryId) === 'new';
    if (isNewCrop && stageKey === 'nit_avg') {
      return false;
    }

    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (isCurrentTripFullAvgApproved(entryId) && ['lot_avg', 'nit_avg', 'half_lorry'].includes(stageKey)) {
      return false;
    }
    if (stageKey !== 'lot_avg') {
      return true;
    }
    if (isNewCrop) {
      // Always show lot_avg in New Crop before half_lorry or full_avg is submitted
      if (isStageLockedForLot(entryId, 'half_lorry') || isStageLockedForLot(entryId, 'full_avg')) {
        return false;
      }
      return true;
    }
    if (!cleanLorry) {
      return true;
    }
    const lotAvgRequired = isLotAvgRequiredForLorry(entryId, cleanLorry);
    if (!lotAvgRequired) {
      return false;
    }
    if (isLocationSampleEntry(entryId) && isFirstRealLorryTrip(entryId, cleanLorry)) {
      const hasLotAvg = isStageLockedForLot(entryId, 'lot_avg') || isStageApprovedForLot(entryId, 'lot_avg');
      if (!hasLotAvg && hasCurrentTripNitOrHalf(entryId)) {
        return false;
      }
    }
    return true;
  };

  const isStageDisabledForEntry = (entryId: string, stageKey: string) => {
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (isCurrentTripFullAvgApproved(entryId) && ['lot_avg', 'nit_avg', 'half_lorry', 'full_avg'].includes(stageKey)) {
      return true;
    }

    const isNewCrop = getRulesMode(entryId) === 'new';
    if (isNewCrop) {
      if (stageKey === 'nit_avg') return true;

      const stagesObj = getLorryStages(entryId, cleanLorry);
      if (hasHoldOnPreviousDay(stagesObj)) {
        if (stageKey === 'lot_avg') {
          return false;
        }
        return true;
      }

      // Pending Lot Avg or Balanced Lot blocks everything else
      if (stageKey !== 'lot_avg' && isStagePendingForLot(entryId, 'lot_avg')) {
        return true;
      }
      if (stageKey !== 'balanced_lot' && isStagePendingForLot(entryId, 'balanced_lot')) {
        return true;
      }

      if (stageKey === 'lot_avg') {
        if (isStageLockedForLot(entryId, 'half_lorry') || isStageLockedForLot(entryId, 'full_avg')) {
          return true;
        }
        return isStageLockedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry);
      }
      if (stageKey === 'half_lorry') {
        if (isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg')) {
          return true;
        }
        return isStageLockedForLot(entryId, 'half_lorry');
      }
      if (stageKey === 'full_avg') {
        if (isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg')) {
          return true;
        }
        return isStageLockedForLot(entryId, 'full_avg');
      }
      if (stageKey === 'balanced_lot') {
        return isBalancedLotDisabled(entryId);
      }
      return false;
    }

    if (stageKey === 'lot_avg') {
      return isStageLockedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry);
    }
    if (stageKey === 'nit_avg') {
      if (isLocationSampleEntry(entryId) && isFirstRealLorryTrip(entryId, cleanLorry)) {
        return false;
      }
      if (!cleanLorry && isStageApprovedForFirstTripLotAvg(entryId)) {
        return false;
      }
      return isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg');
    }
    if (stageKey === 'half_lorry') {
      if (isStageLockedForLot(entryId, 'half_lorry')) {
        return true;
      }
      if (isLocationSampleEntry(entryId) && isFirstRealLorryTrip(entryId, cleanLorry)) {
        return false;
      }
      if (!cleanLorry && isStageApprovedForFirstTripLotAvg(entryId)) {
        return false;
      }
      return isLotAvgRequiredForLorry(entryId, cleanLorry) && !isStageApprovedForLot(entryId, 'lot_avg');
    }
    if (stageKey === 'full_avg') {
      return (!isStageApprovedForLot(entryId, 'half_lorry') && !isStageApprovedForLot(entryId, 'nit_avg')) || isStageLockedForLot(entryId, 'full_avg');
    }
    if (stageKey === 'balanced_lot') {
      return isBalancedLotDisabled(entryId);
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
    const isNewCrop = getRulesMode(entryId) === 'new';
    if (isNewCrop) {
      return false;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (cleanLorry) {
      const progress = inspectionProgress[entryId];
      const currentTrip = progress?.previousInspections?.find(
        (i: any) => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
      );
      if (currentTrip && currentTrip.samplingStages?.full_avg?.reportedAt) {
        const fullAvgDate = new Date(currentTrip.samplingStages.full_avg.reportedAt);
        const today = new Date();
        const fullAvgDay = new Date(fullAvgDate.getFullYear(), fullAvgDate.getMonth(), fullAvgDate.getDate());
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (todayDay > fullAvgDay) {
          return true;
        }
      }
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
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (stageKey === 'lot_avg') {
      const isNewCrop = getRulesMode(entryId) === 'new';
      if (isNewCrop) {
        if (cleanLorry) {
          return prevInsps.some(insp => {
            const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
            return lorryMatch && !!insp.samplingStages?.lot_avg;
          });
        }
        return prevInsps.some(insp => {
          const lorry = (insp.lorryNumber || '').trim().toUpperCase();
          return lorry === 'LOT_AVG' && !!insp.samplingStages?.lot_avg;
        });
      }
      const lotAvgInsps = prevInsps.filter(insp => (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
      if (lotAvgInsps.length > 0) {
        const priorRealLorries = prevInsps.filter(insp => {
          const l = (insp.lorryNumber || '').trim().toUpperCase();
          return l !== cleanLorry && l !== 'LOT_AVG' && l !== 'BALANCED_LOT';
        });

        const getInspectionSortTime = (insp: any) => {
          const stages = insp.samplingStages || {};
          let earliest = null;
          for (const key in stages) {
            const stageValue = stages[key];
            if (stageValue && stageValue.reportedAt) {
              const t = new Date(stageValue.reportedAt).getTime();
              if (!earliest || t < earliest) {
                earliest = t;
              }
            }
          }
          return earliest || (insp.createdAt ? new Date(insp.createdAt).getTime() : null) || (insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null) || (Number(insp.id) * 1000) || 9999999999999;
        };

        let hasActiveLotAvg = false;
        if (priorRealLorries.length === 0) {
          hasActiveLotAvg = lotAvgInsps.some(insp => !!insp.samplingStages?.lot_avg);
        } else {
          const sortedLorries = [...priorRealLorries].sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
          const lastRealLorry = sortedLorries[sortedLorries.length - 1];
          const lastRealLorryTime = getInspectionSortTime(lastRealLorry);
          hasActiveLotAvg = lotAvgInsps.some(insp => {
            const lotAvgTime = getInspectionSortTime(insp);
            return lotAvgTime >= lastRealLorryTime && !!insp.samplingStages?.lot_avg;
          });
        }
        if (hasActiveLotAvg) return true;
      }

      if (isLotAvgRequiredForLorry(entryId, cleanLorry)) {
        if (cleanLorry) {
          const lockedWithCurrentLorry = prevInsps.some(insp => {
            const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
            return lorryMatch && insp.samplingStages?.[stageKey];
          });
          if (lockedWithCurrentLorry) return true;
        }
        return false;
      }

      const lockedWithCurrentLorry = prevInsps.some(insp => {
        const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
        return lorryMatch && insp.samplingStages?.[stageKey];
      });
      if (lockedWithCurrentLorry) return true;

      if (cleanLorry !== 'LOT_AVG' && cleanLorry !== 'BALANCED_LOT') {
        const priorRealLorries = prevInsps.filter(insp => {
          const l = (insp.lorryNumber || '').trim().toUpperCase();
          return l !== cleanLorry && l !== 'LOT_AVG' && l !== 'BALANCED_LOT';
        });

        if (priorRealLorries.length === 0) {
          return prevInsps.some(insp => {
            const l = (insp.lorryNumber || '').trim().toUpperCase();
            return l === 'LOT_AVG' && !!insp.samplingStages?.lot_avg;
          });
        }
      }

      return false;
    }
    if (!cleanLorry) return false;
    if (stageKey === 'balanced_lot') {
      return prevInsps.some(insp => {
        const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
        return lorryMatch && insp.samplingStages?.[stageKey];
      });
    }
    if (stageKey === 'nit_avg') {
      return false;
    }
    return prevInsps.some(insp => {
      const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
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

  const isTripMissingBalancedLotRestrictive = (trip: any, rulesMode: string) => {
    const lorry = (trip.lorryNumber || '').trim().toUpperCase();
    if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
    
    const stages = trip.samplingStages || {};
    const isNewCrop = rulesMode === 'new';
    const hasFullAvg = isNewCrop
      ? !!stages.full_avg
      : (stages.full_avg && stages.full_avg.approvalStatus === 'approved');
      
    const hasBalancedLot = stages.balanced_lot && (stages.balanced_lot.approvalStatus === 'approved' || stages.balanced_lot.approvalStatus === 'pending' || stages.balanced_lot.isSkipped);
    
    if (hasFullAvg && !hasBalancedLot) {
      if (isNewCrop) {
        return true;
      }
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
    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections || progress.previousInspections.length === 0) {
      return true;
    }
    
    if (getRulesMode(entryId) !== 'new') {
      const hasApprovedLotAvg = progress.previousInspections.some(insp => 
        (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG' && insp.samplingStages?.lot_avg?.approvalStatus === 'approved'
      );
      if (hasApprovedLotAvg) {
        return false;
      }
    }
    
    // Filter out inspections for the current lorry and dummy trips
    const priorRealLorries = progress.previousInspections.filter(
      i => {
        const lorry = (i.lorryNumber || '').trim().toUpperCase();
        return lorry !== cleanLorry && lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
      }
    );
    
    if (priorRealLorries.length === 0) {
      return true;
    }

    const getInspectionSortTime = (insp: any) => {
      const stages = insp.samplingStages || {};
      let earliest = null;
      for (const key in stages) {
        const stageValue = stages[key];
        if (stageValue && stageValue.reportedAt) {
          const t = new Date(stageValue.reportedAt).getTime();
          if (!earliest || t < earliest) {
            earliest = t;
          }
        }
      }
      return earliest || (insp.createdAt ? new Date(insp.createdAt).getTime() : null) || (insp.inspectionDate ? new Date(insp.inspectionDate).getTime() : null) || (Number(insp.id) * 1000) || 9999999999999;
    };

    const sortedLorries = [...priorRealLorries].sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
    const lastLorry = sortedLorries[sortedLorries.length - 1];

    if (getRulesMode(entryId) === 'new') {
      const todayStr = new Date().toLocaleDateString('en-GB');
      if (lastLorry && lastLorry.inspectionDate) {
        const lastLorryDateStr = new Date(lastLorry.inspectionDate).toLocaleDateString('en-GB');
        if (todayStr !== lastLorryDateStr) {
          return true;
        }
      }
      return false;
    }

    const stages = lastLorry?.samplingStages || {};
    const isPreviousBalanced = stages.balanced_lot?.approvalStatus === 'approved';

    return !isPreviousBalanced;
  };

  const isFirstTrip = (entryId: string) => {
    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections || progress.previousInspections.length === 0) {
      return true;
    }
    const priorRealLorries = progress.previousInspections.filter(
      (i: any) => {
        const lorry = (i.lorryNumber || '').trim().toUpperCase();
        return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT';
      }
    );
    return priorRealLorries.length === 0;
  };

  // Returns true if any stage has been saved/submitted, meaning the rules mode is committed and should be locked
  const isRulesModeCommitted = (entryId: string) => {
    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections || progress.previousInspections.length === 0) {
      return false;
    }
    // Check if any inspection trip has at least one stage with reportedBy (meaning it was actually submitted)
    return progress.previousInspections.some((trip: any) => {
      const stages = trip.samplingStages || {};
      return Object.values(stages).some(
        (stg: any) => stg && stg.reportedBy && (stg.approvalStatus === 'pending' || stg.approvalStatus === 'approved')
      );
    });
  };

  const getRulesMode = (entryId: string) => {
    if (isRulesModeCommitted(entryId)) {
      const progress = inspectionProgress[entryId];
      if (progress && progress.samplingRulesMode) {
        return progress.samplingRulesMode;
      }
    }
    return inspectionData[entryId]?.samplingRulesMode || '';
  };

  const getLorryStages = (entryId: string, cleanLorry: string) => {
    const progress = inspectionProgress[entryId];
    const prevLorryInspection = progress?.previousInspections?.find(
      (i: any) => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );
    return prevLorryInspection?.samplingStages || {};
  };

  const hasHoldOnPreviousDay = (stages: any) => {
    if (!stages) return false;
    let latestHoldDate: Date | null = null;
    Object.keys(stages).forEach(key => {
      if (key.includes('_hold_')) {
        const stageObj = stages[key];
        const holdTimeStr = stageObj?.holdAt || stageObj?.reportedAt || stageObj?.createdAt;
        if (holdTimeStr) {
          const holdDate = new Date(holdTimeStr);
          if (!latestHoldDate || holdDate > latestHoldDate) {
            latestHoldDate = holdDate;
          }
        }
      }
    });
    if (!latestHoldDate) return false;
    const today = new Date();
    const isDifferentDay = (today.getFullYear() > latestHoldDate.getFullYear()) ||
                           (today.getFullYear() === latestHoldDate.getFullYear() && today.getMonth() > latestHoldDate.getMonth()) ||
                           (today.getFullYear() === latestHoldDate.getFullYear() && today.getMonth() === latestHoldDate.getMonth() && today.getDate() > latestHoldDate.getDate());
    return isDifferentDay;
  };

  const handleAddStage = (entryId: string) => {
    if (!getRulesMode(entryId)) {
      showNotification('Please select Crop (Old/New Paddy) before opening any sampling stage!', 'error');
      return;
    }

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

    if (!isStageVisibleForEntry(entryId, stage) || isStageDisabledForEntry(entryId, stage)) {
      showNotification('This sampling stage is not available for the current trip', 'error');
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

    if (stage !== 'lot_avg' && !isLocationSampleEntry(entryId) && isLotAvgRequiredForLorry(entryId, currentLorry)) {
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
      // Disabled restrictive date check to allow adding Balanced Lot on different dates
    }
    if (stage === 'lot_avg') {
      if (isStageLockedForLot(entryId, 'balanced_lot')) {
        showNotification('Cannot add Lot Avg stage because Balanced Lot has already been added', 'error');
        return;
      }
    }
    if (stage === 'full_avg') {
      const isNewCrop = getRulesMode(entryId) === 'new';
      if (!isNewCrop) {
        const halfApproved = isStageApprovedForLot(entryId, 'half_lorry');
        const nitApproved = isStageApprovedForLot(entryId, 'nit_avg');
        if (!halfApproved && !nitApproved) {
          showNotification('Cannot add Full Avg stage until Half Lorry or Nit Avg is approved by Manager', 'error');
          return;
        }
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
          smellHas: getRulesMode(entryId) === 'new' ? 'Yes' : 'No',
          smellType: '',
          paddyWbEnabled: 'N',
          paddyWb: '',
          paddyColorEnabled: 'N',
          paddyColor: '',
          kadiga: '',
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
    if (isSaving[entryId]) return;

    const data = inspectionData[entryId];
    const stageVal = samplingStageData[entryId]?.[stage];
    const progress = inspectionProgress[entryId];
    const isLorryOptional = stage === 'lot_avg' || stage === 'balanced_lot';

    const rulesMode = getRulesMode(entryId);
    if (!rulesMode) {
      showNotification('Please select a Crop before saving', 'error');
      return;
    }

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

    const validationError = validateStageBeforeSave(stage, stageVal, entryId);
    if (validationError) {
      showNotification(validationError, 'error');
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

    try {
      setIsSaving(prev => ({ ...prev, [entryId]: true }));
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
      formData.append('paddyColorEnabled', stageVal.paddyColor ? 'true' : 'false');
      formData.append('paddyColor', stageVal.paddyColor || '');
      formData.append('kadiga', stageVal.kadiga || '');
      formData.append('remarks', data.remarks || '');
      formData.append('reportedBy', user?.username || 'System');
      formData.append('samplingRulesMode', getRulesMode(entryId));

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

      // Reset form states if Full Avg Lorry or Balanced Lot is saved (trip is completed)
      const isFinalStage = stage === 'balanced_lot' || stage === 'full_avg';
      if (isFinalStage) {
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
    } finally {
      setIsSaving(prev => ({ ...prev, [entryId]: false }));
    }
  };

  const handleSkipBalancedLot = async (entryId: string, inspectionId: string) => {
    try {
      const progress = inspectionProgress[entryId];
      const trip = progress?.previousInspections?.find(t => t.id === inspectionId);
      const lorryNumber = trip ? trip.lorryNumber : '';

      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('inspectionDate', new Date().toISOString().split('T')[0]);
      formData.append('stage', 'balanced_lot');
      formData.append('isSkipped', 'true');
      formData.append('reportedBy', user?.username || 'System');
      formData.append('samplingRulesMode', 'new');
      if (lorryNumber) {
        formData.append('lorryNumber', lorryNumber);
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

      showNotification('Balanced Lot skipped successfully', 'success');
      setSelectedEntry(null);
      setActiveSkipConfirm(prev => ({ ...prev, [inspectionId]: false })); // Reset confirm state
      await loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to skip Balanced Lot', 'error');
    }
  };

  const initializeInspectionData = (entryId: string) => {
    // Check if there is an incomplete trip to resume
    const progress = inspectionProgress[entryId];
    let incompleteTrip = null;
    let nextStage = 'lot_avg';
    
    const isNewCrop = getRulesMode(entryId) === 'new';
    if (progress && progress.previousInspections && progress.previousInspections.length > 0) {
      incompleteTrip = progress.previousInspections.find(trip => {
        const lorry = (trip.lorryNumber || '').trim().toUpperCase();
        if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
        
        const stages = trip.samplingStages || {};
        const hasApprovedFullAvg = stages.full_avg && stages.full_avg.approvalStatus === 'approved';
        
        // In New Crop, only pending lot_avg or balanced_lot blocks user progress.
        const hasPending = Object.keys(stages).some(k => {
          if (isNewCrop) {
            return ['lot_avg', 'balanced_lot'].includes(k) && stages[k]?.approvalStatus === 'pending';
          }
          return stages[k]?.approvalStatus === 'pending';
        });
        
        const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip, getRulesMode(entryId));
        
        if (isNewCrop) {
          // In New Crop, a trip is incomplete only if it has NOT submitted full_avg, OR it has pending stages.
          // We do NOT resume the trip if it is only missing Balanced Lot (we handle that via the trip list actions instead).
          const hasSubmittedFullAvg = !!stages.full_avg;
          return !hasSubmittedFullAvg || hasPending;
        }
        
        return !hasApprovedFullAvg || hasPending || isMissingBalanced;
      });
      
      if (incompleteTrip) {
        const stages = incompleteTrip.samplingStages || {};
        const lotStage = stages.lot_avg || {};
        const nitStage = stages.nit_avg || {};
        const halfStage = stages.half_lorry || {};
        const fullStage = stages.full_avg || {};
        
        // Filter pendingStageKey for New Crop: ignore pending half_lorry/full_avg
        const pendingStageKey = Object.keys(stages).find(k => {
          if (isNewCrop) {
            return ['lot_avg', 'balanced_lot'].includes(k) && stages[k]?.approvalStatus === 'pending';
          }
          return stages[k]?.approvalStatus === 'pending';
        });
        
        if (pendingStageKey) {
          nextStage = pendingStageKey;
        } else {
          // Determine logical next stage based on what's missing or pending
          if (isNewCrop) {
            if (lotStage.approvalStatus === 'approved' && !stages.half_lorry) {
              nextStage = 'half_lorry';
            } else if (stages.half_lorry && !stages.full_avg) {
              nextStage = 'full_avg';
            } else if (stages.full_avg && !stages.balanced_lot) {
              nextStage = 'balanced_lot';
            }
          } else {
            if (lotStage.approvalStatus === 'approved') nextStage = 'nit_avg';
            if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && lotStage.approvalStatus === 'approved')) nextStage = 'half_lorry';
            if (halfStage.approvalStatus === 'approved') nextStage = 'full_avg';
            if (fullStage.approvalStatus === 'approved') nextStage = 'balanced_lot';
          }
        }
      }
    }

    if (incompleteTrip) {
      setInspectionData(prev => ({
        ...prev,
        [entryId]: {
          tripId: incompleteTrip.id,
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
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
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
      
      // Select logical default next stage
      let defaultStage = 'lot_avg';
      if (!isLotAvgRequiredForLorry(entryId, '')) {
        const isNewCrop = getRulesMode(entryId) === 'new';
        defaultStage = isNewCrop ? 'half_lorry' : 'nit_avg';
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
    
    // If date has changed, allow resuming/editing the trip (date check disabled)
    
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
        paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
        paddyColor: dbStage.paddyColor || '',
        kadiga: dbStage.kadiga || '',
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
        smellHas: getRulesMode(entryId) === 'new' ? 'Yes' : 'No',
        smellType: '',
        paddyWbEnabled: 'N',
        paddyWb: '',
        paddyColorEnabled: 'N',
        paddyColor: '',
        kadiga: '',
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
    
    const isNewCrop = getRulesMode(entryId) === 'new';
    let nextStage = 'lot_avg';
    if (!isLotAvgRequiredForLorry(entryId, cleanLorry)) {
      nextStage = isNewCrop ? 'half_lorry' : 'nit_avg';
    }
    
    if (isNewCrop) {
      if (hasHoldOnPreviousDay(stages)) {
        nextStage = 'lot_avg';
      } else if ((isStageApprovedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry)) && !stages.half_lorry) {
        nextStage = 'half_lorry';
      } else if (stages.half_lorry && !stages.full_avg) {
        nextStage = 'full_avg';
      } else if (stages.full_avg && !stages.balanced_lot) {
        nextStage = 'balanced_lot';
      }
    } else {
      const isLotAvgApproved = isStageApprovedForLot(entryId, 'lot_avg');
      if (isLotAvgApproved) {
        nextStage = 'nit_avg';
      }
      if (nitStage.approvalStatus === 'approved' || (nitStage.reportedBy && isLotAvgApproved)) {
        nextStage = 'half_lorry';
      }
      if (halfStage.approvalStatus === 'approved') {
        nextStage = 'full_avg';
      }
      if (fullStage.approvalStatus === 'approved') {
        nextStage = 'balanced_lot';
      }
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

  const sortedFilteredEntries = [...filteredEntries].sort((a, b) => {
    const timeA = a.lotAllotment?.allottedAt
      ? new Date(a.lotAllotment.allottedAt).getTime()
      : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.lotAllotment?.allottedAt
      ? new Date(b.lotAllotment.allottedAt).getTime()
      : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
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
            ) : sortedFilteredEntries.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No lots allotted for inspection</td></tr>
            ) : (
              sortedFilteredEntries.map((entry, index) => {
                const progress = inspectionProgress[entry.id];
                const progressPercentage = progress?.progressPercentage || 0;

                const hasPendingStage = (() => {
                  if (!progress || !progress.previousInspections) return false;
                  const isNewCrop = getRulesMode(entry.id) === 'new';
                  return progress.previousInspections.some(trip => {
                    const stages = trip.samplingStages || {};
                    return Object.keys(stages).some(key => {
                      const stg = stages[key];
                      if (!stg) return false;
                      if (isNewCrop) {
                        return ['lot_avg', 'balanced_lot'].includes(key) && stg.approvalStatus === 'pending';
                      }
                      return stg.approvalStatus === 'pending';
                    });
                  });
                })();

                // Check if this is a new lot (different from previous)
                const prevEntry = sortedFilteredEntries[index - 1];
                const isNewLot = !prevEntry || prevEntry.id !== entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '3px solid #666' }}>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                        {index + 1}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                        {new Date(entry.entryDate).toLocaleDateString('en-GB')}
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
                        {(() => {
                          const isMissingBalancedAcrossTrips = (() => {
                            const progress = inspectionProgress[entry.id];
                            if (!progress || !progress.previousInspections) return false;
                            return progress.previousInspections.some(trip => 
                              isTripMissingBalancedLotRestrictive(trip, getRulesMode(entry.id))
                            );
                          })();
                          const isDisabled = progressPercentage >= 100 || !!entry.lotAllotment?.closedAt || hasPendingStage || isMissingBalancedAcrossTrips;
                          return (
                            <button
                              onClick={() => initializeInspectionData(entry.id)}
                              disabled={isDisabled}
                              style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                fontWeight: '700',
                                backgroundColor: isDisabled ? '#ccc' : (selectedEntry === entry.id ? '#FF9800' : '#4CAF50'),
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {(() => {
                                if (entry.lotAllotment?.closedAt) return 'Closed';
                                if (progressPercentage >= 100) return 'Complete';
                                if (hasPendingStage) return 'Awaiting Approval';
                                if (isMissingBalancedAcrossTrips) return 'Pending Balanced Lot';
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
                                    const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip, getRulesMode(entry.id));
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
                          );
                        })()}
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
                                  const isNewCrop = getRulesMode(entry.id) === 'new';
                                  
                                  const getTripValues = (insp: any) => {
                                    const stgList = insp?.samplingStages || {};
                                    const stg = stgList.full_avg?.reportedBy
                                      ? stgList.full_avg
                                      : stgList.half_lorry?.reportedBy
                                      ? stgList.half_lorry
                                      : (() => {
                                          const nitKeys = Object.keys(stgList)
                                            .filter(k => k.startsWith('nit_avg') && stgList[k]?.reportedBy)
                                            .sort((a, b) => {
                                              if (a === 'nit_avg') return -1;
                                              if (b === 'nit_avg') return 1;
                                              const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                                              const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                                              return numB - numA;
                                            });
                                          if (nitKeys.length > 0) return stgList[nitKeys[0]];
                                          return stgList.lot_avg?.reportedBy ? stgList.lot_avg : null;
                                        })();
                                    if (!stg) return null;
                                    
                                    const moisture = stg.moistureRaw ? `${stg.moistureRaw}%` : (stg.moisture !== undefined && stg.moisture !== null ? `${stg.moisture}%` : null);
                                    const cutting = stg.cutting1 !== undefined && stg.cutting1 !== null ? `${stg.cutting1}×${stg.cutting2 || 0}` : null;
                                    const bend = stg.bend1 !== undefined && stg.bend1 !== null ? `${stg.bend1}×${stg.bend2 || 0}` : null;
                                    
                                    if (!moisture && !cutting && !bend) return null;
                                    return { moisture, cutting, bend };
                                  };

                                  let moistureVal = '-';
                                  let cuttingVal = '-';
                                  let bendVal = '-';

                                  if (isNewCrop) {
                                    let vals = getTripValues(inspection);
                                    if (!vals) {
                                      for (let i = idx - 1; i >= 0; i--) {
                                        const prevInsp = progress.previousInspections[i];
                                        vals = getTripValues(prevInsp);
                                        if (vals) break;
                                      }
                                    }
                                    if (vals) {
                                      moistureVal = vals.moisture || '-';
                                      cuttingVal = vals.cutting || '-';
                                      bendVal = vals.bend || '-';
                                    }
                                  } else {
                                    const latestStage = stages.balanced_lot?.reportedBy
                                      ? stages.balanced_lot
                                      : stages.full_avg?.reportedBy
                                      ? stages.full_avg
                                      : stages.half_lorry?.reportedBy
                                      ? stages.half_lorry
                                      : (() => {
                                          const nitKeys = Object.keys(stages)
                                            .filter(k => k.startsWith('nit_avg') && stages[k]?.reportedBy)
                                            .sort((a, b) => {
                                              if (a === 'nit_avg') return -1;
                                              if (b === 'nit_avg') return 1;
                                              const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                                              const numB = parseInt(a.replace('nit_avg_', '')) || 0;
                                              return numB - numA;
                                            });
                                          if (nitKeys.length > 0) return stages[nitKeys[0]];
                                          return stages.lot_avg?.reportedBy ? stages.lot_avg : null;
                                        })();
                                    
                                    moistureVal = latestStage ? (latestStage.moistureRaw ? `${latestStage.moistureRaw}%` : (latestStage.moisture !== undefined && latestStage.moisture !== null ? `${latestStage.moisture}%` : '-')) : '-';
                                    cuttingVal = latestStage ? (latestStage.cutting1 !== undefined && latestStage.cutting1 !== null ? `${latestStage.cutting1}×${latestStage.cutting2 || 0}` : '-') : '-';
                                    bendVal = latestStage ? (latestStage.bend1 !== undefined && latestStage.bend1 !== null ? `${latestStage.bend1}×${latestStage.bend2 || 0}` : '-') : '-';
                                  }
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
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600', color: '#000000' }}>{moistureVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{cuttingVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{bendVal}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px' }}>{inspection.reportedBy?.username || '-'}</td>
                                    <td style={{ 
                                      border: '1px solid #000', 
                                      padding: '6px', 
                                      textAlign: 'center', 
                                      fontWeight: '700', 
                                      color: (() => {
                                        if (stages.balanced_lot?.approvalStatus === 'approved') return '#2e7d32'; // Pass
                                        if (stages.balanced_lot?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                        if (stages.full_avg?.approvalStatus === 'approved') return '#2e7d32'; // Pass
                                        if (stages.full_avg?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                        if (stages.half_lorry?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                        if (stages.half_lorry?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                        
                                        // Check all nit keys
                                        const nitKeys = Object.keys(stages)
                                          .filter(k => k.startsWith('nit_avg'))
                                          .sort((a, b) => {
                                            if (a === 'nit_avg') return -1;
                                            if (b === 'nit_avg') return 1;
                                            const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                                            const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                                            return numB - numA;
                                          });
                                        for (const key of nitKeys) {
                                          if (stages[key]?.approvalStatus === 'approved') return '#1565c0';
                                          if (stages[key]?.approvalStatus === 'pending') return '#f39c12';
                                        }

                                        if (stages.lot_avg?.approvalStatus === 'approved') return '#1565c0'; // Approved stage
                                        if (stages.lot_avg?.approvalStatus === 'pending') return '#f39c12'; // Pending
                                        return '#64748b';
                                      })()
                                    }}>
                                      {(() => {
                                        if (stages.balanced_lot?.approvalStatus === 'approved') return 'Pass';
                                        if (stages.balanced_lot?.approvalStatus === 'pending') return 'Pending: Balanced Lot';
                                        if (stages.full_avg?.approvalStatus === 'approved') return 'Pass';
                                        if (stages.full_avg?.approvalStatus === 'pending') return 'Pending: Full Lorry';
                                        if (stages.half_lorry?.approvalStatus === 'approved') return 'Approved: Half Lorry';
                                        if (stages.half_lorry?.approvalStatus === 'pending') return 'Pending: Half Lorry';
                                        
                                        // Check all nit keys
                                        const nitKeys = Object.keys(stages)
                                          .filter(k => k.startsWith('nit_avg'))
                                          .sort((a, b) => {
                                            if (a === 'nit_avg') return -1;
                                            if (b === 'nit_avg') return 1;
                                            const numA = parseInt(a.replace('nit_avg_', '')) || 0;
                                            const numB = parseInt(b.replace('nit_avg_', '')) || 0;
                                            return numA - numB;
                                          });
                                        for (const key of nitKeys) {
                                          if (stages[key]?.approvalStatus === 'approved') {
                                            const idx = nitKeys.indexOf(key);
                                            return idx === 0 ? 'Approved: Nit Avg' : `Approved: Nit Avg ${idx + 1}`;
                                          }
                                          if (stages[key]?.approvalStatus === 'pending') {
                                            const idx = nitKeys.indexOf(key);
                                            return idx === 0 ? 'Pending: Nit Avg' : `Pending: Nit Avg ${idx + 1}`;
                                          }
                                        }

                                        if (stages.lot_avg?.approvalStatus === 'approved') return 'Approved: Lot Avg';
                                        if (stages.lot_avg?.approvalStatus === 'pending') return 'Pending: Lot Avg';
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
                                          const hasPendingStages = Object.keys(stages).some(key => {
                                            const stg = stages[key];
                                            if (!stg) return false;
                                            if (getRulesMode(entry.id) === 'new') {
                                              return ['lot_avg', 'balanced_lot'].includes(key) && stg.approvalStatus === 'pending';
                                            }
                                            return stg.approvalStatus === 'pending';
                                          });
                                          if (hasPendingStages) {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                          }
                                          if (stages.lot_avg?.approvalStatus === 'approved') {
                                            return <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                          }
                                        }

                                        // If balanced lot is pending or approved
                                        if (hasBalanced) {
                                          if (stages.balanced_lot?.isSkipped) {
                                            return <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>;
                                          }
                                          if (stages.balanced_lot.approvalStatus === 'pending') {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Balanced Lot: Pending</span>;
                                          }
                                          return <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                        }

                                        // If full_avg is submitted but balanced is missing
                                        const isNewCrop = getRulesMode(entry.id) === 'new';
                                        
                                        if (hasFull && !hasBalanced) {
                                          if (isNewCrop) {
                                            return (
                                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button
                                                  onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, inspection.samplingStages, inspection.inspectionDate, true)}
                                                  style={{
                                                    backgroundColor: '#e67e22',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '3px',
                                                    padding: '3px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  Add Balanced
                                                </button>
                                                {activeSkipConfirm[inspection.id] ? (
                                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '10px', color: '#c0392b', fontWeight: 'bold' }}>Confirm Skip?</span>
                                                    <button
                                                      onClick={() => handleSkipBalancedLot(entry.id, inspection.id)}
                                                      style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                                    >
                                                      Yes
                                                    </button>
                                                    <button
                                                      onClick={() => setActiveSkipConfirm(prev => ({ ...prev, [inspection.id]: false }))}
                                                      style={{ backgroundColor: '#7f8c8d', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                                    >
                                                      No
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    onClick={() => setActiveSkipConfirm(prev => ({ ...prev, [inspection.id]: true }))}
                                                    style={{
                                                      backgroundColor: '#7f8c8d',
                                                      color: '#ffffff',
                                                      border: 'none',
                                                      borderRadius: '3px',
                                                      padding: '3px 8px',
                                                      fontSize: '11px',
                                                      fontWeight: 'bold',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    Skip Balanced
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          } else {
                                            // For Old Crop: Only allow adding Balanced Lot on the same day (before 12 AM)
                                            const todayStr = new Date().toLocaleDateString('en-CA');
                                            const isToday = inspection.inspectionDate && inspection.inspectionDate.split('T')[0] === todayStr;
                                            if (isToday) {
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
                                          }
                                        }

                                        // Check if incomplete trip to resume
                                        const isTripIncomplete = !hasFull || stages.full_avg.approvalStatus !== 'approved';
                                        if (isTripIncomplete) {
                                          // If it has any pending stages, wait for manager to approve before resuming
                                          const hasPendingStages = Object.keys(stages).some(key => {
                                            const stg = stages[key];
                                            if (!stg) return false;
                                            if (getRulesMode(entry.id) === 'new') {
                                              return ['lot_avg', 'balanced_lot'].includes(key) && stg.approvalStatus === 'pending';
                                            }
                                            return stg.approvalStatus === 'pending';
                                          });
                                          if (hasPendingStages) {
                                            return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                          }
                                          return <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>In Progress</span>;
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
                          {!getRulesMode(entry.id) && (
                            <div style={{
                              backgroundColor: '#fff3cd',
                              color: '#856404',
                              border: '1px solid #ffeeba',
                              padding: '12px 18px',
                              borderRadius: '6px',
                              marginBottom: '15px',
                              fontWeight: '600',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                            }}>
                              ⚠️ <strong>Warning:</strong> Crop (Old/New Paddy) has not been selected yet for this allotment. Please select it in the left panel before submitting any sampling stages.
                            </div>
                          )}
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
                                     Loaded Date (Freezed)
                                   </label>
                                   <input
                                     type="date"
                                     value={inspectionData[entry.id]?.inspectionDate || ''}
                                     onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                                     disabled={true}
                                     style={{
                                       width: '100%',
                                       padding: '8px',
                                       fontSize: '12px',
                                       border: '1px solid #ccc',
                                       borderRadius: '4px',
                                       color: '#666',
                                       backgroundColor: '#f5f5f5',
                                       cursor: 'not-allowed'
                                     }}
                                   />
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
                                     Crop *
                                   </label>
                                   <select
                                     value={getRulesMode(entry.id)}
                                     onChange={(e) => handleInputChange(entry.id, 'samplingRulesMode', e.target.value)}
                                     disabled={!isFirstTrip(entry.id) || isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) || isRulesModeCommitted(entry.id)}
                                     style={{
                                       width: '100%',
                                       padding: '8px',
                                       fontSize: '12px',
                                       border: '1px solid #ccc',
                                       borderRadius: '4px',
                                       color: '#1a1a1a',
                                       backgroundColor: (!isFirstTrip(entry.id) || isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber) || isRulesModeCommitted(entry.id)) ? '#e0e0e0' : '#fff',
                                       fontWeight: '600'
                                     }}
                                   >
                                     <option value="">-- SELECT CROP --</option>
                                     <option value="old">Old Paddy</option>
                                     <option value="new">New Paddy</option>
                                   </select>
                                 </div>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                                    Sampling *
                                  </label>
                                  {(() => {
                                    const stageItems = [
                                      { value: 'lot_avg', label: '1. Lot Avg Sampling', disabled: isStageDisabledForEntry(entry.id, 'lot_avg') },
                                      { value: 'nit_avg', label: '2. Nit Avg Sampling', disabled: isStageDisabledForEntry(entry.id, 'nit_avg') },
                                      { value: 'half_lorry', label: '3. Half Lorry Sampling', disabled: isStageDisabledForEntry(entry.id, 'half_lorry') },
                                      { value: 'full_avg', label: '4. Full Avg Lorry Sampling', disabled: isStageDisabledForEntry(entry.id, 'full_avg') },
                                      { value: 'balanced_lot', label: '5. Balanced Lot Sampling', disabled: isStageDisabledForEntry(entry.id, 'balanced_lot') }
                                    ].filter(item => isStageVisibleForEntry(entry.id, item.value));
                                    const freezed = isLorryFreezed(entry.id, inspectionData[entry.id]?.lorryNumber);
                                    return (
                                      <>
                                        <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                                          {stageItems.map((item) => {
                                            const isDisabled = freezed || item.disabled;
                                            const isSelected = (selectedStage[entry.id] || 'lot_avg') === item.value;
                                            const isLocked = isStageLockedForLot(entry.id, item.value);
                                            const isApproved = isStageApprovedForLot(entry.id, item.value);
                                            const isDone = isLocked || isApproved;
                                            
                                            let statusLabel = '✓ Done';
                                            if (isDisabled && !freezed) {
                                              if (item.value === 'balanced_lot') {
                                                const isLockedStg = isStageLockedForLot(entry.id, 'balanced_lot');
                                                if (!isLockedStg && isAnyFullAvgSavedOrApproved(entry.id)) {
                                                  statusLabel = 'Expired / Not Added';
                                                }
                                              } else if (item.value === 'lot_avg') {
                                                const isLockedStg = isStageLockedForLot(entry.id, 'lot_avg');
                                                if (!isLockedStg && !isLotAvgRequiredForLorry(entry.id, (inspectionData[entry.id]?.lorryNumber || '').trim().toUpperCase())) {
                                                  statusLabel = 'Not Required';
                                                }
                                              }
                                            }
                                            return (
                                              <div
                                                key={item.value}
                                                onClick={() => {
                                                  if (!isDisabled) {
                                                    setSelectedStage(prev => ({ ...prev, [entry.id]: item.value }));
                                                  }
                                                }}
                                                style={{
                                                  padding: '10px 14px',
                                                  fontSize: '13px',
                                                  fontWeight: isSelected ? '700' : '500',
                                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                  backgroundColor: isDisabled ? '#e8e8e8' : isSelected ? '#e8f5e9' : '#fff',
                                                  color: isDisabled ? '#aaa' : isSelected ? '#1b5e20' : '#333',
                                                  borderBottom: '1px solid #eee',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  transition: 'background-color 0.15s',
                                                  opacity: isDisabled ? 0.6 : 1,
                                                  textDecoration: (isDone && !item.value.startsWith('nit_avg')) ? 'line-through' : 'none'
                                                }}
                                              >
                                                <span>{item.label}</span>
                                                {isDisabled && (
                                                  <span style={{ 
                                                    fontSize: '10px', 
                                                    color: statusLabel.startsWith('Expired') ? '#d32f2f' : '#999', 
                                                    fontWeight: '600' 
                                                  }}>
                                                    {statusLabel}
                                                  </span>
                                                )}
                                                {isSelected && !isDisabled && <span style={{ fontSize: '10px', color: '#27ae60', fontWeight: '700' }}>● Selected</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <select
                                            value={selectedStage[entry.id] || ''}
                                            onChange={(e) => setSelectedStage(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                            disabled={freezed}
                                            style={{
                                              flex: 1,
                                              padding: '8px',
                                              fontSize: '12px',
                                              border: '1px solid #ccc',
                                              borderRadius: '4px',
                                              backgroundColor: freezed ? '#e0e0e0' : '#fff'
                                            }}
                                          >
                                            {stageItems.map(item => (
                                              <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>
                                            ))}
                                          </select>
                                          <button
                                            onClick={() => handleAddStage(entry.id)}
                                            type="button"
                                            disabled={freezed}
                                            style={{
                                              padding: '6px 12px',
                                              backgroundColor: freezed ? '#ccc' : '#e74c3c',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontWeight: '700',
                                              cursor: freezed ? 'not-allowed' : 'pointer',
                                              fontSize: '12px'
                                            }}
                                          >
                                            Submit
                                          </button>
                                        </div>
                                      </>
                                    );
                                  })()}
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
                                      smellHas: getRulesMode(entry.id) === 'new' ? 'Yes' : 'No',
                                      smellType: '',
                                      paddyWbEnabled: 'N',
                                      paddyWb: '',
                                      paddyColorEnabled: 'N',
                                      paddyColor: '',
                                      kadiga: '',
                                      actualBags: '',
                                      reportedBy: user?.username || 'System',
                                      isLocked: false
                                    };
                                    const isLocked = !!cardData.isLocked;
                                    const isNewMode = getRulesMode(entry.id) === 'new';
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Grains Count{isNewMode ? '' : ' *'}</label>
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Cutting{isNewMode ? '' : ' *'}</label>
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Bend{isNewMode ? '' : ' *'}</label>
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Mix{isNewMode ? '' : ' *'}</label>
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>SK{isNewMode ? '' : ' *'}</label>
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
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Kandu{isNewMode ? '' : ' *'}</label>
                                              <input
                                                type="text"
                                                disabled={isLocked}
                                                value={cardData.kandu}
                                                onChange={(e) => handleStageInputChange(entry.id, stage, 'kandu', e.target.value)}
                                                style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                              />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Oil{isNewMode ? '' : ' *'}</label>
                                              <input
                                                type="text"
                                                disabled={isLocked}
                                                value={cardData.oil}
                                                onChange={(e) => handleStageInputChange(entry.id, stage, 'oil', e.target.value)}
                                                style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                                              />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Smell *</label>
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

                                          {/* Row 5: Paddy Discolor, Kadiga and Paddy WB */}
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1.2 }}>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy Discolor *</label>
                                              <select
                                                disabled={isLocked}
                                                value={cardData.paddyColor}
                                                onChange={(e) => {
                                                  handleStageInputChange(entry.id, stage, 'paddyColor', e.target.value);
                                                  handleStageInputChange(entry.id, stage, 'paddyColorEnabled', e.target.value ? 'Y' : 'N');
                                                }}
                                                style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px' }}
                                              >
                                                <option value="">Select discolor</option>
                                                <option value="Normal Color">Normal Color</option>
                                                <option value="Light Discolor">Light Discolor</option>
                                                <option value="Medium Discolor">Medium Discolor</option>
                                                <option value="Dark Discolor">Dark Discolor</option>
                                              </select>
                                            </div>
                                            <div style={{ flex: 0.8 }}>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>ಕಡಿಗಾ *</label>
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', marginBottom: '4px' }}>
                                                <label><input type="radio" disabled={isLocked} checked={cardData.kadiga === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'kadiga', 'Y')} /> Yes</label>
                                                <label><input type="radio" disabled={isLocked} checked={cardData.kadiga === 'N'} onChange={() => handleStageInputChange(entry.id, stage, 'kadiga', 'N')} /> No</label>
                                              </div>
                                            </div>
                                            <div style={{ flex: 0.8 }}>
                                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB{isNewMode ? '' : ' *'}</label>
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', marginBottom: '4px' }}>
                                                <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'Y')} /> Y</label>
                                                <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'N'} onChange={() => { handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'N'); handleStageInputChange(entry.id, stage, 'paddyWb', ''); }} /> N</label>
                                              </div>
                                            </div>
                                            <div style={{ flex: 1.2 }}>
                                              {cardData.paddyWbEnabled === 'Y' && (
                                                <>
                                                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB Value{isNewMode ? '' : ' *'}</label>
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
                                                disabled={isSaving[entry.id]}
                                                onClick={() => handleSaveStage(entry.id, stage)}
                                                style={{
                                                  flex: 1,
                                                  padding: '6px',
                                                  backgroundColor: isSaving[entry.id] ? '#95a5a6' : '#27ae60',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  fontWeight: '700',
                                                  cursor: isSaving[entry.id] ? 'not-allowed' : 'pointer',
                                                  fontSize: '11px'
                                                }}
                                              >
                                                {isSaving[entry.id] ? 'Saving...' : 'Save'}
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
            <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                const getNitAvgLabel = (nitValue: string) => {
                  if (!nitValue) return 'Nit Avg';
                  const clean = nitValue.trim().toUpperCase();
                  if (clean.includes('NIT') && (clean.includes('AVG') || clean.includes('AVERAGE'))) {
                    return nitValue;
                  }
                  return `Nit Avg (${nitValue})`;
                };

                const formatReportedBy = (stageObj: any) => {
                  return formatField(stageObj.reportedBy);
                };

                const formatPaddyWb = (stageObj: any) => {
                  const hasPaddyWb = !!stageObj.paddyWbEnabled;
                  if (!hasPaddyWb) return '-';
                  return formatField(stageObj.paddyWbRaw || stageObj.paddyWb);
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
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: finalRowBg }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: '800', color: isDarkSmell ? '#ffffff' : color }}>{name}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>{formatReportedBy(stageObj)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>
                        {stageObj.reportedAt ? new Date(stageObj.reportedAt).toLocaleDateString('en-GB') + ', ' + new Date(stageObj.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase() : '-'}
                      </td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600' }}>{formatMoisture(stageObj)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{formatCutting(stageObj)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{formatBend(stageObj)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '55px' }}>{(() => { const v = stageObj.grainsCountRaw || stageObj.grainsCount; return (v !== null && v !== undefined && v !== '') ? `(${v})` : '-'; })()}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.mixRaw || stageObj.mix)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{stageObj.smixEnabled ? formatField(stageObj.mixSRaw || stageObj.mixS) || 'Yes' : '-'}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{stageObj.lmixEnabled ? formatField(stageObj.mixLRaw || stageObj.mixL) || 'Yes' : '-'}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.kanduRaw || stageObj.kandu)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.oilRaw || stageObj.oil)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{formatField(stageObj.skRaw || stageObj.sk)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '50px' }}>{stageObj.smellHas === true || String(stageObj.smellHas).trim().toUpperCase() === 'YES' ? (stageObj.smellType || 'Yes') : '-'}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '50px' }}>{formatPaddyWb(stageObj)}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalKadigaColor, fontWeight: '700', width: '80px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span>{stageObj.paddyColorEnabled && stageObj.paddyColor ? formatField(stageObj.paddyColor) : '-'}</span>
                          <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />
                          <span>ಕಡಿಗಾ: {stageObj.kadiga ? (isKadiga ? 'Yes' : 'No') : '-'}</span>
                        </div>
                      </td>
                      
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>{isFull ? formatField(stageObj.actualBags || inspection.bags) : '-'}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center' }}>
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
                  <div key={inspection.id} style={{ border: '1px solid #f2cfb6', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{tripHeaderLabel} | Bags Loaded: {stages.full_avg?.actualBags || inspection.bags || '-'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Add Balanced Lot button removed as it should be added through Add Sample flow */}
                        <span>Reported By: {inspection.reportedBy?.username || 'System'} | Date: {new Date(inspection.inspectionDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #f2cfb6' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'left', border: '1px solid #cbd5e1' }}>SAMPLE / STAGE</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>REPORTED BY</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>REPORTED AT</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>MOISTURE</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>CUTTING</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>BEND</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '55px' }}>GRAINS</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>MIX</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>S MIX</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>L MIX</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>KANDU</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>OIL</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '45px' }}>SK</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '50px' }}>SMELL</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '50px' }}>PADDY WB</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '80px' }}>P COLOR</th>
                            
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>LOADED BAGS</th>
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1' }}>PHOTO</th>
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
                              } else if (key === 'full_avg') {
                                name = 'Full Avg Lorry';
                                color = '#000000';
                                bgColor = '#ffffff';
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
      {/* Lorry Loading Details Modal */}
      {selectedEntry && (!activeCards[selectedEntry] || activeCards[selectedEntry].length === 0) && (() => {
        const entry = entries.find(e => e.id === selectedEntry);
        if (!entry) return null;
        const progress = inspectionProgress[entry.id];
        const currentLorryNumber = inspectionData[entry.id]?.lorryNumber || '';
        const isCurrentLorryFrozen = isLorryFreezed(entry.id, currentLorryNumber);
        const isDateReadOnly = isCurrentLorryFrozen || (user?.role !== 'admin' && user?.role !== 'manager' && !isLocationStaffUser && !isLegacyPhysicalSupervisor);
        
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
                    Loaded Date (Freezed)
                  </label>
                  <input
                    type="date"
                    value={inspectionData[entry.id]?.inspectionDate || ''}
                    onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                    disabled={true}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed'
                    }}
                  />
                  {isCurrentLorryFrozen && (
                    <span style={{ fontSize: '10px', color: '#c0392b', fontWeight: '600' }}>Freezed</span>
                  )}
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
                      Crop *
                    </label>
                    <select
                      value={getRulesMode(entry.id)}
                      onChange={(e) => handleInputChange(entry.id, 'samplingRulesMode', e.target.value)}
                      disabled={!isFirstTrip(entry.id) || isDateReadOnly || isRulesModeCommitted(entry.id)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '12px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        color: '#1a1a1a',
                        backgroundColor: (!isFirstTrip(entry.id) || isDateReadOnly || isRulesModeCommitted(entry.id)) ? '#e0e0e0' : '#fff',
                        fontWeight: '600'
                      }}
                    >
                      <option value="">-- SELECT CROP --</option>
                      <option value="old">Old Paddy</option>
                      <option value="new">New Paddy</option>
                    </select>
                  </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '700', color: '#333' }}>
                    Sampling *
                  </label>
                  {(() => {
                    const stageItems = [
                      { value: 'lot_avg', label: '1. Lot Avg Sampling', disabled: isStageDisabledForEntry(entry.id, 'lot_avg') },
                      { value: 'nit_avg', label: '2. Nit Avg Sampling', disabled: isStageDisabledForEntry(entry.id, 'nit_avg') },
                      { value: 'half_lorry', label: '3. Half Lorry Sampling', disabled: isStageDisabledForEntry(entry.id, 'half_lorry') },
                      { value: 'full_avg', label: '4. Full Avg Lorry Sampling', disabled: isStageDisabledForEntry(entry.id, 'full_avg') },
                      { value: 'balanced_lot', label: '5. Balanced Lot Sampling', disabled: isStageDisabledForEntry(entry.id, 'balanced_lot') }
                    ].filter(item => isStageVisibleForEntry(entry.id, item.value));
                    return (
                      <>
                        <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                           {stageItems.map((item) => {
                            const isDisabled = item.disabled;
                            const isSelected = (selectedStage[entry.id] || 'lot_avg') === item.value;
                            const isLocked = isStageLockedForLot(entry.id, item.value);
                            const isApproved = isStageApprovedForLot(entry.id, item.value);
                            const isDone = isLocked || isApproved;
                            
                            let statusLabel = '';
                            if (isDone) {
                              statusLabel = '✓ Done';
                            } else if (isDisabled) {
                              if (item.value === 'balanced_lot') {
                                if (isAnyFullAvgSavedOrApproved(entry.id)) {
                                  statusLabel = 'Expired / Not Added';
                                } else {
                                  statusLabel = 'Locked';
                                }
                              } else if (item.value === 'lot_avg') {
                                if (!isLotAvgRequiredForLorry(entry.id, (inspectionData[entry.id]?.lorryNumber || '').trim().toUpperCase())) {
                                  statusLabel = 'Not Required';
                                } else {
                                  statusLabel = 'Locked';
                                }
                              } else {
                                statusLabel = 'Locked';
                              }
                            }
                            return (
                              <div
                                key={item.value}
                                onClick={() => {
                                  if (!isDisabled) {
                                    setSelectedStage(prev => ({ ...prev, [entry.id]: item.value }));
                                  }
                                }}
                                style={{
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  fontWeight: isSelected ? '700' : '500',
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  backgroundColor: isDisabled ? '#e8e8e8' : isSelected ? '#e8f5e9' : '#fff',
                                  color: isDisabled ? '#aaa' : isSelected ? '#1b5e20' : '#333',
                                  borderBottom: '1px solid #eee',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background-color 0.15s',
                                  opacity: isDisabled ? 0.6 : 1,
                                  textDecoration: (isDone && !item.value.startsWith('nit_avg')) ? 'line-through' : 'none'
                                }}
                              >
                                <span>{item.label}</span>
                                {statusLabel && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    color: statusLabel.startsWith('Expired') ? '#d32f2f' : '#999', 
                                    fontWeight: '600' 
                                  }}>
                                    {statusLabel}
                                  </span>
                                )}
                                {isSelected && !isDisabled && <span style={{ fontSize: '10px', color: '#27ae60', fontWeight: '700' }}>● Selected</span>}
                              </div>
                            );
                          })}
                        </div>
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
                            {stageItems.map(item => (
                              <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>
                            ))}
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
                          {getRulesMode(entry.id) === 'new' && selectedStage[entry.id] === 'balanced_lot' && (() => {
                            const tripId = inspectionData[entry.id]?.tripId || progress?.previousInspections?.find(t => {
                              const lorry = (t.lorryNumber || '').trim().toUpperCase();
                              return lorry !== 'LOT_AVG' && lorry !== 'BALANCED_LOT' && t.samplingStages?.full_avg && !t.samplingStages?.balanced_lot;
                            })?.id || '';

                            if (!tripId) return null;

                            if (activeSkipConfirm[tripId]) {
                              return (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: '#c0392b', fontWeight: 'bold' }}>Confirm Skip?</span>
                                  <button
                                    onClick={() => handleSkipBalancedLot(entry.id, tripId)}
                                    type="button"
                                    style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setActiveSkipConfirm(prev => ({ ...prev, [tripId]: false }))}
                                    type="button"
                                    style={{ backgroundColor: '#7f8c8d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    No
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                onClick={() => setActiveSkipConfirm(prev => ({ ...prev, [tripId]: true }))}
                                type="button"
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#7f8c8d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Skip
                              </button>
                            );
                          })()}
                  </div>
                      </>
                    );
                  })()}
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
                  smellHas: getRulesMode(entry.id) === 'new' ? 'Yes' : 'No',
                  smellType: '',
                  paddyWbEnabled: 'N',
                  paddyWb: '',
                  paddyColorEnabled: 'N',
                  paddyColor: '',
                  kadiga: '',
                  actualBags: '',
                  reportedBy: user?.username || 'System',
                  isLocked: false
                };
                const isLocked = !!cardData.isLocked;
                 const isNewMode = getRulesMode(entry.id) === 'new';
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Grains Count{isNewMode ? '' : ' *'}</label>
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Cutting{isNewMode ? '' : ' *'}</label>
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Bend{isNewMode ? '' : ' *'}</label>
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Mix{isNewMode ? '' : ' *'}</label>
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>SK{isNewMode ? '' : ' *'}</label>
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
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Kandu{isNewMode ? '' : ' *'}</label>
                          <input
                            type="text"
                            disabled={isLocked}
                            value={cardData.kandu}
                            onChange={(e) => handleStageInputChange(entry.id, stage, 'kandu', e.target.value)}
                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Oil{isNewMode ? '' : ' *'}</label>
                          <input
                            type="text"
                            disabled={isLocked}
                            value={cardData.oil}
                            onChange={(e) => handleStageInputChange(entry.id, stage, 'oil', e.target.value)}
                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Smell *</label>
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

                      {/* Row 5: Paddy Discolor, Kadiga and Paddy WB */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1.2 }}>
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy Discolor *</label>
                          <select
                            disabled={isLocked}
                            value={cardData.paddyColor}
                            onChange={(e) => {
                              handleStageInputChange(entry.id, stage, 'paddyColor', e.target.value);
                              handleStageInputChange(entry.id, stage, 'paddyColorEnabled', e.target.value ? 'Y' : 'N');
                            }}
                            style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '4px' }}
                          >
                            <option value="">Select discolor</option>
                            <option value="Normal Color">Normal Color</option>
                            <option value="Light Discolor">Light Discolor</option>
                            <option value="Medium Discolor">Medium Discolor</option>
                            <option value="Dark Discolor">Dark Discolor</option>
                          </select>
                        </div>
                        <div style={{ flex: 0.8 }}>
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>ಕಡಿಗಾ *</label>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', marginBottom: '4px' }}>
                            <label><input type="radio" disabled={isLocked} checked={cardData.kadiga === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'kadiga', 'Y')} /> Yes</label>
                            <label><input type="radio" disabled={isLocked} checked={cardData.kadiga === 'N'} onChange={() => handleStageInputChange(entry.id, stage, 'kadiga', 'N')} /> No</label>
                          </div>
                        </div>
                        <div style={{ flex: 0.8 }}>
                          <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB{isNewMode ? '' : ' *'}</label>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', marginBottom: '4px' }}>
                            <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'Y'} onChange={() => handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'Y')} /> Y</label>
                            <label><input type="radio" disabled={isLocked} checked={cardData.paddyWbEnabled === 'N'} onChange={() => { handleStageInputChange(entry.id, stage, 'paddyWbEnabled', 'N'); handleStageInputChange(entry.id, stage, 'paddyWb', ''); }} /> N</label>
                          </div>
                        </div>
                        <div style={{ flex: 1.2 }}>
                          {cardData.paddyWbEnabled === 'Y' && (
                            <>
                              <label style={{ display: 'block', fontWeight: '600', marginBottom: '3px' }}>Paddy WB Value{isNewMode ? '' : ' *'}</label>
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
                            disabled={isSaving[entry.id]}
                            onClick={() => handleSaveStage(entry.id, stage)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              backgroundColor: isSaving[entry.id] ? '#95a5a6' : '#27ae60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: '700',
                              cursor: isSaving[entry.id] ? 'not-allowed' : 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            {isSaving[entry.id] ? 'Saving...' : 'Save'}
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
