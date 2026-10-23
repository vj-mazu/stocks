import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

interface InwardCookingRecord {
  id: string; // PhysicalInspection id
  sampleEntryId: string;
  sampleId: string;
  lorryNumber: string;
  inspectionDate?: string;
  party?: string;
  broker?: string;
  variety?: string;
  location?: string;
  bags?: number;
  cutting?: string;
  bend?: string;
  moisture?: string;
  reportedBy?: string;
  inwardCooking?: {
    moisture?: string;
    grainsCount?: string;
    wbR?: string;
    wbBk?: string;
    wbT?: string;
    cookingStatus?: string;
    cookingDoneBy?: string;
    cookingDoneAt?: string;
    cookingApprovedBy?: string;
    cookingApprovedAt?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    remarks?: string;
    rejectRemarks?: string;
  } | null;
}

export const InwardCookingTab: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const userRole = String(user?.role || '').toLowerCase();
  const canApprove = ['admin', 'owner', 'manager', 'ceo'].includes(userRole);

  const [entries, setEntries] = useState<InwardCookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBroker, setFilterBroker] = useState('');
  const [filterVariety, setFilterVariety] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedInspection, setSelectedInspection] = useState<InwardCookingRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    moisture: '',
    grainsCount: '',
    wbR: '',
    wbBk: '',
    cookingStatus: 'PASS',
    cookingDoneBy: '',
    remarks: ''
  });

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectInspectionId, setRejectInspectionId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = {
        page,
        pageSize,
        search: searchTerm.trim() || undefined,
        broker: filterBroker.trim() || undefined,
        variety: filterVariety.trim() || undefined,
        location: filterLocation.trim() || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined
      };

      const res = await axios.get(`${API_URL}/sample-entries/tabs/inward-cooking`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        setEntries(res.data.entries || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Error loading inward cooking entries:', err);
      showNotification(err.response?.data?.error || 'Failed to load inward cooking entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [page]);

  const handleApplyFilters = () => {
    setPage(1);
    loadEntries();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterBroker('');
    setFilterVariety('');
    setFilterLocation('');
    setFilterStatus('all');
    setPage(1);
    setTimeout(() => {
      loadEntries();
    }, 0);
  };

  const applyQuickDatePreset = (preset: 'today' | 'yesterday' | 'last7') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const d = formatDate(today);
      setFilterStartDate(d);
      setFilterEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const d = formatDate(y);
      setFilterStartDate(d);
      setFilterEndDate(d);
    } else if (preset === 'last7') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setFilterStartDate(formatDate(past));
      setFilterEndDate(formatDate(today));
    }
    setPage(1);
  };

  const openAddReportModal = (item: InwardCookingRecord, mode: 'create' | 'edit' | 'view' = 'create') => {
    setSelectedInspection(item);
    setModalMode(mode);
    const existing = item.inwardCooking;
    if (existing) {
      setFormData({
        moisture: existing.moisture || '',
        grainsCount: existing.grainsCount || '',
        wbR: existing.wbR || '',
        wbBk: existing.wbBk || '',
        cookingStatus: existing.cookingStatus || 'PASS',
        cookingDoneBy: existing.cookingDoneBy || (user?.fullName || user?.username || ''),
        remarks: existing.remarks || ''
      });
    } else {
      setFormData({
        moisture: item.moisture && item.moisture !== '-' ? String(item.moisture) : '',
        grainsCount: '',
        wbR: '',
        wbBk: '',
        cookingStatus: 'PASS',
        cookingDoneBy: user?.fullName || user?.username || '',
        remarks: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;

    if (!formData.moisture.trim()) {
      showNotification('Moisture % is required for 100gms test', 'error');
      return;
    }
    if (!formData.grainsCount.trim()) {
      showNotification('Grains Count is required for 100gms test', 'error');
      return;
    }
    if (!formData.wbR.trim() || !formData.wbBk.trim()) {
      showNotification('WB-R and WB-BK are required for 100gms test', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const payload = {
        moisture: formData.moisture.trim(),
        grainsCount: formData.grainsCount.trim(),
        wbR: formData.wbR.trim(),
        wbBk: formData.wbBk.trim(),
        cookingStatus: formData.cookingStatus,
        cookingDoneBy: formData.cookingDoneBy.trim() || user?.fullName || user?.username || 'Staff',
        remarks: formData.remarks.trim()
      };

      const res = await axios.post(`${API_URL}/sample-entries/inward-cooking/${selectedInspection.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        showNotification('Inward 100gms cooking report submitted for approval!', 'success');
        setShowModal(false);
        loadEntries();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to submit inward cooking report', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (inspectionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/sample-entries/inward-cooking/${inspectionId}/approve`, {
        decision: 'approve'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        showNotification('Inward cooking report approved successfully!', 'success');
        loadEntries();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to approve report', 'error');
    }
  };

  const handleOpenReject = (inspectionId: string) => {
    setRejectInspectionId(inspectionId);
    setRejectRemarks('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectInspectionId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/sample-entries/inward-cooking/${rejectInspectionId}/approve`, {
        decision: 'reject',
        remarks: rejectRemarks.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        showNotification('Inward cooking report rejected', 'info');
        setShowRejectModal(false);
        setRejectInspectionId(null);
        loadEntries();
      }
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to reject report', 'error');
    }
  };

  const calculateWbT = () => {
    const r = parseFloat(formData.wbR) || 0;
    const bk = parseFloat(formData.wbBk) || 0;
    return (r + bk).toFixed(2);
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Search & Filters Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              🔍 Search (Lorry, Sample ID, Party)
            </label>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              From Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              To Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Broker
            </label>
            <input
              type="text"
              placeholder="Filter Broker..."
              value={filterBroker}
              onChange={(e) => setFilterBroker(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Variety
            </label>
            <input
              type="text"
              placeholder="Filter Variety..."
              value={filterVariety}
              onChange={(e) => setFilterVariety(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', background: '#fff' }}
            >
              <option value="all">All Inward Lorries</option>
              <option value="pending">⏳ Pending Cooking / Approval</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleApplyFilters}
              style={{
                flex: 1,
                padding: '7px 14px',
                backgroundColor: '#0d9488',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Apply Filter
            </button>
            <button
              onClick={handleClearFilters}
              style={{
                padding: '7px 12px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Quick Date Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Quick Date:</span>
          {[
            { label: 'Today', preset: 'today' as const },
            { label: 'Yesterday', preset: 'yesterday' as const },
            { label: 'Last 7 Days', preset: 'last7' as const }
          ].map(p => (
            <button
              key={p.preset}
              onClick={() => applyQuickDatePreset(p.preset)}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              {p.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#0f766e' }}>
            Total Inward Lorries: {total}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #000', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ backgroundColor: '#0d9488', color: '#ffffff' }}>
              <th style={{ border: '1px solid #000', padding: '6px 4px', fontWeight: 700, fontSize: '12px', textAlign: 'center', width: '40px' }}>SL No</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '90px' }}>Date</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '120px' }}>Lorry Number</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '85px' }}>Sample ID</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'left', minWidth: '150px' }}>Party & Broker</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'left', minWidth: '110px' }}>Variety</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'left', minWidth: '100px' }}>Location</th>
              <th style={{ border: '1px solid #000', padding: '6px 6px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '60px' }}>Bags</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '130px', background: '#0f766e' }}>
                Full Lorry Avg (Gutti)
              </th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '160px', background: '#115e59' }}>
                100gms Test Yield
              </th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '110px' }}>Cooking Status</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '130px' }}>Done / Approved By</th>
              <th style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 700, fontSize: '12px', textAlign: 'center', minWidth: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading inward cooking records...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No inward cooking records found. (Only lorries from Cooking-passed lots with approved Full Lorry Avg appear here)
                </td>
              </tr>
            ) : (
              entries.map((item, idx) => {
                // Continuous & Cumulative Serial Number Formula
                const slNo = (page - 1) * pageSize + idx + 1;
                const ic = item.inwardCooking;
                const isApproved = ic?.approvalStatus === 'approved';
                const isPending = ic?.approvalStatus === 'pending';
                const isRejected = ic?.approvalStatus === 'rejected';

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #cbd5e1',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    {/* 1. SL No */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                      {slNo}
                    </td>

                    {/* 2. Date */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {formatDateDisplay(item.inspectionDate)}
                    </td>

                    {/* 3. Lorry Number */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                      {item.lorryNumber}
                    </td>

                    {/* 4. Sample ID */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#1e40af' }}>
                      {item.sampleId}
                    </td>

                    {/* 5. Party & Broker */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.party || '-'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Broker: <b>{item.broker || '-'}</b></div>
                    </td>

                    {/* 6. Variety */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#1e293b' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px'
                      }}>
                        {item.variety || '-'}
                      </span>
                    </td>

                    {/* 7. Location */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', color: '#334155' }}>
                      {item.location || '-'}
                    </td>

                    {/* 8. Bags */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 6px', textAlign: 'center', fontWeight: 700 }}>
                      {item.bags || '-'}
                    </td>

                    {/* 9. Full Lorry Avg (Gutti) Quality */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', background: '#f0fdfa' }}>
                      <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                        <div><b>Cutting:</b> {item.cutting || '-'}</div>
                        <div><b>Bend:</b> {item.bend || '-'}</div>
                        <div><b>Moist:</b> {item.moisture ? `${item.moisture}%` : '-'}</div>
                      </div>
                    </td>

                    {/* 10. 100gms Test Yield */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                      {ic ? (
                        <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                          <div><b>M:</b> {ic.moisture}% | <b>G.C:</b> {ic.grainsCount}</div>
                          <div><b>WB-R:</b> {ic.wbR} | <b>WB-BK:</b> {ic.wbBk}</div>
                          <div style={{ fontWeight: 700, color: '#0f766e' }}>Total WB-T: {ic.wbT}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>Not Done</span>
                      )}
                    </td>

                    {/* 11. Cooking Status */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                      {ic ? (
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '11px',
                            background: isApproved ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2',
                            color: isApproved ? '#166534' : isPending ? '#92400e' : '#991b1b',
                            border: `1px solid ${isApproved ? '#86efac' : isPending ? '#fcd34d' : '#fca5a5'}`
                          }}>
                            {ic.cookingStatus || 'PASS'}
                          </span>
                          <div style={{ fontSize: '10px', marginTop: '2px', color: '#64748b' }}>
                            {isApproved ? 'Approved' : isPending ? 'Pending Appr' : 'Rejected'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                      )}
                    </td>

                    {/* 12. Done / Approved By */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center', fontSize: '11px', lineHeight: 1.3 }}>
                      {ic ? (
                        <>
                          <div><b>Done:</b> {ic.cookingDoneBy || '-'}</div>
                          {ic.cookingApprovedBy ? (
                            <div style={{ color: '#047857', fontWeight: 600 }}>
                              <b>Appr:</b> {ic.cookingApprovedBy}
                            </div>
                          ) : (
                            <div style={{ color: '#d97706', fontStyle: 'italic' }}>Pending</div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>

                    {/* 13. Actions */}
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>
                      {!ic ? (
                        <button
                          onClick={() => openAddReportModal(item, 'create')}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#0d9488',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ➕ Add 100gms
                        </button>
                      ) : isPending ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          {canApprove && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handleApprove(item.id)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  fontSize: '10px',
                                  cursor: 'pointer'
                                }}
                                title="Approve Cooking Report"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => handleOpenReject(item.id)}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  fontSize: '10px',
                                  cursor: 'pointer'
                                }}
                                title="Reject Cooking Report"
                              >
                                ❌ Reject
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => openAddReportModal(item, 'edit')}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '3px',
                              fontWeight: 600,
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      ) : isApproved ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            onClick={() => openAddReportModal(item, 'view')}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#f8fafc',
                              color: '#0f766e',
                              border: '1px solid #0d9488',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            👁️ View
                          </button>
                          {canApprove && (
                            <button
                              onClick={() => openAddReportModal(item, 'edit')}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openAddReportModal(item, 'edit')}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #f87171',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          🔄 Re-submit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', padding: '0 4px' }}>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Showing <b>{entries.length === 0 ? 0 : (page - 1) * pageSize + 1}</b> to <b>{Math.min(page * pageSize, total)}</b> of <b>{total}</b> inward lorries
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: page <= 1 ? '#f1f5f9' : '#fff',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              color: page <= 1 ? '#94a3b8' : '#334155'
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: page >= totalPages ? '#f1f5f9' : '#fff',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              color: page >= totalPages ? '#94a3b8' : '#334155'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Add / Edit 100gms Cooking Modal */}
      {showModal && selectedInspection && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)',
              color: '#fff',
              padding: '16px 20px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>
                {modalMode === 'view' ? 'Inward 100gms Cooking Report' : modalMode === 'edit' ? 'Edit Inward 100gms Cooking' : 'Add Inward 100gms Cooking'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.95, lineHeight: 1.4 }}>
                <div><b>Lorry:</b> {selectedInspection.lorryNumber} &nbsp;|&nbsp; <b>Sample ID:</b> {selectedInspection.sampleId}</div>
                <div><b>Party:</b> {selectedInspection.party} &nbsp;|&nbsp; <b>Variety:</b> {selectedInspection.variety}</div>
                <div><b>Full Lorry Bags:</b> {selectedInspection.bags} &nbsp;|&nbsp; <b>Arrival Moisture:</b> {selectedInspection.moisture}%</div>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f766e', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                  1. 100gms Test Parameters (Yield)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Moisture (%) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={modalMode === 'view'}
                      value={formData.moisture}
                      onChange={(e) => setFormData({ ...formData, moisture: e.target.value })}
                      placeholder="e.g. 14.2"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Grains Count <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      disabled={modalMode === 'view'}
                      value={formData.grainsCount}
                      onChange={(e) => setFormData({ ...formData, grainsCount: e.target.value })}
                      placeholder="e.g. 98"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      WB-R <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={modalMode === 'view'}
                      value={formData.wbR}
                      onChange={(e) => setFormData({ ...formData, wbR: e.target.value })}
                      placeholder="e.g. 64"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      WB-BK <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={modalMode === 'view'}
                      value={formData.wbBk}
                      onChange={(e) => setFormData({ ...formData, wbBk: e.target.value })}
                      placeholder="e.g. 8"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0f766e', marginBottom: '4px' }}>
                      WB-T (Total Auto)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={calculateWbT()}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '13px',
                        border: '1px solid #0d9488',
                        background: '#f0fdfa',
                        fontWeight: 800,
                        color: '#0f766e',
                        borderRadius: '4px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f766e', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginTop: '6px' }}>
                  2. Inward Cooking Evaluation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Cooking Status <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      disabled={modalMode === 'view'}
                      value={formData.cookingStatus}
                      onChange={(e) => setFormData({ ...formData, cookingStatus: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', background: '#fff' }}
                    >
                      <option value="PASS">PASS</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="RECHECK">RECHECK</option>
                      <option value="FAIL">FAIL</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Cooking Done By <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      disabled={modalMode === 'view'}
                      value={formData.cookingDoneBy}
                      onChange={(e) => setFormData({ ...formData, cookingDoneBy: e.target.value })}
                      placeholder="Staff Name"
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Remarks
                  </label>
                  <textarea
                    rows={2}
                    disabled={modalMode === 'view'}
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Enter observations on aroma, length elongation, stickiness..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {modalMode === 'view' ? 'Close' : 'Cancel'}
                </button>
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: isSubmitting ? '#99f6e4' : '#0d9488',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit 100gms Cooking'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            border: '1px solid #cbd5e1'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', marginBottom: '8px' }}>
              Reject Inward Cooking Report
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
              Please enter the reason for rejecting this 100gms cooking report:
            </div>
            <textarea
              rows={3}
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="e.g. High broken percentage / undercooked..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectInspectionId(null); }}
                style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InwardCookingTab;
