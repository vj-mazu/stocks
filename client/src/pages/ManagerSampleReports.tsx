import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import AdminSampleBook2 from './AdminSampleBook2';
import AssigningSupervisor from './AssigningSupervisor';
import AllottedSupervisors from './AllottedSupervisors';
import LoadingLots from './LoadingLots';
import { useAuth } from '../contexts/AuthContext';
import CompletedLots from './CompletedLots';
import SampleApprovalsHub from './SampleApprovalsHub';
import SampleEntryPage from './SampleEntry';
import LotSelection from './LotSelection';
import CookingReport from './CookingReport';
import FinalPassLots from './FinalPassLots';
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

const tabs: TabConfig[] = [
    { key: 'paddy-samples', label: 'Paddy Sample Records', icon: '\u{1F33E}', color: '#2e7d32' },
    { key: 'staff-cooking-report', label: 'Staff Cooking Book', icon: '\u{1F373}', color: '#ef6c00' },
    { key: 'sample-book-2', label: 'Paddy Sample Book', icon: '\u{1F4D7}', color: '#1565c0' },
    { key: 'pending-lots', label: 'Pending (Sample Selection)', icon: '\u{1F4CB}', color: '#3498db' },
    { key: 'cooking-report', label: 'Cooking Book', icon: '\u{1F35A}', color: '#e67e22' },
    { key: 'lots-passed', label: 'Final Pass Lots', icon: '\u{2705}', color: '#27ae60' },
    { key: 'loading-lots', label: 'Pending Loading Lots', icon: '\u{1F69A}', color: '#f39c12' },
    { key: 'completed-lots', label: 'Completed Lots', icon: '\u{1F4E6}', color: '#e74c3c' },
    { key: 'approvals', label: 'Approvals', icon: '\u{1F4DD}', color: '#8e44ad' },
];

const ManagerSampleReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('paddy-samples');
    const [activeSubTab, setActiveSubTab] = useState<'financials' | 'assign-supervisor' | 'assigned-lots'>('financials');
    const [approvalPendingCount, setApprovalPendingCount] = useState(0);
    const { user } = useAuth();
    const loadApprovalPendingCount = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const editResponse = await axios.get(`${API_URL}/sample-entries/tabs/edit-approvals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const editCount = ((editResponse.data as any)?.entries || []).length;
            setApprovalPendingCount(editCount);
        } catch {
            setApprovalPendingCount(0);
        }
    }, []);

    useEffect(() => {
        document.title = 'Manager Reports - Kushi Agro Foods';
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
                    {'\u{1F4CA}'} MANAGER SAMPLE RECORDS
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
                {tabs.map(tab => {
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
                {activeTab === 'loading-lots' && (
                    user?.role === 'admin' ? (
                        <div style={{ padding: '0 20px' }}>
                            <LoadingLots excludeEntryType="RICE_SAMPLE" />
                        </div>
                    ) : (
                        <div style={{ padding: '0 20px' }}>
                            {/* Sub-tabs */}
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                marginBottom: '20px',
                                borderBottom: '2px solid #e0e0e0'
                            }}>
                                <button
                                    onClick={() => setActiveSubTab('financials')}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        border: 'none',
                                        borderBottom: activeSubTab === 'financials' ? '3px solid #f39c12' : '3px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: activeSubTab === 'financials' ? '#f39c12' : '#666',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    Loading Lots Table
                                </button>
                                <button
                                    onClick={() => setActiveSubTab('assign-supervisor')}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        border: 'none',
                                        borderBottom: activeSubTab === 'assign-supervisor' ? '3px solid #f39c12' : '3px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: activeSubTab === 'assign-supervisor' ? '#f39c12' : '#666',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    Assign Supervisor
                                </button>
                                <button
                                    onClick={() => setActiveSubTab('assigned-lots')}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        border: 'none',
                                        borderBottom: activeSubTab === 'assigned-lots' ? '3px solid #f39c12' : '3px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: activeSubTab === 'assigned-lots' ? '#f39c12' : '#666',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    Assigned Loading Lots
                                </button>
                            </div>
                            
                            <div>
                                {activeSubTab === 'financials' && <LoadingLots excludeEntryType="RICE_SAMPLE" />}
                                {activeSubTab === 'assign-supervisor' && <AssigningSupervisor />}
                                {activeSubTab === 'assigned-lots' && <AllottedSupervisors />}
                            </div>
                        </div>
                    )
                )}
                {activeTab === 'approvals' && <SampleApprovalsHub excludeEntryType="RICE_SAMPLE" onPendingCountChange={setApprovalPendingCount} />}
                {activeTab === 'completed-lots' && <CompletedLots excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'sample-book-2' && <AdminSampleBook2 excludeEntryType="RICE_SAMPLE" />}
            </div>
        </div>
    );
};

export default ManagerSampleReports;
