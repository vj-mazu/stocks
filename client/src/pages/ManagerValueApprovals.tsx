import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

interface ApprovalEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  brokerName?: string;
  partyName?: string;
  location?: string;
  variety?: string;
  bags?: number;
  packaging?: string;
  pendingManagerValueApprovalRequestedByName?: string;
  offering?: {
    pendingManagerValueApprovalRequestedAt?: string | null;
    pendingManagerValueApprovalData?: Record<string, any> | null;
    [key: string]: any;
  };
}

const toTitleCase = (value: string) => String(value || '').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const toDisplayNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? String(value).replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1') : String(value ?? '-');
};
const formatChargeUnit = (unit?: string) => unit === 'per_quintal'
  ? 'Per Quintal'
  : unit === 'per_bag'
    ? 'Per Bag'
    : unit === 'percentage'
      ? 'Percent'
      : unit === 'lumps'
        ? 'Lumps'
        : unit === 'days'
          ? 'Days'
          : unit === 'month'
            ? 'Month'
            : unit || '';

type PendingSummaryRow = {
  key: string;
  label: string;
  value: string;
  tone: {
    background: string;
    border: string;
    labelBackground: string;
    labelColor: string;
    textColor: string;
  };
};

const managerPendingFieldTone: PendingSummaryRow['tone'] = {
  background: '#fff7ed',
  border: '#fdba74',
  labelBackground: '#ffedd5',
  labelColor: '#c2410c',
  textColor: '#9a3412'
};

const standardPendingFieldTone: PendingSummaryRow['tone'] = {
  background: '#eff6ff',
  border: '#bfdbfe',
  labelBackground: '#dbeafe',
  labelColor: '#1d4ed8',
  textColor: '#1e3a8a'
};

const managerHighlightedFieldKeys = new Set(['hamali', 'brokerage', 'lf']);

const normalizeComparableValue = (value: any) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value).trim();
  if (text === '') return '';
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return String(numeric);
  return text.toLowerCase();
};

const pendingComparisonKeysMap: Record<string, string[]> = {
  finalSute: ['finalSute', 'finalSuteUnit'],
  moistureValue: ['moistureValue'],
  hamali: ['hamali', 'hamaliUnit'],
  brokerage: ['brokerage', 'brokerageUnit'],
  lf: ['lf', 'lfUnit'],
  cdValue: ['cdValue', 'cdUnit', 'cdEnabled'],
  bankLoanValue: ['bankLoanValue', 'bankLoanUnit', 'bankLoanEnabled'],
  paymentConditionValue: ['paymentConditionValue', 'paymentConditionUnit'],
  egbValue: ['egbValue', 'egbType']
};

const hasPendingFieldChanged = (offering: Record<string, any> | undefined, pendingData: Record<string, any> | null | undefined, rowKey: string) => {
  const compareKeys = pendingComparisonKeysMap[rowKey] || [rowKey];
  return compareKeys.some((key) => {
    if (!pendingData || !(key in pendingData)) return false;
    return normalizeComparableValue(pendingData[key]) !== normalizeComparableValue(offering?.[key]);
  });
};

const buildPendingSummary = (data?: Record<string, any> | null, offering?: Record<string, any>): PendingSummaryRow[] => {
  if (!data) return [];
  const rows: PendingSummaryRow[] = [];
  const pushRow = (key: string, label: string, value: string) => {
    const shouldHighlight = managerHighlightedFieldKeys.has(key) && hasPendingFieldChanged(offering, data, key);
    rows.push({
      key,
      label,
      value,
      tone: shouldHighlight ? managerPendingFieldTone : standardPendingFieldTone
    });
  };
  if (data.finalSute !== undefined) pushRow('finalSute', 'Sute', `${toDisplayNumber(data.finalSute)} ${formatChargeUnit(data.finalSuteUnit)}`.trim());
  if (data.moistureValue !== undefined) pushRow('moistureValue', 'Moisture', `${toDisplayNumber(data.moistureValue)}%`);
  if (data.hamali !== undefined) pushRow('hamali', 'Hamali', `${toDisplayNumber(data.hamali)} ${formatChargeUnit(data.hamaliUnit)}`.trim());
  if (data.brokerage !== undefined) pushRow('brokerage', 'Brokerage', `${toDisplayNumber(data.brokerage)} ${formatChargeUnit(data.brokerageUnit)}`.trim());
  if (data.lf !== undefined) pushRow('lf', 'LF', `${toDisplayNumber(data.lf)} ${formatChargeUnit(data.lfUnit)}`.trim());
  if (data.cdValue !== undefined) pushRow('cdValue', 'CD', `${toDisplayNumber(data.cdValue)} ${formatChargeUnit(data.cdUnit)}`.trim());
  if (data.bankLoanValue !== undefined) pushRow('bankLoanValue', 'Bank Loan', `${toDisplayNumber(data.bankLoanValue)} ${formatChargeUnit(data.bankLoanUnit)}`.trim());
  if (data.paymentConditionValue !== undefined) pushRow('paymentConditionValue', 'Payment', `${toDisplayNumber(data.paymentConditionValue)} ${formatChargeUnit(data.paymentConditionUnit)}`.trim());
  if (data.egbValue !== undefined) pushRow('egbValue', 'EGB', `${toDisplayNumber(data.egbValue)}${data.egbType ? ` (${toTitleCase(data.egbType)})` : ''}`);
  return rows;
};

interface ManagerValueApprovalsProps {
  onCountChange?: (count: number) => void;
}

const ManagerValueApprovals: React.FC<ManagerValueApprovalsProps> = ({ onCountChange }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<ApprovalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const canManageApprovals = ['admin', 'owner'].includes(String(user?.role || '').toLowerCase());

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/sample-entries/tabs/manager-value-approvals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEntries((response.data as any)?.entries || []);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load manager approvals', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    if (canManageApprovals) {
      loadEntries();
    } else {
      setEntries([]);
    }
  }, [canManageApprovals, loadEntries]);

  useEffect(() => {
    onCountChange?.(canManageApprovals ? entries.length : 0);
  }, [canManageApprovals, entries.length, onCountChange]);

  const pendingCountBadge = useMemo(() => (
    entries.length > 0 ? (
      <span style={{
        marginLeft: '8px',
        minWidth: '22px',
        height: '22px',
        padding: '0 7px',
        borderRadius: '999px',
        background: '#dc2626',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 800
      }}>
        {entries.length}
      </span>
    ) : null
  ), [entries.length]);

  const handleDecision = async (entryId: string, decision: 'approve' | 'reject') => {
    try {
      setSubmittingId(entryId);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/sample-entries/${entryId}/manager-value-approval-decision`, {
        decision
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification((response.data as any)?.message || `Request ${decision}d`, 'success');
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update manager approval', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!canManageApprovals) {
    return (
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #dbeafe', padding: '24px', color: '#475569', fontWeight: 600 }}>
        Manager value approvals are available only for admin and owner.
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#eff6ff', color: '#1e3a8a', fontWeight: 800 }}>
        Approval For Manager
        {pendingCountBadge}
      </div>
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No manager approvals pending</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                {['Sl No', 'Party', 'Location', 'Variety', 'Bags', 'Pending Values', 'Requested By', 'Requested At', 'Action'].map((header) => (
                  <th key={header} style={{ padding: '10px 12px', border: '1px solid #1e293b', fontSize: '12px', textAlign: 'left' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const summaryRows = buildPendingSummary(entry.offering?.pendingManagerValueApprovalData, entry.offering);
                return (
                  <tr key={entry.id} style={{ background: index % 2 === 0 ? '#fff7ed' : '#fffbeb' }}>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0', fontWeight: 700 }}>{index + 1}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700 }}>{toTitleCase(entry.partyName || '-')}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{toTitleCase(entry.brokerName || '-')}</div>
                      <div style={{
                        marginTop: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#9a3412',
                        background: '#ffedd5',
                        border: '1px solid #fdba74'
                      }}>
                        Manager Added Pending Approval
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>{toTitleCase(entry.location || '-')}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>{toTitleCase(entry.variety || '-')}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>{entry.bags || '-'} | {entry.packaging || '-'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {summaryRows.length === 0 ? (
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '6px 8px'
                          }}>-</div>
                        ) : summaryRows.map((row) => (
                          <div key={row.key} style={{
                            fontSize: '12px',
                            color: row.tone.textColor,
                            background: row.tone.background,
                            border: `1px solid ${row.tone.border}`,
                            borderRadius: '8px',
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '70px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: row.tone.labelBackground,
                              color: row.tone.labelColor,
                              fontSize: '10px',
                              fontWeight: 800
                            }}>{row.label}</span>
                            <span style={{ fontWeight: 700, color: row.tone.textColor }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>{entry.pendingManagerValueApprovalRequestedByName || '-'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                      {entry.offering?.pendingManagerValueApprovalRequestedAt
                        ? new Date(entry.offering.pendingManagerValueApprovalRequestedAt).toLocaleString('en-GB')
                        : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleDecision(entry.id, 'approve')}
                          disabled={submittingId === entry.id}
                          style={{ padding: '6px 10px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: submittingId === entry.id ? 'not-allowed' : 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(entry.id, 'reject')}
                          disabled={submittingId === entry.id}
                          style={{ padding: '6px 10px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: submittingId === entry.id ? 'not-allowed' : 'pointer' }}
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
  );
};

export default ManagerValueApprovals;
