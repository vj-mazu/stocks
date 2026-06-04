import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';
import SampleEditApprovals from './SampleEditApprovals';
import ManagerValueApprovals from './ManagerValueApprovals';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';

interface SampleApprovalsHubProps {
  entryType?: string;
  excludeEntryType?: string;
  onPendingCountChange?: (count: number) => void;
}

type ApprovalTabKey = 'approval-for-edits' | 'approval-for-manager' | 'lorry-approvals' | 'loading-quality-approvals';

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
  
  if (s.includes('avg') && !s.includes('nit')) {
    return { ...baseStyle, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }; // Light Blue
  }
  if (s.includes('half')) {
    return { ...baseStyle, backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }; // Amber/Orange
  }
  if (s.includes('full')) {
    return { ...baseStyle, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }; // Green
  }
  if (s.includes('nit')) {
    return { ...baseStyle, backgroundColor: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff' }; // Purple
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

const SampleApprovalsHub: React.FC<SampleApprovalsHubProps> = ({ entryType, excludeEntryType, onPendingCountChange }) => {
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [managerApprovalCount, setManagerApprovalCount] = useState(0);
  const [lorryApprovalCount, setLorryApprovalCount] = useState(0);
  const [loadingQualityApprovalCount, setLoadingQualityApprovalCount] = useState(0);

  const [pendingLorryInspections, setPendingLorryInspections] = useState<any[]>([]);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
  const [processingLorry, setProcessingLorry] = useState(false);
  const [detailModalEntry, setDetailModalEntry] = useState<any | null>(null);
  const [loadingSubTab, setLoadingSubTab] = useState<'paddy' | 'rice'>('paddy');

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const canAccessManagerApprovals = ['admin', 'owner'].includes(String(currentUser?.role || '').toLowerCase());
  const canAccessLoadingQuality = ['admin', 'owner', 'manager'].includes(String(currentUser?.role || '').toLowerCase());

  const tabs = useMemo<ApprovalTabConfig[]>(() => {
    const baseTabs: ApprovalTabConfig[] = [
      { key: 'approval-for-edits', label: 'Paddy Sample', color: '#8e44ad' }
    ];
    if (canAccessManagerApprovals) {
      baseTabs.push({ key: 'approval-for-manager', label: 'Loading Lots', color: '#16a34a' });
      baseTabs.push({ key: 'lorry-approvals', label: 'Dispute Approval', color: '#f39c12' });
    }
    if (canAccessLoadingQuality) {
      baseTabs.push({ key: 'loading-quality-approvals', label: 'Loading Quality Approvals', color: '#1565c0' });
    }
    return baseTabs;
  }, [canAccessManagerApprovals, canAccessLoadingQuality]);

  const [activeTab, setActiveTab] = useState<ApprovalTabKey>('approval-for-edits');
  const totalPendingCount = editApprovalCount + 
    (canAccessManagerApprovals ? (managerApprovalCount + lorryApprovalCount) : 0) + 
    (canAccessLoadingQuality ? loadingQualityApprovalCount : 0);

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
      const entries = response.data.entries || [];
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
      if (activeTab === 'loading-quality-approvals') {
        setActiveTab('approval-for-edits');
      }
    }
  }, [activeTab, canAccessManagerApprovals, canAccessLoadingQuality]);

  useEffect(() => {
    fetchLoadingQuality(false);
    const interval = setInterval(() => fetchLoadingQuality(true), 30000);
    return () => clearInterval(interval);
  }, [fetchLoadingQuality]);

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

  const getPendingStage = (insp: any) => {
    const stages = insp.samplingStages || {};
    if (stages.lot_avg?.approvalStatus === 'pending') return { key: 'lot_avg', label: 'Lot Avg' };
    if (stages.balanced_lot?.approvalStatus === 'pending') return { key: 'balanced_lot', label: 'Balanced Lot' };
    if (stages.half_lorry?.approvalStatus === 'pending') return { key: 'half_lorry', label: 'Half Lorry' };
    if (stages.nit_avg?.approvalStatus === 'pending') return { key: 'nit_avg', label: 'Nit Avg' };
    if (stages.full_avg?.approvalStatus === 'pending') return { key: 'full_avg', label: 'Full Lorry' };
    return null;
  };

  const getLatestApprovedStageLabel = (insp: any) => {
    const stages = insp.samplingStages || {};
    if (stages.full_avg?.approvalStatus === 'approved') return 'Full Lorry';
    if (stages.nit_avg?.approvalStatus === 'approved') return 'Nit Avg';
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

  const getSamplingStatusLabel = (entry: any) => {
    let inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
    if (inspections.length === 0) return 'Still Loading/Not Started';
    
    // Copy to avoid mutating original objects
    inspections = JSON.parse(JSON.stringify(inspections));
    
    // Merge LOT_AVG trip on the fly
    if (inspections.length > 1) {
      const lotAvgIdx = inspections.findIndex((i: any) => (i.lorryNumber || '').trim().toUpperCase() === 'LOT_AVG');
      if (lotAvgIdx !== -1) {
        const realLorryInsp = inspections.find((i: any) => (i.lorryNumber || '').trim().toUpperCase() !== 'LOT_AVG');
        if (realLorryInsp) {
          const lotAvgInsp = inspections[lotAvgIdx];
          if (lotAvgInsp.samplingStages && lotAvgInsp.samplingStages.lot_avg) {
            if (!realLorryInsp.samplingStages) realLorryInsp.samplingStages = {};
            if (!realLorryInsp.samplingStages.lot_avg) {
              realLorryInsp.samplingStages.lot_avg = lotAvgInsp.samplingStages.lot_avg;
            }
          }
          inspections = inspections.filter((_, idx) => idx !== lotAvgIdx);
        }
      }
    }

    const activeInsp = inspections.find((insp: any) => getPendingStage(insp) !== null) || inspections[inspections.length - 1];
    if (!activeInsp) return '-';
    
    const pendingStage = getPendingStage(activeInsp);
    if (pendingStage) {
      if (pendingStage.key === 'lot_avg') return 'Lot Avg Sampling (Pending Approval)';
      if (pendingStage.key === 'balanced_lot') return 'Balanced Lot Sampling (Pending Approval)';
      if (pendingStage.key === 'half_lorry') return 'Half Lorry Sampling (Pending Approval)';
      if (pendingStage.key === 'full_avg') return 'Full Lorry Sampling (Pending Approval)';
      if (pendingStage.key === 'nit_avg') return 'Nit Avg Sampling (Pending Approval)';
      return `${pendingStage.label} Sampling (Pending Approval)`;
    }
    
    const stages = activeInsp.samplingStages || {};
    const hasInitialStage = (stages.lot_avg && stages.lot_avg.reportedBy) || (stages.balanced_lot && stages.balanced_lot.reportedBy);
    
    if (!hasInitialStage) {
      return 'Lot Avg / Balanced Sampling (Pending)';
    }
    
    const initialStageApproved = stages.lot_avg?.approvalStatus === 'approved' || stages.balanced_lot?.approvalStatus === 'approved';
    if (initialStageApproved && (!stages.half_lorry || !stages.half_lorry.reportedBy) && (!stages.nit_avg || !stages.nit_avg.reportedBy)) {
      return 'Half Lorry / Nit Avg Sampling (Pending)';
    }
    
    if (stages.full_avg?.approvalStatus === 'approved') return 'Full Lorry Sampling (Approved)';
    if (stages.balanced_lot?.approvalStatus === 'approved' && !stages.half_lorry?.reportedBy && !stages.full_avg?.reportedBy) return 'Balanced Lot Sampling (Approved)';
    if (stages.nit_avg?.approvalStatus === 'approved') return 'Nit Avg Sampling (Approved)';
    if (stages.half_lorry?.approvalStatus === 'approved') return 'Half Lorry Sampling (Approved)';
    if (stages.lot_avg?.approvalStatus === 'approved') return 'Lot Avg Sampling (Approved)';
    
    return 'Pending';
  };

  const getLorryNumber = (entry: any) => {
    const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
    const activeInsp = inspections.find((insp: any) => getPendingStage(insp) !== null) || inspections[inspections.length - 1];
    return activeInsp?.lorryNumber?.toUpperCase() || entry.lorryNumber?.toUpperCase() || '-';
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
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Party</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Location</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Variety</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '90px' }}>Pur Bags</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '150px' }}>Sampling Status</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '120px' }}>Lorry No</th>
                  <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((entry, index) => {
                  const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
                  const activeInsp = inspections.find((insp: any) => getPendingStage(insp) !== null) || inspections[inspections.length - 1];

                  return (
                    <React.Fragment key={entry.id}>
                      <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #ddd' }}>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{index + 1}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{formatDate(entry.entryDate)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>{toTitleCase(entry.brokerName)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '10px 12px' }}>
                          <span
                            onClick={() => openDetailEntry(entry)}
                            style={{
                              color: '#4a90e2',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontWeight: 'bold'
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
                              
                              const stages = activeInsp.samplingStages || {};
                              if (activeInsp.isComplete || stages.full_avg?.approvalStatus === 'approved') {
                                return (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                      onClick={() => handleApproveLorryQuality(entry.id)}
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
                        <td colSpan={10} style={{ padding: 0, height: '10px', backgroundColor: 'transparent', border: 'none' }}></td>
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
          <SampleEditApprovals entryType={entryType} excludeEntryType={excludeEntryType} onCountChange={setEditApprovalCount} />
        )}
        {canAccessManagerApprovals && activeTab === 'approval-for-manager' && (
          <ManagerValueApprovals filterType="standard" onCountChange={setManagerApprovalCount} />
        )}
        {canAccessManagerApprovals && activeTab === 'lorry-approvals' && (
          <ManagerValueApprovals filterType="lorry" onCountChange={setLorryApprovalCount} />
        )}
        {canAccessLoadingQuality && activeTab === 'loading-quality-approvals' && renderLorryQualityTable()}
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
                  Lorry Number: {selectedLorryForComparison.lorryNumber?.toUpperCase()} | Date: {selectedLorryForComparison.inspectionDate ? new Date(selectedLorryForComparison.inspectionDate).toLocaleDateString() : '-'}
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
            <div style={{ padding: '16px 18px 18px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a237e', color: '#fff', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'left' }}>SAMPLE / STAGE</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>REPORTED BY</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>REPORTED AT</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>MOISTURE</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>CUTTING</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>BEND</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>GRAINS COUNT</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>MIX</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>S MIX</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>L MIX</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>KANDU</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>OIL</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>SK</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>SMELL</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>PADDY WB</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>NIT</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>LOADED BAGS</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>PHOTO</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const stages = selectedLorryForComparison.samplingStages || {};
                    const lot = stages.lot_avg || {};
                    const balanced = stages.balanced_lot || {};
                    const half = stages.half_lorry || {};
                    const full = stages.full_avg || {};
                    const nit = stages.nit_avg || {};

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
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '500' }}>{formatField(stageObj.nit)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '700' }}>{isFull ? formatField(selectedLorryForComparison.bags) : '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                          </td>
                        </tr>
                      );
                    };

                    return (
                      <>
                        {lot.reportedBy && renderRow('Lot Avg', '#1565c0', '#f0f9ff', lot, false)}
                        {balanced.reportedBy && renderRow('Balanced Lot', '#1565c0', '#f0f9ff', balanced, true)}
                        {half.reportedBy && renderRow('Half Lorry', '#b45309', '#fffbeb', half, false)}
                        {full.reportedBy && renderRow('Full Avg Lorry', '#15803d', '#f0fdf4', full, true)}
                        {nit.reportedBy && renderRow('Nit Avg', '#6b21a8', '#faf5ff', nit, false)}
                      </>
                    );
                  })()}
                </tbody>
              </table>
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
          detailMode="full"
          progressiveMode={true}
          onClose={() => {
            setDetailModalEntry(null);
            fetchLoadingQuality();
          }}
          onUpdate={fetchLoadingQuality}
        />
      )}
    </div>
  );
};

export default SampleApprovalsHub;
