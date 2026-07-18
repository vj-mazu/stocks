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
      const res = await axios.get(`${API_URL}/arrivals?status=approved&limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allEntries = res.data?.arrivals || res.data?.data || [];
      // Show entries with pending place OR pending wb
      const pending = allEntries.filter((e: any) => 
        e.placeStatus === 'pending' || e.wbStatus === 'pending'
      );
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
  if (rows.length === 0) {
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

  // ─── Main Table ────────────────────────────────────────────
  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '12px',
        flexWrap: 'wrap', alignItems: 'center'
      }}>
        <span style={{
          background: '#92400e', color: '#fff', padding: '4px 14px',
          borderRadius: '20px', fontWeight: '700', fontSize: '12px'
        }}>
          🚛 {rows.length} Pending
        </span>
        {pendingEntries.filter(e => e.placeStatus === 'pending').length > 0 && (
          <span style={{
            background: COLORS.kunchinittu.bg, color: COLORS.kunchinittu.text,
            padding: '4px 12px', borderRadius: '20px',
            fontWeight: '600', fontSize: '11px',
            border: `1px solid ${COLORS.kunchinittu.border}`
          }}>
            📍 {pendingEntries.filter(e => e.placeStatus === 'pending').length} Place
          </span>
        )}
        {pendingEntries.filter(e => e.wbStatus === 'pending').length > 0 && (
          <span style={{
            background: COLORS.wb.bg, color: COLORS.wb.text,
            padding: '4px 12px', borderRadius: '20px',
            fontWeight: '600', fontSize: '11px',
            border: `1px solid ${COLORS.wb.border}`
          }}>
            ⚖️ {pendingEntries.filter(e => e.wbStatus === 'pending').length} WB
          </span>
        )}
      </div>

      <div style={{
        overflowX: 'auto', borderRadius: '10px',
        border: `2px solid #d97706`,
        boxShadow: '0 4px 16px rgba(217,119,6,0.15)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #92400e, #b45309)', color: '#fff' }}>
              <th style={CELL_HEAD}>#</th>
              <th style={CELL_HEAD}>Date</th>
              <th style={CELL_HEAD}>Party / Lorry</th>
              <th style={CELL_HEAD}>Bags</th>
              <th style={CELL_HEAD}>Variety</th>
              <th style={CELL_HEAD}>Type</th>
              <th style={{ ...CELL_HEAD, minWidth: '220px' }}>📍 Place Details</th>
              <th style={{ ...CELL_HEAD, minWidth: '140px' }}>⚖️ WB Details</th>
              <th style={{ ...CELL_HEAD, textAlign: 'center', minWidth: '160px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, entry, type }, idx) => {
              const isPlace = type === 'place';
              const isWB = type === 'wb';
              const placeType = entry.placeType || 'kunchinittu';
              const isProduction = placeType === 'production';
              
              // Row highlight colors
              let rowBg: string;
              if (isPlace && isProduction) {
                rowBg = idx % 2 === 0 ? '#faf5ff' : '#f3e8ff';
              } else if (isPlace) {
                rowBg = idx % 2 === 0 ? '#f0f9ff' : '#e0f2fe';
              } else {
                rowBg = idx % 2 === 0 ? '#fffbeb' : '#fef3c7';
              }

              const isHovered = hoveredRow === key;

              return (
                <tr
                  key={key}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: isHovered
                      ? isPlace && isProduction ? '#ede9fe' : isPlace ? '#dbeafe' : '#fde68a'
                      : rowBg,
                    borderBottom: isPlace
                      ? `2px solid ${isProduction ? COLORS.production.border : COLORS.kunchinittu.border}`
                      : `2px solid ${COLORS.wb.border}`,
                    transition: 'background 0.15s ease',
                    opacity: isPlace && entry.placeStatus === 'approved' ? 0.6 : 1
                  }}
                >
                  {/* Serial */}
                  <td style={{ ...CELL, fontWeight: '700', color: '#475569' }}>
                    {idx + 1}
                  </td>

                  {/* Date */}
                  <td style={CELL}>
                    <span style={{ fontWeight: 600 }}>{formatDate(entry.date || entry.entryDate)}</span>
                  </td>

                  {/* Party + Lorry */}
                  <td style={{ ...CELL, fontWeight: '600' }}>
                    <div style={{ color: '#1e293b' }}>
                      {entry.partyName || entry.broker || '-'}
                    </div>
                    <div style={{
                      fontWeight: '800', color: '#1e40af', fontSize: '13px',
                      fontFamily: 'monospace', marginTop: '2px'
                    }}>
                      🚚 {entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '-'}
                    </div>
                  </td>

                  {/* Bags */}
                  <td style={{ ...CELL, fontWeight: '700', textAlign: 'center' }}>
                    {entry.bags || '-'}
                  </td>

                  {/* Variety */}
                  <td style={CELL}>
                    <span style={{
                      background: '#f1f5f9', padding: '2px 8px',
                      borderRadius: '4px', fontWeight: 600, fontSize: '11px',
                      color: '#334155'
                    }}>
                      {entry.variety || '-'}
                    </span>
                  </td>

                  {/* Type badge */}
                  <td style={CELL}>
                    {isPlace ? <PlaceTypeBadge type={placeType} /> : <WbTypeBadge type={entry.wbInputType} />}
                  </td>

                  {/* 📍 PLACE DETAILS */}
                  <td style={CELL}>
                    {isProduction ? (
                      // Production (Outturn) style — Purple
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: '#f3e8ff', padding: '6px 10px', borderRadius: '6px',
                          border: '1px solid #d8b4fe'
                        }}>
                          <span style={{ fontSize: '16px' }}>🏭</span>
                          <div>
                            <div style={{ fontSize: '10px', color: '#6b21a8', fontWeight: 600 }}>OUTTURN</div>
                            <div style={{ fontWeight: '800', color: '#581c87', fontSize: '13px' }}>
                              {entry.outturn?.code || entry.placeOutturnCode || '-'}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#7c3aed' }}>
                          Date: <b>{entry.placeDate ? formatDate(entry.placeDate) : '-'}</b>
                        </div>
                        {/* Show status */}
                        <div style={{ marginTop: '2px' }}>
                          <span style={STATUS_BADGE[entry.placeStatus] || STATUS_BADGE.pending}>
                            {entry.placeStatus === 'approved' ? '✅ Approved' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Kunchinittu style — Blue/Teal
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: '#e0f2fe', padding: '6px 10px', borderRadius: '6px',
                          border: '1px solid #7dd3fc'
                        }}>
                          <span style={{ fontSize: '14px' }}>🏢</span>
                          <div>
                            <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 600 }}>WAREHOUSE</div>
                            <div style={{ fontWeight: '700', color: '#075985', fontSize: '12px' }}>
                              {entry.placeWarehouse?.name || entry.placeWarehouseCode || entry.placeWarehouse?.code || '-'}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px',
                          border: '1px solid #bae6fd'
                        }}>
                          <span style={{ fontSize: '14px' }}>📦</span>
                          <div>
                            <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 600 }}>KUNCHINITTU</div>
                            <div style={{ fontWeight: '700', color: '#075985', fontSize: '12px' }}>
                              {entry.placeKunchinittuData?.name || entry.placeKunchinittuCode || entry.placeKunchinittuData?.code || '-'}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '10px', color: '#0ea5e9' }}>
                          Date: <b>{entry.placeDate ? formatDate(entry.placeDate) : '-'}</b>
                        </div>
                        {/* Show status */}
                        <div style={{ marginTop: '2px' }}>
                          <span style={STATUS_BADGE[entry.placeStatus] || STATUS_BADGE.pending}>
                            {entry.placeStatus === 'approved' ? '✅ Approved' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* ⚖️ WB DETAILS */}
                  <td style={CELL}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: '4px',
                      background: '#fffbeb', padding: '6px 10px', borderRadius: '6px',
                      border: '1px solid #fde68a'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 600, fontSize: '11px', color: '#92400e'
                        }}>
                          {entry.wbInputType === 'mill' ? '🏭 Mill' : '🚛 Party'}
                        </span>
                        <span style={{ fontWeight: '800', color: '#78350f', fontSize: '12px' }}>
                          {entry.millWeightBridge?.name || entry.millWbName || entry.partyWbName || '-'}
                        </span>
                      </div>
                      {entry.wbNo && (
                        <div style={{ fontSize: '10px', color: '#b45309' }}>
                          Slip: <b>{entry.wbNo}</b>
                        </div>
                      )}
                      <div style={{ marginTop: '2px' }}>
                        <span style={STATUS_BADGE[entry.wbStatus] || STATUS_BADGE.pending}>
                          {entry.wbStatus === 'approved' ? '✅ Approved' : entry.wbStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* ACTIONS */}
                  <td style={{ ...CELL, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {(isPlace && entry.placeStatus === 'pending') || (isWB && entry.wbStatus === 'pending') ? (
                        <>
                          <button
                            onClick={() => handleApprove(entry.id, type)}
                            style={BTN_PRIMARY}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.35)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => handleReject(entry.id, type)}
                            style={BTN_DANGER}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,38,38,0.35)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                            }}
                          >
                            ❌ Reject
                          </button>
                        </>
                      ) : (
                        <span style={{
                          color: '#16a34a', fontWeight: 700, fontSize: '11px',
                          background: '#dcfce7', padding: '4px 12px', borderRadius: '20px'
                        }}>
                          ✅ Done
                        </span>
                      )}
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

export default TransitApprovalsTab;
