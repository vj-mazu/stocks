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
  const zeroToEmpty = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    return (str === '0' || str === '0.0' || str === '00') ? '' : str;
  };

  const formatCuttingForUI = (c1: any, c2: any) => {
    const v1 = parseFloat(c1);
    const v2 = parseFloat(c2);
    if (isNaN(v1)) return '';
    const displayV1 = v1 === 0 ? 1 : v1;
    const displayV2 = isNaN(v2) ? 0 : v2;
    return `${displayV1}×${displayV2}`;
  };

  const formatBendForUI = (b1: any, b2: any) => {
    const v1 = parseFloat(b1);
    const v2 = parseFloat(b2);
    if (isNaN(v1)) return '';
    const displayV1 = v1 === 0 ? 1 : v1;
    const displayV2 = isNaN(v2) ? 0 : v2;
    return `${displayV1}×${displayV2}`;
  };

  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});
  const [activeTab, setActiveTab] = useState<'paddy' | 'rice'>(() => {
    const saved = localStorage.getItem('physical_inspection_active_tab');
    return (saved === 'paddy' || saved === 'rice') ? saved : 'paddy';
  });
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
  const [detailModalEntry, setDetailModalEntry] = useState<any>(null);
  const [isSaving, setIsSaving] = useState<{ [entryId: string]: boolean }>({});
  const [activeSkipConfirm, setActiveSkipConfirm] = useState<{ [inspectionId: string]: boolean }>({});
  const [editingStage, setEditingStage] = useState<{ [entryId: string]: string | null }>({});
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
    localStorage.setItem('physical_inspection_active_tab', activeTab);
  }, [activeTab]);

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
          moisture: zeroToEmpty(dbStage.moisture),
          dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
          dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
          grainsCount: zeroToEmpty(dbStage.grainsCount),
          cutting: formatCuttingForUI(dbStage.cutting1, dbStage.cutting2),
          bend: formatBendForUI(dbStage.bend1, dbStage.bend2),
          mix: zeroToEmpty(dbStage.mix),
          smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
          mixS: zeroToEmpty(dbStage.mixS || dbStage.mix_s),
          lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
          mixL: zeroToEmpty(dbStage.mixL || dbStage.mix_l),
          sk: zeroToEmpty(dbStage.sk),
          kandu: zeroToEmpty(dbStage.kandu),
          oil: zeroToEmpty(dbStage.oil),
          smellHas: dbStage.smellHas ? 'Yes' : 'No',
          smellType: dbStage.smellType || '',
          paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
          paddyWb: zeroToEmpty(dbStage.paddyWb),
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
          actualBags: dbStage.actualBags !== undefined && dbStage.actualBags !== null ? dbStage.actualBags.toString() : (dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : ''),
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
        const inspectedBags = inspections.reduce((sum, inspection) => {
          const stages = (inspection as any).samplingStages || {};
          const fullAvgStageKey = Object.keys(stages).find(key => {
            const base = stages[key]?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
            return (base === 'full_avg' || base === 'full_avg_lorry') && stages[key]?.approvalStatus === 'approved';
          });
          const fullAvgStage = fullAvgStageKey ? stages[fullAvgStageKey] : ((stages as any).full_avg || {});
          const actualBags = Number(fullAvgStage.actualBags || fullAvgStage.bags || inspection.bags || 0);
          return sum + actualBags;
        }, 0);
        const remainingBags = entry.lotAllotment?.closedAt ? 0 : Math.max(0, totalBags - inspectedBags);
        const rawProgressPercentage = entry.lotAllotment?.closedAt ? 100 : (totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0);
        const progressPercentage = Math.min(100, rawProgressPercentage);
        
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
              reportedBy: inspection.reportedBy || { username: 'System' },
              createdAt: (inspection as any).createdAt
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

            // Sort progressive trips chronologically — match backend order: inspectionDate ASC, createdAt ASC, id ASC
            mapped.sort((a, b) => {
              const dateA = a.inspectionDate ? new Date(a.inspectionDate).getTime() : 0;
              const dateB = b.inspectionDate ? new Date(b.inspectionDate).getTime() : 0;
              if (dateA !== dateB) return dateA - dateB;
              const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              if (createdA !== createdB) return createdA - createdB;
              return (a.id || 0) - (b.id || 0);
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
      if (data) {
        data.progressPercentage = Math.min(100, data.progressPercentage || 0);
      }
      // Backend already sorts previousInspections by inspectionDate ASC, createdAt ASC, id ASC
      // No client-side re-sort needed — keeps outside table and modal in sync
      
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
    const cleanLorry = lorryNo.trim().toUpperCase();
    const progress = inspectionProgress[entryId];
    const prevLorryInspection = progress?.previousInspections?.find(
      i => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );
    const tripId = prevLorryInspection ? prevLorryInspection.id : '';

    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        lorryNumber: cleanLorry,
        tripId: tripId
      }
    }));

    if (prevLorryInspection && prevLorryInspection.samplingStages) {
      // Check if date has changed (not today) - disabled restriction to allow resuming/editing past trips

      const stages = prevLorryInspection.samplingStages || {};
      const stageKeys = Object.keys(stages);
      
      const newStageData: any = {};
      stageKeys.forEach(key => {
        const dbStage = stages[key] || {};
        newStageData[key] = {
          moisture: zeroToEmpty(dbStage.moisture),
          dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
          dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
          grainsCount: zeroToEmpty(dbStage.grainsCount),
          cutting: formatCuttingForUI(dbStage.cutting1, dbStage.cutting2),
          bend: formatBendForUI(dbStage.bend1, dbStage.bend2),
          mix: zeroToEmpty(dbStage.mix),
          smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
          mixS: zeroToEmpty(dbStage.mixS || dbStage.mix_s),
          lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
          mixL: zeroToEmpty(dbStage.mixL || dbStage.mix_l),
          sk: zeroToEmpty(dbStage.sk),
          kandu: zeroToEmpty(dbStage.kandu),
          oil: zeroToEmpty(dbStage.oil),
          smellHas: dbStage.smellHas ? 'Yes' : 'No',
          smellType: dbStage.smellType || '',
          paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
          paddyWb: zeroToEmpty(dbStage.paddyWb),
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
          actualBags: dbStage.actualBags !== undefined && dbStage.actualBags !== null ? dbStage.actualBags.toString() : (dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : ''),
          nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
          imageUrl: dbStage.imageUrl || null,
          reportedBy: dbStage.reportedBy || 'System',
          approvalStatus: dbStage.approvalStatus || 'approved',
          isLocked: true
        };
      });

      // Removed setActiveCards from here so completed stages do not pop up as active forms in the UI.

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
      
      const entry = getEntryById(entryId);
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
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
    const entry = getEntryById(entryId);
    const isNewMode = getRulesMode(entryId) === 'new' && (!checkIfWbVariety(entry) || isLooseEntry(entryId));

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

  const getStageHoldInfo = (entryId: string, stageKey: string) => {
    if (isStageApprovedForLot(entryId, stageKey)) {
      return { count: 0, latestStatus: 'approved' };
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const tripInsps = prevInsps.filter((insp: any) => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      if (stageKey === 'lot_avg') {
        return lorry === 'LOT_AVG';
      }
      if (stageKey === 'balanced_lot') {
        return lorry === 'BALANCED_LOT';
      }
      return lorry === cleanLorry;
    });

    const uniqueAttempts = new Set<number>();
    let latestStatus = null;
    let latestTime = 0;
    let hasActiveHold = false;

    // Check local draft stages
    const localStages = samplingStageData[entryId] || {};
    Object.keys(localStages).filter(isWorkflowStageKey).forEach((key: string) => {
      const baseKey = getStageBaseKey(key, localStages[key]);
      if (baseKey === stageKey) {
        const stg = localStages[key];
        const attempt = stg?.attemptNo || 1;
        uniqueAttempts.add(attempt);
        const time = new Date(stg.reportedAt || stg.holdAt || stg.createdAt || 0).getTime();
        if (time >= latestTime) {
          latestTime = time;
          latestStatus = stg.approvalStatus;
        }
        if (stg.approvalStatus === 'hold') {
          hasActiveHold = true;
        }
      }
    });

    tripInsps.forEach((insp: any) => {
      const stages = insp.samplingStages || {};

      // Active keys in stages
      Object.keys(stages).filter(isWorkflowStageKey).forEach((key: string) => {
        const baseKey = getStageBaseKey(key, stages[key]);
        if (baseKey === stageKey) {
          const stg = stages[key];
          const attempt = stg?.attemptNo || 1;
          uniqueAttempts.add(attempt);
          const time = new Date(stg.reportedAt || stg.holdAt || stg.createdAt || 0).getTime();
          if (time >= latestTime) {
            latestTime = time;
            latestStatus = stg.approvalStatus;
          }
          if (stg.approvalStatus === 'hold') {
            hasActiveHold = true;
          }
        }
      });

      // Legacy holdHistory check (for backward compatibility)
      const holdHistory = Array.isArray(stages.holdHistory?.[stageKey]) ? stages.holdHistory[stageKey] : [];
      holdHistory.forEach((historyItem: any, index: number) => {
        const attempt = historyItem?.attemptNo || (index + 1);
        uniqueAttempts.add(attempt);
        const time = new Date(historyItem?.holdAt || historyItem?.reportedAt || historyItem?.createdAt || 0).getTime();
        if (time >= latestTime) {
          latestTime = time;
          latestStatus = historyItem?.approvalStatus || 'hold';
        }
      });
    });

    // If there's an active hold on the base stage and it hasn't been approved in any reattempt, status is hold
    const isApproved = isStageApprovedForLot(entryId, stageKey);
    if (isApproved) {
      latestStatus = 'approved';
    } else if (hasActiveHold) {
      latestStatus = 'hold';
    }

    return { count: uniqueAttempts.size, latestStatus };
  };

  const isWorkflowStageKey = (key: string) => key !== 'holdHistory';

  const hasUnresolvedPendingOrHold = (stages: any) => {
    if (!stages) return false;
    return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
      const stg = stages[key];
      if (!stg) return false;
      if (stg.approvalStatus === 'pending') return true;
      if (stg.approvalStatus === 'hold') {
        const baseKey = getStageBaseKey(key, stg);
        return !isStageApprovedInStages(stages, baseKey);
      }
      return false;
    });
  };

  const getSamplingStatusAndColor = (stages: any, isDark: boolean) => {
    const fallbackColor = isDark ? '#e0e0e0' : '#64748b';
    if (!stages) return { text: 'Pending', color: fallbackColor };

    // Check balanced_lot
    const balancedObj = getStageObjFromStages(stages, 'balanced_lot');
    if (isStageApprovedInStages(stages, 'balanced_lot')) {
      return { text: 'Pass', color: isDark ? '#a5d6a7' : '#2e7d32' };
    }
    if (balancedObj.approvalStatus === 'pending') {
      const txt = balancedObj.isEdited ? 'Edited: Balanced Lot' : 'Pending: Balanced Lot';
      return { text: txt, color: isDark ? '#ffe082' : '#f39c12' };
    }
    if (balancedObj.approvalStatus === 'hold') {
      return { text: 'Hold: Balanced Lot', color: isDark ? '#ffb74d' : '#d97706' };
    }

    // Check full_avg
    const fullObj = getStageObjFromStages(stages, 'full_avg');
    if (isStageApprovedInStages(stages, 'full_avg')) {
      return { text: 'Pass', color: isDark ? '#a5d6a7' : '#2e7d32' };
    }
    if (fullObj.approvalStatus === 'pending') {
      const txt = fullObj.isEdited ? 'Edited: Full Lorry' : 'Pending: Full Lorry';
      return { text: txt, color: isDark ? '#ffe082' : '#f39c12' };
    }
    if (fullObj.approvalStatus === 'hold') {
      return { text: 'Hold: Full Lorry', color: isDark ? '#ffb74d' : '#d97706' };
    }

    // Check half_lorry
    const halfObj = getStageObjFromStages(stages, 'half_lorry');
    if (isStageApprovedInStages(stages, 'half_lorry')) {
      return { text: 'Approved: Half Lorry', color: isDark ? '#90caf9' : '#1565c0' };
    }
    if (halfObj.approvalStatus === 'pending') {
      const txt = halfObj.isEdited ? 'Edited: Half Lorry' : 'Pending: Half Lorry';
      return { text: txt, color: isDark ? '#ffe082' : '#f39c12' };
    }
    if (halfObj.approvalStatus === 'hold') {
      return { text: 'Hold: Half Lorry', color: isDark ? '#ffb74d' : '#d97706' };
    }

    // Check nit_avg keys
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
        const label = idx === 0 ? 'Approved: Nit Avg' : `Approved: Nit Avg ${idx + 1}`;
        return { text: label, color: isDark ? '#90caf9' : '#1565c0' };
      }
      if (stages[key]?.approvalStatus === 'pending') {
        const idx = nitKeys.indexOf(key);
        const label = stages[key].isEdited 
          ? (idx === 0 ? 'Edited: Nit Avg' : `Edited: Nit Avg ${idx + 1}`)
          : (idx === 0 ? 'Pending: Nit Avg' : `Pending: Nit Avg ${idx + 1}`);
        return { text: label, color: isDark ? '#ffe082' : '#f39c12' };
      }
      if (stages[key]?.approvalStatus === 'hold') {
        const idx = nitKeys.indexOf(key);
        const label = idx === 0 ? 'Hold: Nit Avg' : `Hold: Nit Avg ${idx + 1}`;
        return { text: label, color: isDark ? '#ffb74d' : '#d97706' };
      }
    }

    // Check lot_avg
    const lotObj = getStageObjFromStages(stages, 'lot_avg');
    if (isStageApprovedInStages(stages, 'lot_avg')) {
      return { text: 'Approved: Lot Avg', color: isDark ? '#90caf9' : '#1565c0' };
    }
    if (lotObj.approvalStatus === 'pending') {
      const txt = lotObj.isEdited ? 'Edited: Lot Avg' : 'Pending: Lot Avg';
      return { text: txt, color: isDark ? '#ffe082' : '#f39c12' };
    }
    if (lotObj.approvalStatus === 'hold') {
      return { text: 'Hold: Lot Avg', color: isDark ? '#ffb74d' : '#d97706' };
    }

    return { text: 'Pending', color: fallbackColor };
  };

  const getStageBaseKey = (key: string, stageObj?: any) => {
    if (stageObj?.baseStage) return stageObj.baseStage;
    return key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');
  };

  const getStageAttemptNo = (stages: Record<string, any>, key: string) => {
    const stageObj = stages[key] || {};
    if (stageObj.attemptNo) return stageObj.attemptNo;
    const baseKey = getStageBaseKey(key, stageObj);
    const matchingKeys = Object.keys(stages)
      .filter(stageKey => isWorkflowStageKey(stageKey) && getStageBaseKey(stageKey, stages[stageKey]) === baseKey)
      .sort((a, b) => {
        const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
        const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
        return timeA - timeB;
      });
    return matchingKeys.indexOf(key) + 1;
  };

  const getStageDisplayLabel = (baseKey: string, stageObj?: any) => {
    if (baseKey === 'lot_avg') return 'Lot Avg';
    if (baseKey === 'balanced_lot') return 'Balanced Lot';
    if (baseKey === 'half_lorry') return 'Half Lorry';
    if (baseKey === 'full_avg') return 'Full Avg Lorry';
    if (baseKey === 'nit_avg' || baseKey.startsWith('nit_avg')) {
      const nit = String(stageObj?.nit || '').trim();
      return nit ? `Nit Avg (${nit})` : 'Nit Avg';
    }
    return baseKey.replace(/_/g, ' ');
  };

  const isStageApprovedInStages = (stages: any, stageKey: string) => {
    if (!stages) return false;
    return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      return baseKey === stageKey && stages[key]?.approvalStatus === 'approved';
    });
  };

  const isStagePendingInStages = (stages: any, stageKey: string) => {
    if (!stages) return false;
    return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      return baseKey === stageKey && stages[key]?.approvalStatus === 'pending';
    });
  };

  const hasStageInStages = (stages: any, stageKey: string) => {
    if (!stages) return false;
    return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      return baseKey === stageKey;
    });
  };

  const isFullAvgEligibleForBalanced = (stages: any, entryId?: string) => {
    const isApproved = isStageApprovedInStages(stages, 'full_avg');
    if (isApproved) return true;
    if (entryId) {
      const entry = getEntryById(entryId);
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
      if (entry && isLooseEntry(entryId) && isNewCrop) {
        const progress = inspectionProgress[entryId];
        if (progress && progress.totalBags > 0 && progress.inspectedBags >= progress.totalBags) {
          return true;
        }
      }
    }
    return false;
  };

  const getStageObjFromStages = (stages: any, stageKey: string) => {
    if (!stages) return {};
    const matchingKeys = Object.keys(stages).filter(key => isWorkflowStageKey(key) && getStageBaseKey(key, stages[key]) === stageKey);
    if (matchingKeys.length === 0) return {};
    matchingKeys.sort((a, b) => {
      const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
      const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return stages[matchingKeys[0]] || {};
  };

  const isStageApprovedForLot = (entryId: string, stageKey: string) => {
    if (stageKey === 'lot_avg') {
      const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
      if (cleanLorry && !isLotAvgRequiredForLorry(entryId, cleanLorry)) {
        return true;
      }
    }
    if (stageKey !== 'lot_avg') {
      return isStageApprovedInStages(samplingStageData[entryId], stageKey);
    }
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
        return lorryMatch && isStageApprovedInStages(stages, stageKey);
      });
      if (approvedWithCurrent) return true;
    }

    const entry = getEntryById(entryId);
    if (getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry)) {
      if (stageKey === 'lot_avg') {
        const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
        const todayStr = new Date().toLocaleDateString('en-GB');
        return prevInsps.some(insp => {
          const lorry = (insp.lorryNumber || '').trim().toUpperCase();
          const isDummy = lorry === 'LOT_AVG' || !lorry;
          const isMatch = isDummy || lorry === cleanLorry;
          const isApproved = isStageApprovedInStages(insp.samplingStages, 'lot_avg');
          
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
          return lotAvgInsps.some(insp => isStageApprovedInStages(insp.samplingStages, 'lot_avg'));
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
            return lotAvgTime >= lastRealLorryTime && isStageApprovedInStages(insp.samplingStages, 'lot_avg');
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
    const localFull = getStageObjFromStages(samplingStageData[entryId], 'full_avg');
    if (localFull?.approvalStatus === 'approved') return true;
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry === cleanLorry && isStageApprovedInStages(insp.samplingStages, 'full_avg');
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
      return lorry === 'LOT_AVG' && isStageApprovedInStages(insp.samplingStages, 'lot_avg');
    });
  };

  const hasCurrentTripNitOrHalf = (entryId: string) => {
    const stages = getCurrentTripStages(entryId);
    return !!stages.half_lorry || Object.keys(stages).some(key => key === 'nit_avg' || key.startsWith('nit_avg_'));
  };

  const isStagePendingForLot = (entryId: string, stageKey: string) => {
    const checkPending = (stages: Record<string, any>) => {
      return Object.keys(stages).filter(isWorkflowStageKey).some(key => {
        const baseKey = getStageBaseKey(key, stages[key]);
        if (stageKey === 'nit_avg') {
          return (baseKey === 'nit_avg' || baseKey.startsWith('nit_avg')) && stages[key]?.approvalStatus === 'pending';
        }
        return baseKey === stageKey && stages[key]?.approvalStatus === 'pending';
      });
    };

    if (samplingStageData[entryId] && checkPending(samplingStageData[entryId])) {
      return true;
    }
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => checkPending(insp.samplingStages || {}));
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

  const isLooseEntry = (entryId: string) => {
    const entry = getEntryById(entryId);
    if (!entry) return false;
    const baseRateType = entry.offering?.baseRateType || '';
    const finalBaseRateType = entry.offering?.finalBaseRateType || '';
    const type = entry.entryType || '';
    return type === 'PD_LOOSE' || type === 'MD_LOOSE' ||
           baseRateType === 'PD_LOOSE' || baseRateType === 'MD_LOOSE' ||
           finalBaseRateType === 'PD_LOOSE' || finalBaseRateType === 'MD_LOOSE';
  };

  const isStageVisibleForEntry = (entryId: string, stageKey: string) => {
    const entry = getEntryById(entryId);
    const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
    if (isLooseEntry(entryId) && getRulesMode(entryId) === 'new' && stageKey === 'nit_avg') {
      return false;
    }
    if (isLooseEntry(entryId) && getRulesMode(entryId) === 'new') {
      // New Crop loose: show lot_avg, half_lorry, full_avg, balanced_lot (hide nit_avg, bag_wise_report)
      if (stageKey !== 'lot_avg' && stageKey !== 'half_lorry' && stageKey !== 'full_avg' && stageKey !== 'balanced_lot') {
        return false;
      }
      // If full_avg is submitted/pending/approved on this trip, hide half_lorry
      const currentTripStages = getCurrentTripStages(entryId);
      const hasFullAvg = Object.keys(currentTripStages).some(key => getStageBaseKey(key, currentTripStages[key]) === 'full_avg');
      if (hasFullAvg && stageKey === 'half_lorry') {
        return false;
      }
      // If full_avg is approved, hide lot_avg and half_lorry
      if (isCurrentTripFullAvgApproved(entryId) && (stageKey === 'lot_avg' || stageKey === 'half_lorry')) {
        return false;
      }
      return true;
    }
    if (isNewCrop && stageKey === 'nit_avg') {
      return false;
    }

    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const currentTripStages = getCurrentTripStages(entryId);
    const hasFullAvg = Object.keys(currentTripStages).some(key => getStageBaseKey(key, currentTripStages[key]) === 'full_avg');
    if (hasFullAvg && ['nit_avg', 'half_lorry'].includes(stageKey)) {
      return false;
    }
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
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    if (isCurrentTripFullAvgApproved(entryId) && ['lot_avg', 'nit_avg', 'half_lorry', 'full_avg'].includes(stageKey)) {
      return true;
    }

    const entry = getEntryById(entryId);
    const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);

    // Get combined stages for current trip
    const trip = prevInsps.find(insp => (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry);
    const stagesObj = {
      ...(trip?.samplingStages || {}),
      ...(samplingStageData[entryId] || {})
    };

    // Check if there is an active hold on any stage (applies to both Old and New Crop)
    let activeHoldStage: string | null = null;
    let holdDate: Date | null = null;
    Object.keys(stagesObj).filter(isWorkflowStageKey).forEach(key => {
      const stg = stagesObj[key];
      if (stg?.approvalStatus === 'hold') {
        const baseKey = getStageBaseKey(key, stg);
        if (!isStageApprovedForLot(entryId, baseKey)) {
          activeHoldStage = baseKey;
          holdDate = stg.holdAt ? new Date(stg.holdAt) : null;
        }
      }
    });

    if (activeHoldStage) {
      if (activeHoldStage === 'balanced_lot' && holdDate) {
        const today = new Date();
        const isNextDay = (today.getFullYear() > holdDate.getFullYear()) ||
                          (today.getFullYear() === holdDate.getFullYear() && today.getMonth() > holdDate.getMonth()) ||
                          (today.getFullYear() === holdDate.getFullYear() && today.getMonth() === holdDate.getMonth() && today.getDate() > holdDate.getDate());
        if (isNextDay) {
          if (stageKey === 'lot_avg') {
            const holdInfo = getStageHoldInfo(entryId, 'lot_avg');
            return holdInfo.count >= 4; // Disabled if already 4 times
          }
          return true; // Blocks all other stages
        }
      }

      // Standard hold behavior: can only add the same stage that is on hold (up to 4 times)
      return stageKey !== activeHoldStage || getStageHoldInfo(entryId, stageKey).count >= 4;
    }

    // Pending Lot Avg or Balanced Lot blocks everything else (applies to all entries)
    if (stageKey !== 'lot_avg' && isStagePendingForLot(entryId, 'lot_avg')) return true;
    if (stageKey !== 'balanced_lot' && isStagePendingForLot(entryId, 'balanced_lot')) return true;

    // For non-loose entries (Old Crop, New Crop WB): pending half_lorry/nit_avg/full_avg also blocks next stages
    const isNewCropLoose = isLooseEntry(entryId) && getRulesMode(entryId) === 'new';
    if (!isNewCropLoose) {
      if (stageKey !== 'half_lorry' && isStagePendingForLot(entryId, 'half_lorry')) return true;
      if (stageKey !== 'nit_avg' && isStagePendingForLot(entryId, 'nit_avg')) return true;
      if (stageKey !== 'full_avg' && isStagePendingForLot(entryId, 'full_avg')) return true;
    }

    const isLocationSample = isLocationSampleEntry(entryId);
    const isFirstTrip = isFirstRealLorryTrip(entryId, cleanLorry);
    const requiresLotAvgFirst = isLotAvgRequiredForLorry(entryId, cleanLorry) && !(isLocationSample && isFirstTrip && !isNewCrop);

    if (stageKey !== 'lot_avg' && requiresLotAvgFirst && !isStageApprovedForLot(entryId, 'lot_avg')) {
      return true;
    }

    if (stageKey === 'lot_avg') {
      if (isNewCrop && (isStageLockedForLot(entryId, 'half_lorry') || isStageLockedForLot(entryId, 'full_avg'))) {
        return true;
      }
      return isStageLockedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry);
    }

    if (stageKey === 'nit_avg') {
      if (isNewCrop) return true;
      if (isStageApprovedForLot(entryId, 'full_avg')) {
        return true;
      }
      return false;
    }

    if (stageKey === 'half_lorry') {
      if (isStageLockedForLot(entryId, 'half_lorry')) return true;
      if (!isNewCrop) {
        if (isLocationSampleEntry(entryId) && isFirstRealLorryTrip(entryId, cleanLorry)) return false;
        if (!cleanLorry && isStageApprovedForFirstTripLotAvg(entryId)) return false;
      }
      return false;
    }

    if (stageKey === 'full_avg') {
      const hasHalfLorry = Object.keys(stagesObj).some(key => getStageBaseKey(key, stagesObj[key]) === 'half_lorry');
      const hasNitAvg = Object.keys(stagesObj).some(key => getStageBaseKey(key, stagesObj[key]).startsWith('nit_avg'));
      const isLoose = isLooseEntry(entryId);
      const required = isLoose ? true : (isNewCrop ? hasHalfLorry : (hasHalfLorry || hasNitAvg));
      return !required || isStageLockedForLot(entryId, 'full_avg');
    }

    if (stageKey === 'balanced_lot') {
      if (isLooseEntry(entryId)) {
        return isBalancedLotDisabled(entryId);
      }
      if (isNewCrop) {
        return isStageLockedForLot(entryId, 'balanced_lot');
      }
      const hasFullAvg = Object.keys(stagesObj).some(key => getStageBaseKey(key, stagesObj[key]) === 'full_avg');
      return !hasFullAvg || isBalancedLotDisabled(entryId);
    }

    return false;
  };

  const isAnyFullAvgSavedOrApproved = (entryId: string) => {
    if (hasStageInStages(samplingStageData[entryId], 'full_avg')) {
      return true;
    }
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (!cleanLorry) return false;
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    return prevInsps.some(insp => {
      const lorry = (insp.lorryNumber || '').trim().toUpperCase();
      return lorry === cleanLorry && hasStageInStages(insp.samplingStages, 'full_avg');
    });
  };

  const isBalancedLotDisabled = (entryId: string) => {
    if (isStageLockedForLot(entryId, 'balanced_lot')) {
      return true;
    }
    const entry = getEntryById(entryId);
    
    // Loose entries need full_avg to be submitted/approved before balanced_lot can be added, OR the bag limit is reached (New Crop only)
    if (isLooseEntry(entryId)) {
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
      const progress = inspectionProgress[entryId];
      if (isNewCrop && progress && progress.totalBags > 0 && progress.inspectedBags >= progress.totalBags) {
        return false; // Enable if max bags reached in New Crop
      }
      const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
      const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
      const hasFullAvg = hasStageInStages(samplingStageData[entryId], 'full_avg') || 
                         prevInsps.some(insp => (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry && hasStageInStages(insp.samplingStages, 'full_avg'));
      return !hasFullAvg;
    }

    // Bagged requires submitted full_avg (not necessarily approved, unless on hold)
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const hasFullAvg = hasStageInStages(samplingStageData[entryId], 'full_avg') || 
                       prevInsps.some(insp => (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry && hasStageInStages(insp.samplingStages, 'full_avg'));
    if (!hasFullAvg) {
      return true;
    }

    // Midnight expiry check (applies to both Old and New Crop)
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

    const holdInfo = getStageHoldInfo(entryId, stageKey);
    if (holdInfo.latestStatus === 'hold' && holdInfo.count < 4) {
      return false; // Under hold and limit of 4 attempts -> not locked!
    }

    if (samplingStageData[entryId]?.[stageKey]?.isLocked) {
      return true;
    }
    const prevInsps = inspectionProgress[entryId]?.previousInspections || [];
    const cleanLorry = (inspectionData[entryId]?.lorryNumber || '').trim().toUpperCase();
    if (stageKey === 'lot_avg') {
      const entry = getEntryById(entryId);
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
      if (isNewCrop) {
        if (cleanLorry) {
          return prevInsps.some(insp => {
            const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
            return lorryMatch && hasStageInStages(insp.samplingStages, 'lot_avg');
          });
        }
        return prevInsps.some(insp => {
          const lorry = (insp.lorryNumber || '').trim().toUpperCase();
          return lorry === 'LOT_AVG' && hasStageInStages(insp.samplingStages, 'lot_avg');
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
          hasActiveLotAvg = lotAvgInsps.some(insp => hasStageInStages(insp.samplingStages, 'lot_avg'));
        } else {
          const sortedLorries = [...priorRealLorries].sort((a, b) => getInspectionSortTime(a) - getInspectionSortTime(b));
          const lastRealLorry = sortedLorries[sortedLorries.length - 1];
          const lastRealLorryTime = getInspectionSortTime(lastRealLorry);
          hasActiveLotAvg = lotAvgInsps.some(insp => {
            const lotAvgTime = getInspectionSortTime(insp);
            return lotAvgTime >= lastRealLorryTime && hasStageInStages(insp.samplingStages, 'lot_avg');
          });
        }
        if (hasActiveLotAvg) return true;
      }

      if (isLotAvgRequiredForLorry(entryId, cleanLorry)) {
        if (cleanLorry) {
          const lockedWithCurrentLorry = prevInsps.some(insp => {
            const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
            return lorryMatch && hasStageInStages(insp.samplingStages, stageKey);
          });
          if (lockedWithCurrentLorry) return true;
        }
        return false;
      }

      const lockedWithCurrentLorry = prevInsps.some(insp => {
        const lorryMatch = (insp.lorryNumber || '').trim().toUpperCase() === cleanLorry;
        return lorryMatch && hasStageInStages(insp.samplingStages, stageKey);
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
            return l === 'LOT_AVG' && hasStageInStages(insp.samplingStages, 'lot_avg');
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

  const isTripMissingBalancedLotRestrictive = (trip: any, rulesMode: string, entry?: any) => {
    const lorry = (trip.lorryNumber || '').trim().toUpperCase();
    if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
    
    const stages = trip.samplingStages || {};
    const isNewCrop = rulesMode === 'new' && !checkIfWbVariety(entry);
    const hasFullAvg = isNewCrop
      ? Object.keys(stages).some(key => getStageBaseKey(key, stages[key]) === 'full_avg' && stages[key]?.reportedBy)
      : isStageApprovedInStages(stages, 'full_avg');
      
    const hasBalancedLot = Object.keys(stages).some(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      if (baseKey === 'balanced_lot') {
        const stg = stages[key];
        return stg && (stg.approvalStatus === 'approved' || stg.approvalStatus === 'pending' || stg.approvalStatus === 'rejected' || stg.isSkipped);
      }
      return false;
    });
    
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
    
    const entry = getEntryById(entryId);
    const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
    
    if (!isNewCrop && !isLooseEntry(entryId)) {
      const hasSubmittedAndNotHoldLotAvg = progress.previousInspections.some(insp => {
        if ((insp.lorryNumber || '').trim().toUpperCase() !== 'LOT_AVG') return false;
        const stagesObj = insp.samplingStages || {};
        const lotObj = getStageObjFromStages(stagesObj, 'lot_avg');
        return lotObj.reportedBy && lotObj.approvalStatus !== 'hold';
      });
      if (hasSubmittedAndNotHoldLotAvg) {
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

    if (isNewCrop || isLooseEntry(entryId)) {
      const todayStr = new Date().toLocaleDateString('en-GB');
      if (lastLorry && lastLorry.inspectionDate) {
        const lastLorryDateStr = new Date(lastLorry.inspectionDate).toLocaleDateString('en-GB');
        if (todayStr !== lastLorryDateStr) {
          return true;
        }
      }
      const lotAvgTrip = progress.previousInspections.find(insp => (insp.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
      if (lotAvgTrip) {
        const stagesObj = lotAvgTrip.samplingStages || {};
        const lotObj = getStageObjFromStages(stagesObj, 'lot_avg');
        if (lotObj.approvalStatus === 'hold') {
          return true;
        }
      }
      return false;
    }

    const currentLorryDate = inspectionData[entryId]?.inspectionDate || new Date().toISOString().split('T')[0];
    const lastLorryDate = lastLorry?.inspectionDate ? new Date(lastLorry.inspectionDate).toISOString().split('T')[0] : '';
    const isSameDay = lastLorryDate === currentLorryDate;

    if (isSameDay) {
      return false;
    }

    const stages = lastLorry?.samplingStages || {};
    const isPreviousBalanced = stages.balanced_lot?.approvalStatus === 'approved' || stages.balanced_lot?.approvalStatus === 'skipped' || !!stages.balanced_lot?.isSkipped;

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

  const checkIfWbVariety = (entry?: any) => {
    if (!entry) return false;
    
    // Mill and Location samples in New Crop must follow Old Crop rules
    const type = entry.entryType || '';
    const isLocationSample = type === 'LOCATION_SAMPLE';
    const isMillSample = ['CREATE_NEW', 'READY_LORRY', 'DIRECT_LOADED_VEHICLE', 'NEW_PADDY_SAMPLE'].includes(type);
    if (isLocationSample || isMillSample) return true;

    // Check variety
    const variety = entry.variety || '';
    const normalizedVariety = String(variety).replace(/\s+/g, '').toLowerCase();
    const isWbVariety = normalizedVariety === 'pd/wb' || normalizedVariety === 'pdwb' || normalizedVariety === 'md/wb' || normalizedVariety === 'mdwb' ||
                        normalizedVariety === 'pd/loose' || normalizedVariety === 'pdloose' || normalizedVariety === 'md/loose' || normalizedVariety === 'mdloose';
    if (isWbVariety) return true;

    // Check offering rate type
    const baseRateType = entry.offering?.baseRateType || '';
    const finalBaseRateType = entry.offering?.finalBaseRateType || '';
    const normalizedRateType = String(finalBaseRateType || baseRateType).replace(/\s+/g, '').replace(/_/g, '/').toLowerCase();
    
    return normalizedRateType === 'pd/wb' || normalizedRateType === 'pdwb' || normalizedRateType === 'md/wb' || normalizedRateType === 'mdwb' ||
           normalizedRateType === 'pd/loose' || normalizedRateType === 'pdloose' || normalizedRateType === 'md/loose' || normalizedRateType === 'mdloose';
  };

  const getRulesMode = (entryId: string) => {
    const progress = inspectionProgress[entryId];
    if (progress && progress.samplingRulesMode) {
      return progress.samplingRulesMode;
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
      const stageObj = stages[key];
      if (key.includes('_hold_') || stageObj?.approvalStatus === 'hold') {
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
    const entry = getEntryById(entryId);
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
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
      if (!isNewCrop && !isLooseEntry(entryId)) {
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
          smellHas: (getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry)) ? 'Yes' : 'No',
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
      // Allow adding extra bags without restriction
      const actualBags = Number(stageVal.actualBags);
      stageVal.actualBags = actualBags;
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

  const handleUpdateStage = async (entryId: string, stage: string) => {
    if (isSaving[entryId]) return;

    const progress = inspectionProgress[entryId];
    if (!progress) {
      showNotification('Inspection progress not found', 'error');
      return;
    }

    const targetTripId = inspectionData[entryId]?.tripId;
    let trip = targetTripId ? progress.previousInspections?.find(t => t.id === targetTripId) : null;

    if (!trip) {
      trip = progress.previousInspections?.find(t => {
        const stagesObj = t.samplingStages || {};
        return !!stagesObj[stage];
      });
    }

    if (!trip || !trip.id) {
      showNotification('Inspection trip record not found for editing', 'error');
      return;
    }

    const data = inspectionData[entryId];
    const stageVal = samplingStageData[entryId]?.[stage];
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

    try {
      setIsSaving(prev => ({ ...prev, [entryId]: true }));
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('inspectionDate', data?.inspectionDate || trip.inspectionDate || new Date().toISOString().split('T')[0]);
      formData.append('lorryNumber', (data?.lorryNumber || '').trim().toUpperCase() || trip.lorryNumber);
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
      formData.append('remarks', data?.remarks || '');

      if (stage === 'full_avg') {
        formData.append('actualBags', stageVal.actualBags || '0');
      }

      if (stage.startsWith('nit_avg')) {
        formData.append('nit', stageVal.nit || '');
      }

      if (stageVal.stageImage instanceof File) {
        formData.append('stageImage', stageVal.stageImage);
      }

      await axios.put(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${trip.id}/stage/${stage}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      showNotification(`${stage.toUpperCase().replace('_', ' ')} updated successfully`, 'success');

      setEditingStage(prev => ({ ...prev, [entryId]: null }));

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

      setSelectedEntry(null);
      setActiveCards(prev => ({
        ...prev,
        [entryId]: []
      }));

      await loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || `Failed to update ${stage}`, 'error');
    } finally {
      setIsSaving(prev => ({ ...prev, [entryId]: false }));
    }
  };

  const handleEditStageFromDetail = (entryId: string, lorryNumber: string, stageKey: string) => {
    setDetailModalEntry(null);

    const progress = inspectionProgress[entryId];
    if (!progress || !progress.previousInspections) return;

    const trip = progress.previousInspections.find(
      t => (t.lorryNumber || '').trim().toUpperCase() === lorryNumber.trim().toUpperCase()
    );
    if (!trip) return;

    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        tripId: trip.id,
        inspectionDate: trip.inspectionDate || new Date().toISOString().split('T')[0],
        lorryNumber: trip.lorryNumber || '',
        remarks: ''
      }
    }));

    setSelectedStage(prev => ({
      ...prev,
      [entryId]: stageKey
    }));

    const stages = trip.samplingStages || {};
    const newStageData: any = {};
    Object.keys(stages).forEach(key => {
      const dbStage = stages[key] || {};
      newStageData[key] = {
        moisture: zeroToEmpty(dbStage.moisture),
        dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
        dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
        grainsCount: zeroToEmpty(dbStage.grainsCount),
        cutting: formatCuttingForUI(dbStage.cutting1, dbStage.cutting2),
        bend: formatBendForUI(dbStage.bend1, dbStage.bend2),
        mix: zeroToEmpty(dbStage.mix),
        smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
        mixS: zeroToEmpty(dbStage.mixS || dbStage.mix_s),
        lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
        mixL: zeroToEmpty(dbStage.mixL || dbStage.mix_l),
        sk: zeroToEmpty(dbStage.sk),
        kandu: zeroToEmpty(dbStage.kandu),
        oil: zeroToEmpty(dbStage.oil),
        smellHas: dbStage.smellHas ? 'Yes' : 'No',
        smellType: dbStage.smellType || '',
        paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
        paddyWb: zeroToEmpty(dbStage.paddyWb),
        paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
        paddyColor: dbStage.paddyColor || '',
        kadiga: dbStage.kadiga || '',
        actualBags: dbStage.actualBags !== undefined && dbStage.actualBags !== null ? dbStage.actualBags.toString() : (dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : ''),
        nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
        imageUrl: dbStage.imageUrl || null,
        reportedBy: dbStage.reportedBy || 'System',
        approvalStatus: dbStage.approvalStatus || 'approved',
        isLocked: true
      };
    });

    setSamplingStageData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        ...newStageData
      }
    }));

    setActiveCards(prev => ({
      ...prev,
      [entryId]: [stageKey]
    }));

    setSelectedEntry(entryId);

    setEditingStage(prev => ({
      ...prev,
      [entryId]: stageKey
    }));
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

  const handleRevertSkip = async (entryId: string, inspectionId: string, stageKey: string) => {
    if (!window.confirm('Are you sure you want to retrieve this skip? This will allow adding balanced lot sampling data again.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/revert-skip-stage`,
        { stage: stageKey },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      showNotification('Stage skip retrieved successfully', 'success');
      await loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to retrieve skip', 'error');
    }
  };

  const initializeInspectionData = (entryId: string) => {
    // Check if there is an incomplete trip to resume
    const progress = inspectionProgress[entryId];
    let incompleteTrip = null;
    let nextStage = 'lot_avg';
    
    const entry = getEntryById(entryId);
    const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
    if (progress && progress.previousInspections && progress.previousInspections.length > 0) {
      incompleteTrip = progress.previousInspections.find(trip => {
        const lorry = (trip.lorryNumber || '').trim().toUpperCase();
        if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
        
        const stages = trip.samplingStages || {};
        const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                               stages.balanced_lot?.approvalStatus === 'skipped' ||
                               !!stages.balanced_lot?.isSkipped;
        if (isTripComplete) return false;

        const hasApprovedFullAvg = isStageApprovedInStages(stages, 'full_avg');
        
        // In New Crop, only pending lot_avg or balanced_lot blocks user progress.
        const hasPending = Object.keys(stages).some(k => {
          const baseKey = getStageBaseKey(k, stages[k]);
          if (isNewCrop) {
            return ['lot_avg', 'balanced_lot'].includes(baseKey) && stages[k]?.approvalStatus === 'pending';
          }
          return stages[k]?.approvalStatus === 'pending';
        });
        
        const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip, getRulesMode(entryId), entry);
        
        if (isNewCrop) {
          // In New Crop, a trip is incomplete only if it has NOT got an approved full_avg, OR it has pending stages.
          // We do NOT resume the trip if it is only missing Balanced Lot (we handle that via the trip list actions instead).
          const hasApprovedFullAvg = isStageApprovedInStages(stages, 'full_avg');
          return !hasApprovedFullAvg || hasPending;
        }
        
        return !hasApprovedFullAvg || hasPending || isMissingBalanced;
      });
      
      if (incompleteTrip) {
        const stages = incompleteTrip.samplingStages || {};
        
        // Filter pendingStageKey for New Crop: ignore pending half_lorry/full_avg
        const pendingStageKey = Object.keys(stages).find(k => {
          const baseKey = getStageBaseKey(k, stages[k]);
          if (isNewCrop) {
            return ['lot_avg', 'balanced_lot'].includes(baseKey) && stages[k]?.approvalStatus === 'pending';
          }
          return stages[k]?.approvalStatus === 'pending';
        });
        
        if (pendingStageKey) {
          nextStage = getStageBaseKey(pendingStageKey, stages[pendingStageKey]);
        } else {
          // Determine logical next stage based on what's missing or pending
          if (isNewCrop) {
            const isLotApproved = isStageApprovedInStages(stages, 'lot_avg');
            const hasHalf = hasStageInStages(stages, 'half_lorry');
            const hasFull = hasStageInStages(stages, 'full_avg');
            const hasBalanced = hasStageInStages(stages, 'balanced_lot');

            if (isLotApproved && !hasHalf) {
              nextStage = 'half_lorry';
            } else if (hasHalf && !hasFull) {
              nextStage = 'full_avg';
            } else if (hasFull && !hasBalanced) {
              nextStage = 'balanced_lot';
            }
          } else {
            const lotStage = stages.lot_avg || {};
            const nitStage = stages.nit_avg || {};
            const halfStage = stages.half_lorry || {};
            const fullStage = stages.full_avg || {};
            
            if (isLooseEntry(entryId)) {
              if (lotStage.approvalStatus === 'approved') {
                const hasHalf = !!halfStage.reportedBy;
                const hasFull = !!fullStage.reportedBy;
                if (!hasHalf && !hasFull) {
                  nextStage = 'full_avg';
                } else {
                  nextStage = 'balanced_lot';
                }
              } else {
                nextStage = 'lot_avg';
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
          moisture: zeroToEmpty(dbStage.moisture),
          dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
          dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
          grainsCount: zeroToEmpty(dbStage.grainsCount),
          cutting: formatCuttingForUI(dbStage.cutting1, dbStage.cutting2),
          bend: formatBendForUI(dbStage.bend1, dbStage.bend2),
          mix: zeroToEmpty(dbStage.mix),
          smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
          mixS: zeroToEmpty(dbStage.mixS || dbStage.mix_s),
          lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
          mixL: zeroToEmpty(dbStage.mixL || dbStage.mix_l),
          sk: zeroToEmpty(dbStage.sk),
          kandu: zeroToEmpty(dbStage.kandu),
          oil: zeroToEmpty(dbStage.oil),
          smellHas: dbStage.smellHas ? 'Yes' : 'No',
          smellType: dbStage.smellType || '',
          paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
          paddyWb: zeroToEmpty(dbStage.paddyWb),
          paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
          paddyColor: dbStage.paddyColor || '',
          kadiga: dbStage.kadiga || '',
          actualBags: dbStage.actualBags !== undefined && dbStage.actualBags !== null ? dbStage.actualBags.toString() : (dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : ''),
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
        const entry = getEntryById(entryId);
        const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
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
    const progress = inspectionProgress[entryId];
    const trip = progress?.previousInspections?.find(
      t => (t.lorryNumber || '').trim().toUpperCase() === cleanLorry
    );
    const tripId = trip ? trip.id : '';
    
    // If date has changed, allow resuming/editing the trip (date check disabled)
    
    // Set inspection entry form state
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        tripId: tripId,
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
        moisture: zeroToEmpty(dbStage.moisture),
        dryMoisture: dbStage.dryMoisture ? 'Y' : 'N',
        dryMoistureValue: dbStage.dryMoistureRaw || (dbStage.dryMoisture !== null && dbStage.dryMoisture !== undefined ? dbStage.dryMoisture.toString() : ''),
        grainsCount: zeroToEmpty(dbStage.grainsCount),
        cutting: formatCuttingForUI(dbStage.cutting1, dbStage.cutting2),
        bend: formatBendForUI(dbStage.bend1, dbStage.bend2),
        mix: zeroToEmpty(dbStage.mix),
        smixEnabled: dbStage.smixEnabled ? 'Y' : 'N',
        mixS: zeroToEmpty(dbStage.mixS || dbStage.mix_s),
        lmixEnabled: dbStage.lmixEnabled ? 'Y' : 'N',
        mixL: zeroToEmpty(dbStage.mixL || dbStage.mix_l),
        sk: zeroToEmpty(dbStage.sk),
        kandu: zeroToEmpty(dbStage.kandu),
        oil: zeroToEmpty(dbStage.oil),
        smellHas: dbStage.smellHas ? 'Yes' : 'No',
        smellType: dbStage.smellType || '',
        paddyWbEnabled: dbStage.paddyWbEnabled ? 'Y' : 'N',
        paddyWb: zeroToEmpty(dbStage.paddyWb),
        paddyColorEnabled: dbStage.paddyColorEnabled ? 'Y' : 'N',
        paddyColor: dbStage.paddyColor || '',
        kadiga: dbStage.kadiga || '',
        actualBags: dbStage.actualBags !== undefined && dbStage.actualBags !== null ? dbStage.actualBags.toString() : (dbStage.bags !== null && dbStage.bags !== undefined ? dbStage.bags.toString() : ''),
        nit: dbStage.nit !== null && dbStage.nit !== undefined ? dbStage.nit.toString() : '',
        imageUrl: dbStage.imageUrl || null,
        reportedBy: dbStage.reportedBy || 'System',
        approvalStatus: dbStage.approvalStatus || 'approved',
        isLocked: true
      };
    });

    // Determine next stage
    const holdStageKey = Object.keys(stages || {}).find(key => 
      isWorkflowStageKey(key) && stages[key]?.approvalStatus === 'hold'
    );
    let nextStage = 'lot_avg';
    if (holdStageKey) {
      nextStage = getStageBaseKey(holdStageKey, stages[holdStageKey]);
    } else {
      const lotStage = stages.lot_avg || {};
      const nitStage = stages.nit_avg || {};
      const halfStage = stages.half_lorry || {};
      const fullStage = stages.full_avg || {};
      
      const entry = getEntryById(entryId);
      const isNewCrop = getRulesMode(entryId) === 'new' && !checkIfWbVariety(entry);
      if (!isLotAvgRequiredForLorry(entryId, cleanLorry)) {
        nextStage = isNewCrop ? 'half_lorry' : 'nit_avg';
      }
      
      if (isNewCrop) {
        if (hasHoldOnPreviousDay(stages)) {
          nextStage = 'lot_avg';
        } else if ((isStageApprovedForLot(entryId, 'lot_avg') || !isLotAvgRequiredForLorry(entryId, cleanLorry)) && !isStageApprovedInStages(stages, 'half_lorry')) {
          nextStage = 'half_lorry';
        } else if (isStageApprovedInStages(stages, 'half_lorry') && !isStageApprovedInStages(stages, 'full_avg')) {
          nextStage = 'full_avg';
        } else if (isStageApprovedInStages(stages, 'full_avg') && !isStageApprovedInStages(stages, 'balanced_lot')) {
          nextStage = 'balanced_lot';
        }
      } else {
        const lotStage = stages.lot_avg || {};
        const nitStage = stages.nit_avg || {};
        const halfStage = stages.half_lorry || {};
        const fullStage = stages.full_avg || {};

        if (isLooseEntry(entryId)) {
          if (lotStage.approvalStatus === 'approved' || isStageApprovedForLot(entryId, 'lot_avg')) {
            const hasHalf = !!halfStage.reportedBy;
            const hasFull = !!fullStage.reportedBy;
            if (!hasHalf && !hasFull) {
              nextStage = 'full_avg';
            } else {
              nextStage = 'balanced_lot';
            }
          } else {
            nextStage = 'lot_avg';
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
      }
    }

    // If the next active stage is currently on hold, clear its values in the form state
    // so the supervisor can enter fresh measurements for the next attempt
    if (nextStage && newStageData[nextStage]) {
      const currentStageObj = getStageObjFromStages(stages, nextStage);
      if (currentStageObj?.approvalStatus === 'hold') {
        newStageData[nextStage] = {
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
    }

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
      [entryId]: onlyBalanced ? ['balanced_lot'] : [nextStage]
    }));

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
                  return progress.previousInspections.some(trip => {
                    const stages = trip.samplingStages || {};
                    const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                           stages.balanced_lot?.approvalStatus === 'skipped' ||
                                           !!stages.balanced_lot?.isSkipped;
                    if (isTripComplete) return false;
                    return hasUnresolvedPendingOrHold(stages);
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
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{entry.brokerName}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}><div
        onClick={() => setDetailModalEntry(entry)}
        style={{ fontWeight: '700', color: '#1565c0', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline', wordBreak: 'break-word', overflowWrap: 'break-word' }}
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
                                width: `${entry.lotAllotment?.closedAt ? 100 : Math.min(100, progressPercentage)}%`,
                                backgroundColor: entry.lotAllotment?.closedAt ? '#7f8c8d' : getProgressColor(progressPercentage),
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '35px' }}>
                              {entry.lotAllotment?.closedAt ? 'Closed' : `${progressPercentage.toFixed(0)}%`}
                            </span>
                          </div>
                          {(() => {
                            const activeStatusObj = (() => {
                              if (!progress || !progress.previousInspections) return null;
                              for (const trip of [...progress.previousInspections].reverse()) {
                                const stages = trip.samplingStages || {};
                                const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                                       stages.balanced_lot?.approvalStatus === 'skipped' ||
                                                       !!stages.balanced_lot?.isSkipped;
                                if (isTripComplete) continue;
                                
                                for (const key of Object.keys(stages).filter(isWorkflowStageKey)) {
                                  const stg = stages[key];
                                  if (stg?.approvalStatus === 'hold') {
                                    const baseKey = getStageBaseKey(key, stg);
                                    if (!isStageApprovedInStages(stages, baseKey) && !isStagePendingInStages(stages, baseKey)) {
                                      return { text: `Hold: ${getStageDisplayLabel(baseKey, stg)}`, color: '#d97706' };
                                    }
                                  }
                                }
                                
                                for (const key of Object.keys(stages).filter(isWorkflowStageKey)) {
                                  const stg = stages[key];
                                  if (stg?.approvalStatus === 'pending') {
                                    const baseKey = getStageBaseKey(key, stg);
                                    return { text: `Pending: ${getStageDisplayLabel(baseKey, stg)}`, color: '#2563eb' };
                                  }
                                }
                              }
                              return null;
                            })();

                            if (!activeStatusObj) return null;

                            return (
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: '2px'
                              }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: '800', 
                                  color: activeStatusObj.color,
                                  backgroundColor: activeStatusObj.color === '#d97706' ? '#fffbeb' : '#eff6ff',
                                  border: `1px solid ${activeStatusObj.color === '#d97706' ? 'rgba(217,119,6,0.2)' : 'rgba(37,99,235,0.2)'}`,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  textAlign: 'center',
                                  width: '100%',
                                  boxSizing: 'border-box'
                                }}>
                                  {activeStatusObj.text}
                                </span>
                              </div>
                            );
                          })()}
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
                              isTripMissingBalancedLotRestrictive(trip, getRulesMode(entry.id), entry)
                            );
                          })();

                          // Check if there is any unresolved pending or hold stage across trips
                          const hasPendingStage = (() => {
                            if (!progress || !progress.previousInspections) return false;
                            return progress.previousInspections.some(trip => {
                              const stages = trip.samplingStages || {};
                              const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                                     stages.balanced_lot?.approvalStatus === 'skipped' ||
                                                     !!stages.balanced_lot?.isSkipped;
                              if (isTripComplete) return false;
                              return hasUnresolvedPendingOrHold(stages);
                            });
                          })();

                          // Check if there is an active hold stage on any incomplete trip
                          const hasActiveHold = (() => {
                            if (!progress || !progress.previousInspections) return false;
                            return progress.previousInspections.some(trip => {
                              const stages = trip.samplingStages || {};
                              const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                                     stages.balanced_lot?.approvalStatus === 'skipped' ||
                                                     !!stages.balanced_lot?.isSkipped;
                              if (isTripComplete) return false;
                              return Object.keys(stages).some(key => {
                                if (key === 'holdHistory') return false;
                                const stg = stages[key];
                                if (stg?.approvalStatus === 'hold') {
                                  const baseKey = getStageBaseKey(key, stg);
                                  return !isStageApprovedInStages(stages, baseKey);
                                }
                                return false;
                              });
                            });
                          })();

                          // Check if any pending stage blocks the next step
                          const hasBlockedPendingStage = (() => {
                            if (!progress || !progress.previousInspections) return false;
                            const isNewCropLoose = getRulesMode(entry.id) === 'new' && isLooseEntry(entry.id);
                            return progress.previousInspections.some(trip => {
                              const stages = trip.samplingStages || {};
                              const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                                     stages.balanced_lot?.approvalStatus === 'skipped' ||
                                                     !!stages.balanced_lot?.isSkipped;
                              if (isTripComplete) return false;
                              
                              if (isNewCropLoose) {
                                // New Crop loose: only lot_avg and balanced_lot pending blocks
                                return stages.lot_avg?.approvalStatus === 'pending' || 
                                       stages.balanced_lot?.approvalStatus === 'pending';
                              }
                              // Old Crop / non-loose: ANY pending stage blocks
                              return Object.keys(stages).some(key => {
                                if (key === 'holdHistory') return false;
                                const stg = stages[key];
                                return stg?.approvalStatus === 'pending';
                              });
                            });
                          })();

                          const isMaxBagsReached = (() => {
                             if (!progress) return false;
                             const isLoose = isLooseEntry(entry.id);
                             return isLoose && progress.totalBags > 0 && progress.inspectedBags >= progress.totalBags;
                           })();

                          const isDisabled = !!entry.lotAllotment?.closedAt || (isMissingBalancedAcrossTrips && !isMaxBagsReached) || hasActiveHold || hasBlockedPendingStage;

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
                                if (hasActiveHold) return 'Hold';
                                if (hasBlockedPendingStage) return 'Awaiting Approval';
                                if (isMissingBalancedAcrossTrips) return 'Pending Balanced Lot';
                                if (selectedEntry === entry.id) return 'Editing...';
                                
                                const hasIncompleteTrip = (() => {
                                  const progress = inspectionProgress[entry.id];
                                  if (!progress || !progress.previousInspections) return false;
                                  return progress.previousInspections.some(trip => {
                                    const lorry = (trip.lorryNumber || '').trim().toUpperCase();
                                    if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
                                    const stages = trip.samplingStages || {};
                                    const isTripComplete = stages.balanced_lot?.approvalStatus === 'approved' ||
                                                           stages.balanced_lot?.approvalStatus === 'skipped' ||
                                                           !!stages.balanced_lot?.isSkipped;
                                    if (isTripComplete) return false;
                                    const hasApprovedFullAvg = stages.full_avg && stages.full_avg.approvalStatus === 'approved';
                                    const hasPending = Object.values(stages).some((stg: any) => stg.approvalStatus === 'pending');
                                    const isMissingBalanced = isTripMissingBalancedLotRestrictive(trip, getRulesMode(entry.id), entry);
                                    return !hasApprovedFullAvg || hasPending || isMissingBalanced;
                                  });
                                })();
                                
                                const hasApprovedLotAvg = (() => {
                                  const progress = inspectionProgress[entry.id];
                                  if (!progress || !progress.previousInspections) return false;
                                  return progress.previousInspections.some(trip => {
                                    const lorry = (trip.lorryNumber || '').trim().toUpperCase();
                                    const stages = trip.samplingStages || {};
                                    return lorry === 'LOT_AVG' && (isStageApprovedInStages(stages, 'lot_avg') || trip.cutting1 !== undefined);
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
                                  const isNewCrop = getRulesMode(entry.id) === 'new' && !checkIfWbVariety(entry);
                                    
                                  const getValueWithFallback = (field: 'moisture' | 'cutting' | 'bend', currentIdx: number) => {
                                     // Get the current trip's lorry number for same-lorry fallback matching
                                     const currentLorry = (progress.previousInspections[currentIdx]?.lorryNumber || '').trim().toUpperCase();
                                     
                                     // Check if any previous trip (before currentIdx) has the same lorry number
                                     const hasSameLorryPrevious = progress.previousInspections.some((insp: any, i: number) => 
                                       i < currentIdx && (insp.lorryNumber || '').trim().toUpperCase() === currentLorry
                                     );
                                     
                                     // Helper to collect stages from an inspection
                                     const collectStages = (insp: any) => {
                                       const stgList = insp.samplingStages || {};
                                       const stagesToCheck: any[] = [];
                                       const balancedLotKey = Object.keys(stgList).find(key => key === 'balanced_lot' || key.startsWith('balanced_lot_hold_'));
                                       const balancedLotStage = balancedLotKey ? stgList[balancedLotKey] : null;
                                       if (balancedLotStage?.reportedBy) stagesToCheck.push(balancedLotStage);
                                       const fullAvgKey = Object.keys(stgList).find(key => key === 'full_avg' || key.startsWith('full_avg_hold_'));
                                       const fullAvgStage = fullAvgKey ? stgList[fullAvgKey] : null;
                                       if (fullAvgStage?.reportedBy) stagesToCheck.push(fullAvgStage);
                                       const halfLorryKey = Object.keys(stgList).find(key => key === 'half_lorry' || key.startsWith('half_lorry_hold_'));
                                       const halfLorryStage = halfLorryKey ? stgList[halfLorryKey] : null;
                                       if (halfLorryStage?.reportedBy) stagesToCheck.push(halfLorryStage);
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
                                     
                                     // Helper to extract non-zero value from a stage
                                     const extractNonZero = (stg: any) => {
                                       if (!stg) return null;
                                       if (field === 'moisture') {
                                         const mRaw = String(stg.moistureRaw || '').trim();
                                         const mVal = String(stg.moisture || '').trim();
                                         if (mRaw && mRaw !== '0' && mRaw !== '0%' && mRaw !== '0.00' && mRaw !== '0.0' && mRaw !== '-') return `${mRaw}%`;
                                         if (mVal && mVal !== '0' && mVal !== '0%' && mVal !== '0.00' && mVal !== '0.0' && mVal !== '-' && mVal !== '') return `${mVal}%`;
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
                                     
                                     // Helper to extract any value (even zero) for cutting/bend
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

                                   let moistureVal = getValueWithFallback('moisture', idx);
                                   let cuttingVal = getValueWithFallback('cutting', idx);
                                   let bendVal = getValueWithFallback('bend', idx);

                                  const o = (entry as any).offering || {};

                                   // Calculate trip-level smell highlighting (ignore balanced lot smell on outer trip row)
                                   let hasTripSmell = false;
                                   let tripSmellType = '';
                                   if (stages) {
                                     for (const [key, stageObj] of Object.entries(stages) as any[]) {
                                       if (key.toLowerCase().includes('balanced_lot')) continue;
                                       if (stageObj && (stageObj.smellHas === true || String(stageObj.smellHas).trim().toUpperCase() === 'YES')) {
                                         hasTripSmell = true;
                                         const typeNormalized = String(stageObj.smellType || '').trim().toUpperCase();
                                         if (typeNormalized === 'DARK') {
                                           tripSmellType = 'DARK';
                                         } else if (typeNormalized === 'MEDIUM' && tripSmellType !== 'DARK') {
                                           tripSmellType = 'MEDIUM';
                                         } else if (typeNormalized === 'LIGHT' && tripSmellType !== 'DARK' && tripSmellType !== 'MEDIUM') {
                                           tripSmellType = 'LIGHT';
                                         }
                                       }
                                     }
                                   }

                                   let rowStyle: React.CSSProperties = { borderBottom: '1px solid #000' };
                                   if (hasTripSmell) {
                                     if (tripSmellType === 'DARK') {
                                       rowStyle.backgroundColor = '#b91c1c';
                                       rowStyle.color = '#ffffff';
                                     } else if (tripSmellType === 'MEDIUM') {
                                       rowStyle.backgroundColor = '#fca5a5';
                                       rowStyle.color = '#1a1a1a';
                                     } else if (tripSmellType === 'LIGHT') {
                                       rowStyle.backgroundColor = '#fee2e2';
                                       rowStyle.color = '#1a1a1a';
                                     } else {
                                       rowStyle.backgroundColor = '#fee2e2';
                                       rowStyle.color = '#1a1a1a';
                                     }
                                   }

                                 return (
                                   <tr key={inspection.id} style={rowStyle}>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{idx + 1}</td>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                       {new Date(inspection.inspectionDate).toLocaleDateString('en-GB')}
                                     </td>
                                     <td style={{ border: '1px solid #000', padding: '6px', fontWeight: '700' }}>
                                       <span
                                         onClick={() => setSelectedLorryForComparison({ entryId: entry.id, lorryNumber: inspection.lorryNumber, previousInspections: [inspection], lotAllotment: entry.lotAllotment, singleLorryMode: true, loadNumber: idx + 1 })}
                                         style={{ color: tripSmellType === 'DARK' ? '#ffffff' : '#1565c0', textDecoration: 'underline', cursor: 'pointer' }}
                                       >
                                         {inspection.lorryNumber?.toUpperCase()}
                                       </span>
                                     </td>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{getStageObjFromStages(stages, 'full_avg')?.actualBags || inspection.bags || '-'}</td>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600', color: tripSmellType === 'DARK' ? '#ffffff' : '#000000' }}>{moistureVal}</td>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{cuttingVal}</td>
                                     <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>{bendVal}</td>
                                     <td style={{ border: '1px solid #000', padding: '6px' }}>{inspection.reportedBy?.username || '-'}</td>
                                     <td style={{ 
                                        border: '1px solid #000', 
                                        padding: '6px', 
                                        textAlign: 'center', 
                                        fontWeight: '700', 
                                        color: getSamplingStatusAndColor(stages, tripSmellType === 'DARK').color
                                      }}>
                                        {getSamplingStatusAndColor(stages, tripSmellType === 'DARK').text}
                                      </td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                      {(() => {
                                        const stages = inspection.samplingStages || {};
                                        const hasLotAvg = hasStageInStages(stages, 'lot_avg');
                                        const hasHalf = hasStageInStages(stages, 'half_lorry');
                                        const balancedLotStage = getStageObjFromStages(stages, 'balanced_lot');
                                        const hasBalanced = Object.keys(balancedLotStage).length > 0;
                                        const hasFull = hasStageInStages(stages, 'full_avg');
                                        const isEligibleForBalanced = isFullAvgEligibleForBalanced(stages, entry.id);
                                        const hasFullApproved = isStageApprovedInStages(stages, 'full_avg');

                                        // If dummy LOT_AVG trip
                                        const isLorryLotAvg = (inspection.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG';
                                        
                                        let statusElement: any = null;

                                        if (isLorryLotAvg) {
                                          const lotAvgStage = getStageObjFromStages(stages, 'lot_avg');
                                          const isLotAvgHold = lotAvgStage?.approvalStatus === 'hold';
                                          
                                          if (isLotAvgHold) {
                                            const holdInfo = getStageHoldInfo(entry.id, 'lot_avg');
                                            if (holdInfo.count < 4) {
                                              statusElement = (
                                                <button
                                                  onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
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
                                                  Add Lot Avg
                                                </button>
                                              );
                                            } else {
                                              statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Lot Avg: Hold (Max Attempts)</span>;
                                            }
                                          } else {
                                            const hasPendingStages = hasUnresolvedPendingOrHold(stages);
                                            if (hasPendingStages) {
                                              statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                            } else if (isStageApprovedInStages(stages, 'lot_avg')) {
                                              statusElement = <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                            }
                                          }
                                        } else if (hasBalanced && balancedLotStage) {
                                          if (isStageApprovedInStages(stages, 'balanced_lot')) {
                                            statusElement = <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                          } else if (balancedLotStage.isSkipped) {
                                            statusElement = (
                                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ color: '#7f8c8d', fontWeight: 'bold', fontSize: '11px' }}>Skipped</span>
                                                {['admin', 'owner', 'manager'].includes(String(user?.role || '').toLowerCase()) && (
                                                  <button
                                                    onClick={() => handleRevertSkip(entry.id, inspection.id, 'balanced_lot')}
                                                    style={{
                                                      backgroundColor: '#8b5cf6',
                                                      color: '#ffffff',
                                                      border: 'none',
                                                      borderRadius: '3px',
                                                      padding: '3px 8px',
                                                      fontSize: '10px',
                                                      fontWeight: 'bold',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    Retrieve Skip
                                                  </button>
                                                )}
                                              </div>
                                            );
                                          } else if (balancedLotStage.approvalStatus === 'pending') {
                                            statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Balanced Lot: Pending</span>;
                                          } else if (balancedLotStage.approvalStatus === 'rejected') {
                                            statusElement = <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '11px' }}>Rejected</span>;
                                          } else if (balancedLotStage.approvalStatus === 'hold') {
                                            const holdInfo = getStageHoldInfo(entry.id, 'balanced_lot');
                                            if (holdInfo.count < 4) {
                                              statusElement = (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                                  <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Balanced Lot: Hold</span>
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
                                                </div>
                                              );
                                            } else {
                                              statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Balanced Lot: Hold (Max Attempts)</span>;
                                            }
                                          } else {
                                            statusElement = <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                          }
                                        } else {
                                          const isNewCrop = getRulesMode(entry.id) === 'new' && !checkIfWbVariety(entry);
                                          
                                          if (isEligibleForBalanced && !hasBalanced) {
                                            if (isNewCrop || isLooseEntry(entry.id)) {
                                              statusElement = (
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
                                              const todayStr = new Date().toLocaleDateString('en-CA');
                                              const isToday = inspection.inspectionDate && inspection.inspectionDate.split('T')[0] === todayStr;
                                              if (isToday) {
                                                statusElement = (
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

                                          if (!statusElement) {
                                            const fullAvgStage = getStageObjFromStages(stages, 'full_avg');
                                            if (fullAvgStage?.approvalStatus === 'hold') {
                                              const holdInfo = getStageHoldInfo(entry.id, 'full_avg');
                                              if (holdInfo.count < 4) {
                                                statusElement = (
                                                  <button
                                                    onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
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
                                                    Add Full Avg
                                                  </button>
                                                );
                                              }
                                            }
                                          }

                                          if (!statusElement) {
                                            const nitAvgStage = getStageObjFromStages(stages, 'nit_avg');
                                            if (nitAvgStage?.approvalStatus === 'hold') {
                                              const holdInfo = getStageHoldInfo(entry.id, 'nit_avg');
                                              if (holdInfo.count < 4) {
                                                statusElement = (
                                                  <button
                                                    onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
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
                                                    Add Nit Avg
                                                  </button>
                                                );
                                              }
                                            }
                                          }

                                          if (!statusElement) {
                                            const halfLorryStage = getStageObjFromStages(stages, 'half_lorry');
                                            if (halfLorryStage?.approvalStatus === 'hold') {
                                              const holdInfo = getStageHoldInfo(entry.id, 'half_lorry');
                                              if (holdInfo.count < 4) {
                                                statusElement = (
                                                  <button
                                                    onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
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
                                                    Add Half Lorry
                                                  </button>
                                                );
                                              }
                                            }
                                          }

                                          if (!statusElement) {
                                            const lotAvgStage = getStageObjFromStages(stages, 'lot_avg');
                                            if (lotAvgStage?.approvalStatus === 'hold') {
                                              const holdInfo = getStageHoldInfo(entry.id, 'lot_avg');
                                              if (holdInfo.count < 4) {
                                                statusElement = (
                                                  <button
                                                    onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, false)}
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
                                                    Add Lot Avg
                                                  </button>
                                                );
                                              }
                                            }
                                          }

                                          if (!statusElement && isNewCrop && hasStageInStages(stages, 'half_lorry') && !hasStageInStages(stages, 'full_avg')) {
                                            const halfLorryStage = getStageObjFromStages(stages, 'half_lorry');
                                            const isHalfPending = halfLorryStage?.approvalStatus === 'pending';
                                            const isHalfApproved = halfLorryStage?.approvalStatus === 'approved';
                                            if (isHalfPending || isHalfApproved) {
                                              statusElement = (
                                                <button
                                                  onClick={() => handleResumeLorry(entry.id, inspection.lorryNumber, stages, inspection.inspectionDate, true)}
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
                                                  Add Full Avg
                                                </button>
                                              );
                                            }
                                          }

                                          if (!statusElement) {
                                            const isTripIncomplete = !isStageApprovedInStages(stages, 'full_avg');
                                            if (isTripIncomplete) {
                                              const hasPendingStages = hasUnresolvedPendingOrHold(stages);
                                              if (hasPendingStages) {
                                                statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>Awaiting Approval</span>;
                                              } else {
                                                statusElement = <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '11px' }}>In Progress</span>;
                                              }
                                            } else {
                                              statusElement = <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '11px' }}>Completed</span>;
                                            }
                                          }
                                        }

                                        return statusElement;
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
                                 {selectedStage[entry.id] !== 'lot_avg' && (
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
                                  )}
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
                                            const isLoose = isLooseEntry(entry.id);
                                            const isDisabled = (freezed && (!isLoose || (item.value !== 'full_avg' && item.value !== 'balanced_lot'))) || item.disabled;
                                            const isLocked = isStageLockedForLot(entry.id, item.value);
                                            const isApproved = isStageApprovedForLot(entry.id, item.value);
                                            const isDone = isLocked || isApproved;
                                            const holdInfo = getStageHoldInfo(entry.id, item.value);
                                            const isOnHold = holdInfo.latestStatus === 'hold';
                                            
                                            let statusLabel = '';
                                            if (isOnHold) {
                                              statusLabel = 'Hold';
                                            } else if (isDone) {
                                              statusLabel = '✓ Done';
                                            } else if (isDisabled && !freezed) {
                                              if (item.value === 'balanced_lot') {
                                                if (isAnyFullAvgSavedOrApproved(entry.id)) {
                                                  const cleanLorry = (inspectionData[entry.id]?.lorryNumber || '').trim().toUpperCase();
                                                  const progress = inspectionProgress[entry.id];
                                                  const currentTrip = progress?.previousInspections?.find(
                                                    (i: any) => (i.lorryNumber || '').trim().toUpperCase() === cleanLorry
                                                  );
                                                  const fullAvgDate = currentTrip?.samplingStages?.full_avg?.reportedAt;
                                                  let isExpired = false;
                                                  if (fullAvgDate) {
                                                    const fDate = new Date(fullAvgDate);
                                                    const today = new Date();
                                                    const fDay = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate());
                                                    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                                    if (tDay > fDay) {
                                                      isExpired = true;
                                                    }
                                                  }
                                                  if (isExpired) {
                                                    statusLabel = 'Expired / Not Added';
                                                  } else {
                                                    statusLabel = 'Locked';
                                                  }
                                                } else {
                                                  statusLabel = 'Locked';
                                                }
                                              } else if (item.value === 'lot_avg') {
                                                const isLockedStg = isStageLockedForLot(entry.id, 'lot_avg');
                                                if (!isLockedStg && !isLotAvgRequiredForLorry(entry.id, (inspectionData[entry.id]?.lorryNumber || '').trim().toUpperCase())) {
                                                  statusLabel = 'Not Required';
                                                }
                                              }
                                            }
                                            const isSelected = (selectedStage[entry.id] || 'lot_avg') === item.value;
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
                                                     color: statusLabel === 'Hold' ? '#d97706' : (statusLabel.startsWith('Expired') ? '#d32f2f' : '#999'), 
                                                     fontWeight: '700' 
                                                   }}>
                                                     {statusLabel}
                                                   </span>
                                                 )}
                                                 {isSelected && !isDisabled && <span style={{ fontSize: '10px', color: '#27ae60', fontWeight: '700' }}>● Selected</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {(() => {
                                          const allStagesCompleted = stageItems.length > 0 && stageItems.every(item => {
                                            const isLocked = isStageLockedForLot(entry.id, item.value);
                                            const isApproved = isStageApprovedForLot(entry.id, item.value);
                                            const holdInfo = getStageHoldInfo(entry.id, item.value);
                                            const isOnHold = holdInfo.latestStatus === 'hold';
                                            return (isLocked || isApproved) && !isOnHold;
                                          });
                                          if (allStagesCompleted) {
                                            return (
                                              <div style={{ color: '#2e7d32', fontWeight: 'bold', textAlign: 'center', padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '6px', border: '1px solid rgba(46, 125, 50, 0.3)', fontSize: '12px', marginTop: '10px', width: '100%' }}>
                                                ✓ All Sampling Stages Completed
                                              </div>
                                            );
                                          }
                                          return (
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
                                                  <option key={item.value} value={item.value} disabled={item.disabled || isStageApprovedForLot(entry.id, item.value) || isStageLockedForLot(entry.id, item.value)}>{item.label}</option>
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
                                          );
                                        })()}
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
                                      smellHas: (getRulesMode(entry.id) === 'new' && !checkIfWbVariety(entry)) ? 'Yes' : 'No',
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
                                    const isLocked = !!cardData.isLocked && editingStage[entry.id] !== stage;
                                    const isNewMode = getRulesMode(entry.id) === 'new' && (!checkIfWbVariety(entry) || isLooseEntry(entry.id));
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
                                                onClick={() => editingStage[entry.id] === stage ? handleUpdateStage(entry.id, stage) : handleSaveStage(entry.id, stage)}
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
                                                {isSaving[entry.id] ? (editingStage[entry.id] === stage ? 'Updating...' : 'Saving...') : (editingStage[entry.id] === stage ? 'Update' : 'Save')}
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (editingStage[entry.id] === stage) {
                                                    setEditingStage(prev => ({ ...prev, [entry.id]: null }));
                                                  }
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
                                                  setEditingStage(prev => ({ ...prev, [entry.id]: stage }));
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '8px',
                                                  backgroundColor: '#e67e22',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  fontWeight: '700',
                                                  cursor: 'pointer',
                                                  fontSize: '11px'
                                                }}
                                              >
                                                Edit Stage
                                              </button>
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
                  const c1 = parseFloat(stageObj.cutting1);
                  const c2 = parseFloat(stageObj.cutting2) || 0;
                  return `${isNaN(c1) || c1 === 0 ? 1 : c1}x${c2}`;
                };

                const formatBend = (stageObj: any) => {
                  if (stageObj.bend1 === undefined || stageObj.bend1 === null) return '-';
                  const b1 = parseFloat(stageObj.bend1);
                  const b2 = parseFloat(stageObj.bend2) || 0;
                  return `${isNaN(b1) || b1 === 0 ? 1 : b1}x${b2}`;
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
                        {(() => {
                          const hasColor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                          const isKadigaYes = stageObj.kadiga === 'Y' || stageObj.kadiga === 'Yes' || stageObj.kadiga === true || stageObj.kadiga === 'true';
                                const isKadigaNo = stageObj.kadiga === 'N' || stageObj.kadiga === 'No' || stageObj.kadiga === false || stageObj.kadiga === 'false';
                                const hasKadiga = isKadigaYes || isKadigaNo;
                          if (!hasColor && !hasKadiga) return '-';
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              {hasColor && <span>{formatField(stageObj.paddyColor)}</span>}
                              {hasColor && hasKadiga && <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />}
                              {hasKadiga && <span>ಕಡಿಗಾ: {isKadigaYes ? 'Yes' : 'No'}</span>}
                            </div>
                          );
                        })()}
                      </td>
                      
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>{isFull ? formatField(stageObj.actualBags || inspection.bags) : '-'}</td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>
                        {(() => {
                          const status = stageObj.approvalStatus || 'approved';
                          const isSkipped = stageObj.isSkipped || status === 'skipped';
                          if (isSkipped) {
                            return <span style={{ color: '#7f8c8d' }}>Skipped</span>;
                          }
                          if (status === 'hold' || status === 'superseded') {
                            return <span style={{ color: '#d97706' }}>Hold</span>;
                          }
                          if (status === 'pending') {
                            return <span style={{ color: '#2563eb' }}>Pending</span>;
                          }
                          return <span style={{ color: '#16a34a' }}>Approved</span>;
                        })()}
                      </td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center' }}>
                        {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                      </td>
                    </tr>
                  );
                };

                const isLorryNotAdded = !inspection.lorryNumber || 
                  ['LOT_AVG', 'BALANCED_LOT'].includes(inspection.lorryNumber.toUpperCase().trim()) ||
                  inspection.lorryNumber.toLowerCase().includes('next loading lorry');

                const actualLoadNumber = selectedLorryForComparison.singleLorryMode && selectedLorryForComparison.loadNumber
                  ? selectedLorryForComparison.loadNumber
                  : idx + 1;
                const tripHeaderLabel = isLorryNotAdded
                  ? <span style={{ color: 'white', fontWeight: '900' }}>Next Loading Lorry Sampling: Lot Avg Sampling or Balance Lot Sampling</span>
                  : actualLoadNumber === 1
                    ? `Load 1 - Loading Sample Details : ${inspection.lorryNumber?.toUpperCase() || ''}`
                    : `Load ${actualLoadNumber} - Lorry Number: ${inspection.lorryNumber?.toUpperCase() || ''}`;

                    const latestFullAvgBags = (() => {
                      const fullAvgStageKeys = Object.keys(stages)
                        .filter(k => getStageBaseKey(k, stages[k]) === 'full_avg' && stages[k]?.reportedBy)
                        .sort((a, b) => {
                          const timeA = new Date(stages[a].reportedAt || stages[a].createdAt || 0).getTime();
                          const timeB = new Date(stages[b].reportedAt || stages[b].createdAt || 0).getTime();
                          return timeB - timeA;
                        });
                      if (fullAvgStageKeys.length > 0) {
                        return stages[fullAvgStageKeys[0]]?.actualBags;
                      }
                      return null;
                    })();

                    return (
                      <div key={inspection.id} style={{ border: '1px solid #f2cfb6', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{tripHeaderLabel} | Bags Loaded: {latestFullAvgBags || inspection.bags || '-'}</span>
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
                            <th style={{ padding: '5px 8px', fontWeight: '800', textAlign: 'center', border: '1px solid #cbd5e1', width: '80px' }}>STATUS</th>
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
                              const baseKey = getStageBaseKey(key, stageObj);
                              const isHold = stageObj.approvalStatus === 'hold';
                              const attemptNo = getStageAttemptNo(stages, key);

                              let displayName = getStageDisplayLabel(baseKey, stageObj);
                              if (isHold) {
                                displayName += ' (Hold)';
                              } else if (attemptNo > 1) {
                                displayName += ` (Attempt ${attemptNo})`;
                              }

                              const name = displayName;
                              const color = isHold ? '#d97706' : '#000000';
                              const bgColor = isHold ? '#fffbeb' : '#ffffff';
                              const isFull = baseKey === 'full_avg';

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
                {selectedStage[entry.id] !== 'lot_avg' && (
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
                )}
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
                            const holdInfo = getStageHoldInfo(entry.id, item.value);
                            const isOnHold = holdInfo.latestStatus === 'hold';
                            
                            let statusLabel = '';
                            if (isOnHold) {
                              statusLabel = 'Hold';
                            } else if (isDone) {
                              statusLabel = '✓ Done';
                            } else if (isDisabled) {
                              if (item.value === 'balanced_lot') {
                                const isNewCrop = getRulesMode(entry.id) === 'new' && !checkIfWbVariety(entry);
                                if (!isNewCrop && isAnyFullAvgSavedOrApproved(entry.id)) {
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
                                    color: statusLabel === 'Hold' ? '#d97706' : (statusLabel.startsWith('Expired') ? '#d32f2f' : '#999'), 
                                    fontWeight: '700' 
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
                  smellHas: (getRulesMode(entry.id) === 'new' && !checkIfWbVariety(entry)) ? 'Yes' : 'No',
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
                const isLocked = !!cardData.isLocked && editingStage[entry.id] !== stage;
                 const isNewMode = getRulesMode(entry.id) === 'new' && (!checkIfWbVariety(entry) || isLooseEntry(entry.id));
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
                        if (appStatus === 'rejected') {
                          return (
                            <span style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              backgroundColor: '#e74c3c',
                              color: 'white',
                              borderRadius: '10px',
                              fontWeight: 'bold'
                            }}>Rejected</span>
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
                            onClick={() => editingStage[entry.id] === stage ? handleUpdateStage(entry.id, stage) : handleSaveStage(entry.id, stage)}
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
                            {isSaving[entry.id] ? (editingStage[entry.id] === stage ? 'Updating...' : 'Saving...') : (editingStage[entry.id] === stage ? 'Update' : 'Save')}
                          </button>
                          <button
                            onClick={() => {
                              if (editingStage[entry.id] === stage) {
                                setEditingStage(prev => ({ ...prev, [entry.id]: null }));
                              }
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
                              setEditingStage(prev => ({ ...prev, [entry.id]: stage }));
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              backgroundColor: '#e67e22',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Edit Stage
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
          onEditStage={(lorryNumber, stageKey) => handleEditStageFromDetail(detailModalEntry.id, lorryNumber, stageKey)}
        />
      )}
    </div>
  );
};

export default PhysicalInspection;
