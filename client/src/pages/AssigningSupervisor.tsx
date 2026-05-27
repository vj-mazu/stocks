import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';
import {
  getDisplayedEntryTypeCode,
  getEntryTypeTextColor,
  getOriginalEntryTypeCode,
  getConvertedEntryTypeCode,
  isConvertedResampleType
} from '../utils/sampleTypeDisplay';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  workflowStatus: string;
  entryType?: string;
  originalEntryType?: string;
  lorryNumber?: string;
  packaging?: string;
  lotSelectionDecision?: string;
  qualityReportAttempts?: number;
  qualityAttemptDetails?: any[];
  resampleCollectedTimeline?: any[];
  resampleCollectedHistory?: any[];
  resampleStartAt?: string;
  lotSelectionAt?: string;
  updatedAt?: string;
  createdAt?: string;
  lotAllotment?: {
    id: string;
    supervisor: {
      id: number;
      username: string;
    } | null;
  } | null;
}

interface Supervisor {
  id: number;
  username: string;
  fullName?: string | null;
  staffType?: string | null;
}

const AssigningSupervisor: React.FC = () => {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupervisors, setSelectedSupervisors] = useState<{ [key: string]: number }>({});
  const [offeringCache, setOfferingCache] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  // Removed fallback modal state - handled in Loading Lots tab now

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
    loadSupervisors();
  }, [page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch ONLY entries with LOT_ALLOTMENT status that don't have supervisor assigned yet
      const response = await axios.get(`${API_URL}/sample-entries/by-role?status=LOT_ALLOTMENT&page=${page}&pageSize=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data as any;
      const allPendingEntries = data.entries || [];

      // Filter out entries that already have supervisor assigned
      // Also include resample lots that have a lotAllotment record but no supervisor assigned yet
      const entriesWithoutSupervisor = allPendingEntries.filter((entry: SampleEntry) =>
        !entry.lotAllotment || !entry.lotAllotment.supervisor
      );

      // Load offering data for each entry
      const offerCache: { [key: string]: any } = {};

      // Batch load offering data - make single call with multiple IDs
      if (entriesWithoutSupervisor.length > 0) {
        try {
          const ids = entriesWithoutSupervisor.map((e: SampleEntry) => e.id).join(',');
          const offerRes = await axios.get(`${API_URL}/sample-entries/offering-data-batch?ids=${ids}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (offerRes.data) {
            Object.assign(offerCache, offerRes.data);
          }
        } catch {
          // Fallback to individual calls
          for (const entry of entriesWithoutSupervisor) {
            try {
              const offerRes = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              offerCache[entry.id] = offerRes.data || {};
            } catch { /* skip */ }
          }
        }
      }

      // Filter to only include entries where all required manager values are filled (needsFill is false)
      const filteredEntries = entriesWithoutSupervisor.filter((entry: SampleEntry) => {
        const o = offerCache[entry.id] || {};
        const needsFill = (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) ||
          (o.moistureEnabled === false && !parseFloat(o.moistureValue)) ||
          (o.hamaliEnabled === false && !parseFloat(o.hamali)) ||
          (o.brokerageEnabled === false && !parseFloat(o.brokerage)) ||
          (o.lfEnabled === false && !parseFloat(o.lf));
        return !needsFill;
      });

      setEntries(filteredEntries);
      setOfferingCache(offerCache);
      setTotal(filteredEntries.length);
      setTotalPages(Math.ceil(filteredEntries.length / pageSize));

    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
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

  const handleAssignClick = (entry: SampleEntry) => {
    const o = offeringCache[entry.id] || {};
    const supervisorId = selectedSupervisors[entry.id];

    // Safety check - shouldn't happen due to UI disabled state, but just in case
    const needsFill = (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) ||
      (o.moistureEnabled === false && !parseFloat(o.moistureValue)) ||
      (o.hamaliEnabled === false && !parseFloat(o.hamali)) ||
      (o.brokerageEnabled === false && !parseFloat(o.brokerage)) ||
      (o.lfEnabled === false && !parseFloat(o.lf));

    if (needsFill) {
      showNotification('Please fill missing financial values in the Loading Lots tab first.', 'error');
      return;
    }

    if (!supervisorId) {
      showNotification('Please select a physical supervisor', 'error');
      return;
    }

    // Assign directly
    handleAssign(entry.id);
  };

  const handleAssign = async (entryId: string) => {
    if (isSubmitting) return;
    const supervisorId = selectedSupervisors[entryId];

    if (!supervisorId) {
      showNotification('Please select a physical supervisor', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');

      // Server-side LotAllotmentService auto-transitions LOT_ALLOTMENT → PHYSICAL_INSPECTION
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/lot-allotment`,
        {
          physicalSupervisorId: supervisorId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Physical supervisor assigned successfully! Entry moved to Physical Inspection.', 'success');

      // Clear the selected supervisor for this entry
      setSelectedSupervisors(prev => {
        const updated = { ...prev };
        delete updated[entryId];
        return updated;
      });

      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to assign supervisor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Sort the entries before grouping: Date descending, then Serial No ascending
  const sortedEntries = [...entries].sort((a, b) => {
    const dateCompare = getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime();
    if (dateCompare !== 0) return dateCompare;
    const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
    const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
    if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // Group entries by Date + Broker
  const groupedEntries: Record<string, Record<string, SampleEntry[]>> = {};
  sortedEntries.forEach(entry => {
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
      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #999' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending supervisor allotment</div>
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed', border: '1px solid #000' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'center', width: '4%' }}>SL No</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'center', width: '4%' }}>Type</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'center', width: '5%' }}>Bags</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'center', width: '4%' }}>Pkg</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'left', width: '20%' }}>Party Name</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'left', width: '18%' }}>Paddy Location</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'left', width: '15%' }}>Variety</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'left', width: '18%' }}>Select Supervisor</th>
                          <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: '700', fontSize: '13px', textAlign: 'left', width: '12%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedEntries.map((entry, index) => {
                          return (
                            <tr key={entry.id} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>
                                {index + 1}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', fontWeight: '700' }}>
                                {(() => {
                                  const typeCode = getDisplayedEntryTypeCode(entry);
                                  const isResample = isConvertedResampleType(entry);
                                  if (isResample) {
                                    const orig = getOriginalEntryTypeCode(entry);
                                    const conv = getConvertedEntryTypeCode(entry);
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: getEntryTypeTextColor(orig) }}>{orig}</span>
                                        <span style={{
                                          display: 'inline-block',
                                          minWidth: '28px',
                                          padding: '1px 4px',
                                          borderRadius: '3px',
                                          fontSize: '13px',
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
                                      fontSize: '13px',
                                      fontWeight: 800,
                                      textAlign: 'center',
                                      color: typeCode === 'RL' || typeCode === 'LS' ? '#fff' : '#166534',
                                      backgroundColor: typeCode === 'RL' ? '#1565c0' : typeCode === 'LS' ? '#c2410c' : '#fff',
                                      border: typeCode === 'MS' ? '1px solid #166534' : 'none'
                                    }}>{typeCode}</span>
                                  );
                                })()}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>
                                {entry.bags}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'center', fontSize: '13px', color: '#1a1a1a' }}>
                                {entry.packaging ? (String(entry.packaging).toLowerCase().includes('kg') ? entry.packaging : `${entry.packaging} Kg`) : '75 Kg'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>
                                {(() => {
                                  const typeCode = getDisplayedEntryTypeCode(entry);
                                  const isLorryEntry = typeCode === 'RL' || 
                                                       entry.entryType === 'DIRECT_LOADED_VEHICLE' || 
                                                       entry.entryType === 'READY_LORRY' || 
                                                       entry.originalEntryType === 'DIRECT_LOADED_VEHICLE' || 
                                                       entry.originalEntryType === 'READY_LORRY';
                                  const partyText = String(entry.partyName || '').trim();
                                  const lorryText = entry.lorryNumber ? String(entry.lorryNumber).toUpperCase().trim() : '';
                                  const primaryText = isLorryEntry ? (lorryText || partyText || '-') : (partyText || lorryText || '-');
                                  const secondaryText = isLorryEntry && partyText && lorryText && partyText.toUpperCase() !== lorryText ? partyText : '';

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <span
                                        onClick={() => openDetailEntry(entry)}
                                        style={{
                                          color: '#1565c0',
                                          textDecoration: 'underline',
                                          cursor: 'pointer',
                                          fontWeight: '700'
                                        }}
                                      >
                                        {primaryText}
                                      </span>
                                      {secondaryText && (
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                                          {secondaryText}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontSize: '13px', color: '#1a1a1a' }}>
                                {entry.location}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontSize: '13px', color: '#1a1a1a' }}>
                                {entry.variety}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>
                                {user?.role !== 'manager' ? (
                                  <div style={{ fontSize: '13px', color: '#7f8c8d', fontStyle: 'italic' }}>
                                    Manager action only
                                  </div>
                                ) : (
                                  <select
                                    value={selectedSupervisors[entry.id] || ''}
                                    onChange={(e) => handleSupervisorChange(entry.id, Number(e.target.value))}
                                    style={{ width: '100%', padding: '6px', fontSize: '13px', border: '1px solid #999', borderRadius: '3px', color: '#1a1a1a', fontWeight: '500' }}
                                  >
                                    <option value="">-- Select Supervisor --</option>
                                    {supervisors.map(supervisor => (
                                      <option key={supervisor.id} value={supervisor.id}>
                                        {supervisor.fullName || supervisor.username}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>
                                <button
                                  onClick={() => handleAssignClick(entry)}
                                  disabled={!selectedSupervisors[entry.id] || user?.role !== 'manager' || isSubmitting}
                                  style={{
                                    fontSize: '13px', padding: '6px 12px', fontWeight: '600',
                                    backgroundColor: (selectedSupervisors[entry.id] && user?.role === 'manager' && !isSubmitting) ? '#4CAF50' : '#ccc',
                                    color: 'white', border: 'none', borderRadius: '3px',
                                    cursor: (selectedSupervisors[entry.id] && user?.role === 'manager' && !isSubmitting) ? 'pointer' : 'not-allowed'
                                  }}
                                >
                                  {isSubmitting ? '...' : 'Assign'}
                                </button>
                              </td>
                            </tr>
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
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px', alignItems: 'center' }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid #bbb', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', background: page === 1 ? '#f5f5f5' : 'white' }}>First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid #bbb', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', background: page === 1 ? '#f5f5f5' : 'white' }}>Prev</button>
          <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} ({total} total)</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 12px', border: '1px solid #bbb', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', background: page === totalPages ? '#f5f5f5' : 'white' }}>Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '6px 12px', border: '1px solid #bbb', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', background: page === totalPages ? '#f5f5f5' : 'white' }}>Last</button>
        </div>
      )}

      {/* Fallback modal removed as logic is now in Loading Lots */}
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

export default AssigningSupervisor;
