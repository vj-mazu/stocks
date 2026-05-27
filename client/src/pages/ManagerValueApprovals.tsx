import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

interface ApprovalEntry {
  id: string;
  pendingManagerValueApprovalRequestId?: string;
  serialNo?: number;
  entryDate: string;
  brokerName?: string;
  partyName?: string;
  location?: string;
  variety?: string;
  bags?: number;
  packaging?: string;
  entryType?: string;
  originalEntryType?: string;
  lorryNumber?: string;
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
const formatPackagingLabel = (value?: string | number | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const normalized = raw.toLowerCase();
  if (normalized === '0' || normalized === 'loose') return 'Loose';
  if (normalized === '75' || normalized === '75 kg') return '75 Kg';
  if (normalized === '40' || normalized === '40 kg') return '40 Kg';
  if (normalized === '26' || normalized === '26 kg') return '26 Kg';
  if (normalized === '50' || normalized === '50 kg') return '50 Kg';
  if (normalized.includes('kg') || normalized.includes('tons')) return raw;
  return `${raw} Kg`;
};

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

const managerHighlightedFieldKeys = new Set(['hamali', 'brokerage', 'lf', 'disputeBaseRate', 'revisedHamali', 'revisedLf']);

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
  egbValue: ['egbValue', 'egbType'],
  disputeBaseRate: ['disputeBaseRate', 'disputeBaseRateType'],
  revisedHamali: ['revisedHamali', 'hamaliUnit'],
  revisedLf: ['revisedLf', 'lfUnit']
};

const hasPendingFieldChanged = (offering: Record<string, any> | undefined, pendingData: Record<string, any> | null | undefined, rowKey: string) => {
  const compareKeys = pendingComparisonKeysMap[rowKey] || [rowKey];
  return compareKeys.some((key) => {
    if (!pendingData || !(key in pendingData)) return false;
    return normalizeComparableValue(pendingData[key]) !== normalizeComparableValue(offering?.[key]);
  });
};

const buildPendingSummary = (data?: Record<string, any> | null, offering?: Record<string, any>): PendingSummaryRow[] => {
  const pendingData = data || {};
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
  if (pendingData.disputeBaseRate !== undefined && pendingData.disputeBaseRate !== null && pendingData.disputeBaseRate !== '') {
    pushRow('disputeBaseRate', 'Dispute Rate', `₹${toDisplayNumber(pendingData.disputeBaseRate)} (${pendingData.disputeBaseRateType || 'PD/WB'})`);
  }
  if (pendingData.finalSute !== undefined && pendingData.finalSute !== null && pendingData.finalSute !== '') {
    pushRow('finalSute', 'Sute', `${toDisplayNumber(pendingData.finalSute)} ${formatChargeUnit(pendingData.finalSuteUnit)}`.trim());
  }
  if (pendingData.moistureValue !== undefined && pendingData.moistureValue !== null && pendingData.moistureValue !== '') {
    pushRow('moistureValue', 'Moisture', `${toDisplayNumber(pendingData.moistureValue)}%`);
  }
  if (pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '') {
    pushRow('revisedHamali', 'Rev. Hamali', `₹${toDisplayNumber(pendingData.revisedHamali)} ${formatChargeUnit(pendingData.hamaliUnit || offering?.hamaliUnit)}`.trim());
  }
  if (pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '') {
    pushRow('revisedLf', 'Rev. LF', `₹${toDisplayNumber(pendingData.revisedLf)} ${formatChargeUnit(pendingData.lfUnit || offering?.lfUnit)}`.trim());
  }
  if (pendingData.hamali !== undefined && pendingData.hamali !== null && pendingData.hamali !== '') {
    pushRow('hamali', 'Hamali', `${toDisplayNumber(pendingData.hamali)} ${formatChargeUnit(pendingData.hamaliUnit)}`.trim());
  }
  if (pendingData.brokerage !== undefined && pendingData.brokerage !== null && pendingData.brokerage !== '') {
    pushRow('brokerage', 'Brokerage', `${toDisplayNumber(pendingData.brokerage)} ${formatChargeUnit(pendingData.brokerageUnit)}`.trim());
  }
  if (pendingData.lf !== undefined && pendingData.lf !== null && pendingData.lf !== '') {
    pushRow('lf', 'LF', `${toDisplayNumber(pendingData.lf)} ${formatChargeUnit(pendingData.lfUnit)}`.trim());
  }
  if (pendingData.cdEnabled === true || pendingData.cdValue !== undefined || pendingData.cdEnabled === false) {
    pushRow('cdValue', 'CD', pendingData.cdEnabled === true
      ? `${toDisplayNumber(pendingData.cdValue)} ${formatChargeUnit(pendingData.cdUnit)}`.trim()
      : 'No');
  }
  if (pendingData.bankLoanEnabled === true || pendingData.bankLoanValue !== undefined || pendingData.bankLoanEnabled === false) {
    pushRow('bankLoanValue', 'Bank Loan', pendingData.bankLoanEnabled === true
      ? `${toDisplayNumber(pendingData.bankLoanValue)} ${formatChargeUnit(pendingData.bankLoanUnit)}`.trim()
      : 'No');
  }
  if (pendingData.paymentConditionValue !== undefined && pendingData.paymentConditionValue !== null && pendingData.paymentConditionValue !== '') {
    pushRow('paymentConditionValue', 'Payment', `${toDisplayNumber(pendingData.paymentConditionValue)} ${formatChargeUnit(pendingData.paymentConditionUnit)}`.trim());
  }
  if (pendingData.egbType !== undefined || pendingData.egbValue !== undefined) {
    const egbValue = pendingData.egbType === 'mill'
      ? `${toDisplayNumber(pendingData.egbValue ?? 0)} (Mill)`
      : `${toDisplayNumber(pendingData.egbValue)}${pendingData.egbType ? ` (${toTitleCase(pendingData.egbType)})` : ''}`;
    pushRow('egbValue', 'EGB', egbValue);
  }
  return rows;
};

const buildOriginalSummary = (data?: Record<string, any> | null, offering?: Record<string, any>): PendingSummaryRow[] => {
  const pendingData = data || {};
  const rows: PendingSummaryRow[] = [];
  const pushRow = (key: string, label: string, value: string) => {
    rows.push({
      key,
      label,
      value,
      tone: {
        background: '#f8fafc',
        textColor: '#64748b',
        border: '#cbd5e1',
        labelBackground: '#e2e8f0',
        labelColor: '#475569'
      }
    });
  };

  if (pendingData.disputeBaseRate !== undefined && pendingData.disputeBaseRate !== null && pendingData.disputeBaseRate !== '') {
    pushRow('disputeBaseRate', 'Orig. Rate', `₹${toDisplayNumber(offering?.finalBaseRate ?? offering?.offerBaseRateValue)} (${offering?.baseRateType || 'PD/WB'})`);
  }
  if (pendingData.revisedHamali !== undefined && pendingData.revisedHamali !== null && pendingData.revisedHamali !== '') {
    pushRow('revisedHamali', 'Orig. Hamali', `₹${toDisplayNumber(offering?.hamali)} ${formatChargeUnit(offering?.hamaliUnit)}`.trim());
  }
  if (pendingData.revisedLf !== undefined && pendingData.revisedLf !== null && pendingData.revisedLf !== '') {
    pushRow('revisedLf', 'Orig. LF', `₹${toDisplayNumber(offering?.lf)} ${formatChargeUnit(offering?.lfUnit)}`.trim());
  }
  return rows;
};

interface ManagerValueApprovalsProps {
  onCountChange?: (count: number) => void;
  filterType?: 'standard' | 'lorry';
}

const ManagerValueApprovals: React.FC<ManagerValueApprovalsProps> = ({ onCountChange, filterType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<ApprovalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const canManageApprovals = ['admin', 'owner'].includes(String(user?.role || '').toLowerCase());

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const pendingData = entry.offering?.pendingManagerValueApprovalData || {};
      const hasLorryFields = pendingData.disputeBaseRate !== undefined || pendingData.revisedHamali !== undefined || pendingData.revisedLf !== undefined;
      
      if (filterType === 'lorry') {
        return hasLorryFields;
      } else if (filterType === 'standard') {
        return !hasLorryFields;
      }
      return true;
    });
  }, [entries, filterType]);

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
    onCountChange?.(canManageApprovals ? filteredEntries.length : 0);
  }, [canManageApprovals, filteredEntries.length, onCountChange]);

  const pendingCountBadge = useMemo(() => (
    filteredEntries.length > 0 ? (
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
        {filteredEntries.length}
      </span>
    ) : null
  ), [filteredEntries.length]);

  const handleDecision = async (entryId: string, requestId: string | undefined, decision: 'approve' | 'reject') => {
    try {
      setSubmittingId(entryId);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/sample-entries/${entryId}/manager-value-approval-decision`, {
        decision,
        requestId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification((response.data as any)?.message || `Request ${decision}d`, 'success');
      setEntries((current) => current.filter((entry) => entry.pendingManagerValueApprovalRequestId !== requestId));
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
        {filterType === 'lorry' ? 'Lorry Value Approvals' : 'Manager Value Approvals'}
        {pendingCountBadge}
      </div>
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : filteredEntries.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No approvals pending</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '36px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              {filterType === 'lorry' && <col style={{ width: '150px' }} />}
              <col style={{ width: '150px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                {['Sl No', 'Broker', 'Party', 'Location', 'Variety', 'Bags', ...(filterType === 'lorry' ? ['Original Values'] : []), 'Pending Values', 'Requested By', 'Requested At', 'Action'].map((header) => (
                  <th key={header} style={{ padding: '6px 8px', border: '1.5px solid #0f172a', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', lineHeight: 1.15 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => {
                const summaryRows = buildPendingSummary(entry.offering?.pendingManagerValueApprovalData, entry.offering);
                return (
                  <tr key={`${entry.id}-${entry.pendingManagerValueApprovalRequestId || index}`} style={{ background: index % 2 === 0 ? '#fff7ed' : '#fffbeb' }}>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontWeight: 700, fontSize: '11px', verticalAlign: 'top', textAlign: 'left' }}>{index + 1}</td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', verticalAlign: 'top', fontWeight: 700, fontSize: '13px', color: '#0f172a', lineHeight: 1.2, textAlign: 'left' }}>
                      {toTitleCase(entry.brokerName || '-')}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', verticalAlign: 'top', textAlign: 'left' }}>
                      {(() => {
                        const isLorryEntry = entry.entryType === 'DIRECT_LOADED_VEHICLE' || 
                                             entry.entryType === 'READY_LORRY' || 
                                             entry.originalEntryType === 'DIRECT_LOADED_VEHICLE' || 
                                             entry.originalEntryType === 'READY_LORRY';
                        const partyText = toTitleCase(entry.partyName || '').trim();
                        const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase().trim() : '';
                        const primaryText = isLorryEntry ? (lorryText || partyText || '-') : (partyText || lorryText || '-');
                        const secondaryText = isLorryEntry && partyText && lorryText && partyText.toUpperCase() !== lorryText ? partyText : '';

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e3a8a', lineHeight: 1.2 }}>{primaryText}</div>
                            {secondaryText && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{secondaryText}</div>}
                          </div>
                        );
                      })()}
                      <div style={{
                        marginTop: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 6px',
                        borderRadius: '999px',
                        fontSize: '9px',
                        fontWeight: 800,
                        color: filterType === 'lorry' ? '#7e22ce' : '#9a3412',
                        background: filterType === 'lorry' ? '#f3e8ff' : '#ffedd5',
                        border: filterType === 'lorry' ? '1px solid #d8b4fe' : '1px solid #fdba74'
                      }}>
                        {filterType === 'lorry' ? 'Dispute / Revised Pending Approval' : 'Manager Added Pending Approval'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#334155', verticalAlign: 'top', lineHeight: 1.15, textAlign: 'left' }}>{toTitleCase(entry.location || '-')}</td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#334155', verticalAlign: 'top', lineHeight: 1.15, textAlign: 'left' }}>{toTitleCase(entry.variety || '-')}</td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#334155', verticalAlign: 'top', lineHeight: 1.15, textAlign: 'left' }}>{entry.bags || '-'} | {formatPackagingLabel(entry.packaging || '-')}</td>
                    {filterType === 'lorry' && (
                      <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', verticalAlign: 'top', textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {(() => {
                            const origRows = buildOriginalSummary(entry.offering?.pendingManagerValueApprovalData, entry.offering);
                            if (origRows.length === 0) {
                              return (
                                <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', lineHeight: 1.2 }}>-</div>
                              );
                            }
                            return origRows.map((row) => (
                              <div key={row.key} style={{ fontSize: '11px', color: row.tone.textColor, background: row.tone.background, border: `1.5px solid ${row.tone.border}`, borderRadius: '7px', padding: '3px 5px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', justifyContent: 'space-between', width: '100%', lineHeight: 1.15 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '62px', flexShrink: 0, padding: '2px 5px', borderRadius: '999px', background: row.tone.labelBackground, color: row.tone.labelColor, fontSize: '11px', fontWeight: 800 }}>{row.label}</span>
                                <span style={{ fontWeight: 700, fontSize: '12px', color: row.tone.textColor, flex: 1, minWidth: 0, textAlign: 'right', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.1 }}>{row.value}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', verticalAlign: 'top', textAlign: 'left' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {summaryRows.length === 0 ? (
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            lineHeight: 1.2
                          }}>-</div>
                        ) : summaryRows.map((row) => (
                          <div key={row.key} style={{
                            fontSize: '11px',
                            color: row.tone.textColor,
                            background: row.tone.background,
                            border: `1.5px solid ${row.tone.border}`,
                            borderRadius: '7px',
                            padding: '3px 5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'nowrap',
                            justifyContent: 'space-between',
                            width: '100%',
                            lineHeight: 1.15
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '62px',
                              flexShrink: 0,
                              padding: '2px 5px',
                              borderRadius: '999px',
                              background: row.tone.labelBackground,
                              color: row.tone.labelColor,
                              fontSize: '11px',
                              fontWeight: 800
                            }}>{row.label}</span>
                            <span style={{ fontWeight: 700, fontSize: '12px', color: row.tone.textColor, flex: 1, minWidth: 0, textAlign: 'right', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.1 }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#334155', verticalAlign: 'top', lineHeight: 1.15, textAlign: 'left' }}>{entry.pendingManagerValueApprovalRequestedByName || '-'}</td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#334155', verticalAlign: 'top', lineHeight: 1.15, textAlign: 'left' }}>
                      {entry.offering?.pendingManagerValueApprovalRequestedAt
                        ? new Date(entry.offering.pendingManagerValueApprovalRequestedAt).toLocaleString('en-GB')
                        : '-'}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', verticalAlign: 'top', textAlign: 'left' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-start' }}>
                        <button
                          onClick={() => handleDecision(entry.id, entry.pendingManagerValueApprovalRequestId, 'approve')}
                          disabled={submittingId === entry.id}
                          style={{ padding: '5px 9px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: submittingId === entry.id ? 'not-allowed' : 'pointer', fontSize: '11px', lineHeight: 1.1 }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(entry.id, entry.pendingManagerValueApprovalRequestId, 'reject')}
                          disabled={submittingId === entry.id}
                          style={{ padding: '5px 9px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: submittingId === entry.id ? 'not-allowed' : 'pointer', fontSize: '11px', lineHeight: 1.1 }}
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
