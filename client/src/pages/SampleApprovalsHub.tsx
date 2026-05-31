import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';
import SampleEditApprovals from './SampleEditApprovals';
import ManagerValueApprovals from './ManagerValueApprovals';

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

const SampleApprovalsHub: React.FC<SampleApprovalsHubProps> = ({ entryType, excludeEntryType, onPendingCountChange }) => {
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [managerApprovalCount, setManagerApprovalCount] = useState(0);
  const [lorryApprovalCount, setLorryApprovalCount] = useState(0);
  const [loadingQualityApprovalCount, setLoadingQualityApprovalCount] = useState(0);

  const [pendingLorryInspections, setPendingLorryInspections] = useState<any[]>([]);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [selectedLorryForComparison, setSelectedLorryForComparison] = useState<any>(null);
  const [processingLorry, setProcessingLorry] = useState(false);

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

  const renderLorryQualityTable = () => {
    if (loadingQuality) {
      return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading quality approvals...</div>;
    }

    if (pendingLorryInspections.length === 0) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
          No pending loading quality approvals.
        </div>
      );
    }

    const fmtField = (val: any) => {
      if (val === null || val === undefined || val === '') return '-';
      return String(val);
    };

    const fmtMoisture = (stageObj: any) => {
      const raw = stageObj.moistureRaw;
      const val = stageObj.moisture;
      if (raw) return `${raw}%`;
      if (val !== undefined && val !== null) return `${val}%`;
      return '-';
    };

    const fmtCutting = (stageObj: any) => {
      if (stageObj.cutting1 === undefined || stageObj.cutting1 === null) return '-';
      return `${stageObj.cutting1}x${stageObj.cutting2 || 0}`;
    };

    const fmtBend = (stageObj: any) => {
      if (stageObj.bend1 === undefined || stageObj.bend1 === null) return '-';
      return `${stageObj.bend1}x${stageObj.bend2 || 0}`;
    };

    const fmtGrains = (stageObj: any) => {
      const val = stageObj.grainsCountRaw || stageObj.grainsCount;
      if (val === undefined || val === null || val === '') return '-';
      return `(${val})`;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {pendingLorryInspections.map((entry) => {
          const allottedBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
          const inspections = entry.physicalInspections || entry.lotAllotment?.physicalInspections || [];
          const loadedBags = inspections.reduce((sum: number, insp: any) => sum + (insp.bags || 0), 0);
          const remainingBags = Math.max(0, allottedBags - loadedBags);

          return (
            <div key={entry.id} style={{ 
              border: '2px solid #1e3a8a', 
              borderRadius: '8px', 
              overflow: 'hidden', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.08)', 
              backgroundColor: '#fff' 
            }}>
              {/* Lot Info Header */}
              <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: 'white', padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Party:</span> {entry.partyName && entry.partyName.trim() ? toTitleCase(entry.partyName) : 'DIRECT LOADED VEHICLE'}
                  <span style={{ color: '#94a3b8', marginLeft: '12px' }}>Variety:</span> {entry.variety || '-'}
                  <span style={{ color: '#94a3b8', marginLeft: '12px' }}>Location:</span> {entry.location || '-'}
                  <span style={{ color: '#94a3b8', marginLeft: '12px' }}>Allotted Bags:</span> {allottedBags} Bags
                  <span style={{ color: '#f39c12', marginLeft: '12px' }}>Remaining Bags:</span> {remainingBags} Bags
                </div>
              </div>

              {/* Lorry sampling parameter grids */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f8fafc' }}>
                {(() => {
                  const inspections = [...(entry.physicalInspections || entry.lotAllotment?.physicalInspections || [])]
                    .sort((a, b) => {
                      const dateA = new Date(a.inspectionDate).getTime();
                      const dateB = new Date(b.inspectionDate).getTime();
                      if (dateA !== dateB) return dateA - dateB;
                      return String(a.id).localeCompare(String(b.id));
                    });
                  if (inspections.length === 0) {
                    return <div style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', padding: '10px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>No physical inspection samples loaded yet for this lot.</div>;
                  }
                  return inspections.map((insp: any, idx: number) => {
                    const stages = insp.samplingStages || {};
                    const lot = stages.lot_avg || {};
                    const half = stages.half_lorry || {};
                    const full = stages.full_avg || {};

                    return (
                      <div key={insp.id} style={{ 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        backgroundColor: '#ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}>
                        {/* Lorry Header */}
                        <div style={{ 
                          backgroundColor: '#f1f5f9', 
                          borderBottom: '1px solid #cbd5e1',
                          borderLeft: '4px solid #f2711c', 
                          padding: '8px 16px', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          color: '#334155', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontSize: '13px', color: '#1e3a8a', marginRight: '12px', fontWeight: '800' }}>Trip #{idx + 1}</span>
                            <span style={{ color: '#64748b' }}>Lorry Number:</span> <span style={{ fontSize: '13px', color: '#0f172a' }}>{insp.lorryNumber?.toUpperCase() || '-'}</span>
                            {(() => {
                              const pendingStage = getPendingStage(insp);
                              if (pendingStage) {
                                return (
                                  <span style={{
                                    marginLeft: '8px',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: '#fef3c7',
                                    color: '#d97706',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    border: '1px solid #fde68a'
                                  }}>
                                    Pending: {pendingStage.label}
                                  </span>
                                );
                              }
                              
                              const latestApproved = getLatestApprovedStageLabel(insp);
                              if (latestApproved) {
                                if (insp.isComplete || stages.full_avg?.approvalStatus === 'approved') {
                                  return (
                                    <span style={{
                                      marginLeft: '8px',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#d1fae5',
                                      color: '#065f46',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      textTransform: 'uppercase',
                                      border: '1px solid #a7f3d0'
                                    }}>
                                      Approved: {latestApproved}
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span style={{
                                      marginLeft: '8px',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#e0f2fe',
                                      color: '#0369a1',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      textTransform: 'uppercase',
                                      border: '1px solid #bae6fd'
                                    }}>
                                      Approved: {latestApproved} (Awaiting Next Stage)
                                    </span>
                                  );
                                }
                              }

                              return (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  border: '1px solid #cbd5e1'
                                }}>
                                  No Sample Submitted
                                </span>
                              );
                            })()}
                            <span style={{ color: '#64748b', marginLeft: '16px' }}>Bags loaded in trip:</span> <span style={{ fontSize: '13px', color: '#0f172a' }}>{insp.bags || '-'}</span>
                            <span style={{ color: '#64748b', marginLeft: '16px' }}>Last Sampled:</span> <span style={{ fontSize: '13px', color: '#0f172a' }}>{insp.inspectionDate || '-'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {(() => {
                              const pendingStage = getPendingStage(insp);
                              if (pendingStage) {
                                return (
                                  <button
                                    onClick={() => handleApproveProgressiveStage(entry.id, insp.id, pendingStage.key, pendingStage.label)}
                                    disabled={processingLorry}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#2ecc71',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                      cursor: processingLorry ? 'not-allowed' : 'pointer',
                                      fontSize: '11px',
                                      boxShadow: '0 1px 2px rgba(46,204,113,0.2)'
                                    }}
                                  >
                                    Approve {pendingStage.label}
                                  </button>
                                );
                              }
                              
                              if (insp.isComplete || stages.full_avg?.approvalStatus === 'approved') {
                                const allTripsApproved = inspections.every((i: any) => i.isComplete || i.samplingStages?.full_avg?.approvalStatus === 'approved');
                                if (!allTripsApproved) {
                                  return (
                                    <button
                                      disabled
                                      style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#94a3b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: 'bold',
                                        cursor: 'not-allowed',
                                        fontSize: '11px'
                                      }}
                                    >
                                      Lorry Approved (Awaiting Other Trips)
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    onClick={() => handleApproveLorryQuality(entry.id)}
                                    disabled={processingLorry}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#27ae60',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                      cursor: processingLorry ? 'not-allowed' : 'pointer',
                                      fontSize: '11px',
                                      boxShadow: '0 1px 2px rgba(39,174,96,0.2)'
                                    }}
                                  >
                                    Approve Trip
                                  </button>
                                );
                              }

                              return (
                                <button
                                  disabled
                                  style={{
                                    padding: '4px 12px',
                                    backgroundColor: '#94a3b8',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'not-allowed',
                                    fontSize: '11px'
                                  }}
                                >
                                  Awaiting Next Stage
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => handleRejectSpecificLorry(entry.id, insp.id, insp.lorryNumber)}
                              disabled={processingLorry}
                              style={{
                                padding: '4px 12px',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: processingLorry ? 'not-allowed' : 'pointer',
                                fontSize: '11px',
                                boxShadow: '0 1px 2px rgba(220,38,38,0.2)'
                              }}
                            >
                              Reject Trip
                            </button>
                          </div>
                        </div>

                        {/* Quality parameters grid transposed inline */}
                        <div style={{ padding: '12px', overflowX: 'auto' }}>
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse', fontSize: '11px' }}>
                              <thead>
                                <tr style={{ background: 'linear-gradient(90deg, #f2711c 0%, #f26202 100%)', color: 'white' }}>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', fontWeight: '800' }}>SAMPLE</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', fontWeight: '800' }}>REPORTED BY</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', fontWeight: '800' }}>REPORTED AT</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>MOISTURE</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>CUTTING</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>BEND</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>GRAINS COUNT</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>MIX</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>S MIX</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>L MIX</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>KANDU</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>OIL</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>SK</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>WB-R</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>WB-BK</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>WB-T</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>SMELL</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>PADDY WB</th>
                                  <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: '800' }}>PHOTO</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Lot Avg */}
                                {stages.lot_avg && (
                                  <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '800', color: '#e05300' }}>Lot Avg</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '600' }}>{fmtField(lot.reportedBy)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{lot.reportedAt ? new Date(lot.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>{fmtMoisture(lot)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtCutting(lot)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtBend(lot)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtGrains(lot)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.mixRaw || lot.mix)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{lot.smixEnabled ? fmtField(lot.mixSRaw || lot.mixS) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{lot.lmixEnabled ? fmtField(lot.mixLRaw || lot.mixL) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.kanduRaw || lot.kandu)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.oilRaw || lot.oil)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.skRaw || lot.sk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.wbRRaw || lot.wbR)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.wbBkRaw || lot.wbBk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(lot.wbTRaw || lot.wbT)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{lot.smellHas ? 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{lot.paddyWbEnabled ? fmtField(lot.paddyWbRaw || lot.paddyWb) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                                      {lot.imageUrl ? <a href={resolveMediaUrl(lot.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                                    </td>
                                  </tr>
                                )}

                                {/* Half Lorry */}
                                {stages.half_lorry && (
                                  <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '800', color: '#e05300' }}>Half Lorry</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '600' }}>{fmtField(half.reportedBy)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{half.reportedAt ? new Date(half.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>{fmtMoisture(half)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtCutting(half)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtBend(half)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtGrains(half)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.mixRaw || half.mix)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{half.smixEnabled ? fmtField(half.mixSRaw || half.mixS) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{half.lmixEnabled ? fmtField(half.mixLRaw || half.mixL) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.kanduRaw || half.kandu)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.oilRaw || half.oil)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.skRaw || half.sk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.wbRRaw || half.wbR)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.wbBkRaw || half.wbBk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(half.wbTRaw || half.wbT)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{half.smellHas ? 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{half.paddyWbEnabled ? fmtField(half.paddyWbRaw || half.paddyWb) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                                      {half.imageUrl ? <a href={resolveMediaUrl(half.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                                    </td>
                                  </tr>
                                )}

                                {/* Full Lorry */}
                                {stages.full_avg && (
                                  <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '800', color: '#e05300' }}>Full Lorry</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: '600' }}>{fmtField(full.reportedBy)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{full.reportedAt ? new Date(full.reportedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>{fmtMoisture(full)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtCutting(full)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtBend(full)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtGrains(full)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.mixRaw || full.mix)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{full.smixEnabled ? fmtField(full.mixSRaw || full.mixS) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{full.lmixEnabled ? fmtField(full.mixLRaw || full.mixL) || 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.kanduRaw || full.kandu)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.oilRaw || full.oil)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.skRaw || full.sk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.wbRRaw || full.wbR)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.wbBkRaw || full.wbBk)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{fmtField(full.wbTRaw || full.wbT)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{full.smellHas ? 'Yes' : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{full.paddyWbEnabled ? fmtField(full.paddyWbRaw || full.paddyWb) : '-'}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                                      {full.imageUrl ? <a href={resolveMediaUrl(full.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })}
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
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>LOADED BAGS</th>
                    <th style={{ padding: '8px', fontWeight: '800', textAlign: 'center' }}>PHOTO</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const stages = selectedLorryForComparison.samplingStages || {};
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
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1a1a1a', fontWeight: '700' }}>{isFull ? formatField(selectedLorryForComparison.bags) : '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {stageObj.imageUrl ? <a href={resolveMediaUrl(stageObj.imageUrl)} target="_blank" rel="noreferrer" style={{ color: '#1565c0', fontWeight: 'bold' }}>🖼️ View</a> : '-'}
                          </td>
                        </tr>
                      );
                    };

                    return (
                      <>
                        {renderRow('Lot Avg', '#1565c0', '#f0f9ff', lot, false)}
                        {renderRow('Half Lorry', '#b45309', '#fffbeb', half, false)}
                        {renderRow('Full Avg Lorry', '#15803d', '#f0fdf4', full, true)}
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
    </div>
  );
};

export default SampleApprovalsHub;
