import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { toast } from '../utils/toast';
import { NotificationMessages } from '../utils/notificationMessages';
import { useLocation as useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import PaddyHamaliRatesTable from '../components/PaddyHamaliRatesTable';
import RiceHamaliRatesTable from '../components/RiceHamaliRatesTable';
import { API_URL } from '../config/api';

const Container = styled.div`
  animation: fadeIn 0.5s ease-in;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
`;

const Title = styled.h1`
  color: #ffffff;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
`;

const TabContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 1rem 2rem;
  border: none;
  background: ${props => props.active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => props.active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f3f4f6'};
    color: ${props => props.active ? 'white' : '#374151'};
  }
`;

const SubTabContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
`;

const SubTabButton = styled.button<{ $active: boolean }>`
  padding: 0.6rem 1.2rem;
  border: none;
  background: ${props => props.$active ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#6b7280'};
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  
  &:hover {
    background: ${props => props.$active ? 'linear-gradient(135deg, #10b981, #059669)' : '#f3f4f6'};
    color: ${props => props.$active ? 'white' : '#374151'};
  }
`;

const SectionContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #f3f4f6;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
`;

const SectionTitle = styled.h2`
  color: #1f2937;
  font-size: 1.5rem;
  margin: 0;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.primary {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
  }

  &.secondary {
    background: #6b7280;
    color: white;
  }

  &.success {
    background: #10b981;
    color: white;
  }

  &.danger {
    background: #ef4444;
    color: white;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const CreateFormContainer = styled.div`
  background: #f8fafc;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 2px solid #e5e7eb;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
  gap: 1.5rem;
  align-items: end;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
`;

const Th = styled.th`
  background: linear-gradient(135deg, #4472c4, #3b5998);
  color: white;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.9rem;
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #4b5563;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const IconButton = styled.button`
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  
  &.edit {
    background: #3b82f6;
    color: white;
    
    &:hover {
      background: #2563eb;
    }
  }
  
  &.delete {
    background: #ef4444;
    color: white;
    
    &:hover {
      background: #dc2626;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-size: 1.1rem;
`;

const AddButton = styled.button`
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  
  input, select {
    background-color: #ffffff;
  }
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #1f2937;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
`;

interface LocationsProps {
  defaultTab?: 'warehouse' | 'kunchinittu' | 'variety' | 'riceVariety' | 'production' | 'packaging' | 'riceStockLocation' | 'hamali' | 'riceHamali' | 'broker';
  hideTabs?: boolean;
}

const Locations: React.FC<LocationsProps> = ({ defaultTab, hideTabs = false }) => {
  const { user } = useAuth();
  const { warehouses, kunchinittus, varieties, riceVarieties, fetchWarehouses, fetchKunchinittus, fetchVarieties, fetchRiceVarieties } = useLocationContext();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [showModal, setShowModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'warehouse' | 'kunchinittu' | 'variety' | 'riceVariety' | 'production' | 'packaging' | 'riceStockLocation' | 'hamali' | 'riceHamali' | 'broker'>(() => {
    if (defaultTab) return defaultTab;
    const validTabs = ['warehouse', 'kunchinittu', 'variety', 'riceVariety', 'production', 'packaging', 'riceStockLocation', 'hamali', 'riceHamali', 'broker'];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam as any;
    }
    return 'warehouse';
  });

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else {
      const validTabs = ['warehouse', 'kunchinittu', 'variety', 'riceVariety', 'production', 'packaging', 'riceStockLocation', 'hamali', 'riceHamali', 'broker'];
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, [tabParam, defaultTab]);

  // Warehouse form
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseType, setWarehouseType] = useState<'mill' | 'outside'>('mill');
  const [warehouseShortCutName, setWarehouseShortCutName] = useState('');
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [warehouseTabFilter, setWarehouseTabFilter] = useState<'mill' | 'outside'>('mill');

  // Kunchinittu form
  const [kunchinintuName, setKunchinintuName] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  const [editingKunchinittu, setEditingKunchinittu] = useState<any>(null);

  // Variety form
  const [varietyName, setVarietyName] = useState('');
  const [editingVariety, setEditingVariety] = useState<any>(null);

  // Rice Variety form
  const [riceVarietyName, setRiceVarietyName] = useState('');
  const [editingRiceVariety, setEditingRiceVariety] = useState<any>(null);

  // Broker form
  const [brokerName, setBrokerName] = useState('');
  const [brokerType, setBrokerType] = useState<'paddy' | 'rice' | 'both'>('both');
  const [brokerPhoneNumber, setBrokerPhoneNumber] = useState('');
  const [brokerIsActive, setBrokerIsActive] = useState<boolean>(true);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [editingBroker, setEditingBroker] = useState<any>(null);
  const [brokerStatusFilter, setBrokerStatusFilter] = useState<'active' | 'inactive'>('active');
  const [brokerTypeFilter, setBrokerTypeFilter] = useState<'all' | 'paddy' | 'rice' | 'both'>('all');

  // Production (Outturn) form
  const [outturnCode, setOutturnCode] = useState('');
  const [allottedVariety, setAllottedVariety] = useState('');
  const [outturnType, setOutturnType] = useState<'Raw' | 'Steam'>('Raw');
  const [outturns, setOutturns] = useState<any[]>([]);
  const [editingOutturn, setEditingOutturn] = useState<any>(null);

  // Packaging form
  const [packagingBrandName, setPackagingBrandName] = useState('');
  const [packagingKg, setPackagingKg] = useState('26');
  const [packagings, setPackagings] = useState<any[]>([]);
  const [editingPackaging, setEditingPackaging] = useState<any>(null);

  // Rice Stock Location form
  const [riceStockLocationCode, setRiceStockLocationCode] = useState('');
  const [riceStockLocationName, setRiceStockLocationName] = useState('');
  const [riceStockLocations, setRiceStockLocations] = useState<any[]>([]);
  const [editingRiceStockLocation, setEditingRiceStockLocation] = useState<any>(null);

  // Hamali rates form
  const [loadingRate, setLoadingRate] = useState('');
  const [unloadingSadaRate, setUnloadingSadaRate] = useState('');
  const [unloadingKnRate, setUnloadingKnRate] = useState('');
  const [looseTumbidduRate, setLooseTumbidduRate] = useState('');
  const [hamaliRatesId, setHamaliRatesId] = useState<number | null>(null);
  const [editingHamaliRates, setEditingHamaliRates] = useState(false);

  const canEdit = user?.role === 'manager' || user?.role === 'admin';
  const toTitleCase = (value?: string | null) => {
    const str = typeof value === 'string' ? value.trim() : '';
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  };
  const notifyLocationsUpdated = () => {
    try {
      localStorage.setItem('locationsUpdatedAt', Date.now().toString());
    } catch (err) {
      console.warn('Failed to persist locations update signal', err);
    }
    window.dispatchEvent(new Event('locations:updated'));
  };

  useEffect(() => {
    fetchWarehouses();
    fetchKunchinittus();
    fetchVarieties();
  }, []);

  useEffect(() => {
    if (activeTab === 'production') {
      fetchOutturns();
    } else if (activeTab === 'packaging') {
      fetchPackagings();
    } else if (activeTab === 'riceStockLocation') {
      fetchRiceStockLocations();
    } else if (activeTab === 'riceVariety') {
      fetchRiceVarieties();
    } else if (activeTab === 'hamali') {
      fetchHamaliRates();
    } else if (activeTab === 'broker') {
      fetchBrokers();
    }
  }, [activeTab]);

  const fetchOutturns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<any[]>('/outturns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setOutturns(data);

      // Auto-generate next outturn code
      if (data.length > 0) {
        // Find the latest code (assuming format YY-SEQUENCE, e.g., 24-01)
        // Sort by ID descending to get the latest created
        const sortedOutturns = [...data].sort((a, b) => b.id - a.id);
        const latestOutturn = sortedOutturns[0];

        if (latestOutturn && latestOutturn.code) {
          const parts = latestOutturn.code.split('-');
          if (parts.length === 2) {
            const year = parts[0];
            const sequence = parseInt(parts[1]);

            // Check if it's the same year
            const currentYear = new Date().getFullYear().toString().slice(-2);

            if (year === currentYear && !isNaN(sequence)) {
              const nextSequence = (sequence + 1).toString().padStart(2, '0');
              setOutturnCode(`${currentYear}-${nextSequence}`);
            } else {
              // New year or invalid format, start fresh for current year
              setOutturnCode(`${currentYear}-01`);
            }
          } else {
            // Different format, start fresh for current year
            const currentYear = new Date().getFullYear().toString().slice(-2);
            setOutturnCode(`${currentYear}-01`);
          }
        }
      } else {
        // No outturns yet, start with current year
        const currentYear = new Date().getFullYear().toString().slice(-2);
        setOutturnCode(`${currentYear}-01`);
      }
    } catch (error) {
      console.error('Error fetching outturns:', error);
      toast.error('Failed to fetch outturns');
    }
  };

  const handleCreateOutturn = async () => {
    if (!outturnCode.trim() || !allottedVariety.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (editingOutturn) {
        // Update existing outturn
        await axios.put(`${API_URL}/outturns/${editingOutturn.id}`,
          { code: outturnCode, allottedVariety, type: outturnType },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Outturn updated successfully!');
        setEditingOutturn(null);
      } else {
        // Create new outturn
        await axios.post(`${API_URL}/outturns`,
          { code: outturnCode, allottedVariety, type: outturnType },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Outturn created successfully');
      }

      setOutturnCode('');
      setAllottedVariety('');
      setOutturnType('Raw');
      fetchOutturns();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingOutturn ? 'Failed to update outturn' : 'Failed to create outturn'));
    }
  };

  const handleEditOutturn = (outturn: any) => {
    setEditingOutturn(outturn);
    setOutturnCode(outturn.code);
    setAllottedVariety(outturn.allottedVariety);
    setOutturnType(outturn.type || 'Raw');
  };

  const handleCancelOutturnEdit = () => {
    setEditingOutturn(null);
    setOutturnCode('');
    setAllottedVariety('');
    setOutturnType('Raw');
    fetchOutturns(); // Re-generate next code
  };

  const handleDeleteOutturn = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this outturn?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/outturns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Outturn deleted successfully');
      fetchOutturns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete outturn');
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseName.trim()) {
      toast.error('Please enter warehouse name');
      return;
    }

    if (warehouseType === 'outside' && !warehouseLocation.trim()) {
      toast.error('Location is required for outside warehouses');
      return;
    }

    try {
      const code = warehouseName.substring(0, 10).toUpperCase();

      if (editingWarehouse) {
        // Update existing
        await axios.put(`${API_URL}/locations/warehouses/${editingWarehouse.id}`, {
          name: warehouseName.trim(),
          code: editingWarehouse.code, // Keep existing code
          location: warehouseType === 'outside' ? warehouseLocation.trim() : null,
          type: warehouseType,
          shortCutName: warehouseShortCutName.trim() || null,
          isActive: true
        });
        toast.success('Warehouse updated successfully!');
        setEditingWarehouse(null);
      } else {
        // Create new
        await axios.post(`${API_URL}/locations/warehouses`, {
          name: warehouseName.trim(),
          code,
          location: warehouseType === 'outside' ? warehouseLocation.trim() : null,
          type: warehouseType,
          shortCutName: warehouseShortCutName.trim() || null,
          isActive: true
        });
        toast.success('Warehouse created successfully!');
      }

      setWarehouseName('');
      setWarehouseLocation('');
      setWarehouseShortCutName('');
      setWarehouseType('mill');
      fetchWarehouses();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingWarehouse ? 'Failed to update warehouse' : 'Failed to create warehouse'));
    }
  };

  const handleCreateKunchinittu = async () => {
    if (!kunchinintuName.trim() || !selectedWarehouseId || !selectedVarietyId) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const code = kunchinintuName.substring(0, 10).toUpperCase();

      if (editingKunchinittu) {
        // Update existing
        await axios.put(`${API_URL}/locations/kunchinittus/${editingKunchinittu.id}`, {
          name: kunchinintuName.trim(),
          code: editingKunchinittu.code,
          warehouseId: parseInt(selectedWarehouseId),
          varietyId: parseInt(selectedVarietyId),
          isActive: true
        });
        toast.success('KanchiNittu updated successfully!');
        setEditingKunchinittu(null);
      } else {
        // Create new
        await axios.post(`${API_URL}/locations/kunchinittus`, {
          name: kunchinintuName.trim(),
          code,
          warehouseId: parseInt(selectedWarehouseId),
          varietyId: parseInt(selectedVarietyId),
          isActive: true
        });
        toast.success('KanchiNittu created successfully!');
      }

      setKunchinintuName('');
      setSelectedWarehouseId('');
      setSelectedVarietyId('');
      fetchKunchinittus();
      setShowModal(false);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || (editingKunchinittu ? 'Failed to update KanchiNittu' : 'Failed to create KanchiNittu');
      toast.error(errorMessage);
    }
  };

  const handleCreateVariety = async () => {
    if (!varietyName.trim()) {
      toast.error('Please enter variety name');
      return;
    }

    try {
      const code = varietyName.substring(0, 10).toUpperCase();

      if (editingVariety) {
        // Update existing
        await axios.put(`${API_URL}/locations/varieties/${editingVariety.id}`, {
          name: varietyName.trim(),
          code: editingVariety.code,
          isActive: true
        });
        toast.success('Variety updated successfully!');
        setEditingVariety(null);
      } else {
        // Create new
        await axios.post(`${API_URL}/locations/varieties`, {
          name: varietyName.trim(),
          code,
          isActive: true
        });
        toast.success('Variety created successfully!');
      }

      setVarietyName('');
      fetchVarieties();
      notifyLocationsUpdated();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingVariety ? 'Failed to update variety' : 'Failed to create variety'));
    }
  };

  const handleCreateRiceVariety = async () => {
    if (!riceVarietyName.trim()) {
      toast.error('Please enter rice variety name');
      return;
    }

    try {
      const code = riceVarietyName.substring(0, 15).toUpperCase().replace(/\s+/g, '-');

      if (editingRiceVariety) {
        await axios.put(`${API_URL}/locations/rice-varieties/${editingRiceVariety.id}`, {
          name: riceVarietyName.trim(),
          code, // Re-generate or keep? Let's re-generate for simplicity or allow edit code later
          isActive: true
        });
        toast.success('Rice Variety updated successfully!');
        setEditingRiceVariety(null);
      } else {
        await axios.post(`${API_URL}/locations/rice-varieties`, {
          name: riceVarietyName.trim(),
          code,
          isActive: true
        });
        toast.success('Rice Variety created successfully!');
      }

      setRiceVarietyName('');
      fetchRiceVarieties();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingRiceVariety ? 'Failed to update rice variety' : 'Failed to create rice variety'));
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/locations/${type === 'riceVariety' ? 'rice-varieties' : type + 's'}/${id}`);

      toast.success(`${type === 'riceVariety' ? 'Rice Variety' : type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);

      if (type === 'warehouse') fetchWarehouses();
      if (type === 'kunchinittu') fetchKunchinittus();
      if (type === 'variety') fetchVarieties();
      if (type === 'riceVariety') fetchRiceVarieties();
    } catch (error) {
      toast.error(`Failed to delete ${type}`);
    }
  };

  const handleEdit = (type: string, item: any) => {
    if (type === 'warehouse') {
      setEditingWarehouse(item);
      setWarehouseName(item.name);
      setWarehouseLocation(item.location || '');
      setWarehouseType(item.type || 'mill');
      setWarehouseShortCutName(item.shortCutName || '');
    } else if (type === 'variety') {
      setEditingVariety(item);
      setVarietyName(item.name);
    } else if (type === 'kunchinittu') {
      setEditingKunchinittu(item);
      setKunchinintuName(item.name);
      setSelectedWarehouseId(item.warehouseId?.toString() || '');
      setSelectedVarietyId(item.varietyId?.toString() || '');
    } else if (type === 'riceVariety') {
      setEditingRiceVariety(item);
      setRiceVarietyName(item.name);
    }
  };

  const handleCancelEdit = () => {
    setEditingWarehouse(null);
    setEditingVariety(null);
    setEditingKunchinittu(null);
    setWarehouseName('');
    setWarehouseLocation('');
    setWarehouseType('mill');
    setWarehouseShortCutName('');
    setVarietyName('');
    setKunchinintuName('');
    setRiceVarietyName('');
    setSelectedWarehouseId('');
    setSelectedVarietyId('');
    setEditingPackaging(null);
    setPackagingBrandName('');
    setEditingRiceVariety(null);
    setPackagingKg('26');
    setEditingRiceStockLocation(null);
    setRiceStockLocationCode('');
    setRiceStockLocationName('');
    setEditingBroker(null);
    setBrokerName('');
    setBrokerType('both');
    setBrokerPhoneNumber('');
    setBrokerIsActive(true);
  };

  // Packaging functions
  const fetchPackagings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ packagings: any[] }>(`${API_URL}/packagings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPackagings(response.data.packagings || []);
    } catch (error) {
      console.error('Error fetching packagings:', error);
      toast.error('Failed to fetch packagings');
    }
  };

  const handleCreatePackaging = async () => {
    if (!packagingBrandName.trim()) {
      toast.error('Please fill brand name');
      return;
    }

    if (!packagingKg || parseFloat(packagingKg) <= 0) {
      toast.error('Please enter a valid KG value');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        brandName: packagingBrandName.trim(),
        code: packagingBrandName.trim(), // Use brand name as code
        allottedKg: parseFloat(packagingKg)
      };

      if (editingPackaging) {
        const response = await axios.put(`${API_URL}/packagings/${editingPackaging.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Packaging updated successfully and related records recalculated!');
      } else {
        await axios.post(`${API_URL}/packagings`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Packaging created successfully!');
      }

      setPackagingBrandName('');
      setPackagingKg('25');
      setEditingPackaging(null);
      await fetchPackagings();
      setShowModal(false);
    } catch (error: any) {
      console.error('Packaging operation error:', error);
      toast.error(error.response?.data?.error || (editingPackaging ? 'Failed to update packaging' : 'Failed to create packaging'));
    }
  };

  const handleDeletePackaging = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this packaging?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/packagings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Packaging deleted successfully!');
      fetchPackagings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete packaging');
    }
  };

  const handleEditPackaging = (packaging: any) => {
    setEditingPackaging(packaging);
    setPackagingBrandName(packaging.brandName);
    setPackagingKg(packaging.allottedKg);
  };

  // Rice Stock Location functions
  const fetchRiceStockLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ locations: any[] }>(`${API_URL}/locations/rice-stock-locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiceStockLocations(response.data.locations || []);
    } catch (error) {
      console.error('Error fetching rice stock locations:', error);
      toast.error('Failed to fetch rice stock locations');
    }
  };

  const handleCreateRiceStockLocation = async () => {
    if (!riceStockLocationCode.trim()) {
      toast.error('Please enter location code');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        code: riceStockLocationCode.trim().toUpperCase(),
        name: riceStockLocationName.trim() || null
      };

      if (editingRiceStockLocation) {
        await axios.put(`${API_URL}/locations/rice-stock-locations/${editingRiceStockLocation.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Rice stock location updated successfully!');
      } else {
        await axios.post(`${API_URL}/locations/rice-stock-locations`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Rice stock location created successfully!');
      }

      setRiceStockLocationCode('');
      setRiceStockLocationName('');
      setEditingRiceStockLocation(null);
      fetchRiceStockLocations();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingRiceStockLocation ? 'Failed to update location' : 'Failed to create location'));
    }
  };

  const handleDeleteRiceStockLocation = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this rice stock location?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/locations/rice-stock-locations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rice stock location deleted successfully!');
      fetchRiceStockLocations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete location');
    }
  };

  const handleEditRiceStockLocation = (location: any) => {
    setEditingRiceStockLocation(location);
    setRiceStockLocationCode(location.code);
    setRiceStockLocationName(location.name || '');
  };

  // Hamali rates functions
  const fetchHamaliRates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ rates: any }>('/hamali-rates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rates = response.data.rates;
      setLoadingRate(rates.loadingRate?.toString() || '0');
      setUnloadingSadaRate(rates.unloadingSadaRate?.toString() || '0');
      setUnloadingKnRate(rates.unloadingKnRate?.toString() || '0');
      setLooseTumbidduRate(rates.looseTumbidduRate?.toString() || '0');
      setHamaliRatesId(rates.id || null);
    } catch (error) {
      console.error('Error fetching hamali rates:', error);
      toast.error('Failed to fetch hamali rates');
    }
  };

  const handleSaveHamaliRates = async () => {
    if (!loadingRate || !unloadingSadaRate || !unloadingKnRate || !looseTumbidduRate) {
      toast.error('Please fill all rate fields');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        loadingRate: parseFloat(loadingRate),
        unloadingSadaRate: parseFloat(unloadingSadaRate),
        unloadingKnRate: parseFloat(unloadingKnRate),
        looseTumbidduRate: parseFloat(looseTumbidduRate)
      };

      await axios.post(`${API_URL}/hamali-rates`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(NotificationMessages.hamali.ratesUpdated);
      setEditingHamaliRates(false);
      fetchHamaliRates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save hamali rates');
    }
  };

  const handleEditHamaliRates = () => {
    setEditingHamaliRates(true);
  };

  const handleCancelHamaliEdit = () => {
    setEditingHamaliRates(false);
    fetchHamaliRates();
  };

  // Broker functions
  const fetchBrokers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ brokers: any[] }>(`${API_URL}/locations/brokers`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { includeInactive: 'true', t: Date.now() }
      });
      setBrokers(response.data.brokers || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
      toast.error('Failed to fetch brokers');
    }
  };

  const handleCreateBroker = async () => {
    if (!brokerName.trim()) {
      toast.error('Please enter broker name');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    const phoneVal = brokerPhoneNumber.trim();
    if (phoneVal && !/^\d{10}$/.test(phoneVal)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload: any = {
        name: brokerName.trim(),
        type: brokerType,
        phoneNumber: phoneVal || null
      };

      if (editingBroker) {
        payload.isActive = brokerIsActive;
      }

      if (editingBroker) {
        await axios.put(`${API_URL}/locations/brokers/${editingBroker.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Broker updated successfully!');
      } else {
        await axios.post(`${API_URL}/locations/brokers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Broker created successfully!');
      }

      setBrokerName('');
      setBrokerType('both');
      setBrokerPhoneNumber('');
      setBrokerIsActive(true);
      setEditingBroker(null);
      fetchBrokers();
      notifyLocationsUpdated();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingBroker ? 'Failed to update broker' : 'Failed to create broker'));
    }
  };

  const handleDeleteBroker = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this broker?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/locations/brokers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Broker deleted successfully!');
      fetchBrokers();
      notifyLocationsUpdated();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete broker');
    }
  };

  const handleToggleBrokerStatus = async (broker: any) => {
    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/locations/brokers/${broker.id}`, {
        isActive: broker.isActive === false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Broker ${broker.isActive === false ? 'activated' : 'deactivated'} successfully!`);
      fetchBrokers();
      notifyLocationsUpdated();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const handleEditBroker = (broker: any) => {
    setEditingBroker(broker);
    setBrokerName(broker.name);
    setBrokerType(broker.type || 'both');
    setBrokerPhoneNumber(broker.phoneNumber || '');
    setBrokerIsActive(broker.isActive !== false);
  };

  const getPageTitle = () => {
    if (!hideTabs) return '📍 Location Management';
    switch (activeTab) {
      case 'broker': return '👥 Broker Management';
      case 'variety': return '🌾 Variety Management';
      case 'warehouse': return '🏢 Warehouse Management';
      case 'kunchinittu': return '📦 KanchiNittu Management';
      case 'packaging': return '🛍️ Brand Management';
      case 'hamali': return '👷 Paddy Hamali Rates';
      case 'riceHamali': return '👷 Rice Hamali Rates';
      default: return '📍 Master Management';
    }
  };

  return (
    <Container>
      <Title>{getPageTitle()}</Title>

      {!hideTabs && (
        <TabContainer>
          <Tab active={activeTab === 'warehouse'} onClick={() => setActiveTab('warehouse')}>
            Warehouse
          </Tab>
          <Tab active={activeTab === 'variety'} onClick={() => setActiveTab('variety')}>
            Variety
          </Tab>
          <Tab active={activeTab === 'kunchinittu'} onClick={() => setActiveTab('kunchinittu')}>
            KanchiNittu
          </Tab>
          <Tab active={activeTab === 'production'} onClick={() => setActiveTab('production')}>
            Production
          </Tab>
          <Tab active={activeTab === 'packaging'} onClick={() => setActiveTab('packaging')}>
            Packaging
          </Tab>
          <Tab active={activeTab === 'riceStockLocation'} onClick={() => setActiveTab('riceStockLocation')}>
            Rice Stock Locations
          </Tab>
          <Tab active={activeTab === 'riceVariety'} onClick={() => setActiveTab('riceVariety')}>
            Rice Varieties
          </Tab>
          <Tab active={activeTab === 'broker'} onClick={() => setActiveTab('broker')}>
            Brokers
          </Tab>
          <Tab active={activeTab === 'hamali'} onClick={() => setActiveTab('hamali')}>
            Paddy Hamali
          </Tab>
          <Tab active={activeTab === 'riceHamali'} onClick={() => setActiveTab('riceHamali')}>
            Rice Hamali
          </Tab>
        </TabContainer>
      )}

      <SectionContainer>
        {defaultTab === 'variety' && (
          <SubTabContainer>
            <SubTabButton $active={activeTab === 'variety'} onClick={() => setActiveTab('variety')}>
              Paddy Variety
            </SubTabButton>
            <SubTabButton $active={activeTab === 'riceVariety'} onClick={() => setActiveTab('riceVariety')}>
              Rice Variety
            </SubTabButton>
          </SubTabContainer>
        )}
        {activeTab === 'warehouse' && (
          <>
            <SectionHeader>
              <SectionTitle>Warehouses</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setWarehouseType(warehouseTabFilter); setShowModal(true); }}>
                  ➕ Add {warehouseTabFilter === 'mill' ? 'Mill' : 'Outside'} Warehouse
                </AddButton>
              )}
            </SectionHeader>

            <SubTabContainer>
              <SubTabButton $active={warehouseTabFilter === 'mill'} onClick={() => setWarehouseTabFilter('mill')}>
                Mill Warehouse
              </SubTabButton>
              <SubTabButton $active={warehouseTabFilter === 'outside'} onClick={() => setWarehouseTabFilter('outside')}>
                Outside Warehouse
              </SubTabButton>
            </SubTabContainer>

            <div>
              {(() => {
                const filteredWarehouses = warehouses.filter((w: any) => {
                  const type = w.type || 'mill';
                  return type === warehouseTabFilter;
                });

                return filteredWarehouses.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No {warehouseTabFilter === 'mill' ? 'mill' : 'outside'} warehouses created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th style={{ width: '60px' }}>S.No</Th>
                        <Th>Warehouse Name</Th>
                        <Th>Short Cut Name</Th>
                        {warehouseTabFilter === 'outside' && <Th>Location</Th>}
                        {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWarehouses.map((warehouse, index) => (
                        <tr key={warehouse.id}>
                          <Td>{index + 1}</Td>
                          <Td>{warehouse.name}</Td>
                          <Td>{warehouse.shortCutName || '-'}</Td>
                          {warehouseTabFilter === 'outside' && <Td>{warehouse.location || '-'}</Td>}
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => { handleEdit('warehouse', warehouse); setShowModal(true); }}>
                                  ✏️
                                </IconButton>
                                <IconButton 
                                  className="delete" 
                                  onClick={() => handleDelete('warehouse', warehouse.id)}
                                  disabled={warehouse.inUse}
                                  title={warehouse.inUse ? 'Cannot delete: Warehouse is in use by KanchiNittus' : 'Delete Warehouse'}
                                >
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                );
              })()}
            </div>
          </>
        )}

        {activeTab === 'variety' && (
          <>
            <SectionHeader>
              <SectionTitle>Varieties</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Variety
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {varieties.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No varieties created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>Variety Name</Th>
                      {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {varieties.map((variety, index) => (
                      <tr key={variety.id}>
                        <Td>{index + 1}</Td>
                        <Td>{variety.name}</Td>
                        {canEdit && (
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => { handleEdit('variety', variety); setShowModal(true); }}>
                                ✏️
                              </IconButton>
                              <IconButton 
                                className="delete" 
                                onClick={() => handleDelete('variety', variety.id)}
                                disabled={variety.inUse}
                                title={variety.inUse ? 'Cannot delete: Variety is currently in use' : 'Delete Variety'}
                              >
                                🗑️
                              </IconButton>
                            </ActionButtons>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        {activeTab === 'kunchinittu' && (
          <>
            <SectionHeader>
              <SectionTitle>KanchiNittu (KN)</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add KN
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {kunchinittus.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No KanchiNittus created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>KanchiNittu</Th>
                      <Th>Alloted Warehouse</Th>
                      <Th>Alloted Variety</Th>
                      {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {kunchinittus.map((kn, index) => (
                      <tr key={kn.id}>
                        <Td>{index + 1}</Td>
                        <Td>{kn.name}</Td>
                        <Td>{kn.warehouse?.name || '-'}</Td>
                        <Td>{kn.variety?.name || '-'}</Td>
                        {canEdit && (
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => { handleEdit('kunchinittu', kn); setShowModal(true); }}>
                                ✏️
                              </IconButton>
                               <IconButton 
                                 className="delete" 
                                 onClick={() => handleDelete('kunchinittu', kn.id)}
                                 disabled={kn.inUse}
                                 title={kn.inUse ? 'Cannot delete: KanchiNittu is in use in inventory records' : 'Delete KanchiNittu'}
                               >
                                 🗑️
                               </IconButton>
                            </ActionButtons>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        {activeTab === 'riceVariety' && (
          <>
            <SectionHeader>
              <SectionTitle>Rice Variety Management</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Rice Variety
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {riceVarieties.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No rice varieties created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>Name</Th>
                      {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {riceVarieties.map((v: any, index) => (
                      <tr key={v.id}>
                        <Td>{index + 1}</Td>
                        <Td style={{ fontWeight: '600' }}>{v.name}</Td>
                        {canEdit && (
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => { handleEdit('riceVariety', v); setShowModal(true); }}>
                                ✏️ Edit
                              </IconButton>
                              <IconButton 
                                className="delete" 
                                onClick={() => handleDelete('riceVariety', v.id)}
                                disabled={v.inUse}
                                title={v.inUse ? 'Cannot delete: Rice Variety is currently in use' : 'Delete Rice Variety'}
                              >
                                🗑️
                              </IconButton>
                            </ActionButtons>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}
        {activeTab === 'production' && (
          <>
            <SectionHeader>
              <SectionTitle>Outturns</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Outturn
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {outturns.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No outturns created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>Code</Th>
                      <Th>Allotted Variety</Th>
                      <Th>Type</Th>
                      <Th style={{ width: '120px' }}>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {outturns.map((outturn: any, index) => (
                      <tr key={outturn.id}>
                        <Td>{index + 1}</Td>
                        <Td>{outturn.code}</Td>
                        <Td>{outturn.allottedVariety}</Td>
                        <Td>{outturn.type || 'Raw'}</Td>
                        <Td>
                          <ActionButtons>
                            <IconButton className="edit" onClick={() => { handleEditOutturn(outturn); setShowModal(true); }}>
                              ✏️
                            </IconButton>
                            <IconButton className="delete" onClick={() => handleDeleteOutturn(outturn.id)}>
                              🗑️
                            </IconButton>
                          </ActionButtons>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        {activeTab === 'packaging' && (
          <>
            <SectionHeader>
              <SectionTitle>Brand Management</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Brand
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {packagings.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No packagings created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>Brand Name</Th>
                      <Th>KG/Bag</Th>
                      {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {packagings.map((pkg: any, index) => (
                      <tr key={pkg.id}>
                        <Td>{index + 1}</Td>
                        <Td style={{ fontWeight: '600' }}>{pkg.brandName}</Td>
                        <Td>{pkg.allottedKg} KG</Td>
                        {canEdit && (
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => { handleEditPackaging(pkg); setShowModal(true); }}>
                                ✏️
                              </IconButton>
                              <IconButton 
                                className="delete" 
                                onClick={() => handleDeletePackaging(pkg.id)}
                                disabled={pkg.inUse}
                                title={pkg.inUse ? 'Cannot delete: brand is in use' : 'Delete Brand'}
                              >
                                🗑️
                              </IconButton>
                            </ActionButtons>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        {activeTab === 'riceStockLocation' && (
          <>
            <SectionHeader>
              <SectionTitle>Rice Stock Locations</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Rice Stock Location
                </AddButton>
              )}
            </SectionHeader>

            <div>
              {riceStockLocations.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                  No rice stock locations created yet
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: '60px' }}>S.No</Th>
                      <Th>Code</Th>
                      <Th>Description</Th>
                      <Th>Status</Th>
                      {canEdit && <Th style={{ width: '120px' }}>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {riceStockLocations.map((location: any, index) => (
                      <tr key={location.id}>
                        <Td>{index + 1}</Td>
                        <Td style={{ fontWeight: '600' }}>{location.code}</Td>
                        <Td>{location.name || '-'}</Td>
                        <Td>
                          <span style={{
                            color: location.isActive ? '#10b981' : '#6b7280',
                            fontWeight: '600'
                          }}>
                            {location.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </Td>
                        {canEdit && (
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => { handleEditRiceStockLocation(location); setShowModal(true); }}>
                                ✏️
                              </IconButton>
                              <IconButton className="delete" onClick={() => handleDeleteRiceStockLocation(location.id)}>
                                🗑️
                              </IconButton>
                            </ActionButtons>
                          </Td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        {activeTab === 'hamali' && (
          <PaddyHamaliRatesTable canEdit={canEdit} />
        )}

        {activeTab === 'riceHamali' && (
          <RiceHamaliRatesTable />
        )}

        {activeTab === 'broker' && (
          <>
            <SectionHeader>
              <SectionTitle>Broker Management</SectionTitle>
              {canEdit && (
                <AddButton onClick={() => { handleCancelEdit(); setShowModal(true); }}>
                  ➕ Add Broker
                </AddButton>
              )}
            </SectionHeader>

            <SubTabContainer>
              <SubTabButton $active={brokerStatusFilter === 'active'} onClick={() => setBrokerStatusFilter('active')}>
                Active Brokers
              </SubTabButton>
              <SubTabButton $active={brokerStatusFilter === 'inactive'} onClick={() => setBrokerStatusFilter('inactive')}>
                Inactive Brokers
              </SubTabButton>
            </SubTabContainer>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4b5563' }}>Filter by Type:</span>
              <button
                onClick={() => setBrokerTypeFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: brokerTypeFilter === 'all' ? '#3b82f6' : '#fff',
                  color: brokerTypeFilter === 'all' ? '#fff' : '#374151'
                }}
              >
                All
              </button>
              <button
                onClick={() => setBrokerTypeFilter('paddy')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: brokerTypeFilter === 'paddy' ? '#10b981' : '#fff',
                  color: brokerTypeFilter === 'paddy' ? '#fff' : '#374151'
                }}
              >
                Paddy Brokers
              </button>
              <button
                onClick={() => setBrokerTypeFilter('rice')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: brokerTypeFilter === 'rice' ? '#8b5cf6' : '#fff',
                  color: brokerTypeFilter === 'rice' ? '#fff' : '#374151'
                }}
              >
                Rice Brokers
              </button>
              <button
                onClick={() => setBrokerTypeFilter('both')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '15px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: brokerTypeFilter === 'both' ? '#3b82f6' : '#fff',
                  color: brokerTypeFilter === 'both' ? '#fff' : '#374151'
                }}
              >
                Both Brokers
              </button>
            </div>

            <div>
              {(() => {
                const filteredBrokers = brokers.filter(broker => {
                  const matchesStatus = brokerStatusFilter === 'active' ? (broker.isActive !== false) : (broker.isActive === false);
                  if (!matchesStatus) return false;

                  if (brokerTypeFilter === 'all') return true;
                  if (brokerTypeFilter === 'paddy') {
                    return broker.type === 'paddy';
                  }
                  if (brokerTypeFilter === 'rice') {
                    return broker.type === 'rice';
                  }
                  if (brokerTypeFilter === 'both') {
                    return broker.type === 'both';
                  }
                  return true;
                });

                return filteredBrokers.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No {brokerStatusFilter === 'active' ? 'active' : 'inactive'} brokers found matching the filter
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th style={{ width: '60px' }}>S.No</Th>
                        <Th>Broker Name</Th>
                        <Th>Phone Number</Th>
                        <Th>Broker Type</Th>
                        <Th>Status</Th>
                        {canEdit && <Th style={{ width: '150px' }}>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBrokers.map((broker, index) => (
                        <tr key={broker.id}>
                          <Td>{index + 1}</Td>
                          <Td>{broker.name}</Td>
                          <Td>{broker.phoneNumber || '-'}</Td>
                          <Td>
                            <span style={{
                              textTransform: 'capitalize',
                              fontWeight: '600',
                              color: broker.type === 'paddy' ? '#10b981' : broker.type === 'rice' ? '#8b5cf6' : '#3b82f6'
                            }}>
                              {broker.type || 'both'}
                            </span>
                          </Td>
                          <Td>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: broker.isActive !== false ? '#dcfce7' : '#fee2e2',
                              color: broker.isActive !== false ? '#15803d' : '#b91c1c'
                            }}>
                              {broker.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => { handleEditBroker(broker); setShowModal(true); }}>
                                  ✏️
                                </IconButton>
                                <IconButton 
                                  className="toggle" 
                                  style={{ backgroundColor: broker.isActive !== false ? '#fef3c7' : '#d1fae5', color: broker.isActive !== false ? '#d97706' : '#059669' }} 
                                  onClick={() => handleToggleBrokerStatus(broker)}
                                  title={broker.isActive !== false ? 'Deactivate Broker' : 'Activate Broker'}
                                >
                                  {broker.isActive !== false ? '🔒' : '🔓'}
                                </IconButton>
                                <IconButton 
                                  className="delete" 
                                  onClick={() => handleDeleteBroker(broker.id)}
                                  disabled={broker.inUse}
                                  title={broker.inUse ? 'Cannot delete: Broker is currently referenced in sample entries' : 'Delete Broker'}
                                >
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                );
              })()}
            </div>
          </>
        )}
      </SectionContainer>

      {showModal && (
        <ModalOverlay onClick={() => { setShowModal(false); handleCancelEdit(); }}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {editingWarehouse || editingVariety || editingKunchinittu || editingRiceVariety || editingOutturn || editingPackaging || editingRiceStockLocation || editingBroker
                ? `✏️ Edit ${
                    activeTab === 'warehouse' ? 'Warehouse' :
                    activeTab === 'variety' ? 'Variety' :
                    activeTab === 'kunchinittu' ? 'KanchiNittu' :
                    activeTab === 'riceVariety' ? 'Rice Variety' :
                    activeTab === 'production' ? 'Outturn' :
                    activeTab === 'packaging' ? 'Packaging' :
                    activeTab === 'riceStockLocation' ? 'Rice Stock Location' :
                    activeTab === 'broker' ? 'Broker' : ''
                  }`
                : `➕ Add New ${
                    activeTab === 'warehouse' ? 'Warehouse' :
                    activeTab === 'variety' ? 'Variety' :
                    activeTab === 'kunchinittu' ? 'KanchiNittu' :
                    activeTab === 'riceVariety' ? 'Rice Variety' :
                    activeTab === 'production' ? 'Outturn' :
                    activeTab === 'packaging' ? 'Packaging' :
                    activeTab === 'riceStockLocation' ? 'Rice Stock Location' :
                    activeTab === 'broker' ? 'Broker' : ''
                  }`
              }
            </ModalTitle>

            {activeTab === 'warehouse' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateWarehouse(); }}>
                <FormGroup>
                  <Label>Warehouse Name *</Label>
                  <Input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="Enter warehouse name"
                    required
                  />
                </FormGroup>
                <FormGroup style={{ marginTop: '1rem' }}>
                  <Label>Short Cut Name</Label>
                  <Input
                    type="text"
                    value={warehouseShortCutName}
                    onChange={(e) => setWarehouseShortCutName(e.target.value)}
                    placeholder="Enter short cut name"
                  />
                </FormGroup>
                <FormGroup style={{ marginTop: '1rem' }}>
                  <Label>Warehouse Type *</Label>
                  <Select
                    value={warehouseType}
                    onChange={(e: any) => setWarehouseType(e.target.value)}
                    required
                  >
                    <option value="mill">Mill Warehouse</option>
                    <option value="outside">Outside Warehouse</option>
                  </Select>
                </FormGroup>
                <FormGroup style={{ marginTop: '1rem' }}>
                  <Label>Location {warehouseType === 'outside' ? '*' : '(Optional)'}</Label>
                  <Input
                    type="text"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    placeholder="Enter location description"
                    required={warehouseType === 'outside'}
                  />
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary">
                    {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'variety' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateVariety(); }}>
                <FormGroup>
                  <Label>Variety Name</Label>
                  <Input
                    type="text"
                    value={varietyName}
                    onChange={(e) => setVarietyName(e.target.value)}
                    placeholder="Enter variety name"
                    required
                  />
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary">
                    {editingVariety ? 'Update Variety' : 'Create Variety'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'kunchinittu' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateKunchinittu(); }}>
                <FormGroup>
                  <Label>KN Name</Label>
                  <Input
                    type="text"
                    value={kunchinintuName}
                    onChange={(e) => setKunchinintuName(e.target.value)}
                    placeholder="Enter KN name"
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label>Alloted Warehouse</Label>
                  <Select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Warehouse --</option>
                    {[...warehouses]
                      .sort((a, b) => {
                        const typeA = a.type || 'mill';
                        const typeB = b.type || 'mill';
                        if (typeA === 'mill' && typeB === 'outside') return -1;
                        if (typeA === 'outside' && typeB === 'mill') return 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.type === 'outside' ? 'Outside' : 'Mill'})
                        </option>
                      ))
                    }
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>Alloted Variety</Label>
                  <Select
                    value={selectedVarietyId}
                    onChange={(e) => setSelectedVarietyId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </Select>
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary">
                    {editingKunchinittu ? 'Update KN' : 'Create KN'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'riceVariety' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateRiceVariety(); }}>
                <FormGroup>
                  <Label>Rice Variety Name</Label>
                  <Input
                    type="text"
                    value={riceVarietyName}
                    onChange={(e) => setRiceVarietyName(e.target.value)}
                    placeholder="e.g., SUM25 RNR RAW"
                    required
                  />
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary">
                    {editingRiceVariety ? 'Update Rice Variety' : 'Create Rice Variety'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'production' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateOutturn(); }}>
                <FormGroup>
                  <Label>Outturn Code</Label>
                  <Input
                    type="text"
                    value={outturnCode}
                    onChange={(e) => setOutturnCode(e.target.value)}
                    placeholder="Enter outturn code"
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label>Allotted Variety</Label>
                  <Select
                    value={allottedVariety}
                    onChange={(e) => setAllottedVariety(e.target.value)}
                    required
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((variety: any) => (
                      <option key={variety.id} value={variety.name}>
                        {variety.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>Type</Label>
                  <Select
                    value={outturnType}
                    onChange={(e) => setOutturnType(e.target.value as 'Raw' | 'Steam')}
                    required
                  >
                    <option value="Raw">Raw</option>
                    <option value="Steam">Steam</option>
                  </Select>
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelOutturnEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary">
                    {editingOutturn ? 'Update Outturn' : 'Create Outturn'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'packaging' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreatePackaging(); }}>
                <FormGroup>
                  <Label>Brand Name *</Label>
                  <Input
                    type="text"
                    value={packagingBrandName}
                    onChange={(e) => setPackagingBrandName(e.target.value)}
                    placeholder="e.g., A1, B1, Premium"
                    disabled={!canEdit}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label>Allotted KG per Bag *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999.99"
                    value={packagingKg}
                    onChange={(e) => setPackagingKg(e.target.value)}
                    placeholder="e.g., 25, 26.5, 30"
                    disabled={!canEdit}
                    required
                  />
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }} disabled={!canEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary" disabled={!canEdit}>
                    {editingPackaging ? 'Update Brand' : 'Create Brand'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'riceStockLocation' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateRiceStockLocation(); }}>
                <FormGroup>
                  <Label>Location Code *</Label>
                  <Input
                    type="text"
                    value={riceStockLocationCode}
                    onChange={(e) => setRiceStockLocationCode(e.target.value)}
                    placeholder="e.g., A1, A2, B8"
                    disabled={!canEdit}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label>Description (Optional)</Label>
                  <Input
                    type="text"
                    value={riceStockLocationName}
                    onChange={(e) => setRiceStockLocationName(e.target.value)}
                    placeholder="e.g., Storage Area A1"
                    disabled={!canEdit}
                  />
                </FormGroup>
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }} disabled={!canEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary" disabled={!canEdit}>
                    {editingRiceStockLocation ? 'Update Location' : 'Create Location'}
                  </Button>
                </ButtonRow>
              </form>
            )}

            {activeTab === 'broker' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreateBroker(); }}>
                <FormGroup>
                  <Label>Broker Name *</Label>
                  <Input
                    type="text"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    placeholder="Enter broker name"
                    required
                  />
                </FormGroup>
                <FormGroup style={{ marginTop: '1rem' }}>
                  <Label>Phone Number</Label>
                  <Input
                    type="text"
                    value={brokerPhoneNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) {
                        setBrokerPhoneNumber(val);
                      }
                    }}
                    placeholder="Enter phone number"
                    maxLength={10}
                  />
                </FormGroup>
                <FormGroup style={{ marginTop: '1rem' }}>
                  <Label>Broker Type *</Label>
                  <select
                    value={brokerType}
                    onChange={(e: any) => setBrokerType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                    required
                  >
                    <option value="both">Both (Paddy & Rice)</option>
                    <option value="paddy">Paddy Broker</option>
                    <option value="rice">Rice Broker</option>
                  </select>
                </FormGroup>
                {editingBroker && (
                  <FormGroup style={{ marginTop: '1rem' }}>
                    <Label>Status *</Label>
                    <select
                      value={brokerIsActive ? 'active' : 'inactive'}
                      onChange={(e) => setBrokerIsActive(e.target.value === 'active')}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                      required
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </FormGroup>
                )}
                <ButtonRow>
                  <Button type="button" className="secondary" onClick={() => { setShowModal(false); handleCancelEdit(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="primary" disabled={!canEdit}>
                    {editingBroker ? 'Update Broker' : 'Create Broker'}
                  </Button>
                </ButtonRow>
              </form>
            )}
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default Locations;
