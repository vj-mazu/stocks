import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import LotSelection from './LotSelection';
import CookingReport from './CookingReport';
import FinalPassLots from './FinalPassLots';
import LoadingLots from './LoadingLots';
import CompletedLots from './CompletedLots';
import AdminSampleBook2 from './AdminSampleBook2';
import SampleApprovalsHub from './SampleApprovalsHub';
import SampleEntryPage from './SampleEntry';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';

type TabKey =
  | 'paddy-samples'
  | 'staff-cooking-report'
  | 'pending-lots'
  | 'cooking-report'
  | 'lots-passed'
  | 'loading-lots'
  | 'approvals'
  | 'completed-lots'
  | 'sample-book-2';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  color: string;
}

const baseTabs: TabConfig[] = [
  { key: 'paddy-samples', label: 'Paddy Sample Records', icon: '\u{1F33E}', color: '#2e7d32' },
  { key: 'sample-book-2', label: 'Paddy Sample Book', icon: '\u{1F4D7}', color: '#1565c0' },
  { key: 'pending-lots', label: 'Pending (Sample Selection)', icon: '\u{1F4CB}', color: '#3498db' },
  { key: 'cooking-report', label: 'Cooking Book', icon: '\u{1F35A}', color: '#e67e22' },
  { key: 'lots-passed', label: 'Final Pass Lots', icon: '\u{2705}', color: '#27ae60' },
  { key: 'loading-lots', label: 'Loading Lots', icon: '\u{1F69A}', color: '#f39c12' },
  { key: 'completed-lots', label: 'Completed Lots', icon: '\u{1F4E6}', color: '#e74c3c' },
];

const approvalTabs: TabConfig[] = [
  { key: 'approvals', label: 'Approvals', icon: '\u{1F4DD}', color: '#8e44ad' }
];

const OwnerSampleReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('paddy-samples');
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const loadApprovalPendingCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [editResponse, managerResponse] = await Promise.all([
        axios.get(`${API_URL}/sample-entries/tabs/edit-approvals`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        user?.role === 'admin'
          ? axios.get(`${API_URL}/sample-entries/tabs/manager-value-approvals`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          : Promise.resolve({ data: { entries: [] } })
      ]);
      const editCount = ((editResponse.data as any)?.entries || []).length;
      const managerCount = ((managerResponse.data as any)?.entries || []).length;
      setApprovalPendingCount(editCount + managerCount);
    } catch {
      setApprovalPendingCount(0);
    }
  }, [user?.role]);

  const tabs = useMemo<TabConfig[]>(() => {
    const completedIndex = baseTabs.findIndex((tab) => tab.key === 'completed-lots');
    const baseTabsWithApprovals = completedIndex === -1
      ? [...baseTabs, ...approvalTabs]
      : [
          ...baseTabs.slice(0, completedIndex),
          ...approvalTabs,
          ...baseTabs.slice(completedIndex)
        ];

    if (!isManager) {
      return baseTabsWithApprovals;
    }

    const staffTab: TabConfig = {
      key: 'staff-cooking-report',
      label: 'Staff Cooking Book',
      icon: '\u{1F373}',
      color: '#ef6c00'
    };
    const insertionIndex = baseTabsWithApprovals.findIndex((tab) => tab.key === 'pending-lots');

    if (insertionIndex === -1) {
      return [...baseTabsWithApprovals, staffTab];
    }

    return [
      ...baseTabsWithApprovals.slice(0, insertionIndex + 1),
      staffTab,
      ...baseTabsWithApprovals.slice(insertionIndex + 1)
    ];
  }, [isManager]);

  useEffect(() => {
    document.title = 'Sample Reports - Kushi Agro Foods';
  }, []);

  useEffect(() => {
    loadApprovalPendingCount();
  }, [loadApprovalPendingCount]);

  return (
    <div style={{
      padding: '0',
      backgroundColor: '#f0f2f5',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '16px 20px',
        color: 'white',
        marginBottom: '0'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '700',
          letterSpacing: '0.5px'
        }}>
          {'\u{1F4CA}'} PADDY SAMPLE RECORDS
        </h2>
      </div>

      <div style={{
        display: 'flex',
        gap: '0',
        backgroundColor: 'white',
        borderBottom: '2px solid #e0e0e0',
        overflowX: 'visible',
        padding: '0 8px',
        whiteSpace: 'normal',
        flexWrap: 'wrap',
        rowGap: '4px'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '500',
                border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: isActive ? tab.color : '#666',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.key === 'approvals' && approvalPendingCount > 0 && (
                <span style={{
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '999px',
                  background: '#dc2626',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800
                }}>
                  {approvalPendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{
        padding: '16px 0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {activeTab === 'paddy-samples' && <SampleEntryPage excludeEntryType="RICE_SAMPLE" showGps={true} />}
        {activeTab === 'staff-cooking-report' && <CookingReport excludeEntryType="RICE_SAMPLE" forceStaffMode />}
        {activeTab === 'pending-lots' && <LotSelection excludeEntryType="RICE_SAMPLE" />}
        {activeTab === 'cooking-report' && <CookingReport excludeEntryType="RICE_SAMPLE" />}
        {activeTab === 'lots-passed' && <FinalPassLots excludeEntryType="RICE_SAMPLE" />}
        {activeTab === 'loading-lots' && <LoadingLots excludeEntryType="RICE_SAMPLE" />}
        {activeTab === 'approvals' && <SampleApprovalsHub excludeEntryType="RICE_SAMPLE" onPendingCountChange={setApprovalPendingCount} />}
        {activeTab === 'completed-lots' && <CompletedLots excludeEntryType="RICE_SAMPLE" />}
        {activeTab === 'sample-book-2' && <AdminSampleBook2 excludeEntryType="RICE_SAMPLE" />}
      </div>
    </div>
  );
};

export default OwnerSampleReports;
