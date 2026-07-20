import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';

// ─── Styling Constants ───────────────────────────────────────────
const COLORS = {
  production: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', label: '🏭 Production' },
  kunchinittu: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1', label: '📍 Kunchinittu' },
  wb: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', label: '⚖️ Weight Bridge' },
  approved: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  pending: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  rejected: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
} as const;

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  approved: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
    background: COLORS.approved.bg, color: COLORS.approved.text,
    border: `1px solid ${COLORS.approved.border}`, textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  pending: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
    background: COLORS.pending.bg, color: COLORS.pending.text,
    border: `1px solid ${COLORS.pending.border}`, textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  rejected: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
    background: COLORS.rejected.bg, color: COLORS.rejected.text,
    border: `1px solid ${COLORS.rejected.border}`, textTransform: 'uppercase', letterSpacing: '0.5px'
  }
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: '6px 14px', border: 'none', borderRadius: '6px',
  background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff',
  fontWeight: '700', fontSize: '11px', cursor: 'pointer',
  transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  display: 'inline-flex', alignItems: 'center', gap: '4px'
};

const BTN_DANGER: React.CSSProperties = {
  padding: '6px 14px', border: 'none', borderRadius: '6px',
  background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff',
  fontWeight: '700', fontSize: '11px', cursor: 'pointer',
  transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  display: 'inline-flex', alignItems: 'center', gap: '4px'
};

const CELL: React.CSSProperties = {
  border: '1px solid #e5e7eb', padding: '10px 12px', fontSize: '12px',
  verticalAlign: 'middle'
};

const CELL_HEAD: React.CSSProperties = {
  border: '1px solid #78350f', padding: '10px 12px', fontWeight: '700',
  fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap'
};

// ─── Helpers ─────────────────────────────────────────────────────
const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const PlaceTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const style = type === 'production' ? COLORS.production : COLORS.kunchinittu;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
      background: style.bg, color: style.text,
      border: `1px solid ${style.border}`, letterSpacing: '0.3px'
    }}>
      {style.label}
    </span>
  );
};

const WbTypeBadge: React.FC<{ type: string }> = ({ type }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
    background: type === 'mill' ? '#dbeafe' : '#fce7f3',
    color: type === 'mill' ? '#1d4ed8' : '#9d174d',
    border: `1px solid ${type === 'mill' ? '#93c5fd' : '#f9a8d4'}`,
    letterSpacing: '0.3px'
  }}>
    {type === 'mill' ? '🏭 Mill WB' : '🚛 Party WB'}
  </span>
);

// ─── Component ───────────────────────────────────────────────────
const TransitApprovalsTab: React.FC = () => {
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/arrivals/transit-approvals/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const pending = res.data?.arrivals || res.data?.data || [];
      setPendingEntries(pending);
    } catch (err) {
      console.error('Failed to fetch transit approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleApprove = async (id: number, type: 'place' | 'wb') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/approve-${type}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${type === 'place' ? '📍 Place' : '⚖️ Weight Bridge'} approved!`);
      fetchPendingApprovals();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to approve ${type}`);
    }
  };

  const handleReject = async (id: number, type: 'place' | 'wb') => {
    const reason = prompt(`Reason for rejecting ${type === 'place' ? 'Place' : 'WB'}:`);
    if (!reason) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/reject-${type}`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${type === 'place' ? '📍 Place' : '⚖️ WB'} rejected.`);
      fetchPendingApprovals();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to reject ${type}`);
    }
  };
  // ─── Aggregate rows: each entry may produce multiple rows ──
  const rows = useMemo(() => {
    const result: {
      key: string; entry: any; type: 'place' | 'wb'
    }[] = [];
    pendingEntries.forEach((entry) => {
      if (entry.placeStatus === 'pending') {
        result.push({ key: `place-${entry.id}`, entry, type: 'place' });
      }
      if (entry.wbStatus === 'pending') {
        result.push({ key: `wb-${entry.id}`, entry, type: 'wb' });
      }
    });
    return result;
  }, [pendingEntries]);

  const placeRows = useMemo(() => {
    return pendingEntries.filter(entry => entry.placeStatus === 'pending');
  }, [pendingEntries]);

  const wbRows = useMemo(() => {
    return pendingEntries.filter(entry => entry.wbStatus === 'pending');
  }, [pendingEntries]);

  // ─── Loading State ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{
          width: '40px', height: '40px', margin: '0 auto 16px',
          border: '4px solid #e2e8f0', borderTopColor: '#d97706',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Loading transit approvals...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────────────
  if (placeRows.length === 0 && wbRows.length === 0) {
    return (
      <div style={{
        padding: '40px 16px', textAlign: 'center',
        color: '#64748b', fontWeight: 600,
        backgroundColor: '#f8fafc', borderRadius: '12px',
        border: '2px dashed #cbd5e1'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
        <div>All In Transit approvals cleared!</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
          No pending Place or Weight Bridge approvals.
        </div>
      </div>
    );
  }

  const CELL: React.CSSProperties = {
    padding: '8px 10px',
    borderRight: '1px solid #cbd5e1',
    borderBottom: '1px solid #cbd5e1',
    verticalAlign: 'middle',
    fontSize: '11.5px',
    textAlign: 'center'
  };

  const PLACE_HEAD: React.CSSProperties = {
    padding: '8px 10px',
    borderRight: '1px solid #1e40af',
    borderBottom: '2px solid #1e40af',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: '11.5px',
    color: '#fff',
    backgroundColor: '#1e40af',
    whiteSpace: 'nowrap'
  };

  const WB_HEAD: React.CSSProperties = {
    padding: '8px 10px',
    borderRight: '1px solid #c2410c',
    borderBottom: '2px solid #c2410c',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: '11.5px',
    color: '#fff',
    backgroundColor: '#c2410c',
    whiteSpace: 'nowrap'
  };

  // ─── Main View ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 📍 SECTION 1: PLACE LOCATION APPROVALS */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px', paddingBottom: '6px', borderBottom: '2px solid #3b82f6'
        }}>
          <h3 style={{ margin: 0, color: '#1d4ed8', fontSize: '15px', fontWeight: 800 }}>
            📍 Place Location Approvals ({placeRows.length})
          </h3>
        </div>

        {placeRows.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: '#1e40af', fontWeight: '600',
            background: '#eff6ff', border: '1px dashed #bfdbfe', borderRadius: '8px'
          }}>
            ✅ No pending Place Location approvals.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #3b82f6', boxShadow: '0 4px 12px rgba(59,130,246,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ ...PLACE_HEAD, width: '40px' }}>#</th>
                  <th style={{ ...PLACE_HEAD, width: '90px' }}>Date</th>
                  <th style={{ ...PLACE_HEAD, textAlign: 'left', minWidth: '180px' }}>Party / Lorry</th>
                  <th style={{ ...PLACE_HEAD, width: '60px' }}>Bags</th>
                  <th style={{ ...PLACE_HEAD, minWidth: '120px' }}>Variety</th>
                  <th style={{ ...PLACE_HEAD, width: '110px' }}>Dest Type</th>
                  <th style={PLACE_HEAD}>Warehouse / Outturn</th>
                  <th style={PLACE_HEAD}>Kunchinittu</th>
                  <th style={{ ...PLACE_HEAD, width: '95px' }}>Place Date</th>
                  <th style={{ ...PLACE_HEAD, width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {placeRows.map((entry, idx) => {
                  const sampleEntry = entry.sampleEntry || {};
                  const inspection = entry.physicalInspection || {};
                  const lorryNumber = entry.lorryNumber || inspection.lorryNumber || sampleEntry.lorryNumber || '-';
                  const isProduction = entry.placeType === 'production';

                  return (
                    <tr key={`place-${entry.id}`} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? '#ffffff' : '#f0f9ff' }}>
                      <td style={{ ...CELL, fontWeight: '700', color: '#475569' }}>{idx + 1}</td>
                      <td style={{ ...CELL, whiteSpace: 'nowrap' }}>{formatDate(entry.createdAt)}</td>
                      <td style={{ ...CELL, textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{sampleEntry.partyName || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold', marginTop: '2px' }}>🚚 {lorryNumber.toUpperCase()}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{sampleEntry.variety || '-'} | Broker: {sampleEntry.brokerName || '-'}</div>
                      </td>
                      <td style={{ ...CELL, fontWeight: 'bold' }}>{inspection.bags || sampleEntry.bags || '-'}</td>
                      <td style={CELL}>
                        <span style={{
                          background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px',
                          fontWeight: 600, fontSize: '11px', color: '#334155'
                        }}>
                          {sampleEntry.variety || '-'}
                        </span>
                      </td>
                      <td style={CELL}>
                        <PlaceTypeBadge type={entry.placeType} />
                      </td>
                      <td style={{ ...CELL, fontWeight: '700', color: isProduction ? '#6b21a8' : '#0369a1' }}>
                        {isProduction 
                          ? (entry.outturn?.code || entry.placeOutturnCode || '-')
                          : (entry.placeWarehouse?.name || entry.placeWarehouseCode || '-')}
                      </td>
                      <td style={{ ...CELL, color: '#0369a1' }}>
                        {isProduction ? '-' : (entry.placeKunchinittuData?.name || entry.placeKunchinittuCode || '-')}
                      </td>
                      <td style={{ ...CELL, whiteSpace: 'nowrap' }}>{formatDate(entry.placeDate)}</td>
                      <td style={{ ...CELL, borderRight: 'none' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleApprove(entry.id, 'place')}
                            style={BTN_PRIMARY}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(22,163,74,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'; }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(entry.id, 'place')}
                            style={BTN_DANGER}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(220,38,38,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'; }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ⚖️ SECTION 2: WEIGHT BRIDGE (WB) APPROVALS */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px', paddingBottom: '6px', borderBottom: '2px solid #ea580c'
        }}>
          <h3 style={{ margin: 0, color: '#c2410c', fontSize: '15px', fontWeight: 800 }}>
            ⚖️ Weight Bridge (WB) Approvals ({wbRows.length})
          </h3>
        </div>

        {wbRows.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: '#c2410c', fontWeight: '600',
            background: '#fffbeb', border: '1px dashed #fde68a', borderRadius: '8px'
          }}>
            ✅ No pending Weight Bridge approvals.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #ea580c', boxShadow: '0 4px 12px rgba(234,88,12,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ ...WB_HEAD, width: '40px' }}>#</th>
                  <th style={{ ...WB_HEAD, width: '90px' }}>Date</th>
                  <th style={{ ...WB_HEAD, textAlign: 'left', minWidth: '180px' }}>Party / Lorry</th>
                  <th style={{ ...WB_HEAD, width: '60px' }}>Bags</th>
                  <th style={{ ...WB_HEAD, width: '90px' }}>WB Type</th>
                  <th style={WB_HEAD}>WB Name</th>
                  <th style={WB_HEAD}>Slip No</th>
                  <th style={WB_HEAD}>Gross Wt</th>
                  <th style={WB_HEAD}>Tare Wt</th>
                  <th style={WB_HEAD}>Net Wt</th>
                  <th style={{ ...WB_HEAD, width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {wbRows.map((entry, idx) => {
                  const sampleEntry = entry.sampleEntry || {};
                  const inspection = entry.physicalInspection || {};
                  const lorryNumber = entry.lorryNumber || inspection.lorryNumber || sampleEntry.lorryNumber || '-';

                  return (
                    <tr key={`wb-${entry.id}`} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? '#ffffff' : '#fffbeb' }}>
                      <td style={{ ...CELL, fontWeight: '700', color: '#475569' }}>{idx + 1}</td>
                      <td style={{ ...CELL, whiteSpace: 'nowrap' }}>{formatDate(entry.createdAt)}</td>
                      <td style={{ ...CELL, textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{sampleEntry.partyName || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold', marginTop: '2px' }}>🚚 {lorryNumber.toUpperCase()}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{sampleEntry.variety || '-'} | Broker: {sampleEntry.brokerName || '-'}</div>
                      </td>
                      <td style={{ ...CELL, fontWeight: 'bold' }}>{inspection.bags || sampleEntry.bags || '-'}</td>
                      <td style={CELL}>
                        <WbTypeBadge type={entry.wbInputType} />
                      </td>
                      <td style={{ ...CELL, fontWeight: '700', color: '#78350f' }}>
                        {entry.wbInputType === 'mill' 
                          ? (entry.millWeightBridge?.name || entry.millWbName || '-')
                          : (entry.partyWbName || '-')}
                      </td>
                      <td style={{ ...CELL, fontWeight: '700' }}>{entry.wbNo || '-'}</td>
                      <td style={CELL}>{entry.grossWeight ? `${entry.grossWeight} Kg` : '-'}</td>
                      <td style={CELL}>{entry.tareWeight ? `${entry.tareWeight} Kg` : '-'}</td>
                      <td style={{ ...CELL, fontWeight: '700', color: '#16a34a' }}>{entry.netWeight ? `${entry.netWeight} Kg` : '-'}</td>
                      <td style={{ ...CELL, borderRight: 'none' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleApprove(entry.id, 'wb')}
                            style={BTN_PRIMARY}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(22,163,74,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'; }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(entry.id, 'wb')}
                            style={BTN_DANGER}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(220,38,38,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'; }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransitApprovalsTab;
