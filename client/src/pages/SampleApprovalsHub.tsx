import React, { useEffect, useMemo, useState } from 'react';
import SampleEditApprovals from './SampleEditApprovals';
import ManagerValueApprovals from './ManagerValueApprovals';

interface SampleApprovalsHubProps {
  entryType?: string;
  excludeEntryType?: string;
  onPendingCountChange?: (count: number) => void;
}

type ApprovalTabKey = 'approval-for-edits' | 'approval-for-manager';

interface ApprovalTabConfig {
  key: ApprovalTabKey;
  label: string;
  color: string;
}

const SampleApprovalsHub: React.FC<SampleApprovalsHubProps> = ({ entryType, excludeEntryType, onPendingCountChange }) => {
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [managerApprovalCount, setManagerApprovalCount] = useState(0);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);
  const canAccessManagerApprovals = ['admin', 'owner'].includes(String(currentUser?.role || '').toLowerCase());
  const tabs = useMemo<ApprovalTabConfig[]>(() => {
    const baseTabs: ApprovalTabConfig[] = [
      { key: 'approval-for-edits', label: 'Approval For Edits', color: '#8e44ad' }
    ];
    if (canAccessManagerApprovals) {
      baseTabs.push({ key: 'approval-for-manager', label: 'Approval For Manager', color: '#16a34a' });
    }
    return baseTabs;
  }, [canAccessManagerApprovals]);
  const [activeTab, setActiveTab] = useState<ApprovalTabKey>('approval-for-edits');
  const totalPendingCount = editApprovalCount + (canAccessManagerApprovals ? managerApprovalCount : 0);

  useEffect(() => {
    if (!canAccessManagerApprovals) {
      setManagerApprovalCount(0);
      if (activeTab === 'approval-for-manager') {
        setActiveTab('approval-for-edits');
      }
    }
  }, [activeTab, canAccessManagerApprovals]);

  useEffect(() => {
    onPendingCountChange?.(totalPendingCount);
  }, [onPendingCountChange, totalPendingCount]);

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
          const tabCount = tab.key === 'approval-for-edits' ? editApprovalCount : managerApprovalCount;
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
        {canAccessManagerApprovals && activeTab === 'approval-for-manager' && <ManagerValueApprovals onCountChange={setManagerApprovalCount} />}
      </div>
    </div>
  );
};

export default SampleApprovalsHub;
