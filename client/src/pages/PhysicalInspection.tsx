import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  workflowStatus: string;
  offeringPrice?: number;
  priceType?: string;
  finalPrice?: number;
  entryType?: string;
  lorryNumber?: string;
  lotAllotment?: {
    id: string;
    allottedToSupervisorId: number;
    allottedBags?: number;
    closedAt?: string | null;
    supervisor: {
      id: number;
      username: string;
    };
    physicalInspections?: {
      id: string;
      inspectionDate: string;
      lorryNumber: string;
      bags: number;
      cutting1: number;
      cutting2: number;
      bend: number;
      reportedBy: {
        username: string;
      };
    }[];
  };
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

const formatDecimal = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const num = Number(val);
  return isNaN(num) ? val.toString() : num.toString();
};

const handleCuttingInput = (value: string, entryType?: string) => {
  if (entryType === 'RICE_SAMPLE') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return { raw: cleaned, part1: cleaned, part2: '' };
    return { raw: cleaned, part1: cleaned, part2: '' };
  }

  let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return { raw: clean, part1: first, part2: second || '' };
};

const handleBendInput = (value: string, entryType?: string) => {
  if (entryType === 'RICE_SAMPLE') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return { raw: cleaned, part1: cleaned, part2: '' };
    return { raw: cleaned, part1: cleaned, part2: '' };
  }

  let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return { raw: clean, part1: first, part2: second || '' };
};

interface PreviousInspection {
  id: string;
  inspectionDate: string;
  lorryNumber: string;
  bags: number;
  cutting1: number;
  cutting2: number;
  bend: number;
  bend2?: number;
  reportedBy: {
    username: string;
  };
}

interface InspectionProgress {
  totalBags: number;
  inspectedBags: number;
  remainingBags: number;
  progressPercentage: number;
  previousInspections: PreviousInspection[];
}

const PhysicalInspection: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});
  const [activeTab, setActiveTab] = useState<'paddy' | 'rice'>('paddy');

  // Inspection form data
  const [inspectionData, setInspectionData] = useState<{
    [key: string]: {
      inspectionDate: string;
      lorryNumber: string;
      actualBags: number;
      cutting: string;
      bend: string;
      halfLorryImage: File | null;
      fullLorryImage: File | null;
      remarks: string;
    }
  }>({});

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Query for multiple statuses - LOT_ALLOTMENT, PHYSICAL_INSPECTION, INVENTORY_ENTRY, OWNER_FINANCIAL, MANAGER_FINANCIAL, FINAL_REVIEW, COMPLETED
      // This ensures lots don't disappear after first save or after completion
      const [lotAllotmentResponse, physicalInspectionResponse, inventoryEntryResponse, ownerFinancialResponse, managerFinancialResponse, finalReviewResponse, completedResponse] = await Promise.all([
        axios.get(`${API_URL}/sample-entries/by-role?status=LOT_ALLOTMENT`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=PHYSICAL_INSPECTION`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=INVENTORY_ENTRY`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=OWNER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=MANAGER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=FINAL_REVIEW`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=COMPLETED`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const lotAllotmentEntries = (lotAllotmentResponse.data as any).entries || [];
      const physicalInspectionEntries = (physicalInspectionResponse.data as any).entries || [];
      const inventoryEntryEntries = (inventoryEntryResponse.data as any).entries || [];
      const ownerFinancialEntries = (ownerFinancialResponse.data as any).entries || [];
      const managerFinancialEntries = (managerFinancialResponse.data as any).entries || [];
      const finalReviewEntries = (finalReviewResponse.data as any).entries || [];
      const completedEntries = (completedResponse.data as any).entries || [];

      // Combine all lists and remove duplicates
      const allMap = new Map();
      [...lotAllotmentEntries, ...physicalInspectionEntries, ...inventoryEntryEntries, ...ownerFinancialEntries, ...managerFinancialEntries, ...finalReviewEntries, ...completedEntries].forEach(entry => {
        allMap.set(entry.id, entry);
      });
      const allEntries = Array.from(allMap.values());
      setEntries(allEntries);

      // Calculate inspection progress locally for each entry
      const progressCache: { [key: string]: InspectionProgress } = {};
      allEntries.forEach((entry: SampleEntry) => {
        const totalBags = entry.lotAllotment?.allottedBags || entry.bags || 0;
        const inspections = entry.lotAllotment?.physicalInspections || [];
        const inspectedBags = inspections.reduce((sum, inspection) => sum + (inspection.bags || 0), 0);
        const remainingBags = entry.lotAllotment?.closedAt ? 0 : Math.max(0, totalBags - inspectedBags);
        const progressPercentage = entry.lotAllotment?.closedAt ? 100 : (totalBags > 0 ? (inspectedBags / totalBags) * 100 : 0);
        
        progressCache[entry.id] = {
          totalBags,
          inspectedBags,
          remainingBags,
          progressPercentage,
          previousInspections: inspections.map(inspection => ({
            id: inspection.id,
            inspectionDate: inspection.inspectionDate,
            lorryNumber: inspection.lorryNumber,
            bags: inspection.bags,
            cutting1: inspection.cutting1,
            cutting2: inspection.cutting2,
            bend: inspection.bend,
            bend2: (inspection as any).bend2,
            reportedBy: inspection.reportedBy || { username: 'System' }
          }))
        };
      });
      setInspectionProgress(progressCache);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInspectionProgress = async (entryId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<InspectionProgress>(`${API_URL}/sample-entries/${entryId}/inspection-progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: response.data as InspectionProgress
      }));
    } catch (error: any) {
      console.error('Failed to load inspection progress:', error);
      console.error('Error response:', error.response?.data);
      // Set default progress if API fails
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: {
          totalBags: 0,
          inspectedBags: 0,
          remainingBags: 0,
          progressPercentage: 0,
          previousInspections: []
        }
      }));
    }
  };

  const handleInputChange = (entryId: string, field: string, value: string | number) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value
      }
    }));
  };

  const handleFileChange = (entryId: string, field: 'halfLorryImage' | 'fullLorryImage', file: File | null) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: file
      }
    }));
  };

  const handleSubmitInspection = async (entryId: string) => {
    const data = inspectionData[entryId];
    const progress = inspectionProgress[entryId];

    if (!data || !data.inspectionDate || !data.lorryNumber || !data.actualBags ||
      !data.cutting || !data.bend) {
      showNotification('Please fill all required fields', 'error');
      return;
    }

    // Parse cutting: e.g. "12x20" → cutting1=12, cutting2=20
    const cuttingParts = data.cutting.split(/[xX×]/);
    const cutting1 = parseFloat(cuttingParts[0]?.trim()) || 0;
    const cutting2 = cuttingParts.length > 1 ? (parseFloat(cuttingParts[1]?.trim()) || 0) : 0;

    // Parse bend: e.g. "12x15" → bend1 = 12, bend2 = 15
    const bendParts = data.bend.split(/[xX×]/);
    const bend1 = parseFloat(bendParts[0]?.trim()) || 0;
    const bend2 = bendParts.length > 1 ? (parseFloat(bendParts[1]?.trim()) || 0) : 0;

    // Validate bags don't exceed remaining
    if (progress && data.actualBags > progress.remainingBags) {
      showNotification(`Cannot inspect ${data.actualBags} bags. Only ${progress.remainingBags} bags remaining.`, 'error');
      return;
    }

    // Validate bags is not zero or negative
    if (!data.actualBags || data.actualBags <= 0) {
      showNotification('Please enter valid number of bags', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('inspectionDate', data.inspectionDate);
      formData.append('lorryNumber', data.lorryNumber);
      formData.append('actualBags', data.actualBags.toString());
      formData.append('cutting1', cutting1.toString());
      formData.append('cutting2', cutting2.toString());
      formData.append('bend', data.bend);
      formData.append('bend1', bend1.toString());
      formData.append('bend2', bend2.toString());
      if (data.remarks) formData.append('remarks', data.remarks);

      // Add images if selected
      if (data.halfLorryImage) {
        formData.append('halfLorryImage', data.halfLorryImage);
      }
      if (data.fullLorryImage) {
        formData.append('fullLorryImage', data.fullLorryImage);
      }

      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      showNotification('Physical inspection submitted successfully', 'success');
      setSelectedEntry(null);
      setInspectionData(prev => {
        const newData = { ...prev };
        delete newData[entryId];
        return newData;
      });

      // Reload entries and progress
      await loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to submit inspection', 'error');
    }
  };

  const initializeInspectionData = (entryId: string) => {
    const progress = inspectionProgress[entryId];
    if (!inspectionData[entryId]) {
      setInspectionData(prev => ({
        ...prev,
        [entryId]: {
          inspectionDate: new Date().toISOString().split('T')[0],
          lorryNumber: '',
          actualBags: progress?.remainingBags || 0,
          cutting: '',
          bend: '',
          halfLorryImage: null,
          fullLorryImage: null,
          remarks: ''
        }
      }));
    }
    setSelectedEntry(entryId);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#2e7d32';
    if (percentage >= 50) return '#d97706';
    return '#dc2626';
  };

  const isLocationStaffUser = user?.role === 'staff' && user?.staffType === 'location';
  const isLegacyPhysicalSupervisor = user?.role === 'physical_supervisor';

  if (user && !isLocationStaffUser && !isLegacyPhysicalSupervisor) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        <h2 style={{ marginBottom: '10px', color: '#333' }}>Access Denied</h2>
        <p>Only assigned location staff can access this page.</p>
      </div>
    );
  }

  const filteredEntries = entries.filter(entry => {
    if (activeTab === 'paddy') {
      return entry.entryType !== 'RICE_SAMPLE';
    } else {
      return entry.entryType === 'RICE_SAMPLE';
    }
  });

  return (
    <div style={{ padding: '0px 20px 20px 20px' }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '10px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <button
          onClick={() => setActiveTab('paddy')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderBottom: activeTab === 'paddy' ? '3px solid #4a90e2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'paddy' ? '#4a90e2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Paddy Loading
        </button>
        <button
          onClick={() => setActiveTab('rice')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderBottom: activeTab === 'rice' ? '3px solid #4a90e2' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'rice' ? '#4a90e2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Rice Loading
        </button>
      </div>

      <div style={{
        overflowX: 'auto',
        backgroundColor: 'white',
        border: '1px solid #999'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '60px' }}>SL No</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Date</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '100px' }}>Broker</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Variety</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Party</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '110px' }}>Location</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Total</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Loaded</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '95px' }}>Balance</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '140px' }}>Progress</th>
              <th style={{ border: '1px solid #24629e', padding: '10px 12px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No lots allotted for inspection</td></tr>
            ) : (
              filteredEntries.map((entry, index) => {
                const progress = inspectionProgress[entry.id];
                const progressPercentage = progress?.progressPercentage || 0;

                // Check if this is a new lot (different from previous)
                const prevEntry = filteredEntries[index - 1];
                const isNewLot = !prevEntry || prevEntry.id !== entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    {index > 0 && (
                      <tr style={{ backgroundColor: '#ffd700', height: '14px' }}>
                        <td colSpan={11} style={{ padding: 0, height: '14px', border: 'none', borderTop: '2px solid #b8860b', borderBottom: '2px solid #b8860b' }} />
                      </tr>
                    )}
                    <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '3px solid #666' }}>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                        {index + 1}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.brokerName}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.variety}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>
                        <div style={{ fontWeight: '700', color: '#1565c0', fontSize: '14px' }}>{toTitleCase(entry.partyName) || (entry.entryType === 'DIRECT_LOADED_VEHICLE' ? entry.lorryNumber?.toUpperCase() : '')}</div>
                        {entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber && entry.partyName && <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: '700' }}>{entry.lorryNumber.toUpperCase()}</div>}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', fontSize: '13px', textAlign: 'left', color: '#1a1a1a', fontWeight: '500' }}>{entry.location}</td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>
                        {progress?.totalBags?.toLocaleString('en-IN') || entry.bags?.toLocaleString('en-IN')}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', color: '#4CAF50', fontWeight: '700' }}>
                        {progress?.inspectedBags || 0}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '10px 12px', textAlign: 'left', fontSize: '13px', color: entry.lotAllotment?.closedAt ? '#d32f2f' : '#FF9800', fontWeight: '700' }}>
                        {entry.lotAllotment?.closedAt ? (
                           <span>0 <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#777' }}>(Closed)</span></span>
                        ) : (
                          progress?.remainingBags?.toLocaleString('en-IN') || entry.bags?.toLocaleString('en-IN')
                        )}
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '6px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{
                            flex: 1,
                            height: '20px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '10px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${entry.lotAllotment?.closedAt ? 100 : progressPercentage}%`,
                              backgroundColor: entry.lotAllotment?.closedAt ? '#7f8c8d' : getProgressColor(progressPercentage),
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '35px' }}>
                            {entry.lotAllotment?.closedAt ? 'Closed' : `${progressPercentage.toFixed(0)}%`}
                          </span>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #666', borderBottom: '3px solid #666', padding: '6px', textAlign: 'left' }}>
                        <button
                          onClick={() => initializeInspectionData(entry.id)}
                          disabled={progressPercentage >= 100 || !!entry.lotAllotment?.closedAt}
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            fontWeight: '700',
                            backgroundColor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt) ? '#ccc' : (selectedEntry === entry.id ? '#FF9800' : '#4CAF50'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: (progressPercentage >= 100 || entry.lotAllotment?.closedAt) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {entry.lotAllotment?.closedAt ? 'Closed' : (progressPercentage >= 100 ? 'Complete' : (selectedEntry === entry.id ? 'Editing...' : 'Add Inspection'))}
                        </button>
                      </td>
                    </tr>

                    {/* Show previous inspections history */}
                    {progress && progress.previousInspections && progress.previousInspections.length > 0 && (
                      <tr style={{ borderBottom: '3px solid #444' }}>
                        <td colSpan={11} style={{ padding: '12px', backgroundColor: '#f0f8ff', border: '1px solid #666', borderBottom: '3px solid #444' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px', color: '#111' }}>
                            📋 Lorry Loading Details ({progress.previousInspections.length})
                          </div>
                          <table style={{ width: '100%', maxWidth: '950px', fontSize: '13px', borderCollapse: 'collapse', border: '1px solid #444', tableLayout: 'fixed' }}>
                            <colgroup>
                              <col style={{ width: '120px' }} />
                              <col style={{ width: '160px' }} />
                              <col style={{ width: '110px' }} />
                              <col style={{ width: '130px' }} />
                              <col style={{ width: '130px' }} />
                              <col style={{ width: '160px' }} />
                            </colgroup>
                            <thead>
                              <tr style={{ backgroundColor: '#d0e1f9', color: '#111' }}>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Date</th>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Lorry Number</th>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Bags</th>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Cutting</th>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Bend</th>
                                <th style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700' }}>Loaded By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {progress.previousInspections.map((inspection, idx) => (
                                <tr key={inspection.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                                  </td>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>{inspection.lorryNumber}</td>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#1a1a1a' }}>
                                    {inspection.bags?.toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                                    {formatDecimal(inspection.cutting1)} {inspection.cutting2 && Number(inspection.cutting2) !== 0 ? `x ${formatDecimal(inspection.cutting2)}` : ''}
                                  </td>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>
                                    {formatDecimal(inspection.bend)} {inspection.bend2 && Number(inspection.bend2) !== 0 ? `x ${formatDecimal(inspection.bend2)}` : ''}
                                  </td>
                                  <td style={{ border: '1px solid #444', padding: '8px 10px', textAlign: 'left', color: '#1a1a1a', fontWeight: '600' }}>{inspection.reportedBy.username}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}

                    {/* Inspection form */}
                    {selectedEntry === entry.id && (
                      <tr>
                        <td colSpan={11} style={{ padding: '15px', backgroundColor: '#fff3e0', border: '1px solid #999' }}>
                          <div style={{
                            maxWidth: '500px',
                            backgroundColor: '#ffffff',
                            padding: '16px 20px',
                            borderRadius: '8px',
                            border: '1px solid #e0b380',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                          }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '13px', fontWeight: '700', color: '#e67e22', borderBottom: '2px solid #fff3e0', paddingBottom: '8px' }}>
                              Add New Inspection - Remaining Bags: {progress?.remainingBags || entry.bags}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {/* Row 1: Date & Lorry Number */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Inspection date *
                                  </label>
                                  <input
                                    type="date"
                                    value={inspectionData[entry.id]?.inspectionDate || ''}
                                    onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Lorry number *
                                  </label>
                                  <input
                                    type="text"
                                    value={inspectionData[entry.id]?.lorryNumber || ''}
                                    onChange={(e) => handleInputChange(entry.id, 'lorryNumber', e.target.value.toUpperCase())}
                                    placeholder="Enter lorry number"
                                    maxLength={10}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#fff',
                                      textTransform: 'uppercase'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Row 2: Actual Bags */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Actual bags (this lorry) *
                                  </label>
                                  <input
                                    type="number"
                                    value={inspectionData[entry.id]?.actualBags || ''}
                                    onChange={(e) => handleInputChange(entry.id, 'actualBags', Number(e.target.value))}
                                    placeholder={`Max: ${progress?.remainingBags || entry.bags}`}
                                    max={progress?.remainingBags || entry.bags}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'flex-end' }}>
                                  {/* Empty space for alignment */}
                                </div>
                              </div>

                              {/* Row 3: Quality Parameters (Cutting & Bend) */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Cutting *
                                  </label>
                                  <input
                                    type="text"
                                    value={inspectionData[entry.id]?.cutting || ''}
                                    placeholder="1×"
                                    onFocus={() => {
                                      if (!inspectionData[entry.id]?.cutting) {
                                        const res = handleCuttingInput('1×', entry.entryType);
                                        handleInputChange(entry.id, 'cutting', res.raw);
                                      }
                                    }}
                                    onChange={(e) => {
                                      const res = handleCuttingInput(e.target.value, entry.entryType);
                                      handleInputChange(entry.id, 'cutting', res.raw);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Bend *
                                  </label>
                                  <input
                                    type="text"
                                    value={inspectionData[entry.id]?.bend || ''}
                                    placeholder="1×"
                                    onFocus={() => {
                                      if (!inspectionData[entry.id]?.bend) {
                                        const res = handleBendInput('1×', entry.entryType);
                                        handleInputChange(entry.id, 'bend', res.raw);
                                      }
                                    }}
                                    onChange={(e) => {
                                      const res = handleBendInput(e.target.value, entry.entryType);
                                      handleInputChange(entry.id, 'bend', res.raw);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      color: '#1a1a1a',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Row 4: Lorry Images */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Half lorry image (optional)
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(entry.id, 'halfLorryImage', e.target.files?.[0] || null)}
                                    style={{
                                      width: '100%',
                                      padding: '6px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                    Full lorry image (optional)
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(entry.id, 'fullLorryImage', e.target.files?.[0] || null)}
                                    style={{
                                      width: '100%',
                                      padding: '6px',
                                      fontSize: '11px',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      backgroundColor: '#fff'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Row 5: Remarks */}
                              <div style={{ width: '100%' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600', color: '#444' }}>
                                  Remarks
                                </label>
                                <textarea
                                  value={inspectionData[entry.id]?.remarks || ''}
                                  onChange={(e) => handleInputChange(entry.id, 'remarks', e.target.value)}
                                  placeholder="Enter any remarks"
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '11px',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    color: '#1a1a1a',
                                    backgroundColor: '#fff',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Buttons */}
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                              <button
                                onClick={() => handleSubmitInspection(entry.id)}
                                style={{
                                  fontSize: '12px',
                                  padding: '8px 16px',
                                  fontWeight: '600',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Submit Inspection
                              </button>
                              <button
                                onClick={() => setSelectedEntry(null)}
                                style={{
                                  fontSize: '12px',
                                  padding: '8px 16px',
                                  fontWeight: '600',
                                  backgroundColor: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PhysicalInspection;
