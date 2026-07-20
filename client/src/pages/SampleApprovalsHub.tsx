import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';
import SampleEditApprovals from './SampleEditApprovals';
import ManagerValueApprovals from './ManagerValueApprovals';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';
import TransitApprovalsTab from '../components/TransitApprovalsTab';

interface SampleApprovalsHubProps {
  entryType?: string;
  excludeEntryType?: string;
  onPendingCountChange?: (count: number) => void;
}

type ApprovalTabKey = 'approval-for-edits' | 'approval-for-manager' | 'lorry-approvals' | 'loading-quality-approvals' | 'bmb-inventory-quality' | 'rate-linking-approvals' | 'transit-approvals';

interface ApprovalTabConfig {
  key: ApprovalTabKey;
  label: string;
  color: string;
}

const toTitleCase = (value: string) => String(value || '').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const resolveMediaUrl = (value?: string | null) => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = API_URL.replace(/\/api\/?$/, '');
  return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
};

const getStatusBadgeStyle = (status: string) => {
  const s = status.toLowerCase();
  const baseStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center'
  };
  
  if (s.includes('hold') || s.includes('hold')) {
    return { ...baseStyle, backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d' }; // Amber/Orange
  }
  if (s.includes('edit')) {
    return { ...baseStyle, backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }; // Amber
  }
  if (s.includes('avg') && !s.includes('nit')) {
    return { ...baseStyle, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }; // Light Blue
  }
  if (s.includes('half')) {
    return { ...baseStyle, backgroundColor: '#fffbeb', color: '#000000', border: '1px solid #fde68a' }; // Amber/Orange
  }
  if (s.includes('full')) {
    return { ...baseStyle, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }; // Green
  }
  if (s.includes('nit')) {
    return { ...baseStyle, backgroundColor: '#ffffff', color: '#6b21a8', border: '1px solid #e9d5ff' }; // Purple
  }
  if (s.includes('pending') || s.includes('no sample')) {
    return { ...baseStyle, backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' }; // Red
  }
  return { ...baseStyle, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }; // Slate
};

const getLorryBadgeStyle = () => {
  return {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    display: 'inline-block',
    fontSize: '12px'
  } as React.CSSProperties;
};

const getStageBaseKey = (key: string, stageObj?: any) => stageObj?.baseStage || key.replace(/_hold_\d+$/, '').replace(/_reattempt_\d+$/, '');

const getStageAttemptNo = (stages: Record<string, any>, key: string) => {
  const stageObj = stages[key] || {};
  if (stageObj.attemptNo) return stageObj.attemptNo;
  const baseKey = getStageBaseKey(key, stageObj);
  const matchingKeys = Object.keys(stages)
    .filter(stageKey => getStageBaseKey(stageKey, stages[stageKey]) === baseKey)
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
  if (baseKey === 'full_avg') return 'Full Lorry';
  if (baseKey === 'nit_avg' || baseKey.startsWith('nit_avg')) {
    const nit = String(stageObj?.nit || '').trim();
    return nit ? `Nit Avg (${nit})` : 'Nit Avg';
  }
  return baseKey.replace(/_/g, ' ');
};

const SampleApprovalsHub: React.FC<SampleApprovalsHubProps> = ({ entryType, excludeEntryType, onPendingCountChange }) => {
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [managerApprovalCount, setManagerApprovalCount] = useState(0);
  const [lorryApprovalCount, setLorryApprovalCount] = useState(0);
  const [loadingQualityApprovalCount, setLoadingQualityApprovalCount] = useState(0);
  const [rateLinkingCount, setRateLinkingCount] = useState(0);
  const [rateLinkingEntries, setRateLinkingEntries] = useState<any[]>([]);
  const [loadingRateLinking, setLoadingRateLinking] = useState(false);
  const [pendingInventoryQualityApprovals, setPendingInventoryQualityApprovals] = useState<any[]>([]);
  const [loadingInventoryQualityApprovals, setLoadingInventoryQualityApprovals] = useState(false);
  const [inventoryQualityApprovalCount, setInventoryQualityApprovalCount] = useState(0);

  const [pendingLorryInspections, setPendingLorryInspections] = useState<any[]>([]);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
  const [processingLorry, setProcessingLorry] = useState(false);
  const [detailModalEntry, setDetailModalEntry] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoDisputeStage, setAutoDisputeStage] = useState<{ inspectionId: string; stageKey: string } | null>(null);
  const [loadingSubTab, setLoadingSubTab] = useState<'paddy' | 'rice'>(() => {
    const saved = localStorage.getItem('sample_approvals_hub_loading_sub_tab');
    return (saved === 'paddy' || saved === 'rice') ? saved : 'paddy';
  });
  const [holdDropdown, setHoldDropdown] = useState<{ entryId: string; inspectionId: string; stageKey: string } | null>(null);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const canAccessManagerApprovals = ['admin', 'owner', 'manager', 'ceo'].includes(String(currentUser?.role || '').toLowerCase());
  const canAccessLoadingQuality = ['admin', 'owner', 'manager', 'ceo'].includes(String(currentUser?.role || '').toLowerCase());

  const tabs = useMemo<ApprovalTabConfig[]>(() => {
    const baseTabs: ApprovalTabConfig[] = [
      { key: 'approval-for-edits', label: 'Paddy Sample', color: '#8e44ad' }
    ];
    if (canAccessManagerApprovals) {
      baseTabs.push({ key: 'approval-for-manager', label: 'Loading Lots', color: '#16a34a' });
      baseTabs.push({ key: 'lorry-approvals', label: 'Dispute Approval', color: '#f39c12' });
      baseTabs.push({ key: 'rate-linking-approvals', label: 'Rate Linking Approvals', color: '#0284c7' });
    }
    if (canAccessLoadingQuality) {
      baseTabs.push({ key: 'loading-quality-approvals', label: 'Loading Quality Approvals', color: '#1565c0' });
      baseTabs.push({ key: 'bmb-inventory-quality', label: 'Arrivals Quality Approvals', color: '#0f766e' });
    }
    if (canAccessManagerApprovals) {
      baseTabs.push({ key: 'transit-approvals', label: 'In Transit Approvals', color: '#d97706' });
    }
    return baseTabs;
  }, [canAccessManagerApprovals, canAccessLoadingQuality]);

  const [activeTab, setActiveTab] = useState<ApprovalTabKey>(() => {
    const saved = localStorage.getItem('sample_approvals_hub_active_tab');
    const allowedKeys = ['approval-for-edits'];
    if (canAccessManagerApprovals) {
      allowedKeys.push('approval-for-manager', 'lorry-approvals', 'rate-linking-approvals', 'transit-approvals');
    }
    if (canAccessLoadingQuality) {
      allowedKeys.push('loading-quality-approvals', 'bmb-inventory-quality');
    }
    return (saved && allowedKeys.includes(saved)) ? (saved as ApprovalTabKey) : 'approval-for-edits';
  });
  const totalPendingCount = editApprovalCount + 
    (canAccessManagerApprovals ? (managerApprovalCount + lorryApprovalCount + rateLinkingCount) : 0) + 
    (canAccessLoadingQuality ? (loadingQualityApprovalCount + inventoryQualityApprovalCount) : 0);

  const fetchLoadingQuality = useCallback(async (isSilent = false) => {
    if (!canAccessLoadingQuality) return;
    try {
      if (!isSilent) {
        setLoadingQuality(true);
      }
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sample-entries/by-role?status=PHYSICAL_INSPECTION`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const entries = (response.data.entries || []).filter((entry: any) => !entry.lotAllotment?.closedAt);
      setPendingLorryInspections(entries);
      setLoadingQualityApprovalCount(entries.length);
    } catch (error) {
      console.error('Error fetching loading quality:', error);
    } finally {
      if (!isSilent) {
        setLoadingQuality(false);
      }
    }
  }, [canAccessLoadingQuality]);

  const fetchInventoryQualityApprovals = useCallback(async (isSilent = false) => {
    if (!canAccessLoadingQuality) return;
    try {
      if (!isSilent) {
        setLoadingInventoryQualityApprovals(true);
      }
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/arrivals/bmb/inventory-quality/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const entries = response.data.entries || [];
      setPendingInventoryQualityApprovals(entries);
      setInventoryQualityApprovalCount(entries.length);
    } catch (error) {
      console.error('Error fetching Arrivals inventory quality approvals:', error);
    } finally {
      if (!isSilent) {
        setLoadingInventoryQualityApprovals(false);
      }
    }
  }, [canAccessLoadingQuality]);

  useEffect(() => {
    localStorage.setItem('sample_approvals_hub_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sample_approvals_hub_loading_sub_tab', loadingSubTab);
  }, [loadingSubTab]);

  const fetchCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const editRes = await axios.get(`${API_URL}/sample-entries/tabs/edit-approvals`, { headers });
      const editEntries = editRes.data?.entries || [];
      setEditApprovalCount(editEntries.length);

      if (canAccessManagerApprovals) {
        const mgrRes = await axios.get(`${API_URL}/sample-entries/tabs/manager-value-approvals`, { headers });
        const mgrEntries = mgrRes.data?.entries || [];
        let stdCount = 0;
        let lorryCount = 0;
        mgrEntries.forEach((entry: any) => {
          const pendingData = entry.offering?.pendingManagerValueApprovalData || {};
          const hasLorryFields = pendingData.disputeBaseRate !== undefined || pendingData.revisedHamali !== undefined || pendingData.revisedLf !== undefined;
          if (hasLorryFields) {
            lorryCount++;
          } else {
            stdCount++;
          }
        });
        setManagerApprovalCount(stdCount);
        setLorryApprovalCount(lorryCount);

        // Fetch rate linking count
        const rateLinkRes = await axios.get(`${API_URL}/sample-entries/tabs/rate-linking-approvals`, { headers });
        const rateLinkEntriesList = rateLinkRes.data?.entries || [];
        setRateLinkingEntries(rateLinkEntriesList);
        setRateLinkingCount(rateLinkEntriesList.length);
      } else {
        setManagerApprovalCount(0);
        setLorryApprovalCount(0);
        setRateLinkingCount(0);
        setRateLinkingEntries([]);
      }
    } catch (err) {
      console.error('Error fetching global approvals counts:', err);
    }
  }, [canAccessManagerApprovals]);

  useEffect(() => {
    if (!canAccessManagerApprovals) {
      setManagerApprovalCount(0);
      setLorryApprovalCount(0);
      if (activeTab === 'approval-for-manager' || activeTab === 'lorry-approvals') {
        setActiveTab('approval-for-edits');
      }
    }
    if (!canAccessLoadingQuality) {
      setLoadingQualityApprovalCount(0);
      setInventoryQualityApprovalCount(0);
      if (activeTab === 'loading-quality-approvals' || activeTab === 'bmb-inventory-quality') {
        setActiveTab('approval-for-edits');
      }
    }
  }, [activeTab, canAccessManagerApprovals, canAccessLoadingQuality]);

  useEffect(() => {
    fetchLoadingQuality(false);
    fetchInventoryQualityApprovals(false);
    fetchCounts();
    const interval = setInterval(() => {
      fetchLoadingQuality(true);
      fetchInventoryQualityApprovals(true);
      fetchCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLoadingQuality, fetchInventoryQualityApprovals, fetchCounts]);

  useEffect(() => {
    onPendingCountChange?.(totalPendingCount);
  }, [onPendingCountChange, totalPendingCount]);

  const handleApproveLorryQuality = async (entryId: string) => {
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/transition`,
        { toStatus: 'INVENTORY_ENTRY' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Lorry Loaded Quality Approved! Status moved to Inventory Entry.');
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error approving lorry quality:', error);
      toast.error(error.response?.data?.error || 'Failed to approve lorry quality');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleRejectLorryQuality = async (entryId: string) => {
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/transition`,
        { toStatus: 'LOT_ALLOTMENT' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Lorry Loaded Quality Rejected! Moved back to Lot Allotment.');
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error rejecting lorry quality:', error);
      toast.error(error.response?.data?.error || 'Failed to reject lorry quality');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleApproveBmbInventoryQuality = async (qualityId: string) => {
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inventory quality approved successfully');
      fetchInventoryQualityApprovals();
      fetchCounts();
    } catch (error: any) {
      console.error('Error approving inventory quality:', error);
      toast.error(error.response?.data?.error || 'Failed to approve inventory quality');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleRejectBmbInventoryQuality = async (qualityId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null || !reason.trim()) return;

    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/reject`, { rejectReason: reason.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Inventory quality rejected successfully');
      fetchInventoryQualityApprovals();
      fetchCounts();
    } catch (error: any) {
      console.error('Error rejecting inventory quality:', error);
      toast.error(error.response?.data?.error || 'Failed to reject inventory quality');
    } finally {
      setProcessingLorry(false);
    }
  };

  const getPendingStage = (insp: any) => {
    const stages = insp.samplingStages || {};
    const priority = ['lot_avg', 'balanced_lot', 'half_lorry', 'nit_avg', 'full_avg'];
    
    // Group keys by baseKey
    const baseGroups: Record<string, string[]> = {};
    Object.keys(stages).forEach(key => {
      const baseKey = getStageBaseKey(key, stages[key]);
      if (!baseGroups[baseKey]) {
        baseGroups[baseKey] = [];
      }
      baseGroups[baseKey].push(key);
    });

    const activeKeys: string[] = [];
    Object.keys(baseGroups).forEach(baseKey => {
      const groupKeys = baseGroups[baseKey];
      // If any key in the group is approved, and there is no pending edit/stage, the whole stage is resolved
      const hasPending = groupKeys.some(key => stages[key]?.approvalStatus === 'pending');
      const isApproved = !hasPending && groupKeys.some(key => stages[key]?.approvalStatus === 'approved');
      if (isApproved) {
        return;
      }
      // Otherwise, only the latest attempt can be pending/hold
      if (groupKeys.length > 0) {
        groupKeys.sort((a, b) => {
          const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
          const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
          return timeB - timeA;
        });
        activeKeys.push(groupKeys[0]);
      }
    });

    const pendingKeys = activeKeys
      .filter(key => stages[key]?.approvalStatus === 'pending' || stages[key]?.approvalStatus === 'hold')
      .sort((a, b) => {
        const baseA = getStageBaseKey(a, stages[a]);
        const baseB = getStageBaseKey(b, stages[b]);
        const priorityDiff = priority.indexOf(baseA) - priority.indexOf(baseB);
        if (priorityDiff !== 0) return priorityDiff;
        const timeA = new Date(stages[a]?.reportedAt || stages[a]?.holdAt || stages[a]?.createdAt || 0).getTime();
        const timeB = new Date(stages[b]?.reportedAt || stages[b]?.holdAt || stages[b]?.createdAt || 0).getTime();
        return timeB - timeA;
      });

    if (pendingKeys.length > 0) {
      const key = pendingKeys[0];
      const stageObj = stages[key];
      const baseKey = getStageBaseKey(key, stageObj);
      const attemptNo = getStageAttemptNo(stages, key);
      const label = `${getStageDisplayLabel(baseKey, stageObj)}${attemptNo > 1 ? ` Attempt ${attemptNo}` : ''}`;
      return { key, baseKey, label, approvalStatus: stageObj.approvalStatus, isEdited: !!(stageObj.isEdited || stageObj.beforeEdit), attemptNo };
    }
    return null;
  };

  const renderEditComparison = (entry: any) => {
    const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
    let activeInsp: any = null;
    let pendingStage: any = null;
    for (const insp of inspections) {
      pendingStage = getPendingStage(insp);
      if (pendingStage) {
        activeInsp = insp;
        break;
      }
    }
    if (!activeInsp || !pendingStage) return null;
    const stages = activeInsp.samplingStages || {};
    const pendingKey = pendingStage.key;
    const stageObj = stages[pendingKey];
    if (!stageObj || !stageObj.isEdited || !stageObj.beforeEdit) return null;

    const before = stageObj.beforeEdit;
    const after = stageObj;

    const changes: { label: string; before: any; after: any }[] = [];
    const fields = [
      { key: 'moisture', label: 'Moisture' },
      { key: 'actualBags', label: 'Bags' },
      { key: 'bags', label: 'Bags' },
      { key: 'mix', label: 'Mix' },
      { key: 'mixS', label: 'S Mix' },
      { key: 'mixL', label: 'L Mix' },
      { key: 'kandu', label: 'Kandu' },
      { key: 'oil', label: 'Oil' },
      { key: 'sk', label: 'SK' },
      { key: 'smellHas', label: 'Smell' },
      { key: 'smellType', label: 'Smell Type' },
      { key: 'paddyWb', label: 'Paddy WB' },
      { key: 'kadiga', label: 'Kadiga' },
    ];

    fields.forEach(({ key, label }) => {
      let bVal = before[key];
      let aVal = after[key];
      if (key === 'bags' || key === 'actualBags') {
        bVal = before.actualBags || before.bags;
        aVal = after.actualBags || after.bags;
      }
      if (key === 'smellHas') {
        const normalizeSmell = (val: any) => {
          if (val === true || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes') return 'Yes';
          return 'No';
        };
        bVal = normalizeSmell(bVal);
        aVal = normalizeSmell(aVal);
      }
      if (key === 'smellType') {
        const bSmell = before.smellHas === true || String(before.smellHas).toLowerCase() === 'true' || String(before.smellHas).toLowerCase() === 'yes';
        const aSmell = after.smellHas === true || String(after.smellHas).toLowerCase() === 'true' || String(after.smellHas).toLowerCase() === 'yes';
        if (!bSmell && !aSmell) {
          return;
        }
        bVal = bVal || '';
        aVal = aVal || '';
      }
      if (bVal !== undefined && aVal !== undefined && String(bVal).trim() !== String(aVal).trim() && !changes.some(c => c.label === label)) {
        changes.push({ label, before: bVal || '-', after: aVal || '-' });
      }
    });

    if (changes.length === 0) return null;

    return (
      <div style={{ marginTop: '6px', padding: '6px 8px', backgroundColor: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '4px', fontSize: '11px', color: '#b45309' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>✏️ Edited Stage Values:</div>
        {changes.map((c, i) => (
          <div key={i}>
            <strong>{c.label}</strong>: <span style={{ textDecoration: 'line-through', color: '#dc2626' }}>{c.before}</span> → <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{c.after}</span>
          </div>
        ))}
      </div>
    );
  };

  const getLatestApprovedStageLabel = (insp: any) => {
    const stages = insp.samplingStages || {};
    if (stages.full_avg?.approvalStatus === 'approved') return 'Full Lorry';
    
    const nitKeys = Object.keys(stages)
      .filter(k => k.startsWith('nit_avg'))
      .sort((a, b) => {
        if (a === 'nit_avg') return -1;
        if (b === 'nit_avg') return 1;
        const numA = parseInt(a.replace('nit_avg_', '')) || 0;
        const numB = parseInt(b.replace('nit_avg_', '')) || 0;
        return numA - numB;
      });
    for (let i = nitKeys.length - 1; i >= 0; i--) {
      const key = nitKeys[i];
      if (stages[key]?.approvalStatus === 'approved') {
        return i === 0 ? 'Nit Avg' : `Nit Avg ${i + 1}`;
      }
    }

    if (stages.half_lorry?.approvalStatus === 'approved') return 'Half Lorry';
    if (stages.balanced_lot?.approvalStatus === 'approved') return 'Balanced Lot';
    if (stages.lot_avg?.approvalStatus === 'approved') return 'Lot Avg';
    return null;
  };

  const handleApproveProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, stageLabel: string) => {
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/approve-stage`,
        { stage: stageKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${stageLabel} Stage Approved successfully!`);
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error approving progressive stage:', error);
      toast.error(error.response?.data?.error || 'Failed to approve stage');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleHoldProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, duration: string) => {
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/hold-stage`,
        { stage: stageKey, holdDuration: duration },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Stage put on Hold for ${duration} successfully!`);
      setHoldDropdown(null);
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error holding progressive stage:', error);
      toast.error(error.response?.data?.error || 'Failed to hold stage');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleRejectSpecificLorry = async (entryId: string, inspectionId: string, lorryNumber: string) => {
    if (!window.confirm(`Are you sure you want to reject and delete the trip for Lorry ${lorryNumber || ''}?`)) {
      return;
    }
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Trip for Lorry ${lorryNumber || ''} rejected and removed successfully.`);
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error rejecting specific lorry trip:', error);
      toast.error(error.response?.data?.error || 'Failed to reject lorry trip');
    } finally {
      setProcessingLorry(false);
    }
  };

  const handleRejectProgressiveStage = async (entryId: string, inspectionId: string, stageKey: string, stageLabel: string) => {
    if (!window.confirm(`Are you sure you want to reject the progressive stage "${stageLabel}"?`)) {
      return;
    }
    try {
      setProcessingLorry(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection/${inspectionId}/reject-stage`,
        { stage: stageKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Stage "${stageLabel}" rejected successfully.`);
      fetchLoadingQuality();
    } catch (error: any) {
      console.error('Error rejecting progressive stage:', error);
      toast.error(error.response?.data?.error || 'Failed to reject stage');
    } finally {
      setProcessingLorry(false);
    }
  };

  const openDetailEntry = async (entry: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sample-entries/${entry.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetailModalEntry(response.data || entry);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load entry details');
      setDetailModalEntry(entry);
    }
  };

  const getNormalizedInspections = (entry: any) => {
    let inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
    if (inspections.length === 0) return [];
    
    // Copy
    inspections = JSON.parse(JSON.stringify(inspections));
    
    // Sort
    inspections.sort((a: any, b: any) => {
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;
      if (idA !== idB) return idA - idB;
      const dateA = new Date(a.createdAt || a.inspectionDate || 0).getTime();
      const dateB = new Date(b.createdAt || b.inspectionDate || 0).getTime();
      return dateA - dateB;
    });
    
    // Merge LOT_AVG trip on the fly
    if (inspections.length > 1) {
      const lotAvgIdx = inspections.findIndex((i: any) => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
      if (lotAvgIdx !== -1) {
        const realLorryInsp = inspections.find((i: any) => {
          const lorry = (i.lorryNumber || '').trim().toUpperCase();
          if (lorry === 'LOT_AVG' || lorry === 'BALANCED_LOT') return false;
          const stages = i.samplingStages || {};
          const isFullApproved = Object.keys(stages).some(k => {
            return getStageBaseKey(k, stages[k]) === 'full_avg' && stages[k]?.approvalStatus === 'approved';
          });
          return !isFullApproved;
        });
        if (realLorryInsp) {
          const lotAvgInsp = inspections[lotAvgIdx];
          if (lotAvgInsp.samplingStages && lotAvgInsp.samplingStages.lot_avg) {
            if (!realLorryInsp.samplingStages) realLorryInsp.samplingStages = {};
            if (!realLorryInsp.samplingStages.lot_avg) {
              realLorryInsp.samplingStages.lot_avg = lotAvgInsp.samplingStages.lot_avg;
            }
          }
          return inspections.filter((_, idx) => idx !== lotAvgIdx);
        }
      }
    }
    return inspections;
  };

  const getSamplingStatusLabel = (entry: any) => {
    const inspections = getNormalizedInspections(entry);
    if (inspections.length === 0) return 'Still Loading/Not Started';

    const activeInsp = inspections.find((insp: any) => getPendingStage(insp) !== null) || inspections[inspections.length - 1];
    if (!activeInsp) return '-';
    
    const pendingStage = getPendingStage(activeInsp);
    if (pendingStage) {
      const isHold = pendingStage.approvalStatus === 'hold';
      if (isHold) {
        return `${pendingStage.label} Hold`;
      }
      const suffix = (pendingStage as any).isEdited ? ' (Edit Pending Approval)' : ' (Pending Approval)';
      return `${pendingStage.label} Sampling${suffix}`;
    }
    
    const stages = activeInsp.samplingStages || {};
    const isStageApproved = (baseKey: string) => Object.keys(stages).some(key => getStageBaseKey(key, stages[key]) === baseKey && stages[key]?.approvalStatus === 'approved');

    if (isStageApproved('balanced_lot') || isStageApproved('full_avg')) {
      const allottedBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
      const totalInspected = inspections.reduce((sum: number, i: any) => sum + (i.bags || 0), 0);
      if (totalInspected >= allottedBags) {
        return 'All Stages Approved';
      } else {
        return 'Lorry Approved (Awaiting Next Lorry)';
      }
    }

    const hasInitialStage = (stages.lot_avg && stages.lot_avg.reportedBy) || (stages.balanced_lot && stages.balanced_lot.reportedBy);
    if (!hasInitialStage) {
      return 'Lot Avg / Balanced Sampling (Pending)';
    }
    
    const initialStageApproved = isStageApproved('lot_avg') || isStageApproved('balanced_lot');
    if (initialStageApproved && (!stages.half_lorry || !stages.half_lorry.reportedBy) && (!stages.nit_avg || !stages.nit_avg.reportedBy)) {
      return 'Half Lorry / Nit Avg Sampling (Pending)';
    }
    
    if (isStageApproved('balanced_lot')) return 'Balanced Lot Sampling (Approved)';
    if (isStageApproved('full_avg')) return 'Full Lorry Sampling (Approved)';
    if (isStageApproved('nit_avg')) return 'Nit Avg Sampling (Approved)';
    if (isStageApproved('half_lorry')) return 'Half Lorry Sampling (Approved)';
    if (isStageApproved('lot_avg')) return 'Lot Avg Sampling (Approved)';
    
    return 'Pending';
  };

  const getLorryNumber = (entry: any) => {
    const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
    let lNo = '';
    if (inspections.length === 0) {
      lNo = entry.lorryNumber?.toUpperCase() || '';
    } else {
      const sorted = [...inspections].sort((a: any, b: any) => {
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        if (idA !== idB) return idA - idB;
        const dateA = new Date(a.createdAt || a.inspectionDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.inspectionDate || 0).getTime();
        return dateA - dateB;
      });

      const activeInsp = sorted.find((insp: any) => getPendingStage(insp) !== null) || sorted[sorted.length - 1];
      lNo = activeInsp?.lorryNumber?.toUpperCase() || entry.lorryNumber?.toUpperCase() || '';
    }
    return (lNo.trim() === 'LOT_AVG' || lNo.trim() === '') ? '-' : lNo;
  };

  const renderLorryQualityTable = () => {
    const filteredInspections = pendingLorryInspections.filter((entry) => {
      const matchesSubTab = loadingSubTab === 'rice'
        ? entry.entryType === 'RICE_SAMPLE'
        : entry.entryType !== 'RICE_SAMPLE';
      
      if (!matchesSubTab) return false;

      // Filter out 'Still Loading/Not Started' rows unless they are DIRECT_LOADED_VEHICLE (Ready Lorry)
      const statusLabel = getSamplingStatusLabel(entry);
      if (statusLabel === 'Still Loading/Not Started' && entry.entryType !== 'DIRECT_LOADED_VEHICLE') {
        return false;
      }

      return true;
    });

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {/* Sub-tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '10px',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <button
            type="button"
            onClick={() => setLoadingSubTab('paddy')}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderBottom: loadingSubTab === 'paddy' ? '3px solid #4a90e2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: loadingSubTab === 'paddy' ? '#4a90e2' : '#666',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Paddy Loading
          </button>
          <button
            type="button"
            onClick={() => setLoadingSubTab('rice')}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderBottom: loadingSubTab === 'rice' ? '3px solid #4a90e2' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: loadingSubTab === 'rice' ? '#4a90e2' : '#666',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Rice Loading
          </button>
        </div>

        {loadingQuality ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading quality approvals...</div>
        ) : filteredInspections.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
            No pending loading quality approvals.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #999' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '60px' }}>SL No</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Date</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '100px' }}>Broker</th>
                  {loadingSubTab === 'paddy' && (
                    <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '130px' }}>Allotted Supervisor</th>
                  )}
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '120px' }}>Party</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '100px' }}>Location</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '100px' }}>Variety</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '85px' }}>Pur Bags</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '85px' }}>Balance</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '150px' }}>Sampling Status</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Lorry No</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '235px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((entry, index) => {
                  const inspections = getNormalizedInspections(entry);
                  const activeInsp = inspections.find((insp: any) => getPendingStage(insp) !== null) || inspections[inspections.length - 1];

                  return (
                    <React.Fragment key={entry.id}>
                      <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #ddd' }}>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{index + 1}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{formatDate(entry.entryDate)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{toTitleCase(entry.brokerName)}</td>
                        {loadingSubTab === 'paddy' && (
                          <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>
                            {entry.lotAllotment?.supervisor
                              ? toTitleCase(entry.lotAllotment.supervisor.fullName || entry.lotAllotment.supervisor.username)
                              : '-'}
                          </td>
                        )}
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <span
                            onClick={() => openDetailEntry(entry)}
                            style={{
                              color: '#4a90e2',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word'
                            }}
                          >
                            {entry.partyName && entry.partyName.trim() && entry.partyName.toUpperCase() !== 'DIRECT LOADED VEHICLE'
                              ? toTitleCase(entry.partyName)
                              : (entry.lorryNumber?.toUpperCase() || getLorryNumber(entry) || 'DIRECT LOADED VEHICLE')}
                          </span>
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{entry.location ? toTitleCase(entry.location) : '-'}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{entry.variety ? toTitleCase(entry.variety) : '-'}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{entry.lotAllotment?.allottedBags || entry.bags || 0}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px', textAlign: 'center' }}>
                          {(() => {
                            const allottedBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
                            const totalInspected = inspections.reduce((sum: number, insp: any) => sum + (insp.bags || 0), 0);
                            const diff = totalInspected - allottedBags;
                            return diff > 0 ? (
                              <span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>+{diff}</span>
                            ) : diff < 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{diff}</span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>0</span>
                            );
                          })()}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>
                          <span style={getStatusBadgeStyle(getSamplingStatusLabel(entry))}>
                            {getSamplingStatusLabel(entry)}
                          </span>
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>
                          {getLorryNumber(entry)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>
                          {activeInsp ? (
                            (() => {
                              const pendingStage = getPendingStage(activeInsp);
                              if (pendingStage) {
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                    {pendingStage.approvalStatus === 'hold' && (
                                      <span style={{ color: '#d97706', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px', backgroundColor: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                                        [On Hold]
                                      </span>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <button
                                        onClick={() => handleApproveProgressiveStage(entry.id, activeInsp.id, pendingStage.key, pendingStage.label)}
                                        disabled={processingLorry}
                                        style={{
                                          background: '#27ae60',
                                          border: 'none',
                                          color: '#fff',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          padding: '5px 12px',
                                          fontSize: '11px',
                                          borderRadius: '4px',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleRejectProgressiveStage(entry.id, activeInsp.id, pendingStage.key, pendingStage.label)}
                                        disabled={processingLorry}
                                        style={{
                                          background: '#dc2626',
                                          border: 'none',
                                          color: '#fff',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          padding: '5px 12px',
                                          fontSize: '11px',
                                          borderRadius: '4px',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        Reject
                                      </button>
                                      {pendingStage.approvalStatus === 'hold' && (
                                        <button
                                          onClick={() => {
                                            setAutoDisputeStage({ inspectionId: activeInsp.id, stageKey: pendingStage.key });
                                            setDetailModalEntry(entry);
                                          }}
                                          disabled={processingLorry}
                                          style={{
                                            background: '#d97706',
                                            border: 'none',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            padding: '5px 12px',
                                            fontSize: '11px',
                                            borderRadius: '4px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                          }}
                                        >
                                          Dispute
                                        </button>
                                      )}
                                    </div>
                                    {pendingStage.approvalStatus !== 'hold' && (
                                       <div style={{ display: 'block', marginTop: '2px' }}>
                                         <button
                                           onClick={() => handleHoldProgressiveStage(entry.id, activeInsp.id, pendingStage.key, 'Hold')}
                                           disabled={processingLorry}
                                           style={{
                                             background: '#d97706',
                                             border: 'none',
                                             color: '#fff',
                                             fontWeight: 'bold',
                                             cursor: 'pointer',
                                             padding: '4px 12px',
                                             fontSize: '11px',
                                             borderRadius: '4px',
                                             boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                           }}
                                         >
                                           Hold
                                         </button>
                                       </div>
                                     )}
                                  </div>
                                );
                              }
                              
                              const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
                              const totalInspected = inspections.reduce((sum: number, i: any) => sum + (i.bags || 0), 0);
                              const allottedBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
                              const isLotFullyInspected = totalInspected >= allottedBags;

                              const stages = activeInsp.samplingStages || {};
                              const hasApprovedFullOrBalanced = Object.keys(stages).some(key => {
                                const baseKey = getStageBaseKey(key, stages[key]);
                                return ['full_avg', 'balanced_lot'].includes(baseKey) && stages[key]?.approvalStatus === 'approved';
                              });
                              if (hasApprovedFullOrBalanced) {
                                if (!isLotFullyInspected) {
                                  return (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <span style={{
                                        color: '#047857',
                                        backgroundColor: '#ecfdf5',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        border: '1px solid #a7f3d0'
                                      }}>
                                        Lorry Approved (Awaiting Next Lorry)
                                      </span>
                                      <button
                                        onClick={() => handleRejectSpecificLorry(entry.id, activeInsp.id, activeInsp.lorryNumber)}
                                        disabled={processingLorry}
                                        style={{
                                          background: '#dc2626',
                                          border: 'none',
                                          color: '#fff',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          padding: '5px 12px',
                                          fontSize: '11px',
                                          borderRadius: '4px',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{
                                      color: '#16a34a',
                                      backgroundColor: '#f0fdf4',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      border: '1px solid #bbf7d0'
                                    }}>
                                      All Stages Approved (Ready for Completion)
                                    </span>
                                  </div>
                                );
                              }
                              
                              return (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{
                                    color: '#64748b',
                                    backgroundColor: '#f1f5f9',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    border: '1px solid #cbd5e1'
                                  }}>
                                    Awaiting Next Stage
                                  </span>
                                  <button
                                    onClick={() => handleRejectSpecificLorry(entry.id, activeInsp.id, activeInsp.lorryNumber)}
                                    disabled={processingLorry}
                                    style={{
                                      background: '#dc2626',
                                      border: 'none',
                                      color: '#fff',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      padding: '5px 12px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              );
                            })()
                          ) : '-'}
                        </td>
                      </tr>
                      <tr style={{ height: '10px', backgroundColor: 'transparent' }}>
                        <td colSpan={loadingSubTab === 'paddy' ? 12 : 11} style={{ padding: 0, height: '10px', backgroundColor: 'transparent', border: 'none' }}></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const handleRateLinkingDecision = async (entryId: string, decision: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/sample-entries/${entryId}/rate-linking-decision`, { decision }, { headers });
      toast.success(`Rate Linking request ${decision}ed successfully!`);
      fetchCounts();
    } catch (error: any) {
      console.error('Error submitting rate linking decision:', error);
      toast.error(error.response?.data?.error || 'Failed to submit decision');
    }
  };

  const renderRateLinkingTable = () => {
    if (loadingRateLinking) {
      return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading rate linking approvals...</div>;
    }
    if (rateLinkingEntries.length === 0) {
      return (
        <div style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: '#64748b',
          fontWeight: 600,
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1'
        }}>
          No pending rate linking approvals.
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1565c0', boxShadow: '0 2px 8px rgba(21,101,192,0.12)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #1565c0, #1e88e5)', color: '#fff' }}>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>SL No</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Date</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Broker</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Party / Lorry</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Bags</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Base Rate</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Sute</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Moisture</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Hamali</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>LF</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rateLinkingEntries.map((e, index) => {
              const pending = e.offering?.pendingRateLinkingData || {};
              const getPendingRateLabel = (p: any, pendingData: any) => {
                if (!pendingData) return '';
                const pendingRate = Number(pendingData.finalPrice || pendingData.finalBaseRate || pendingData.rateInfo?.rate || 0);
                const finalRate = Number(p.finalPrice || p.finalBaseRate || 0);
                
                const disputeVersions = Array.isArray(p.disputeVersions) ? p.disputeVersions : [];
                const isDispute = pendingData.rateInfo?.isDispute || pendingData.isDispute;
                const isRevision = pendingData.rateInfo?.isRevision || pendingData.isRevision;
                
                if (isDispute) {
                  const matchedDisputeIdx = disputeVersions.findIndex((d: any) => Number(d.disputeBaseRate) === pendingRate);
                  if (matchedDisputeIdx !== -1) return `Dispute ${matchedDisputeIdx + 1}`;
                  return 'Dispute';
                }
                if (isRevision) return 'Revision';
                if (pendingRate === finalRate) return 'Final Rate';
                
                const offerVersions = Array.isArray(p.offerVersions) ? p.offerVersions : [];
                const matchedOfferIdx = offerVersions.findIndex((v: any) => Number(v.offerBaseRateValue || v.offeringPrice || 0) === pendingRate);
                if (matchedOfferIdx !== -1) return `Offer ${matchedOfferIdx + 1}`;
                
                return '';
              };
              const rateLabel = getPendingRateLabel(e.offering || {}, pending);

              return (
                <tr key={e.id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>{index + 1}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>{new Date(e.entryDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{e.brokerName}</td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <div style={{ fontWeight: 'bold', color: '#1e40af' }}>{e.partyName || e.lorryNumber || '-'}</div>
                    {pending.targetLorryNumber ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                        <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', background: '#faf5ff', border: '1px solid #e9d5ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', width: 'max-content' }}>
                          🚚 Lorry: {pending.targetLorryNumber.toUpperCase()}
                        </div>
                        {rateLabel && (
                          <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold', background: '#fffbeb', border: '1px solid #fef3c7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', width: 'max-content' }}>
                            ⚠️ {rateLabel}
                          </div>
                        )}
                      </div>
                    ) : (
                      e.lorryNumber && e.partyName && <div style={{ fontSize: '10px', color: '#64748b' }}>{e.lorryNumber}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>{e.bags}</td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', fontWeight: 600, color: '#0f172a' }}>
                    {pending.finalBaseRate ? `Rs ${pending.finalBaseRate}` : '-'}
                    {pending.baseRateType ? <div style={{ fontSize: '10px', color: '#64748b' }}>{pending.baseRateType}</div> : null}
                  </td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0' }}>
                    {pending.finalSute ? `${pending.finalSute} / ${pending.finalSuteUnit || 'Per Ton'}` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0' }}>
                    {pending.moistureValue ? `${pending.moistureValue}%` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0' }}>
                    {pending.hamali ? `Rs ${pending.hamali} / ${pending.hamaliUnit === 'per_quintal' ? 'Qtl' : 'Bag'}` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0' }}>
                    {pending.lf ? `Rs ${pending.lf} / ${pending.lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRateLinkingDecision(e.id, 'approve')}
                        style={{
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleRateLinkingDecision(e.id, 'reject')}
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ❌ Reject
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
  };

  const renderBmbInventoryQualityTable = () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    if (loadingInventoryQualityApprovals) {
      return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading arrivals inventory quality approvals...</div>;
    }

    if (pendingInventoryQualityApprovals.length === 0) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
          No pending arrivals inventory quality approvals.
        </div>
      );
    }

    const CELL: React.CSSProperties = {
      padding: '10px 12px',
      borderRight: '1px solid #e2e8f0',
      verticalAlign: 'middle',
      fontSize: '12px'
    };

    const CELL_HEAD: React.CSSProperties = {
      padding: '10px 12px',
      borderRight: '1px solid #e2e8f0',
      textAlign: 'left',
      fontWeight: '700',
      fontSize: '12px',
      color: '#0f766e',
      backgroundColor: '#f0fdf4'
    };

    return (
      <div>
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#374151', fontWeight: 600 }}>
          📋 {pendingInventoryQualityApprovals.length} pending quality parameter approval{pendingInventoryQualityApprovals.length > 1 ? 's' : ''}
        </div>
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ ...CELL_HEAD, width: '40px' }}>#</th>
                <th style={{ ...CELL_HEAD, width: '100px' }}>Date</th>
                <th style={CELL_HEAD}>Party / Lorry</th>
                <th style={{ ...CELL_HEAD, width: '70px' }}>Bags</th>
                <th style={{ ...CELL_HEAD, width: '120px' }}>Type</th>
                <th style={{ ...CELL_HEAD, minWidth: '380px' }}>📊 Quality Parameters</th>
                <th style={CELL_HEAD}>Reporter / Remarks</th>
                <th style={{ ...CELL_HEAD, textAlign: 'center', width: '200px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInventoryQualityApprovals.map((entry, index) => {
                const sampleEntry = entry.lorryTransitDetail?.sampleEntry;
                const inspection = entry.lorryTransitDetail?.physicalInspection;
                const lorryNumber = entry.lorryTransitDetail?.lorryNumber || inspection?.lorryNumber || '-';
                const typeLabel = entry.type === 'lot_avg' ? 'Lot Avg' : 'Full Lorry Avg';
                
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ ...CELL, fontWeight: 'bold' }}>{index + 1}</td>
                    <td style={{ ...CELL, whiteSpace: 'nowrap' }}>{formatDate(entry.reportedAt)}</td>
                    <td style={CELL}>
                      <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{sampleEntry?.partyName || '-'}</div>
                      <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold', marginTop: '2px' }}>🚚 {lorryNumber.toUpperCase()}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{sampleEntry?.variety || '-'} | Broker: {sampleEntry?.brokerName || '-'}</div>
                    </td>
                    <td style={{ ...CELL, fontWeight: 'bold' }}>{inspection?.bags || sampleEntry?.bags || '-'}</td>
                    <td style={CELL}>
                      <span style={{
                        padding: '3px 8px',
                        background: entry.type === 'lot_avg' ? '#eff6ff' : '#faf5ff',
                        color: entry.type === 'lot_avg' ? '#1d4ed8' : '#7c3aed',
                        border: entry.type === 'lot_avg' ? '1px solid #bfdbfe' : '1px solid #e9d5ff',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        display: 'inline-block'
                      }}>
                        {typeLabel}
                      </span>
                    </td>
                    <td style={CELL}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', fontSize: '11px' }}>
                        <div>Moisture: <b>{entry.moisture || '-'}</b></div>
                        <div>Dry: <b>{entry.dryMoisture || '-'}</b></div>
                        <div>Cutting: <b>{entry.cutting || '-'}</b></div>
                        <div>Bend: <b>{entry.bend || '-'}</b></div>
                        <div>Grains: <b>{entry.grains || '-'}</b></div>
                        <div>Mix: <b>{entry.mix || '-'}</b></div>
                        <div>SMix: <b>{entry.sMix || '-'}</b></div>
                        <div>LMix: <b>{entry.lMix || '-'}</b></div>
                        <div>SK: <b>{entry.sk || '-'}</b></div>
                        <div>Kandu: <b>{entry.kandu || '-'}</b></div>
                        <div>Oil: <b>{entry.oil || '-'}</b></div>
                        <div>Smell: <b>{entry.smell || '-'}</b></div>
                        <div>Paddy WB: <b>{entry.paddyWb || '-'}</b></div>
                        <div>Discolor: <b>{entry.pColor || '-'}</b></div>
                        <div>Kadiga: <b>{entry.kadiga || '-'}</b></div>
                      </div>
                    </td>
                    <td style={CELL}>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Reported: <b>{entry.reportedBy?.fullName || entry.reportedBy?.username || '-'}</b>
                      </div>
                      {entry.remarks && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#b45309', background: '#fffbeb', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          💬 {entry.remarks}
                        </div>
                      )}
                    </td>
                    <td style={{ ...CELL, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApproveBmbInventoryQuality(entry.id)}
                          disabled={processingLorry}
                          style={{
                            backgroundColor: '#10b981',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleRejectBmbInventoryQuality(entry.id)}
                          disabled={processingLorry}
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '10px',
      border: '1px solid #dbe4f0',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0 10px',
        borderBottom: '1px solid #dbe4f0',
        background: '#f8fafc',
        flexWrap: 'wrap'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const tabCount = tab.key === 'approval-for-edits' 
            ? editApprovalCount 
            : tab.key === 'approval-for-manager' 
              ? managerApprovalCount 
              : tab.key === 'lorry-approvals'
                ? lorryApprovalCount
                : tab.key === 'rate-linking-approvals'
                  ? rateLinkingCount
                  : tab.key === 'bmb-inventory-quality'
                    ? inventoryQualityApprovalCount
                    : loadingQualityApprovalCount;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 16px',
                border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                background: 'transparent',
                color: isActive ? tab.color : '#475569',
                fontWeight: isActive ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
              {tabCount > 0 && (
                <span style={{
                  marginLeft: '8px',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '999px',
                  background: isActive ? tab.color : '#dc2626',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800
                }}>
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px' }}>
        {activeTab === 'approval-for-edits' && (
          <SampleEditApprovals key={`edits-${refreshKey}`} entryType={entryType} excludeEntryType={excludeEntryType} onCountChange={setEditApprovalCount} />
        )}
        {canAccessManagerApprovals && activeTab === 'approval-for-manager' && (
          <ManagerValueApprovals key={`manager-${refreshKey}`} filterType="standard" onCountChange={setManagerApprovalCount} />
        )}
        {canAccessManagerApprovals && activeTab === 'lorry-approvals' && (
          <ManagerValueApprovals key={`lorry-${refreshKey}`} filterType="lorry" onCountChange={setLorryApprovalCount} />
        )}
        {canAccessManagerApprovals && activeTab === 'rate-linking-approvals' && (
          <div key={`rate-linking-${refreshKey}`}>
            {renderRateLinkingTable()}
          </div>
        )}
        {canAccessLoadingQuality && activeTab === 'loading-quality-approvals' && (
          <div key={`loading-quality-${refreshKey}`}>
            {renderLorryQualityTable()}
          </div>
        )}
        {canAccessLoadingQuality && activeTab === 'bmb-inventory-quality' && (
          <div key={`bmb-inventory-quality-${refreshKey}`}>
            {renderBmbInventoryQualityTable()}
          </div>
        )}
        {canAccessManagerApprovals && activeTab === 'transit-approvals' && (
          <TransitApprovalsTab key={`transit-${refreshKey}`} />
        )}
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
                  Lorry Sampling Stage Comparison
                </div>
                <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '4px' }}>
                  Lorry Number: {selectedLorryForComparison.lorryNumber?.toUpperCase() === 'LOT_AVG' ? '-' : selectedLorryForComparison.lorryNumber?.toUpperCase()} | Date: {selectedLorryForComparison.inspectionDate ? new Date(selectedLorryForComparison.inspectionDate).toLocaleDateString() : '-'}
                  {selectedLorryForComparison.lotAllotment?.manager && ` | Allotted By: ${selectedLorryForComparison.lotAllotment.manager.fullName || selectedLorryForComparison.lotAllotment.manager.username}`}
                  {selectedLorryForComparison.lotAllotment?.supervisor && ` | Supervisor: ${selectedLorryForComparison.lotAllotment.supervisor.fullName || selectedLorryForComparison.lotAllotment.supervisor.username}`}
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
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
                      const stages = selectedLorryForComparison.samplingStages || {};

                      const formatField = (val: any) => {
                        if (val === null || val === undefined || val === '') return '-';
                        return String(val);
                      };

                      const renderStageCompareCell = (
                        currentStage: any,
                        getValueFn: (obj: any) => any
                      ) => {
                        const currentVal = getValueFn(currentStage);
                        if (!currentStage.beforeEdit || currentStage.approvalStatus !== 'pending') {
                          return currentVal;
                        }
                        
                        const beforeVal = getValueFn(currentStage.beforeEdit);
                        if (beforeVal === currentVal) {
                          return currentVal;
                        }
                        
                        const formattedBefore = beforeVal === undefined || beforeVal === null || beforeVal === '' ? '-' : String(beforeVal);
                        const formattedCurrent = currentVal === undefined || currentVal === null || currentVal === '' ? '-' : String(currentVal);
                        
                        if (formattedBefore === formattedCurrent) {
                          return currentVal;
                        }
                        
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ textDecoration: 'line-through', color: '#dc2626', fontSize: '9px', opacity: 0.8 }}>{formattedBefore}</span>
                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{formattedCurrent}</span>
                          </div>
                        );
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

                        const getSmellLabel = (obj: any) => {
                          return obj.smellHas === true || String(obj.smellHas).trim().toUpperCase() === 'YES' ? (obj.smellType || 'Yes') : '-';
                        };

                        return (
                          <tr key={name} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: finalRowBg }}>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: '800', color: isDarkSmell ? '#ffffff' : color }}>{name}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>{formatReportedBy(stageObj)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500' }}>
                              {stageObj.reportedAt ? new Date(stageObj.reportedAt).toLocaleDateString('en-GB') + ', ' + new Date(stageObj.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase() : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600' }}>{renderStageCompareCell(stageObj, formatMoisture)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{renderStageCompareCell(stageObj, formatCutting)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '600', width: '55px' }}>{renderStageCompareCell(stageObj, formatBend)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '55px' }}>{renderStageCompareCell(stageObj, (obj) => { const v = obj.grainsCountRaw || obj.grainsCount; return (v !== null && v !== undefined && v !== '') ? `(${v})` : '-'; })}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.mixRaw || obj.mix)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.smixEnabled ? obj.mixSRaw || obj.mixS || 'Yes' : '-')}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.lmixEnabled ? obj.mixLRaw || obj.mixL || 'Yes' : '-')}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.kanduRaw || obj.kandu)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.oilRaw || obj.oil)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '45px' }}>{renderStageCompareCell(stageObj, (obj) => obj.skRaw || obj.sk)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '50px' }}>{renderStageCompareCell(stageObj, getSmellLabel)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '500', width: '50px' }}>{renderStageCompareCell(stageObj, formatPaddyWb)}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalKadigaColor, fontWeight: '700', width: '80px' }}>
                              {(() => {
                                const hasColor = !!stageObj.paddyColorEnabled && !!stageObj.paddyColor;
                                const hasKadiga = (stageObj.kadiga === 'Y' || stageObj.kadiga === 'Yes' || stageObj.kadiga === true || stageObj.kadiga === 'true') || 
                                                  (stageObj.beforeEdit && (stageObj.beforeEdit.kadiga === 'Y' || stageObj.beforeEdit.kadiga === 'Yes' || stageObj.beforeEdit.kadiga === true || stageObj.beforeEdit.kadiga === 'true'));
                                if (!hasColor && !hasKadiga) return '-';
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    {hasColor && <span>{renderStageCompareCell(stageObj, (obj) => obj.paddyColorEnabled && obj.paddyColor ? obj.paddyColor : '-')}</span>}
                                    {hasColor && hasKadiga && <hr style={{ width: '100%', border: 'none', borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />}
                                    {hasKadiga && <span>ಕಡಿಗಾ: {renderStageCompareCell(stageObj, (obj) => {
                                      const isK = obj.kadiga === 'Y' || obj.kadiga === 'Yes' || obj.kadiga === true || obj.kadiga === 'true';
                                      return obj.kadiga ? (isK ? 'Yes' : 'No') : '-';
                                    })}</span>}
                                  </div>
                                );
                              })()}
                            </td>
                            
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center', color: finalTextColor, fontWeight: '700' }}>
                              {isFull ? renderStageCompareCell(stageObj, (obj) => obj.actualBags || obj.bags || selectedLorryForComparison.bags) : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', textAlign: 'center' }}>
                              {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                            </td>
                          </tr>
                        );
                      };

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
                        const attemptNo = getStageAttemptNo(stages, key);
                        const statusSuffix = stageObj.approvalStatus === 'hold'
                          ? ' - Hold'
                          : stageObj.approvalStatus === 'rejected'
                            ? ' - Rejected'
                            : stageObj.approvalStatus === 'pending'
                              ? ' - Pending'
                              : stageObj.approvalStatus === 'approved'
                                ? ' - Approved'
                                : '';
                        const name = `${getStageDisplayLabel(baseKey, stageObj)}${attemptNo > 1 ? ` - Attempt ${attemptNo}` : ''}${statusSuffix}`;
                        const color = stageObj.approvalStatus === 'hold' ? '#d97706' : '#000000';
                        const bgColor = stageObj.approvalStatus === 'hold' ? '#fffbeb' : '#ffffff';
                        const isFull = baseKey === 'full_avg';

                        return renderRow(name, color, bgColor, stageObj, isFull);
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => setSelectedLorryForComparison(null)}
                style={{ marginTop: '8px', width: '100%', padding: '9px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
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
          detailMode="full"
          progressiveMode={true}
          onClose={async () => {
            setDetailModalEntry(null);
            setAutoDisputeStage(null);
            setRefreshKey(prev => prev + 1);
            try {
              await fetchLoadingQuality();
              await fetchCounts();
            } catch (err) {
              console.error("Error reloading quality after modal close:", err);
            }
          }}
          onUpdate={async () => {
            setRefreshKey(prev => prev + 1);
            try {
              await fetchLoadingQuality();
              await fetchCounts();
            } catch (err) {
              console.error("Error reloading quality after modal update:", err);
            }
          }}
          autoTriggerDisputeKey={autoDisputeStage || undefined}
        />
      )}
    </div>
  );
};

export default SampleApprovalsHub;
