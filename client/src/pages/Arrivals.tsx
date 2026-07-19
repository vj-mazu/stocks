import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from '../utils/toast';
import { NotificationMessages } from '../utils/notificationMessages';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import { SampleEntryDetailModal } from '../components/SampleEntryDetailModal';
import { applyWbSaveToEntries } from './arrivalsWbState';

const Container = styled.div`
  animation: fadeIn 0.5s ease-in;
  max-width: 98%;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: #ffffff;
  margin-bottom: 2rem;
  font-size: 2rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
`;

const FormCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #f3f4f6;
`;

const InfoPanel = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #e5e7eb;
  height: fit-content;
  position: sticky;
  top: 20px;
`;

const InfoTitle = styled.h3`
  color: #667eea;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
`;

const InfoItem = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #667eea;

  .label {
    font-weight: 600;
    color: #374151;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }

  .value {
    color: #667eea;
    font-weight: 700;
    font-size: 1.1rem;
  }
`;

const InfoTable = styled.div`
  margin-bottom: 1.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
`;

const InfoTableHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.75rem;
  font-weight: 600;
  font-size: 0.95rem;
  text-align: center;
`;

const InfoTableBody = styled.div`
  background: white;
`;

const InfoTableRow = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9fafb;
  }
`;

const InfoTableLabel = styled.div`
  font-weight: 600;
  color: #6b7280;
  font-size: 0.85rem;
`;

const InfoTableValue = styled.div`
  color: #667eea;
  font-weight: 600;
  font-size: 0.95rem;
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
`;

const ToggleButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 8px;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#6b7280'};

  &:hover {
    background: ${props => props.$active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb'};
  }
`;

const TopSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
  gap: 2rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
`;

const FormSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  color: #ffffff;
  margin-bottom: 1rem;
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
  gap: 1rem;
  margin-bottom: 1rem;
`;

const TwoColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
  }
  gap: 1rem;
  margin-bottom: 1.5rem;
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
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
`;

const SmallInput = styled(Input)`
  width: 100%;
`;

const CalculatedDisplay = styled.div`
  padding: 0.75rem;
  background: #f0fdf4;
  border: 2px solid #10b981;
  border-radius: 8px;
  font-weight: 700;
  color: #059669;
  font-size: 1.1rem;
  text-align: center;
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #e5e7eb;
`;

const Button = styled.button`
  padding: 0.875rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }
  }

  &.secondary {
    background: #6b7280;
    color: white;

    &:hover:not(:disabled) {
      background: #4b5563;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SlNoDisplay = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 8px;
  text-align: center;
`;

const InfoText = styled.p`
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: 0.25rem;
`;

interface VarietyAllocation {
  kunchinintuName: string;
  kunchinintuCode: string;
  warehouseName: string;
  warehouseCode: string;
}

const cleanDecimal = (val: any) => {
  if (val === null || val === undefined || val === '') return '';
  const num = parseFloat(val);
  if (!isNaN(num)) {
    return String(Number(num.toFixed(2))); // e.g. "1.00" -> "1", "1.50" -> "1.5"
  }
  return String(val).trim();
};

const formatCuttingClean = (cuttingStr: any) => {
  if (!cuttingStr || cuttingStr === '-') return '-';
  const str = String(cuttingStr).trim();
  if (!str || str === '-') return '-';
  const parts = str.toLowerCase().split(/x|\*/);
  if (parts.length === 2) {
    const c1 = cleanDecimal(parts[0]);
    const c2 = cleanDecimal(parts[1]);
    if (c1 && c2) return `${c1}x${c2}`;
  }
  return str;
};

const getCuttingValue = (entry: any, currentInspection: any) => {
  let rawCutting = '';
  
  const isZeroCutting = (val: any) => {
    if (!val) return true;
    const clean = String(val).replace(/\s+/g, '').toLowerCase();
    return clean === '0' || clean === '0x0' || clean === '0x' || clean === 'x0' || clean === '0-0' || clean === '0*0' || clean === '-' || clean === 'none';
  };

  // 1. Check current inspection (for In-Transit)
  if (currentInspection) {
    let temp = '';
    if (currentInspection.cutting) {
      temp = currentInspection.cutting;
    } else if (currentInspection.cutting1) {
      temp = `${currentInspection.cutting1}x${currentInspection.cutting2 || ''}`;
    }
    if (!isZeroCutting(temp)) {
      rawCutting = temp;
    }
  }

  // 2. Check entry.cutting directly (for Band Mall Book)
  if (isZeroCutting(rawCutting) && entry && entry.cutting) {
    if (!isZeroCutting(entry.cutting)) {
      rawCutting = entry.cutting;
    }
  }

  // 3. Check quality parameters
  if (isZeroCutting(rawCutting) && entry && entry.qualityParameters) {
    const qp = entry.qualityParameters;
    if (qp.cutting1 || qp.cutting2) {
      let temp = `${qp.cutting1 || ''}x${qp.cutting2 || ''}`;
      if (!isZeroCutting(temp)) {
        rawCutting = temp;
      }
    }
  }

  // 4. Check other inspections in the same entry
  if (isZeroCutting(rawCutting) && entry) {
    const inspections = entry.lotAllotment?.physicalInspections || 
                        entry.physicalInspections || 
                        entry.sampleEntry?.physicalInspections || 
                        entry.sampleEntry?.lotAllotment?.physicalInspections || 
                        [];
    for (const insp of inspections) {
      let temp = '';
      if (insp.cutting) {
        temp = insp.cutting;
      } else if (insp.cutting1) {
        temp = `${insp.cutting1}x${insp.cutting2 || ''}`;
      }
      if (!isZeroCutting(temp)) {
        rawCutting = temp;
        break;
      }
    }
  }

  // 5. Fallback: check from the parent sample entry inside Band Mall Book
  if (isZeroCutting(rawCutting) && entry && entry.sampleEntry) {
    const se = entry.sampleEntry;
    if (se.cutting) {
      if (!isZeroCutting(se.cutting)) {
        rawCutting = se.cutting;
      }
    }
    if (isZeroCutting(rawCutting) && se.qualityParameters) {
      const qp = se.qualityParameters;
      if (qp.cutting1 || qp.cutting2) {
        let temp = `${qp.cutting1 || ''}x${qp.cutting2 || ''}`;
        if (!isZeroCutting(temp)) {
          rawCutting = temp;
        }
      }
    }
  }

  if (isZeroCutting(rawCutting)) return '-';
  return formatCuttingClean(rawCutting);
};

const Arrivals: React.FC = () => {
  const { user } = useAuth();
  const { warehouses, kunchinittus, varieties, fetchWarehouses, fetchKunchinittus, fetchVarieties } = useLocation();

  const [slNo, setSlNo] = useState('');
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [selectedTransitDetail, setSelectedTransitDetail] = useState<any>(null);
  const [isTransitDetailOpen, setIsTransitDetailOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [dateInput, setDateInput] = useState('');
  const [movementType, setMovementType] = useState<'purchase' | 'shifting'>('purchase');

  // Purchase type selection
  const [purchaseFromType, setPurchaseFromType] = useState<'kunchinittu' | 'for-production'>('kunchinittu');

  // Shifting type selection
  const [shiftingType, setShiftingType] = useState<'normal' | 'production'>('normal');

  // Purchase fields
  const [broker, setBroker] = useState('');
  const [variety, setVariety] = useState('');
  const [bags, setBags] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toKunchinintuId, setToKunchinintuId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');

  // Outturn fields (for purchase from outturn)
  const [fromOutturnId, setFromOutturnId] = useState('');
  const [outturns, setOutturns] = useState<any[]>([]);
  const [brokersList, setBrokersList] = useState<any[]>([]);

  // Shifting fields
  const [fromKunchinintuId, setFromKunchinintuId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseShiftId, setToWarehouseShiftId] = useState('');

  // Production shifting fields (for shifting type = production)
  const [toOutturnId, setToOutturnId] = useState('');

  // Cutting fields (split into two)
  const [cuttingValue1, setCuttingValue1] = useState('');
  const [cuttingValue2, setCuttingValue2] = useState('');

  // Common fields
  const [moisture, setMoisture] = useState('');
  const [wbNo, setWbNo] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [lorryNumber, setLorryNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stock locations state
  const [stockLocations, setStockLocations] = useState<any[]>([]);
  const [loadingStockLocations, setLoadingStockLocations] = useState(false);

  // Fetch Mill Weight Bridges list from backend on mount
  useEffect(() => {
    const fetchBridges = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/weight-bridges`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMillWBList((res.data as any).bridges || []);
      } catch (err) {
        console.error('Error fetching weight bridges:', err);
      }
    };
    fetchBridges();
  }, []);

  // Filter out closed kunchinittus for dropdowns
  const activeKunchinittus = useMemo(() => {
    return kunchinittus.filter(k => !k.isClosed);
  }, [kunchinittus]);

  // Calculate cutting total
  const cuttingTotal = useMemo(() => {
    const val1 = parseFloat(cuttingValue1) || 0;
    const val2 = parseFloat(cuttingValue2) || 0;
    return val1 && val2 ? val1 * val2 : 0;
  }, [cuttingValue1, cuttingValue2]);

  // Get ALL variety allocations for this variety
  const varietyAllocations = useMemo(() => {
    if (!variety || variety.trim() === '') return [];

    const normalizedVariety = variety.trim().toUpperCase();

    // Find ALL kunchinittus allocated to this variety
    const allocatedKunchinittus = kunchinittus.filter(k => {
      // Only include if NOT closed
      if (k.isClosed) return false;

      if (k.variety && k.variety.name) {
        return k.variety.name.trim().toUpperCase() === normalizedVariety;
      }
      return false;
    });

    return allocatedKunchinittus.map(k => {
      const allocatedWarehouse = warehouses.find(w => w.id === k.warehouseId);
      return {
        kunchinintuId: k.id,
        kunchinintuName: k.name,
        kunchinintuCode: k.code,
        warehouseName: allocatedWarehouse?.name || '',
        warehouseCode: allocatedWarehouse?.code || '',
        warehouseId: allocatedWarehouse?.id || ''
      };
    }).filter(item => item.warehouseName);
  }, [variety, kunchinittus, warehouses]);

  // Get first allocation for backward compatibility
  const varietyAllocation = useMemo((): VarietyAllocation | null => {
    if (varietyAllocations.length === 0) return null;

    const first = varietyAllocations[0];
    return {
      kunchinintuName: first.kunchinintuName,
      kunchinintuCode: first.kunchinintuCode,
      warehouseName: first.warehouseName,
      warehouseCode: first.warehouseCode
    };
  }, [varietyAllocations]);

  // Auto-populate kunchinittu and warehouse when variety is selected
  useEffect(() => {
    if (varietyAllocation && movementType === 'purchase' && purchaseFromType === 'kunchinittu') {
      const kunchinittu = kunchinittus.find(k => k.code === varietyAllocation.kunchinintuCode);
      const warehouse = warehouses.find(w => w.code === varietyAllocation.warehouseCode);

      if (kunchinittu && toKunchinintuId !== String(kunchinittu.id)) {
        setToKunchinintuId(String(kunchinittu.id));
      }
      if (warehouse && toWarehouseId !== String(warehouse.id)) {
        setToWarehouseId(String(warehouse.id));
      }
    }
  }, [varietyAllocation, movementType, purchaseFromType, kunchinittus, warehouses]);

  // Auto-populate shifting fields when variety is selected
  useEffect(() => {
    if (varietyAllocations.length > 0 && movementType === 'shifting' && shiftingType === 'normal') {
      // If only one kunchinittu for this variety, auto-select it for "from"
      if (varietyAllocations.length === 1) {
        const allocation = varietyAllocations[0];
        if (fromKunchinintuId !== String(allocation.kunchinintuId)) {
          setFromKunchinintuId(String(allocation.kunchinintuId));
        }
        if (fromWarehouseId !== String(allocation.warehouseId)) {
          setFromWarehouseId(String(allocation.warehouseId));
        }
      }
    }
  }, [varietyAllocations, movementType, shiftingType]);

  // Fetch stock locations when variety changes (for shifting only)
  useEffect(() => {
    const fetchStockLocations = async () => {
      if (!variety || variety.trim() === '' || movementType !== 'shifting') {
        setStockLocations([]);
        return;
      }

      setLoadingStockLocations(true);
      try {
        const response = await axios.get<{ locations: any[] }>(`${API_URL}/arrivals/stock/variety-locations/${encodeURIComponent(variety.trim())}`);
        setStockLocations(response.data.locations || []);
      } catch (error) {
        console.error('Error fetching stock locations:', error);
        setStockLocations([]);
        toast.warning('Could not fetch stock locations for this variety');
      } finally {
        setLoadingStockLocations(false);
      }
    };

    // Debounce the API call to avoid too many requests while typing
    const timeoutId = setTimeout(fetchStockLocations, 500);
    return () => clearTimeout(timeoutId);
  }, [variety, movementType]);

  // Auto-populate fields based on stock locations
  useEffect(() => {
    if (movementType !== 'shifting' || shiftingType !== 'normal') return;

    if (stockLocations.length === 1) {
      // Only one location - auto-populate "From" fields
      const location = stockLocations[0];
      setFromKunchinintuId(String(location.kunchinintuId));
      setFromWarehouseId(String(location.warehouseId));
    } else if (stockLocations.length === 2) {
      // Two locations - auto-populate both "From" and "To" fields
      const [location1, location2] = stockLocations;
      setFromKunchinintuId(String(location1.kunchinintuId));
      setFromWarehouseId(String(location1.warehouseId));
      setToKunchinintuId(String(location2.kunchinintuId));
      setToWarehouseShiftId(String(location2.warehouseId));
    }
    // For more than 2 locations, user will choose from the available options
  }, [stockLocations, movementType, shiftingType]);

  // Automatically select Warehouse when Kunchinittu is selected
  useEffect(() => {
    if (toKunchinintuId) {
      const k = kunchinittus.find(item => String(item.id) === String(toKunchinintuId));
      if (k && k.warehouseId && toWarehouseId !== String(k.warehouseId)) {
        setToWarehouseId(String(k.warehouseId));
      }
    }
  }, [toKunchinintuId, kunchinittus]);

  useEffect(() => {
    if (fromKunchinintuId) {
      const k = kunchinittus.find(item => String(item.id) === String(fromKunchinintuId));
      if (k && k.warehouseId && fromWarehouseId !== String(k.warehouseId)) {
        setFromWarehouseId(String(k.warehouseId));
      }
    }
  }, [fromKunchinintuId, kunchinittus]);

  useEffect(() => {
    if (toKunchinintuId && movementType === 'shifting') {
      const k = kunchinittus.find(item => String(item.id) === String(toKunchinintuId));
      if (k && k.warehouseId && toWarehouseShiftId !== String(k.warehouseId)) {
        setToWarehouseShiftId(String(k.warehouseId));
      }
    }
  }, [toKunchinintuId, movementType, kunchinittus]);


  const selectedToKunchinittu = useMemo(() => {
    if (!toKunchinintuId) return undefined;
    return kunchinittus.find(k => String(k.id) === toKunchinintuId);
  }, [kunchinittus, toKunchinintuId]);

  // Available warehouses for purchase (based on selected kunchinittu)
  const availableWarehouses = useMemo(() => {
    if (!selectedToKunchinittu) return [];
    if (selectedToKunchinittu.warehouse) return [selectedToKunchinittu.warehouse];
    if (selectedToKunchinittu.warehouseId) {
      const match = warehouses.find(w => w.id === selectedToKunchinittu.warehouseId);
      return match ? [match] : [];
    }
    return [];
  }, [selectedToKunchinittu, warehouses]);

  // Available warehouses for shifting (filtered by selected kunchinittu)
  const availableFromWarehouses = useMemo(() => {
    if (!fromKunchinintuId) return warehouses;
    const selectedKunchinittu = kunchinittus.find(k => String(k.id) === fromKunchinintuId);
    if (!selectedKunchinittu) return warehouses;
    return warehouses.filter(w => String(w.id) === String(selectedKunchinittu.warehouseId));
  }, [warehouses, kunchinittus, fromKunchinintuId]);

  const availableToWarehousesForShifting = useMemo(() => {
    if (!toKunchinintuId) return warehouses;
    const selectedKunchinittu = kunchinittus.find(k => String(k.id) === toKunchinintuId);
    if (!selectedKunchinittu) return warehouses;
    return warehouses.filter(w => String(w.id) === String(selectedKunchinittu.warehouseId));
  }, [warehouses, kunchinittus, toKunchinintuId]);

  // Determine which fields to show based on stock locations count
  const shouldShowSingleLocationFields = useMemo(() => {
    return stockLocations.length === 1;
  }, [stockLocations]);

  const shouldShowMultipleLocationFields = useMemo(() => {
    return stockLocations.length >= 2;
  }, [stockLocations]);

  // Fetch data on mount and auto-populate date
  useEffect(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setDate(today);
    setDateInput(today.toLocaleDateString('en-GB').split('/').join('-'));

    fetchNextSlNo();
    fetchWarehouses();
    fetchKunchinittus();
    fetchVarieties();
    fetchOutturns();
    fetchBrokers();
  }, []);
 
  const fetchBrokers = async () => {
    try {
      const response = await axios.get(`${API_URL}/locations/brokers?type=paddy`);
      setBrokersList(response.data.brokers || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  };

  const fetchNextSlNo = async () => {
    try {
      const response = await axios.get(`${API_URL}/arrivals/next-sl-no`);
      setSlNo((response.data as { slNo: string }).slNo);
    } catch (error) {
      console.error('Error fetching SL No:', error);
      toast.error('Failed to fetch SL number');
    }
  };

  const fetchOutturns = async () => {
    try {
      const response = await axios.get<any[]>(`${API_URL}/outturns`);
      setOutturns(response.data);
    } catch (error) {
      console.error('Error fetching outturns:', error);
    }
  };

  const netWeight = grossWeight && tareWeight ?
    (parseFloat(grossWeight) - parseFloat(tareWeight)).toFixed(2) : '0.00';

  const handleReset = () => {
    setBroker('');
    setVariety('');
    setBags('');
    setFromLocation('');
    setToKunchinintuId('');
    setToWarehouseId('');
    setFromKunchinintuId('');
    setFromWarehouseId('');
    setToWarehouseShiftId('');
    setFromOutturnId('');
    setToOutturnId('');
    setMoisture('');
    setCuttingValue1('');
    setCuttingValue2('');
    setWbNo('');
    setGrossWeight('');
    setTareWeight('');
    setLorryNumber('');
    setRemarks('');
    setPurchaseFromType('kunchinittu');
    setShiftingType('normal');

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setDate(today);
    setDateInput(today.toLocaleDateString('en-GB').split('/').join('-'));

    fetchNextSlNo();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double-click submission
    if (isSubmitting) {
      return;
    }

    // Validation
    if (!wbNo || !grossWeight || !tareWeight || !lorryNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    if (parseFloat(grossWeight) <= parseFloat(tareWeight)) {
      toast.error('Gross weight must be greater than tare weight');
      return;
    }

    setIsSubmitting(true);

    // Build cutting string
    const cuttingString = (cuttingValue1 && cuttingValue2) ?
      `${cuttingValue1}X${cuttingValue2}` : '';

    if (movementType === 'purchase') {
      if (purchaseFromType === 'kunchinittu') {
        if (!broker || !broker.trim() || !variety || !toKunchinintuId || !toWarehouseId) {
          toast.error('Please enter broker name, variety and select to location (kunchinittu & warehouse)');
          return;
        }
      } else {
        // For production - direct to outturn
        if (!broker || !broker.trim() || !variety || !toOutturnId) {
          toast.error('Please fill broker, variety and select outturn');
          return;
        }
      }
    } else if (movementType === 'shifting') {
      if (shiftingType === 'normal') {
        if (!fromKunchinintuId || !fromWarehouseId || !toKunchinintuId || !toWarehouseShiftId) {
          toast.error('Please fill all location fields for shifting');
          return;
        }
      } else {
        // Production shifting
        if (!fromKunchinintuId || !fromWarehouseId || !toOutturnId || !variety) {
          toast.error('Please fill all fields for production shifting');
          return;
        }
      }
    }

    setLoading(true);

    try {
      const data: any = {
        date: date.toISOString().split('T')[0],
        movementType: shiftingType === 'production' ? 'production-shifting' : movementType,
        purchaseType: purchaseFromType, // Add purchaseType to distinguish normal vs for-production
        variety: variety || null,
        bags: bags ? parseInt(bags) : null,
        moisture: moisture ? parseFloat(moisture) : null,
        cutting: cuttingString || null,
        wbNo,
        grossWeight: parseFloat(grossWeight),
        tareWeight: parseFloat(tareWeight),
        lorryNumber,
        remarks
      };

      if (movementType === 'purchase') {
        if (purchaseFromType === 'kunchinittu') {
          data.broker = broker.trim();
          data.fromLocation = fromLocation || null;
          data.toKunchinintuId = parseInt(toKunchinintuId);
          data.toWarehouseId = parseInt(toWarehouseId);
        } else {
          // For production - direct to outturn (no kunchinittu/warehouse)
          data.broker = broker.trim();
          data.fromLocation = fromLocation || null;
          data.outturnId = parseInt(toOutturnId);
        }
      } else if (movementType === 'shifting') {
        if (shiftingType === 'normal') {
          data.fromKunchinintuId = parseInt(fromKunchinintuId);
          data.fromWarehouseId = parseInt(fromWarehouseId);
          data.toKunchinintuId = parseInt(toKunchinintuId);
          data.toWarehouseShiftId = parseInt(toWarehouseShiftId);
        } else {
          // Production shifting
          data.fromKunchinintuId = parseInt(fromKunchinintuId);
          data.fromWarehouseId = parseInt(fromWarehouseId);
          data.outturnId = parseInt(toOutturnId);
          data.toKunchinintuId = parseInt(fromKunchinintuId); // Same kunchinittu
        }
      }

      await axios.post(`${API_URL}/arrivals`, data);

      toast.success(NotificationMessages.arrivals.created);
      handleReset();
    } catch (error: any) {
      console.error('Error creating arrival:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create arrival';

      if (errorMessage.includes('VARIETY MISMATCH') || errorMessage.includes('SOURCE VARIETY NOT FOUND') || errorMessage.includes('DESTINATION VARIETY MISMATCH')) {
        toast.error(errorMessage, {
          autoClose: 8000,
          style: {
            fontSize: '14px',
            lineHeight: '1.4'
          }
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };


  const [inTransitEntries, setInTransitEntries] = useState<any[]>([]);
  const [loadingTransit, setLoadingTransit] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transitNextCursor, setTransitNextCursor] = useState<string | null>(null);
  const [transitHasNextPage, setTransitHasNextPage] = useState(false);
  const [transitPageSize, setTransitPageSize] = useState(20);
  const [transitTotalLoaded, setTransitTotalLoaded] = useState(0);
  const [transitSearchQuery, setTransitSearchQuery] = useState('');
  const [transitDebouncedSearch, setTransitDebouncedSearch] = useState('');
  const [selectedLorryForWB, setSelectedLorryForWB] = useState<string | null>(null);
  const [selectedLorryForPlace, setSelectedLorryForPlace] = useState<string | null>(null);
  const [selectedLorryEntries, setSelectedLorryEntries] = useState<any[]>([]);
  
  // Weight bridge form inputs
  const [wbInputType, setWbInputType] = useState<'mill' | 'party'>('mill');
  const [millWbId, setMillWbId] = useState('');
  const [partyWbName, setPartyWbName] = useState('');
  const [wbNumber, setWbNumber] = useState('');
  const [wbGrossWeight, setWbGrossWeight] = useState('');
  const [wbTareWeight, setWbTareWeight] = useState('');
  const [wbNetWeight, setWbNetWeight] = useState('');
  const [millWBList, setMillWBList] = useState<any[]>([]);
  
  // Place form inputs
  const [placeType, setPlaceType] = useState<'production' | 'kunchinittu'>('production');
  const [placeWarehouseId, setPlaceWarehouseId] = useState('');
  const [placeKunchinittuId, setPlaceKunchinittuId] = useState('');
  const [placeDate, setPlaceDate] = useState(new Date().toISOString().split('T')[0]);
  const [placeOutturnId, setPlaceOutturnId] = useState('');
  const [selectedLorryInspection, setSelectedLorryInspection] = useState<any>(null);
  
  const [arrivalsActiveSubTab, setArrivalsActiveSubTab] = useState<'entry' | 'transit' | 'bandmalal' | 'approvals'>('transit');
  const [bandMalalEntries, setBandMalalEntries] = useState<any[]>([]);
  const [approvalEntries, setApprovalEntries] = useState<any[]>([]);
  const searchTimerRef = useRef<any>(null);

  // Inventory Quality Parameters State
  const [expandedInventoryQuality, setExpandedInventoryQuality] = useState<string | null>(null);
  const [inventoryQualityType, setInventoryQualityType] = useState<'lot_avg' | 'full_lorry_avg'>('lot_avg');
  const [inventoryQualityForm, setInventoryQualityForm] = useState({
    moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
    mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
    wbR: '', wbBk: '', wbT: '', smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
  });
  const [inventoryQualityToggle, setInventoryQualityToggle] = useState({
    dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
  });
  const [rejectInventoryQualityId, setRejectInventoryQualityId] = useState<string | null>(null);
  const [rejectInventoryQualityReason, setRejectInventoryQualityReason] = useState('');

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setTransitDebouncedSearch(transitSearchQuery);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [transitSearchQuery]);

  const fetchInTransitEntries = useCallback(async (cursor?: string | null, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingTransit(true);
      }
      const token = localStorage.getItem('token');
      const params: any = {
        status: 'PHYSICAL_INSPECTION',
        pageSize: transitPageSize,
        includeInventory: 'true'
      };
      if (cursor) params.cursor = cursor;
      if (transitDebouncedSearch.trim()) {
        params.broker = transitDebouncedSearch.trim();
        params.variety = transitDebouncedSearch.trim();
        params.party = transitDebouncedSearch.trim();
      }
      const response = await axios.get(`${API_URL}/sample-entries/by-role`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      // Reset toggle state
      setInventoryQualityToggle({
        dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
      });
      const newEntries = response.data.entries || [];
      const pagination = response.data.pagination || {};
      
      if (append) {
        setInTransitEntries(prev => [...prev, ...newEntries]);
      } else {
        setInTransitEntries(newEntries);
      }
      setTransitNextCursor(pagination.nextCursor || null);
      setTransitHasNextPage(!!pagination.hasNextPage);
      setTransitTotalLoaded(prev => append ? prev + newEntries.length : newEntries.length);
    } catch (err) {
      console.error('Error fetching in transit entries:', err);
    } finally {
      setLoadingTransit(false);
      setLoadingMore(false);
    }
  }, [transitPageSize, transitDebouncedSearch]);

  const handleApprovePlace = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/approve-place`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Place approved!');
      fetchInTransitEntries();
      fetchBandMalalEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve place');
    }
  };

  const handleRejectPlace = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/reject-place`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Place rejected!');
      fetchInTransitEntries();
      fetchBandMalalEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject place');
    }
  };

  const handleApproveWb = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/approve-wb`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weigh Bridge approved!');
      fetchInTransitEntries();
      fetchBandMalalEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve WB');
    }
  };

  const handleRejectWb = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/reject-wb`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weigh Bridge rejected!');
      fetchInTransitEntries();
      fetchBandMalalEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject WB');
    }
  };

  // Fetch Band Mall entries from the NEW dedicated Band Mall Book API
  // Band Mall Book shows LorryTransitDetail entries with placeStatus='approved'
  // These have NOT yet been finalized into Arrival records (stock)
  const fetchBandMalalEntries = useCallback(async () => {
    try {
      setLoadingTransit(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/arrivals/band-malal-book`, {
        params: { limit: 200 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setBandMalalEntries(response.data.arrivals || []);
    } catch (err) {
      console.error('Error fetching Band Mall entries:', err);
    } finally {
      setLoadingTransit(false);
    }
  }, []);

  // Inventory Quality Parameters Authorization
  const canAddInventoryQuality = user && (
    (user.role === 'staff' && ['mill', 'location', 'inventory'].includes(user.staffType)) ||
    user.role === 'inventory_head' ||
    user.effectiveRole === 'inventory_head' ||
    user.role === 'admin' ||
    user.role === 'owner' ||
    user.role === 'manager' ||
    user.role === 'ceo' ||
    user.effectiveRole === 'ceo'
  );

  const canApproveInventoryQuality = user && ['admin', 'owner', 'manager', 'ceo'].includes(user.role);

  // Inventory Quality Parameters Handlers
  const handleSubmitInventoryQuality = async (transitDetailId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/${transitDetailId}/inventory-quality`,
        {
          type: inventoryQualityType,
          ...inventoryQualityForm
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Inventory quality parameters submitted successfully');
      setExpandedInventoryQuality(null);
      // Reset form
      setInventoryQualityForm({
        moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
        mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
        wbR: '', wbBk: '', wbT: '', smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
      });
      fetchBandMalalEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit inventory quality parameters');
    }
  };

  const handleApproveInventoryQuality = async (qualityId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Inventory quality parameters approved successfully');
      fetchBandMalalEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve inventory quality parameters');
    }
  };

  const handleRejectInventoryQuality = async () => {
    if (!rejectInventoryQualityId) return;
    if (!rejectInventoryQualityReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/inventory-quality/${rejectInventoryQualityId}/reject`,
        { rejectReason: rejectInventoryQualityReason },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Inventory quality parameters rejected');
      setRejectInventoryQualityId(null);
      setRejectInventoryQualityReason('');
      fetchBandMalalEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject inventory quality parameters');
    }
  };

  // Reset and refetch when search or pageSize changes
  useEffect(() => {
    if (arrivalsActiveSubTab === 'transit') {
      setTransitNextCursor(null);
      setTransitTotalLoaded(0);
      fetchInTransitEntries(null, false);
    } else if (arrivalsActiveSubTab === 'bandmalal') {
      fetchBandMalalEntries();
    }
  }, [arrivalsActiveSubTab, transitDebouncedSearch, transitPageSize]);

  const handleLoadMore = () => {
    if (transitHasNextPage && transitNextCursor && !loadingMore) {
      fetchInTransitEntries(transitNextCursor, true);
    }
  };

  const handleRefreshTransit = () => {
    setTransitNextCursor(null);
    setTransitTotalLoaded(0);
    fetchInTransitEntries(null, false);
  };

  return (
    <Container>
      <Title>📝 Arrivals</Title>

      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid #cbd5e1',
        paddingBottom: '10px'
      }}>
        <button
          onClick={() => setArrivalsActiveSubTab('transit')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: arrivalsActiveSubTab === 'transit' ? '#10b981' : '#f1f5f9',
            color: arrivalsActiveSubTab === 'transit' ? '#fff' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          In Transit
        </button>
        <button
          onClick={() => setArrivalsActiveSubTab('bandmalal')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: arrivalsActiveSubTab === 'bandmalal' ? '#10b981' : '#f1f5f9',
            color: arrivalsActiveSubTab === 'bandmalal' ? '#fff' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Band Mall Book
        </button>
        <button
          onClick={() => setArrivalsActiveSubTab('entry')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: arrivalsActiveSubTab === 'entry' ? '#10b981' : '#f1f5f9',
            color: arrivalsActiveSubTab === 'entry' ? '#fff' : '#475569',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Arrivals Data Entry
        </button>
      </div>

      {arrivalsActiveSubTab === 'transit' ? (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', border: '2px solid #f3f4f6' }}>
          {/* Header with title + stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1e293b', fontWeight: 'bold', margin: 0 }}>
              🚚 Active In Transit Lorries
              {!loadingTransit && <span style={{ marginLeft: '10px', fontSize: '0.8rem', background: '#dbeafe', color: '#1565c0', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>{inTransitEntries.length} loaded</span>}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={handleRefreshTransit} disabled={loadingTransit} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', cursor: loadingTransit ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}>
                <span style={{ display: 'inline-block', animation: loadingTransit ? 'spin 1s linear infinite' : 'none' }}>🔄</span> Refresh
              </button>
            </div>
          </div>

          {/* Search + Page Size Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '400px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by broker, variety, or party..."
                value={transitSearchQuery}
                onChange={(e) => setTransitSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#f8fafc', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1565c0'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(21,101,192,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              {transitSearchQuery && (
                <button onClick={() => setTransitSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: '#94a3b8', padding: '2px' }}>✕</button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Per page:</label>
              <select
                value={transitPageSize}
                onChange={(e) => setTransitPageSize(Number(e.target.value))}
                style={{ padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Skeleton Loading */}
          {loadingTransit ? (
            <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Skeleton header */}
              <div style={{ background: 'linear-gradient(135deg, #1565c0, #1e88e5)', padding: '10px 12px', display: 'flex', gap: '12px' }}>
                {[80, 70, 60, 60, 100, 70, 50, 50, 60].map((w, i) => (
                  <div key={i} style={{ height: '14px', width: `${w}px`, background: 'rgba(255,255,255,0.25)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
              {/* Skeleton rows */}
              {Array.from({ length: Math.min(transitPageSize, 8) }).map((_, ri) => (
                <div key={ri} style={{ display: 'flex', gap: '12px', padding: '12px', borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  {[40, 70, 60, 60, 100, 70, 40, 40, 60].map((w, ci) => (
                    <div key={ci} style={{ height: '12px', width: `${w}px`, background: '#e2e8f0', borderRadius: '3px', animation: `pulse 1.5s ease-in-out ${ri * 0.08}s infinite` }} />
                  ))}
                </div>
              ))}
            </div>
          ) : inTransitEntries.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600, backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              {transitDebouncedSearch ? `No results for "${transitDebouncedSearch}"` : 'No lorries currently in transit.'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1565c0', boxShadow: '0 2px 8px rgba(21,101,192,0.12)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#1a237e', color: '#fff', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '3%' }}>SL No</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '7%' }}>Date</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '10%' }}>Broker</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Party Name</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>No. of Bags</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '10%' }}>Variety</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Moisture</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Cutting</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>WB Number</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Place</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Net Weight</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Lorry Number</th>
                      {(((user as any)?.role === 'owner' || (user as any)?.role === 'staff' || (user as any)?.role === 'inventory_staff' || (user as any)?.role === 'financial_account' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) && (
                        <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const flatTrips: any[] = [];
                      inTransitEntries.forEach((e) => {
                        const inspections = (e.lotAllotment?.physicalInspections || e.physicalInspections || [])
                          .filter((insp: any) => {
                            const num = (insp.lorryNumber || '').trim().toUpperCase();
                            return num !== 'LOT_AVG' && num !== 'BALANCED_LOT';
                          });

                        // Group inspections by normalized lorry number to deduplicate when multiple stages/updates exist
                        const lorryGroups: { [key: string]: any[] } = {};
                        inspections.forEach((insp: any) => {
                          const key = (insp.lorryNumber || '').trim().toUpperCase();
                          if (!lorryGroups[key]) {
                            lorryGroups[key] = [];
                          }
                          lorryGroups[key].push(insp);
                        });

                        // For each lorry group, decide which one to keep
                        const filteredInspections: any[] = [];
                        Object.keys(lorryGroups).forEach((lorryKey) => {
                          const group = lorryGroups[lorryKey];
                          if (group.length === 1) {
                            filteredInspections.push(group[0]);
                          } else {
                            // Find the one that has a full lorry average (full_avg) or is complete
                            const fullLorryInsp = group.find((insp) => 
                              insp.isComplete || 
                              (insp.samplingStages && (insp.samplingStages.full_avg || insp.samplingStages.lot_avg))
                            );
                            if (fullLorryInsp) {
                              filteredInspections.push(fullLorryInsp);
                            } else {
                              // Fallback to the latest one
                              const sortedGroup = [...group].sort((a, b) => {
                                const timeA = new Date(a.createdAt || a.inspectionDate || 0).getTime();
                                const timeB = new Date(b.createdAt || b.inspectionDate || 0).getTime();
                                return timeB - timeA;
                              });
                              filteredInspections.push(sortedGroup[0]);
                            }
                          }
                        });

                        // Sort the filtered inspections chronologically
                        filteredInspections.sort((a, b) => {
                          const dateA = new Date(a.inspectionDate || 0).getTime();
                          const dateB = new Date(b.inspectionDate || 0).getTime();
                          if (dateA !== dateB) return dateA - dateB;
                          return Number(a.id || 0) - Number(b.id || 0);
                        });

                        // Only show trips if inspections have actually started
                        filteredInspections.forEach((insp: any) => {
                          if (!insp.lorryTransitDetail || insp.lorryTransitDetail.placeStatus !== 'approved') {
                            flatTrips.push({
                              entry: e,
                              inspection: insp,
                              isPlaceholder: false,
                            });
                          }
                        });
                      });

                      // Sort flatTrips by date ascending so oldest entry gets SL No 1
                      flatTrips.sort((a, b) => {
                        const aDate = new Date(a.inspection?.inspectionDate || a.entry?.entryDate || 0).getTime();
                        const bDate = new Date(b.inspection?.inspectionDate || b.entry?.entryDate || 0).getTime();
                        return aDate - bDate;
                      });

                      return flatTrips.map((trip, idx) => {
                        const { entry, inspection, isPlaceholder } = trip;
                        const dateVal = isPlaceholder ? entry.entryDate : (inspection.inspectionDate || entry.entryDate);
                        const lorryNum = isPlaceholder ? (entry.lorryNumber || 'Pending Lorry') : (inspection.lorryNumber || 'Pending Lorry');
                        const bagsLoaded = isPlaceholder ? entry.bags : (inspection.bags || inspection.bagsLoaded || '-');
                        const isLinked = !isPlaceholder && !!inspection.linkedPattiRate;

                        const transitDetail = isPlaceholder ? null : inspection?.lorryTransitDetail;
                        const placeStatus = transitDetail?.placeStatus || 'none';
                        const wbStatus = transitDetail?.wbStatus || 'none';
                        const wbNoVal = transitDetail?.wbNo || '-';
                        const netWeightVal = transitDetail?.netWeight || '-';

                        const isApprover = (user as any)?.role === 'owner' || 
                                           (user as any)?.role === 'ceo' || 
                                           (user as any)?.effectiveRole === 'ceo' || 
                                           (user as any)?.role === 'inventory_head' || 
                                           (user as any)?.effectiveRole === 'inventory_head' || 
                                           (user as any)?.role === 'admin' || 
                                           (user as any)?.role === 'manager';

                        return (
                          <React.Fragment key={isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`}>
                            {idx > 0 && (
                              <tr key={`spacer-${idx}`} style={{ height: '20px', backgroundColor: '#e2e8f0' }}>
                                <td colSpan={9} style={{ padding: 0, height: '20px', backgroundColor: '#f1f5f9', border: 'none' }} />
                              </tr>
                            )}
                            <tr style={{
                              borderBottom: '2px solid #cbd5e1',
                              background: idx % 2 === 0 ? '#ffffff' : '#f9f9f9'
                            }}>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>{idx + 1}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{new Date(dateVal).toLocaleDateString('en-GB')}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', wordBreak: 'break-word' }}>{entry.brokerName || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', wordBreak: 'break-word' }}>
                                <button
                                  onClick={() => {
                                    setSelectedDetailEntry({
                                      ...entry,
                                      lorryNumber: lorryNum
                                    });
                                    setIsDetailOpen(true);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    font: 'inherit',
                                    color: '#2563eb',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 'inherit'
                                  }}
                                >
                                  {entry.partyName || '-'}
                                </button>
                              </td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>
                                {bagsLoaded} {entry.packaging ? `(${entry.packaging} Kg)` : ''}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>{entry.variety || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700', color: '#b91c1c' }}>
                                {isPlaceholder ? '-' : (() => {
                                  // ✅ FIX: Get moisture from Full Lorry Avg (samplingStages.full_avg.moisture) OR fallback to inspection.moisture
                                  const fullLorryMoisture = inspection?.samplingStages?.full_avg?.moisture;
                                  const directMoisture = inspection?.moisture;
                                  const moistureValue = fullLorryMoisture || directMoisture;
                                  return moistureValue ? `${Number(moistureValue)}%` : '-';
                                })()}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                                {isPlaceholder ? '-' : getCuttingValue(entry, inspection)}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{wbNoVal}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px' }}>
                                {transitDetail && (placeStatus === 'approved' || placeStatus === 'pending') ? (
                                  <span style={{ 
                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                    background: placeStatus === 'approved' ? '#dcfce7' : '#fef3c7',
                                    color: placeStatus === 'approved' ? '#166534' : '#92400e'
                                  }}>
                                    {(() => {
                                      if (transitDetail.placeType === 'kunchinittu') {
                                        const kc = transitDetail.placeKunchinittuData?.name || '';
                                        const wh = transitDetail.placeWarehouse?.name || '';
                                        return wh ? `${wh} (${kc})` : (kc || '-');
                                      }
                                      return transitDetail.placeWarehouse?.name || transitDetail.warehouse?.name || (transitDetail.outturn ? `${transitDetail.outturn.code} (${transitDetail.outturn.allottedVariety})` : '-') || '-';
                                    })()}
                                    {placeStatus === 'pending' && ' ⏳'}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>{netWeightVal ? `${netWeightVal} Kg` : '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '800', color: '#1e40af' }}>{lorryNum.toUpperCase()}</td>
                              {(((user as any)?.role === 'owner' || (user as any)?.role === 'staff' || (user as any)?.role === 'inventory_staff' || (user as any)?.role === 'financial_account' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) && (
                                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                    {/* Place Action Section */}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      {placeStatus === 'pending' && isApprover ? (
                                        <>
                                          <button
                                            onClick={() => handleApprovePlace(inspection.id)}
                                            style={{
                                              padding: '4px 6px', border: 'none', borderRadius: '4px',
                                              background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
                                            }}
                                          >
                                            Approve Place
                                          </button>
                                          <button
                                            onClick={() => handleRejectPlace(inspection.id)}
                                            style={{
                                              padding: '4px 6px', border: 'none', borderRadius: '4px',
                                              background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
                                            }}
                                          >
                                            Reject Place
                                          </button>
                                        </>
                                      ) : placeStatus === 'approved' ? (
                                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>📍 Place Done</span>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            const rowKey = isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`;
                                            if (selectedLorryForPlace === rowKey) {
                                              setSelectedLorryForPlace(null);
                                              setSelectedLorryEntries([]);
                                              setSelectedLorryInspection(null);
                                            } else {
                                              setSelectedLorryForPlace(rowKey);
                                              setSelectedLorryForWB(null);
                                              setSelectedLorryEntries([entry]);
                                              setSelectedLorryInspection(inspection);
                                              // Initialize inputs
                                              setPlaceWarehouseId('');
                                              setPlaceKunchinittuId('');
                                              setPlaceOutturnId('');
                                              setPlaceType('production');
                                            }
                                          }}
                                          style={{
                                            padding: '4px 8px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: selectedLorryForPlace === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) ? '#64748b' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          📍 Place
                                        </button>
                                      )}
                                    </div>

                                    {/* WB Action Section */}
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      {wbStatus === 'pending' && isApprover ? (
                                        <>
                                          <button
                                            onClick={() => handleApproveWb(inspection.id)}
                                            style={{
                                              padding: '4px 6px', border: 'none', borderRadius: '4px',
                                              background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
                                            }}
                                          >
                                            Approve WB
                                          </button>
                                          <button
                                            onClick={() => handleRejectWb(inspection.id)}
                                            style={{
                                              padding: '4px 6px', border: 'none', borderRadius: '4px',
                                              background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
                                            }}
                                          >
                                            Reject WB
                                          </button>
                                        </>
                                      ) : wbStatus === 'approved' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✅ WB Approved</span>
                                          {!transitDetail?.partyWbName && (
                                            <button
                                              onClick={() => {
                                                const rowKey = isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`;
                                                if (selectedLorryForWB === rowKey) {
                                                  setSelectedLorryForWB(null);
                                                  setSelectedLorryInspection(null);
                                                } else {
                                                  setSelectedLorryForWB(rowKey);
                                                  setSelectedLorryForPlace(null);
                                                  setSelectedLorryInspection(inspection || entry);
                                                  setWbInputType('party');
                                                  setWbNumber('');
                                                  setPartyWbName('');
                                                  setWbGrossWeight('');
                                                  setWbTareWeight('');
                                                  setWbNetWeight('');
                                                }
                                              }}
                                              style={{
                                                padding: '2px 6px', border: 'none', borderRadius: '4px',
                                                background: selectedLorryForWB === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) ? '#64748b' : '#2563eb',
                                                color: '#fff', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer'
                                              }}
                                            >
                                              + Party WB
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            const rowKey = isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`;
                                            if (selectedLorryForWB === rowKey) {
                                              setSelectedLorryForWB(null);
                                              setSelectedLorryEntries([]);
                                              setSelectedLorryInspection(null);
                                            } else {
                                              setSelectedLorryForWB(rowKey);
                                              setSelectedLorryForPlace(null);
                                              setSelectedLorryEntries([entry]);
                                              setSelectedLorryInspection(inspection || entry);
                                              setWbInputType('mill');
                                              setWbNumber(transitDetail?.wbNo || '');
                                              setWbGrossWeight('');
                                              setWbTareWeight('');
                                              setWbNetWeight('');
                                            }
                                          }}
                                          style={{
                                            padding: '4px 8px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: selectedLorryForWB === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) ? '#64748b' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            color: '#fff',
                                            fontWeight: 'bold',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ⚖️ WB
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              )}
                            </tr>
                            
                            {/* COLLAPSIBLE WB ROW */}
                            {selectedLorryForWB === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) && (
                              <tr>
                                <td colSpan={ (((user as any)?.role === 'owner' || (user as any)?.role === 'staff' || (user as any)?.role === 'inventory_staff' || (user as any)?.role === 'financial_account' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) ? 13 : 12 } style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>⚖️ Add Weight Bridge for {lorryNum.toUpperCase()}</h4>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                          onClick={() => setWbInputType('mill')}
                                          style={{
                                            padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1',
                                            background: wbInputType === 'mill' ? '#1a237e' : '#fff',
                                            color: wbInputType === 'mill' ? '#fff' : '#475569',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Mill Weight Bridge
                                        </button>
                                        <button 
                                          onClick={() => setWbInputType('party')}
                                          style={{
                                            padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1',
                                            background: wbInputType === 'party' ? '#1a237e' : '#fff',
                                            color: wbInputType === 'party' ? '#fff' : '#475569',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Party Weight Bridge
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>WB Number <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input 
                                          type="text" 
                                          value={wbNumber}
                                          onChange={(e) => setWbNumber(e.target.value.toUpperCase())}
                                          placeholder="Enter WB number"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                        />
                                      </div>
                                      
                                      {wbInputType === 'mill' ? (
                                        <div>
                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Mill WB Name (Mandatory)</label>
                                          <select 
                                            value={millWbId}
                                            onChange={(e) => setMillWbId(e.target.value)}
                                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                          >
                                            <option value="">Select Mill Weight Bridge</option>
                                            {millWBList?.map(wb => (
                                              <option key={wb.id} value={wb.id}>{wb.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                      ) : (
                                        <div>
                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Party WB Name</label>
                                          <input 
                                            type="text" 
                                            value={partyWbName}
                                            onChange={(e) => setPartyWbName(e.target.value)}
                                            placeholder="Enter Party WB name"
                                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                          />
                                        </div>
                                      )}
                                      
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Gross Weight (Kg)</label>
                                        <input 
                                          type="number" 
                                          value={wbGrossWeight}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setWbGrossWeight(val);
                                            if (val && wbTareWeight) {
                                              setWbNetWeight(String(Number(val) - Number(wbTareWeight)));
                                            }
                                          }}
                                          placeholder="Enter Gross"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Tare Weight (Kg)</label>
                                        <input 
                                          type="number" 
                                          value={wbTareWeight}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setWbTareWeight(val);
                                            if (wbGrossWeight && val) {
                                              setWbNetWeight(String(Number(wbGrossWeight) - Number(val)));
                                            }
                                          }}
                                          placeholder="Enter Tare"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Net Weight (Kg)</label>
                                        <input 
                                          type="text" 
                                          value={wbNetWeight}
                                          disabled
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }}
                                        />
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                      <button 
                                        onClick={() => setSelectedLorryForWB(null)}
                                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (!wbNumber || (wbInputType === 'mill' && !millWbId) || (wbInputType === 'party' && !partyWbName)) {
                                            toast.error('Please fill required fields (WB Number & Mill/Party WB Name)');
                                            return;
                                          }
                                          if (!wbGrossWeight || !wbTareWeight) {
                                            toast.error('Please enter both Gross Weight and Tare Weight');
                                            return;
                                          }
                                          if (parseFloat(wbGrossWeight) <= parseFloat(wbTareWeight)) {
                                            toast.error('Gross Weight must be strictly greater than Tare Weight');
                                            return;
                                          }
                                          try {
                                            const token = localStorage.getItem('token');
                                            const response = await axios.post(`${API_URL}/arrivals/${selectedLorryInspection.id}/wb`, {
                                              wbInputType,
                                              millWbId: wbInputType === 'mill' ? millWbId : null,
                                              partyWbName: wbInputType === 'party' ? partyWbName : null,
                                              wbNo: wbNumber,
                                              grossWeight: wbGrossWeight,
                                              tareWeight: wbTareWeight,
                                              netWeight: wbNetWeight
                                            }, {
                                              headers: { Authorization: `Bearer ${token}` }
                                            });
                                          setInventoryQualityToggle({
                                            dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
                                          });
                                            const responseDetail = response?.data?.detail || response?.data || {};
                                            const savedStatus = wbInputType === 'party' ? 'approved' : (responseDetail?.wbStatus || response?.data?.wbStatus || 'pending');
                                            const savedWbNo = responseDetail?.wbNo || response?.data?.wbNo || wbNumber;
                                            const savedNetWeight = responseDetail?.netWeight ?? response?.data?.netWeight ?? wbNetWeight;
                                            setInTransitEntries(prev => applyWbSaveToEntries(prev, selectedLorryInspection?.id ?? entry.id, {
                                              wbStatus: savedStatus,
                                              wbNo: savedWbNo,
                                              netWeight: savedNetWeight,
                                              partyWbName: wbInputType === 'party' ? partyWbName : (responseDetail?.partyWbName || undefined),
                                              wbInputType,
                                              millWbId: wbInputType === 'mill' ? millWbId : undefined,
                                              grossWeight: wbGrossWeight,
                                              tareWeight: wbTareWeight
                                            }));
                                            toast.success('Weight Bridge submitted for approval!');
                                            setSelectedLorryForWB(null);
                                            setSelectedLorryEntries([]);
                                            setSelectedLorryInspection(null);
                                            fetchInTransitEntries();
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.error || 'Failed to save Weight Bridge');
                                          }
                                        }}
                                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: '#1a237e', color: '#fff', cursor: 'pointer' }}
                                      >
                                        Save Weight Bridge
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {/* COLLAPSIBLE PLACE ROW */}
                            {selectedLorryForPlace === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) && (
                              <tr>
                                <td colSpan={ (((user as any)?.role === 'owner' || (user as any)?.role === 'staff' || (user as any)?.role === 'inventory_staff' || (user as any)?.role === 'financial_account' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) ? 14 : 13 } style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>📍 Set Place Location for {lorryNum.toUpperCase()}</h4>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Place Date</label>
                                        <input 
                                          type="date" 
                                          value={placeDate}
                                          onChange={(e) => setPlaceDate(e.target.value)}
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Destination Type</label>
                                        <select 
                                          value={placeType}
                                          onChange={(e) => {
                                            setPlaceType(e.target.value as any);
                                            setPlaceWarehouseId('');
                                            setPlaceKunchinittuId('');
                                          }}
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                        >
                                          <option value="production">Production</option>
                                          <option value="kunchinittu">Kunchinittu</option>
                                        </select>
                                      </div>
                                      
                                      {placeType === 'production' ? (
                                        <>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Select Outturn</label>
                                            <select 
                                              value={placeOutturnId}
                                              onChange={(e) => setPlaceOutturnId(e.target.value)}
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                            >
                                              <option value="">Choose Outturn</option>
                                              {outturns.filter(o => !o.isCleared).map((o) => (
                                                <option key={o.id} value={o.id}>
                                                  {o.code} - {o.allottedVariety}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Select Warehouse</label>
                                            <select 
                                              value={placeWarehouseId}
                                              onChange={(e) => {
                                                const wid = e.target.value;
                                                setPlaceWarehouseId(wid);
                                                // Reset Kunchinittu if it doesn't belong to the newly selected warehouse
                                                const currentK = kunchinittus.find(k => String(k.id) === String(placeKunchinittuId));
                                                if (currentK && String(currentK.warehouseId) !== String(wid)) {
                                                  setPlaceKunchinittuId('');
                                                }
                                              }}
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                            >
                                              <option value="">Choose Warehouse</option>
                                              {warehouses.map(w => (
                                                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Select Kunchinittu</label>
                                            <select 
                                              value={placeKunchinittuId}
                                              onChange={(e) => {
                                                const kid = e.target.value;
                                                setPlaceKunchinittuId(kid);
                                                const match = kunchinittus.find(k => String(k.id) === String(kid));
                                                if (match && match.warehouseId) {
                                                  setPlaceWarehouseId(String(match.warehouseId));
                                                }
                                              }}
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                            >
                                              <option value="">Choose Kunchinittu</option>
                                              {kunchinittus
                                                .filter(k => !placeWarehouseId || String(k.warehouseId) === String(placeWarehouseId))
                                                .map(k => (
                                                  <option key={k.id} value={k.id}>{k.name} ({k.code})</option>
                                                ))}
                                            </select>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                      <button 
                                        onClick={() => setSelectedLorryForPlace(null)}
                                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (placeType === 'production') {
                                            if (!placeOutturnId) {
                                              toast.error('Please choose an outturn');
                                              return;
                                            }
                                          }
                                          if (placeType === 'kunchinittu' && (!placeKunchinittuId || !placeWarehouseId)) {
                                            toast.error('Please choose both Kunchinittu & Warehouse');
                                            return;
                                          }
                                          try {
                                            const token = localStorage.getItem('token');
                                            await axios.post(`${API_URL}/arrivals/${selectedLorryInspection.id}/place`, {
                                              placeDate,
                                              placeType,
                                              placeKunchinittuId: placeType === 'kunchinittu' ? (placeKunchinittuId ? Number(placeKunchinittuId) : null) : null,
                                              placeWarehouseId: placeType === 'production' ? null : (placeWarehouseId ? Number(placeWarehouseId) : null),
                                              outturnId: placeType === 'production' ? (placeOutturnId ? Number(placeOutturnId) : null) : null
                                            }, {
                                              headers: { Authorization: `Bearer ${token}` }
                                            });
                                            toast.success('Place submitted for approval!');
                                            setSelectedLorryForPlace(null);
                                            setSelectedLorryEntries([]);
                                            setSelectedLorryInspection(null);
                                            fetchInTransitEntries();
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.error || 'Failed to save Place');
                                          }
                                        }}
                                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: '#1a237e', color: '#fff', cursor: 'pointer' }}
                                      >
                                        Save Place
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer: Load More + Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  <span style={{ background: '#dbeafe', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{transitTotalLoaded}</span>
                  lots loaded
                  {transitHasNextPage && <span style={{ color: '#94a3b8' }}>• more available</span>}
                </div>
                {transitHasNextPage && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      padding: '8px 24px',
                      background: loadingMore ? '#94a3b8' : 'linear-gradient(135deg, #1565c0, #1e88e5)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '12px',
                      boxShadow: loadingMore ? 'none' : '0 2px 8px rgba(21,101,192,0.25)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Loading...
                      </>
                    ) : (
                      <>📥 Load More</>
                    )}
                  </button>
                )}
                {!transitHasNextPage && transitTotalLoaded > 0 && (
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✅ All records loaded</span>
                )}
              </div>
            </>
          )}

          {/* Inline CSS animation for skeleton pulse and spinner */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : arrivalsActiveSubTab === 'bandmalal' ? (
        <div>
          <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '16px', fontWeight: 'bold' }}>📗 Band Mall Book — Placed Entries</h3>
          {loadingTransit ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>⏳ Loading...</div>
          ) : bandMalalEntries.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600, backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              No placed entries in Band Mall Book yet.
            </div>
          ) : (
            <>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #10b981', boxShadow: '0 2px 8px rgba(16,185,129,0.12)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#065f46', color: '#fff', borderBottom: '1px solid #000' }}>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '3%' }}>SL No</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '7%' }}>Date</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '10%' }}>Broker</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '12%' }}>From/Party</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>No. of Bags</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '10%' }}>Variety</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Moisture</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Cutting</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>WB Number</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Place</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Net Weight</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Approved By</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Lorry Number</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '5%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bandMalalEntries.map((entry, idx) => {
                    const wbStatus = entry.wbStatus || 'none';
                    const wbNoVal = entry.wbNo || (wbStatus === 'none' ? '⚠️ Required' : '-');
                    const netWeightVal = entry.netWeight || 0;
                    const placeStatus = entry.placeStatus || 'none';
                    
                    // Format bags display (bags count + packaging size)
                    const bagsDisplay = entry.bags 
                      ? `${entry.bags} ${entry.packaging ? `(${entry.packaging} Kg)` : ''}` 
                      : '-';
                    
                    // Use getCuttingValue helper for cutting display
                    const cuttingDisplay = getCuttingValue(entry, null);
                    
                    // Format moisture display
                    const moistureDisplay = entry.moisture 
                      ? `${entry.moisture}%` 
                      : '-';
                    
                    // Determine place display based on type
                    let placeDisplay = '-';
                    if (entry.placeType === 'production' && entry.outturn) {
                      placeDisplay = `🏭 ${entry.outturn.code}`;
                    } else if (entry.placeType === 'kunchinittu') {
                      const wh = entry.placeWarehouse?.name || entry.toWarehouse?.name || '';
                      const kc = entry.placeKunchinittuData?.name || entry.toKunchinittu?.name || '';
                      placeDisplay = wh ? (wh + (kc ? ' (' + kc + ')' : '')) : (kc || '-');
                    }

                    const isApprover = (user as any)?.role === 'owner' || 
                                       (user as any)?.role === 'ceo' || 
                                       (user as any)?.effectiveRole === 'ceo' || 
                                       (user as any)?.role === 'inventory_head' || 
                                       (user as any)?.effectiveRole === 'inventory_head' || 
                                       (user as any)?.role === 'admin' || 
                                       (user as any)?.role === 'manager';

                    return (
                      <React.Fragment key={`bm-${entry.id}`}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          {/* Column 1: SL No */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600' }}>
                            {entry.slNo}
                          </td>
                          
                          {/* Column 2: Date */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </td>
                          
                          {/* Column 3: Broker */}
                          <td style={{ border: '1px solid #000', padding: '5px' }}>
                            {entry.broker || '-'}
                          </td>
                          
                          {/* Column 4: From/Party */}
                          <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '600' }}>
                            <button
                              onClick={async () => {
                                const entryId = entry.id || `${entry.slNo}-${idx}`;
                                setDetailLoadingId(entryId);
                                try {
                                  // Try to fetch full sample entry to get all details
                                  const sampleEntryId = entry.sampleEntry?.id || entry.sampleEntryId;
                                  if (sampleEntryId) {
                                    const token = localStorage.getItem('token');
                                    const res = await axios.get(`${API_URL}/sample-entries/${sampleEntryId}`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    const fullSampleEntry = res.data.entry || res.data.sampleEntry || res.data;
                                    // Merge: Sample Entry data first, then Band Mall entry overrides
                                    // This preserves Band Mall specific fields (wbNo, placeType, WB/Place details)
                                    setSelectedDetailEntry({
                                      ...fullSampleEntry,
                                      ...entry, // Band Mall entry overrides with WB and Place details
                                      id: sampleEntryId,
                                      lorryNumber: entry.lorryNumber,
                                      isBandMalalBook: true,
                                    });
                                  } else {
                                    setSelectedDetailEntry({
                                      ...entry,
                                      isBandMalalBook: true,
                                    });
                                  }
                                  setIsDetailOpen(true);
                                } catch (err) {
                                  console.error('Error fetching sample entry details:', err);
                                  // Fallback: just use the Band Mall entry data
                                  setSelectedDetailEntry({
                                    ...entry,
                                    isBandMalalBook: true,
                                  });
                                  setIsDetailOpen(true);
                                } finally {
                                  setDetailLoadingId(null);
                                }
                              }}
                              disabled={detailLoadingId === (entry.id || `${entry.slNo}-${idx}`)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                font: 'inherit',
                                color: detailLoadingId === (entry.id || `${entry.slNo}-${idx}`) ? '#94a3b8' : '#2563eb',
                                textDecoration: 'underline',
                                cursor: detailLoadingId === (entry.id || `${entry.slNo}-${idx}`) ? 'wait' : 'pointer',
                                textAlign: 'left',
                                fontWeight: 'inherit'
                              }}
                            >
                              {detailLoadingId === (entry.id || `${entry.slNo}-${idx}`) ? '⏳ Loading...' : (entry.partyName || entry.fromLocation || '-')}
                            </button>
                          </td>
                          
                          {/* Column 5: No. of Bags */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>
                            {bagsDisplay}
                          </td>
                          
                          {/* Column 6: Variety */}
                          <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '800', color: '#1e40af' }}>
                            {entry.variety || '-'}
                          </td>
                          
                          {/* Column 7: Moisture */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {moistureDisplay}
                          </td>
                          
                          {/* Column 8: Cutting */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: cuttingDisplay === '-' ? '#94a3b8' : '#059669' }}>
                            {cuttingDisplay}
                          </td>
                          
                          {/* Column 9: WB Number */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {entry.wbNo || (wbStatus === 'pending' ? 'PENDING' : wbStatus === 'none' ? '⚠️ Required' : '-')}
                          </td>
                          
                          {/* Column 10: Place */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: '#7c3aed' }}>
                            {placeDisplay}
                          </td>
                          
                          {/* Column 11: Net Weight */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>
                            {netWeightVal ? `${netWeightVal} Kg` : '-'}
                          </td>

                          {/* Column 11a: Approved By */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: entry.wbApprover ? '#16a34a' : '#b45309' }}>
                            {entry.wbApprover?.username || entry.wbApprover?.fullName || (entry.wbStatus === 'approved' ? 'Auto Approved' : entry.wbStatus === 'pending' ? 'Pending Approval' : '-')}
                          </td>
                          
                          {/* Column 12: Lorry Number */}
                          <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '800', color: '#1e40af' }}>
                            {(entry.lorryNumber || 'N/A').toUpperCase()}
                          </td>
                          
                          {/* Column 13: Actions */}
                          {(user?.role === 'owner' || user?.role === 'ceo' || user?.effectiveRole === 'ceo' || user?.role === 'inventory_head' || user?.effectiveRole === 'inventory_head' || user?.role === 'admin' || user?.role === 'manager' || (user?.role === 'staff' && ['mill', 'location', 'inventory'].includes(user?.staffType))) && (
                            <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                {/* Weight Bridge Actions */}
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  {wbStatus === 'pending' && isApprover ? (
                                    <>
                                      <button onClick={() => handleApproveWb(entry.id)} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Approve</button>
                                      <button onClick={() => handleRejectWb(entry.id)} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Reject</button>
                                    </>
                                  ) : wbStatus === 'pending' ? (
                                    <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>WB Pending</span>
                                  ) : wbStatus === 'approved' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✅ WB Approved</span>
                                      {!entry.partyWbName && (
                                        <button
                                          onClick={() => {
                                            const lorry = (entry.lorryNumber || 'N/A').toUpperCase();
                                            if (selectedLorryForWB === lorry) {
                                              setSelectedLorryForWB(null);
                                              setSelectedLorryInspection(null);
                                            } else {
                                              setSelectedLorryForWB(lorry);
                                              setSelectedLorryInspection(entry);
                                              setWbInputType('party');
                                              setWbNumber('');
                                              setPartyWbName('');
                                              setWbGrossWeight('');
                                              setWbTareWeight('');
                                              setWbNetWeight('');
                                            }
                                          }}
                                          style={{
                                            padding: '2px 6px', border: 'none', borderRadius: '4px',
                                            background: selectedLorryForWB === (entry.lorryNumber || 'N/A').toUpperCase() ? '#64748b' : '#2563eb',
                                            color: '#fff', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer'
                                          }}
                                        >
                                          + Party WB
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <button onClick={() => {
                                      const lorry = (entry.lorryNumber || 'N/A').toUpperCase();
                                      if (selectedLorryForWB === lorry) { setSelectedLorryForWB(null); setSelectedLorryInspection(null); }
                                      else { setSelectedLorryForWB(lorry); setSelectedLorryInspection(entry); setWbNumber(''); setMillWbId(''); setWbGrossWeight(''); setWbTareWeight(''); }
                                    }} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: selectedLorryForWB === (entry.lorryNumber || 'N/A').toUpperCase() ? '#64748b' : 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Add WB</button>
                                  )}
                                </div>
                                {/* Inventory Quality Button */}
                                {canAddInventoryQuality && (
                                  <button
                                    onClick={() => {
                                      if (expandedInventoryQuality === entry.transitDetailId) {
                                        setExpandedInventoryQuality(null);
                                      } else {
                                        setExpandedInventoryQuality(entry.transitDetailId);
                                        setInventoryQualityType('lot_avg');
                                        setInventoryQualityForm({
                                          moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
                                          mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
                                          wbR: '', wbBk: '', wbT: '', smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
                                        });
                                      }
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      background: expandedInventoryQuality === entry.transitDetailId ? '#9333ea' : '#a855f7',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      width: '100%'
                                    }}
                                  >
                                    🔬 Inventory Quality
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                        {/* INVENTORY QUALITY EXPANDED FORM */}
                        {expandedInventoryQuality === entry.transitDetailId && (
                            <tr>
                              <td colSpan={14} style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', border: '1px solid #d8b4fe', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}>
                                  {/* Header */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                                    <div>
                                      <h4 style={{ margin: 0, color: '#6b21a8', fontSize: '15px', fontWeight: 'bold' }}>🔬 Inventory Quality Parameters</h4>
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Lorry: {(entry.lorryNumber || 'N/A').toUpperCase()}</div>
                                    </div>
                                    <button
                                      onClick={() => setExpandedInventoryQuality(null)}
                                      style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px', color: '#64748b', fontWeight: 600 }}
                                    >✕ Close</button>
                                  </div>

                                  {/* Previously Submitted Section */}
                                  {entry.inventoryQualityParameters && entry.inventoryQualityParameters.length > 0 && (
                                    <div style={{ marginBottom: '18px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Previously Submitted:</div>
                                      {entry.inventoryQualityParameters.map((qp: any, qIdx: number) => (
                                        <div key={qp.id || qIdx} style={{
                                          padding: '10px 14px', marginBottom: '8px',
                                          background: qp.status === 'approved' ? '#f0fdf4' : qp.status === 'rejected' ? '#fef2f2' : '#fefce8',
                                          border: '1px solid',
                                          borderColor: qp.status === 'approved' ? '#86efac' : qp.status === 'rejected' ? '#fca5a5' : '#fde047',
                                          borderRadius: '8px', fontSize: '12px'
                                        }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '11px', color: qp.status === 'approved' ? '#166534' : qp.status === 'rejected' ? '#991b1b' : '#854d0e' }}>
                                              {qp.type === 'lot_avg' ? '📊 Lot Avg' : '🚛 Full Lorry Avg'} — {qp.status === 'approved' ? '✅ Approved' : qp.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', color: '#475569', fontSize: '11px' }}>
                                            <span>Moisture: <b>{qp.moisture || '-'}</b></span>
                                            <span>Dry: <b>{qp.dryMoisture || '-'}</b></span>
                                            <span>Cut: <b>{qp.cutting || '-'}</b></span>
                                            <span>Bend: <b>{qp.bend || '-'}</b></span>
                                            <span>Grains: <b>{qp.grains || '-'}</b></span>
                                            <span>Mix: <b>{qp.mix || '-'}</b></span>
                                            <span>S Mix: <b>{qp.sMix || '-'}</b></span>
                                            <span>L Mix: <b>{qp.lMix || '-'}</b></span>
                                            <span>Kandu: <b>{qp.kandu || '-'}</b></span>
                                            <span>Oil: <b>{qp.oil || '-'}</b></span>
                                            <span>SK: <b>{qp.sk || '-'}</b></span>
                                            <span>WB R: <b>{qp.wbR || '-'}</b></span>
                                            <span>WB Bk: <b>{qp.wbBk || '-'}</b></span>
                                            <span>WB T: <b>{qp.wbT || '-'}</b></span>
                                            <span>Smell: <b>{qp.smell || '-'}</b></span>
                                            <span>P WB: <b>{qp.paddyWb || '-'}</b></span>
                                            <span>P Color: <b>{qp.pColor || '-'}</b></span>
                                          </div>
                                          {qp.reporter && <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>Reported by: {qp.reporter.fullName || qp.reporter.username}</div>}
                                          {qp.status === 'pending' && canApproveInventoryQuality && (
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                                              <button onClick={() => handleApproveInventoryQuality(qp.id)} style={{ padding: '4px 12px', border: 'none', borderRadius: '5px', background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Approve</button>
                                              <button onClick={() => { setRejectInventoryQualityId(qp.id); setRejectInventoryQualityReason(''); }} style={{ padding: '4px 12px', border: 'none', borderRadius: '5px', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Reject</button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Rejection Reason */}
                                  {rejectInventoryQualityId && (
                                    <div style={{ marginBottom: '14px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#991b1b', marginBottom: '6px' }}>Rejection Reason:</label>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <input type="text" value={rejectInventoryQualityReason} onChange={(e) => setRejectInventoryQualityReason(e.target.value)} placeholder="Enter reason..." style={{ flex: 1, padding: '6px 10px', fontSize: '12px', border: '1px solid #fca5a5', borderRadius: '5px' }} autoFocus />
                                        <button onClick={handleRejectInventoryQuality} style={{ padding: '6px 14px', border: 'none', borderRadius: '5px', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Confirm Reject</button>
                                        <button onClick={() => setRejectInventoryQualityId(null)} style={{ padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: '5px', background: '#fff', color: '#64748b', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                      </div>
                                    </div>
                                  )}

                                  {/* New Parameters Form - Physical Inspection Style */}
                                  <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>📝 Add New Parameters</span>
                                      {/* Type Toggle */}
                                      <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '3px', borderRadius: '6px' }}>
                                        <button onClick={() => setInventoryQualityType('lot_avg')} style={{
                                          padding: '5px 14px', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                          background: inventoryQualityType === 'lot_avg' ? '#7c3aed' : 'transparent',
                                          color: inventoryQualityType === 'lot_avg' ? '#fff' : '#6b7280',
                                          transition: 'all 0.2s'
                                        }}>📊 Lot Avg</button>
                                        <button onClick={() => setInventoryQualityType('full_lorry_avg')} style={{
                                          padding: '5px 14px', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                          background: inventoryQualityType === 'full_lorry_avg' ? '#7c3aed' : 'transparent',
                                          color: inventoryQualityType === 'full_lorry_avg' ? '#fff' : '#6b7280',
                                          transition: 'all 0.2s'
                                        }}>🚛 Full Lorry Avg</button>
                                      </div>
                                    </div>

                                                                        {/* Row 1: Moisture, Dry Moisture, Grains Count */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Moisture</label>
                                      <input type="text" value={inventoryQualityForm.moisture} onChange={(e) => setInventoryQualityForm(p => ({ ...p, moisture: e.target.value }))} placeholder="e.g. 16.5" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Dry Moisture</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="dm_toggle" checked={inventoryQualityToggle.dryMoisture === 'Y'} onChange={() => setInventoryQualityToggle(p => ({ ...p, dryMoisture: 'Y' }))} /> Y</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="dm_toggle" checked={inventoryQualityToggle.dryMoisture === 'N'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, dryMoisture: 'N' })); setInventoryQualityForm(p => ({ ...p, dryMoisture: '' })); }} /> N</label>
                                      </div>
                                      {inventoryQualityToggle.dryMoisture === 'Y' && (
                                        <input type="text" value={inventoryQualityForm.dryMoisture} onChange={(e) => setInventoryQualityForm(p => ({ ...p, dryMoisture: e.target.value }))} placeholder="Dry Value" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Grains Count</label>
                                      <input type="text" value={inventoryQualityForm.grains} onChange={(e) => setInventoryQualityForm(p => ({ ...p, grains: e.target.value }))} placeholder="e.g. 85" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    </div>

                                    {/* Row 2: Cutting, Bend, Mix */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Cutting</label>
                                      <input type="text" value={inventoryQualityForm.cutting} onChange={(e) => setInventoryQualityForm(p => ({ ...p, cutting: e.target.value }))} placeholder="1x" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Bend</label>
                                      <input type="text" value={inventoryQualityForm.bend} onChange={(e) => setInventoryQualityForm(p => ({ ...p, bend: e.target.value }))} placeholder="1x" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Mix</label>
                                      <input type="text" value={inventoryQualityForm.mix} onChange={(e) => setInventoryQualityForm(p => ({ ...p, mix: e.target.value }))} placeholder="e.g. 5" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    </div>

                                    {/* Row 3: SMix, LMix, SK */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>SMix</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="sm_toggle" checked={inventoryQualityToggle.sMix === 'Y'} onChange={() => setInventoryQualityToggle(p => ({ ...p, sMix: 'Y' }))} /> Y</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="sm_toggle" checked={inventoryQualityToggle.sMix === 'N'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, sMix: 'N' })); setInventoryQualityForm(p => ({ ...p, sMix: '' })); }} /> N</label>
                                      </div>
                                      {inventoryQualityToggle.sMix === 'Y' && (
                                        <input type="text" value={inventoryQualityForm.sMix} onChange={(e) => setInventoryQualityForm(p => ({ ...p, sMix: e.target.value }))} placeholder="Value" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>LMix</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="lm_toggle" checked={inventoryQualityToggle.lMix === 'Y'} onChange={() => setInventoryQualityToggle(p => ({ ...p, lMix: 'Y' }))} /> Y</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="lm_toggle" checked={inventoryQualityToggle.lMix === 'N'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, lMix: 'N' })); setInventoryQualityForm(p => ({ ...p, lMix: '' })); }} /> N</label>
                                      </div>
                                      {inventoryQualityToggle.lMix === 'Y' && (
                                        <input type="text" value={inventoryQualityForm.lMix} onChange={(e) => setInventoryQualityForm(p => ({ ...p, lMix: e.target.value }))} placeholder="Value" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>SK</label>
                                      <input type="text" value={inventoryQualityForm.sk} onChange={(e) => setInventoryQualityForm(p => ({ ...p, sk: e.target.value }))} placeholder="e.g. 0.5" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    </div>

                                    {/* Row 4: Kandu, Oil, Smell */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Kandu</label>
                                      <input type="text" value={inventoryQualityForm.kandu} onChange={(e) => setInventoryQualityForm(p => ({ ...p, kandu: e.target.value }))} placeholder="e.g. 1" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Oil</label>
                                      <input type="text" value={inventoryQualityForm.oil} onChange={(e) => setInventoryQualityForm(p => ({ ...p, oil: e.target.value }))} placeholder="e.g. 0.5" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Smell</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="smell_has" checked={inventoryQualityToggle.smellHas === 'Yes'} onChange={() => setInventoryQualityToggle(p => ({ ...p, smellHas: 'Yes' }))} /> Yes</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="smell_has" checked={inventoryQualityToggle.smellHas === 'No'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, smellHas: 'No' })); setInventoryQualityForm(p => ({ ...p, smell: '' })); }} /> No</label>
                                      </div>
                                      {inventoryQualityToggle.smellHas === 'Yes' && (
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                          {['Light', 'Medium', 'Dark'].map(opt => (
                                            <label key={opt} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                              <input type="radio" name="smell_type" checked={inventoryQualityForm.smell === opt} onChange={() => setInventoryQualityForm(p => ({ ...p, smell: opt }))} /> {opt}
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    </div>

                                    {/* Row 5: Paddy Discolor, Kadiga */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1.2 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Paddy Discolor</label>
                                      <select value={inventoryQualityForm.pColor} onChange={(e) => setInventoryQualityForm(p => ({ ...p, pColor: e.target.value }))} style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff' }}>
                                        <option value=''>Select discolor</option>
                                        <option value='Normal Color'>Normal Color</option>
                                        <option value='Light Discolor'>Light Discolor</option>
                                        <option value='Medium Discolor'>Medium Discolor</option>
                                        <option value='Dark Discolor'>Dark Discolor</option>
                                      </select>
                                    </div>
                                    <div style={{ flex: 0.8 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>ಕಡಿಗಾ (Kadiga)</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="kd_toggle" checked={inventoryQualityToggle.kadiga === 'Y'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, kadiga: 'Y' })); setInventoryQualityForm(p => ({ ...p, kadiga: 'Y' })); }} /> Y</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="kd_toggle" checked={inventoryQualityToggle.kadiga === 'N'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, kadiga: 'N' })); setInventoryQualityForm(p => ({ ...p, kadiga: '' })); }} /> N</label>
                                      </div>
                                    </div>
                                    </div>

                                    {/* Row 6: WB R, WB Bk, WB T */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>WB R</label>
                                      <input type="text" value={inventoryQualityForm.wbR} onChange={(e) => setInventoryQualityForm(p => ({ ...p, wbR: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>WB Bk</label>
                                      <input type="text" value={inventoryQualityForm.wbBk} onChange={(e) => setInventoryQualityForm(p => ({ ...p, wbBk: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>WB T</label>
                                      <input type="text" value={inventoryQualityForm.wbT} onChange={(e) => setInventoryQualityForm(p => ({ ...p, wbT: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                    </div>
                                    </div>

                                    {/* Row 7: Paddy WB, Remarks */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Paddy WB</label>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="pwb_toggle" checked={inventoryQualityToggle.paddyWb === 'Y'} onChange={() => setInventoryQualityToggle(p => ({ ...p, paddyWb: 'Y' }))} /> Y</label>
                                        <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}><input type="radio" name="pwb_toggle" checked={inventoryQualityToggle.paddyWb === 'N'} onChange={() => { setInventoryQualityToggle(p => ({ ...p, paddyWb: 'N' })); setInventoryQualityForm(p => ({ ...p, paddyWb: '' })); }} /> N</label>
                                      </div>
                                      {inventoryQualityToggle.paddyWb === 'Y' && (
                                        <input type="text" value={inventoryQualityForm.paddyWb} onChange={(e) => setInventoryQualityForm(p => ({ ...p, paddyWb: e.target.value }))} placeholder="Value" style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 2 }}>
                                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '3px', fontSize: '11px' }}>Remarks</label>
                                      <textarea value={inventoryQualityForm.remarks} onChange={(e) => setInventoryQualityForm(p => ({ ...p, remarks: e.target.value }))} placeholder='Additional remarks...' rows={1} style={{ width: '100%', padding: '5px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontFamily: 'inherit' }} />
                                    </div>
                                    </div>
{/* Submit Button */}
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
                                      <button
                                        onClick={() => handleSubmitInventoryQuality(entry.transitDetailId)}
                                        style={{ padding: '7px 20px', border: 'none', borderRadius: '6px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}
                                      >💾 Submit Quality Parameters</button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                        )}                        {selectedLorryForWB === (entry.lorryNumber || 'N/A').toUpperCase() && selectedLorryInspection?.id === entry.id && (
                          <tr>
                            <td colSpan={14} style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>⚖️ Add Weight Bridge for {(entry.lorryNumber || 'N/A').toUpperCase()}</h4>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => setWbInputType('mill')}
                                      style={{
                                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1',
                                        background: wbInputType === 'mill' ? '#1a237e' : '#fff',
                                        color: wbInputType === 'mill' ? '#fff' : '#475569',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Mill Weight Bridge
                                    </button>
                                    <button 
                                      onClick={() => setWbInputType('party')}
                                      style={{
                                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1',
                                        background: wbInputType === 'party' ? '#1a237e' : '#fff',
                                        color: wbInputType === 'party' ? '#fff' : '#475569',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Party Weight Bridge
                                    </button>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>WB Number <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input 
                                      type="text" 
                                      value={wbNumber}
                                      onChange={(e) => setWbNumber(e.target.value.toUpperCase())}
                                      placeholder="Enter WB number"
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                  </div>
                                  
                                  {wbInputType === 'mill' ? (
                                    <div>
                                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Mill WB Name (Mandatory)</label>
                                      <select 
                                        value={millWbId}
                                        onChange={(e) => setMillWbId(e.target.value)}
                                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                      >
                                        <option value="">Select Mill Weight Bridge</option>
                                        {millWBList?.map(wb => (
                                          <option key={wb.id} value={wb.id}>{wb.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <div>
                                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Party WB Name</label>
                                      <input 
                                        type="text" 
                                        value={partyWbName}
                                        onChange={(e) => setPartyWbName(e.target.value)}
                                        placeholder="Enter Party WB name"
                                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                      />
                                    </div>
                                  )}
                                  
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Gross Weight (Kg)</label>
                                    <input 
                                      type="number" 
                                      value={wbGrossWeight}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setWbGrossWeight(val);
                                        if (val && wbTareWeight) {
                                          setWbNetWeight(String(Number(val) - Number(wbTareWeight)));
                                        }
                                      }}
                                      placeholder="Enter Gross"
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Tare Weight (Kg)</label>
                                    <input 
                                      type="number" 
                                      value={wbTareWeight}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setWbTareWeight(val);
                                        if (wbGrossWeight && val) {
                                          setWbNetWeight(String(Number(wbGrossWeight) - Number(val)));
                                        }
                                      }}
                                      placeholder="Enter Tare"
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Net Weight (Kg)</label>
                                    <input 
                                      type="text" 
                                      value={wbNetWeight}
                                      disabled
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9' }}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button 
                                    onClick={() => {
                                      setSelectedLorryForWB(null);
                                      setSelectedLorryInspection(null);
                                    }}
                                    style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (!wbNumber || (wbInputType === 'mill' && !millWbId) || (wbInputType === 'party' && !partyWbName)) {
                                        toast.error('Please fill required fields (WB Number & Mill/Party WB Name)');
                                        return;
                                      }
                                      if (!wbGrossWeight || !wbTareWeight) {
                                        toast.error('Please enter both Gross Weight and Tare Weight');
                                        return;
                                      }
                                      if (parseFloat(wbGrossWeight) <= parseFloat(wbTareWeight)) {
                                        toast.error('Gross Weight must be strictly greater than Tare Weight');
                                        return;
                                      }
                                      try {
                                        const token = localStorage.getItem('token');
                                        const response = await axios.post(`${API_URL}/arrivals/${entry.id}/wb`, {
                                          wbInputType,
                                          millWbId: wbInputType === 'mill' ? Number(millWbId) : null,
                                          partyWbName: wbInputType === 'party' ? partyWbName : null,
                                          wbNo: wbNumber,
                                          grossWeight: Number(wbGrossWeight),
                                          tareWeight: Number(wbTareWeight),
                                          netWeight: Number(wbNetWeight)
                                        }, {
                                          headers: { Authorization: `Bearer ${token}` }
                                        });
                                        const responseDetail = response?.data?.detail || response?.data || {};
                                        const savedStatus = wbInputType === 'party' ? 'approved' : (responseDetail?.wbStatus || response?.data?.wbStatus || 'pending');
                                        const savedWbNo = responseDetail?.wbNo || response?.data?.wbNo || wbNumber;
                                        const savedNetWeight = responseDetail?.netWeight ?? response?.data?.netWeight ?? Number(wbNetWeight);
                                        setInTransitEntries(prev => applyWbSaveToEntries(prev, entry.id, {
                                          wbStatus: savedStatus,
                                          wbNo: savedWbNo,
                                          netWeight: savedNetWeight,
                                          partyWbName: wbInputType === 'party' ? partyWbName : (responseDetail?.partyWbName || undefined),
                                          wbInputType,
                                          millWbId: wbInputType === 'mill' ? Number(millWbId) : undefined,
                                          grossWeight: Number(wbGrossWeight),
                                          tareWeight: Number(wbTareWeight)
                                        }));
                                        toast.success('Weight Bridge submitted for approval!');
                                        setSelectedLorryForWB(null);
                                        setSelectedLorryInspection(null);
                                        setWbNumber('');
                                        setMillWbId('');
                                        setPartyWbName('');
                                        setWbGrossWeight('');
                                        setWbTareWeight('');
                                        setWbNetWeight('');
                                        fetchInTransitEntries();
                                      } catch (err: any) {
                                        toast.error(err.response?.data?.error || 'Failed to save Weight Bridge');
                                      }
                                    }}
                                    style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', cursor: 'pointer' }}
                                  >
                                    Save WB
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Footer: styled like In Transit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{bandMalalEntries.length}</span>
                lots loaded
              </div>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✅ All records loaded</span>
            </div>
            </>
          )}
        </div>
      ) : arrivalsActiveSubTab === 'entry' ? (
        <MainGrid>
        <FormCard>
          <form onSubmit={handleSubmit}>
            {/* Form Header with Movement Type Toggle */}
            <FormHeader>
              <div>
                <Label style={{ marginBottom: '0.5rem' }}>Entry Type</Label>
              </div>
              <ToggleButtonGroup>
                <ToggleButton
                  type="button"
                  $active={movementType === 'purchase'}
                  onClick={() => {
                    setMovementType('purchase');
                    setPurchaseFromType('kunchinittu');
                    setShiftingType('normal');
                  }}
                >
                  📦 Purchase
                </ToggleButton>
                <ToggleButton
                  type="button"
                  $active={movementType === 'shifting'}
                  onClick={() => {
                    setMovementType('shifting');
                    setPurchaseFromType('kunchinittu');
                    setShiftingType('normal');
                  }}
                >
                  🔄 Shifting
                </ToggleButton>
              </ToggleButtonGroup>
            </FormHeader>

            {/* Top Section - SL No and Date */}
            <TopSection>
              <FormGroup>
                <Label>SL No</Label>
                <SlNoDisplay>{slNo || 'Loading...'}</SlNoDisplay>
                <InfoText>Auto-generated serial number</InfoText>
              </FormGroup>

              <FormGroup>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={date ? date.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value + 'T12:00:00');
                    if (!isNaN(selectedDate.getTime())) {
                      setDate(selectedDate);
                    }
                  }}
                />
                <InfoText>Click the calendar icon to select date</InfoText>
              </FormGroup>
            </TopSection>

            {/* Conditional Fields Based on Movement Type */}
            {movementType === 'purchase' ? (
              <>
                {/* Purchase Type Selection */}
                <FormSection>
                  <FormRow>
                    <FormGroup>
                      <Label>To *</Label>
                      <Select
                        value={purchaseFromType}
                        onChange={(e) => setPurchaseFromType(e.target.value as 'kunchinittu' | 'for-production')}
                      >
                        <option value="kunchinittu">Kunchinittu (Normal Purchase)</option>
                        <option value="for-production">For Production (Direct to Outturn)</option>
                      </Select>
                    </FormGroup>
                  </FormRow>
                </FormSection>

                {purchaseFromType === 'kunchinittu' ? (
                  <>
                    {/* Normal Purchase Fields */}
                    <FormSection>
                      <SectionTitle>Purchase Details</SectionTitle>
                      <FormRow>
                        <FormGroup>
                          <Label>Broker *</Label>
                          <Select
                            value={broker}
                            onChange={(e) => setBroker(e.target.value)}
                            required
                          >
                            <option value="">-- Select Broker --</option>
                            {[...brokersList]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((b) => (
                                <option key={b.id} value={b.name}>
                                  {b.name}
                                </option>
                              ))
                            }
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Variety *</Label>
                          <Select
                            value={variety}
                            onChange={(e) => setVariety(e.target.value)}
                            required
                          >
                            <option value="">-- Select Variety --</option>
                            {[...varieties]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((v) => (
                                <option key={v.id} value={v.name}>
                                  {v.name}
                                </option>
                              ))
                            }
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Bags</Label>
                          <Input
                            type="number"
                            value={bags}
                            onChange={(e) => setBags(e.target.value)}
                            placeholder="Number of bags"
                            min="0"
                          />
                        </FormGroup>
                      </FormRow>

                      <FormRow>
                        <FormGroup>
                          <Label>From Location</Label>
                          <Input
                            type="text"
                            value={fromLocation}
                            onChange={(e) => setFromLocation(e.target.value.toUpperCase())}
                            placeholder="Source location"
                            style={{ textTransform: 'uppercase' }}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>To Kunchinittu *</Label>
                          <Select
                            value={toKunchinintuId}
                            onChange={(e) => {
                              setToKunchinintuId(e.target.value);
                              setToWarehouseId('');
                            }}
                            required
                          >
                            <option value="">Select Kunchinittu</option>
                            {varietyAllocations.length > 0 ? (
                              // Show only kunchinittus for this variety
                              varietyAllocations.map((allocation) => (
                                <option key={allocation.kunchinintuId} value={allocation.kunchinintuId}>
                                  {allocation.kunchinintuCode} - {allocation.warehouseName}
                                </option>
                              ))
                            ) : (
                              // Show all kunchinittus if no variety selected
                              activeKunchinittus.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.code} - {k.warehouse?.name || 'No Warehouse'}
                                </option>
                              ))
                            )}
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Warehouse *</Label>
                          <Select
                            value={toWarehouseId}
                            onChange={(e) => setToWarehouseId(e.target.value)}
                            required
                            disabled={!toKunchinintuId}
                          >
                            <option value="">Select Warehouse</option>
                            {availableWarehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.code}
                              </option>
                            ))}
                          </Select>
                        </FormGroup>
                      </FormRow>
                    </FormSection>
                  </>
                ) : (
                  <>
                    {/* For Production - Direct to Outturn */}
                    <FormSection>
                      <SectionTitle>For Production (Direct to Outturn)</SectionTitle>
                      <FormRow>
                        <FormGroup>
                          <Label>Broker *</Label>
                          <Select
                            value={broker}
                            onChange={(e) => setBroker(e.target.value)}
                            required
                          >
                            <option value="">-- Select Broker --</option>
                            {[...brokersList]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((b) => (
                                <option key={b.id} value={b.name}>
                                  {b.name}
                                </option>
                              ))
                            }
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Variety *</Label>
                          <Select
                            value={variety}
                            onChange={(e) => setVariety(e.target.value)}
                            required
                          >
                            <option value="">-- Select Variety --</option>
                            {[...varieties]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((v) => (
                                <option key={v.id} value={v.name}>
                                  {v.name}
                                </option>
                              ))
                            }
                          </Select>
                        </FormGroup>

                        <FormGroup>
                          <Label>Bags</Label>
                          <Input
                            type="number"
                            value={bags}
                            onChange={(e) => setBags(e.target.value)}
                            placeholder="Number of bags"
                            min="0"
                          />
                        </FormGroup>
                      </FormRow>

                      <FormRow>
                        <FormGroup>
                          <Label>From Location</Label>
                          <Input
                            type="text"
                            value={fromLocation}
                            onChange={(e) => setFromLocation(e.target.value.toUpperCase())}
                            placeholder="Source location"
                            style={{ textTransform: 'uppercase' }}
                          />
                        </FormGroup>

                        <FormGroup>
                          <Label>To Outturn * (No Warehouse Storage)</Label>
                          <Select
                            value={toOutturnId}
                            onChange={(e) => {
                              setToOutturnId(e.target.value);
                              const selected = outturns.find(o => o.id === parseInt(e.target.value));
                              if (selected) {
                                setVariety(selected.allottedVariety);
                              }
                            }}
                            required
                          >
                            <option value="">Select Outturn</option>
                            {outturns.filter(o => !o.isCleared).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.code} - {o.allottedVariety}
                              </option>
                            ))}
                          </Select>
                        </FormGroup>
                      </FormRow>
                    </FormSection>
                  </>
                )}

                {/* Cutting Fields */}
                <FormSection>
                  <SectionTitle>Additional Details</SectionTitle>
                  <FormRow>
                    <FormGroup>
                      <Label>Moisture (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={moisture}
                        onChange={(e) => setMoisture(e.target.value)}
                        placeholder="e.g., 12.5"
                        min="0"
                        max="100"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label>Cutting (multiply)</Label>
                      <TwoColumnRow>
                        <SmallInput
                          type="number"
                          value={cuttingValue1}
                          onChange={(e) => setCuttingValue1(e.target.value)}
                          placeholder="e.g., 20"
                          min="0"
                        />
                        <SmallInput
                          type="number"
                          value={cuttingValue2}
                          onChange={(e) => setCuttingValue2(e.target.value)}
                          placeholder="e.g., 10"
                          min="0"
                        />
                      </TwoColumnRow>
                      {/* Cutting total hidden as per user request */}
                    </FormGroup>
                  </FormRow>
                </FormSection>
              </>
            ) : (
              <>
                {/* Shifting Type Selection */}
                <FormSection>
                  <FormRow>
                    <FormGroup>
                      <Label>Shifting Type *</Label>
                      <Select
                        value={shiftingType}
                        onChange={(e) => setShiftingType(e.target.value as 'normal' | 'production')}
                      >
                        <option value="normal">Normal Shifting</option>
                        <option value="production">Production Shifting</option>
                      </Select>
                    </FormGroup>
                  </FormRow>
                </FormSection>

                {shiftingType === 'normal' ? (
                  <>
                    {/* Normal Shifting Fields */}
                    <FormSection>
                      <SectionTitle>Shifting Details</SectionTitle>
                      <FormRow>
                        <FormGroup>
                          <Label>Variety *</Label>
                          <Select
                            value={variety}
                            onChange={(e) => setVariety(e.target.value)}
                            required
                          >
                            <option value="">-- Select Variety --</option>
                            {[...varieties]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((v) => (
                                <option key={v.id} value={v.name}>
                                  {v.name}
                                </option>
                              ))
                            }
                          </Select>
                          {loadingStockLocations && (
                            <InfoText style={{ color: '#667eea' }}>
                              🔍 Checking stock locations...
                            </InfoText>
                          )}
                          {!loadingStockLocations && variety && stockLocations.length === 0 && (
                            <InfoText style={{ color: '#ef4444' }}>
                              ⚠️ No stock found for this variety
                            </InfoText>
                          )}
                        </FormGroup>

                        <FormGroup>
                          <Label>Bags</Label>
                          <Input
                            type="number"
                            value={bags}
                            onChange={(e) => setBags(e.target.value)}
                            placeholder="Number of bags"
                            min="0"
                          />
                        </FormGroup>
                      </FormRow>

                      {/* Conditional Field Rendering Based on Stock Locations */}
                      {shouldShowSingleLocationFields && (
                        <>
                          <SectionTitle>From Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu *</Label>
                              <Select
                                value={fromKunchinintuId}
                                onChange={(e) => setFromKunchinintuId(e.target.value)}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {stockLocations.map((loc) => (
                                  <option key={loc.kunchinintuId} value={loc.kunchinintuId}>
                                    {loc.kunchinintuCode} - {loc.warehouseName} ({loc.stockBags} bags)
                                  </option>
                                ))}
                              </Select>
                              <InfoText style={{ color: '#10b981' }}>
                                ✓ Auto-populated (only one location has stock)
                              </InfoText>
                            </FormGroup>

                            <FormGroup>
                              <Label>From Warehouse *</Label>
                              <Select
                                value={fromWarehouseId}
                                onChange={(e) => setFromWarehouseId(e.target.value)}
                                required
                              >
                                <option value="">Select Warehouse</option>
                                {stockLocations.map((loc) => (
                                  <option key={loc.warehouseId} value={loc.warehouseId}>
                                    {loc.warehouseName}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>

                          <SectionTitle>To Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>To Kunchinittu *</Label>
                              <Select
                                value={toKunchinintuId}
                                onChange={(e) => {
                                  setToKunchinintuId(e.target.value);
                                  setToWarehouseShiftId('');
                                }}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {activeKunchinittus.map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>

                            <FormGroup>
                              <Label>To Warehouse *</Label>
                              <Select
                                value={toWarehouseShiftId}
                                onChange={(e) => setToWarehouseShiftId(e.target.value)}
                                required
                                disabled={!toKunchinintuId}
                              >
                                <option value="">Select Warehouse</option>
                                {availableToWarehousesForShifting.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>
                        </>
                      )}

                      {shouldShowMultipleLocationFields && (
                        <>
                          <SectionTitle>From Kunchinittu Warehouse</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu Warehouse *</Label>
                              <Select
                                value={fromKunchinintuId ? `${fromKunchinintuId}-${fromWarehouseId}` : ''}
                                onChange={(e) => {
                                  const [kId, wId] = e.target.value.split('-');
                                  setFromKunchinintuId(kId);
                                  setFromWarehouseId(wId);
                                }}
                                required
                              >
                                <option value="">Select From Location</option>
                                {stockLocations.map((loc) => (
                                  <option
                                    key={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                    value={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                  >
                                    {loc.kunchinintuCode} - {loc.warehouseName} ({loc.stockBags} bags)
                                  </option>
                                ))}
                              </Select>
                              {stockLocations.length === 2 && (
                                <InfoText style={{ color: '#10b981' }}>
                                  ✓ Auto-populated (two locations available)
                                </InfoText>
                              )}
                            </FormGroup>
                          </FormRow>

                          <SectionTitle>To Kunchinittu Warehouse</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>To Kunchinittu Warehouse *</Label>
                              <Select
                                value={toKunchinintuId ? `${toKunchinintuId}-${toWarehouseShiftId}` : ''}
                                onChange={(e) => {
                                  const [kId, wId] = e.target.value.split('-');
                                  setToKunchinintuId(kId);
                                  setToWarehouseShiftId(wId);
                                }}
                                required
                              >
                                <option value="">Select To Location</option>
                                {stockLocations.map((loc) => (
                                  <option
                                    key={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                    value={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                  >
                                    {loc.kunchinintuCode} - {loc.warehouseName} ({loc.stockBags} bags)
                                  </option>
                                ))}
                              </Select>
                              {stockLocations.length === 2 && (
                                <InfoText style={{ color: '#10b981' }}>
                                  ✓ Auto-populated (two locations available)
                                </InfoText>
                              )}
                            </FormGroup>
                          </FormRow>
                        </>
                      )}

                      {!shouldShowSingleLocationFields && !shouldShowMultipleLocationFields && variety && !loadingStockLocations && (
                        <>
                          <SectionTitle>From Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu *</Label>
                              <Select
                                value={fromKunchinintuId}
                                onChange={(e) => {
                                  setFromKunchinintuId(e.target.value);
                                  setFromWarehouseId('');
                                }}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {activeKunchinittus.map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.code} - {k.warehouse?.name || 'No Warehouse'}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>

                            <FormGroup>
                              <Label>From Warehouse *</Label>
                              <Select
                                value={fromWarehouseId}
                                onChange={(e) => setFromWarehouseId(e.target.value)}
                                required
                                disabled={!fromKunchinintuId}
                              >
                                <option value="">
                                  {fromKunchinintuId ? 'Select Warehouse' : 'Select Kunchinittu First'}
                                </option>
                                {availableFromWarehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>

                          <SectionTitle>To Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>To Kunchinittu *</Label>
                              <Select
                                value={toKunchinintuId}
                                onChange={(e) => {
                                  setToKunchinintuId(e.target.value);
                                  setToWarehouseShiftId('');
                                }}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {activeKunchinittus.map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.code} - {k.warehouse?.name || 'No Warehouse'}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>

                            <FormGroup>
                              <Label>To Warehouse *</Label>
                              <Select
                                value={toWarehouseShiftId}
                                onChange={(e) => setToWarehouseShiftId(e.target.value)}
                                required
                                disabled={!toKunchinintuId}
                              >
                                <option value="">
                                  {toKunchinintuId ? 'Select Warehouse' : 'Select Kunchinittu First'}
                                </option>
                                {availableToWarehousesForShifting.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>
                        </>
                      )}
                    </FormSection>
                  </>
                ) : (
                  <>
                    {/* Production Shifting Fields */}
                    <FormSection>
                      <SectionTitle>Production Shifting Details</SectionTitle>
                      <FormRow>
                        <FormGroup>
                          <Label>Variety *</Label>
                          <Select
                            value={variety}
                            onChange={(e) => setVariety(e.target.value)}
                            required
                          >
                            <option value="">-- Select Variety --</option>
                            {[...varieties]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((v) => (
                                <option key={v.id} value={v.name}>
                                  {v.name}
                                </option>
                              ))
                            }
                          </Select>
                          {loadingStockLocations && (
                            <InfoText style={{ color: '#667eea' }}>
                              🔍 Checking stock locations...
                            </InfoText>
                          )}
                          {!loadingStockLocations && variety && stockLocations.length === 0 && (
                            <InfoText style={{ color: '#ef4444' }}>
                              ⚠️ No stock found for this variety
                            </InfoText>
                          )}
                        </FormGroup>

                        <FormGroup>
                          <Label>Bags</Label>
                          <Input
                            type="number"
                            value={bags}
                            onChange={(e) => setBags(e.target.value)}
                            placeholder="Number of bags"
                            min="0"
                          />
                        </FormGroup>
                      </FormRow>

                      {/* Conditional rendering based on stock locations */}
                      {shouldShowSingleLocationFields && (
                        <>
                          <SectionTitle>From Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu *</Label>
                              <Select
                                value={fromKunchinintuId}
                                onChange={(e) => {
                                  setFromKunchinintuId(e.target.value);
                                  setToKunchinintuId(e.target.value);
                                }}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {stockLocations.map((loc) => (
                                  <option key={loc.kunchinintuId} value={loc.kunchinintuId}>
                                    {loc.kunchinintuCode} - {loc.warehouseName} ({loc.stockBags} bags)
                                  </option>
                                ))}
                              </Select>
                              <InfoText style={{ color: '#10b981' }}>
                                ✓ Auto-populated (only one location has stock)
                              </InfoText>
                            </FormGroup>

                            <FormGroup>
                              <Label>From Warehouse *</Label>
                              <Select
                                value={fromWarehouseId}
                                onChange={(e) => setFromWarehouseId(e.target.value)}
                                required
                              >
                                <option value="">Select Warehouse</option>
                                {stockLocations.map((loc) => (
                                  <option key={loc.warehouseId} value={loc.warehouseId}>
                                    {loc.warehouseName}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>
                        </>
                      )}

                      {shouldShowMultipleLocationFields && (
                        <>
                          <SectionTitle>From Kunchinittu Warehouse</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu Warehouse *</Label>
                              <Select
                                value={fromKunchinintuId ? `${fromKunchinintuId}-${fromWarehouseId}` : ''}
                                onChange={(e) => {
                                  const [kId, wId] = e.target.value.split('-');
                                  setFromKunchinintuId(kId);
                                  setFromWarehouseId(wId);
                                  setToKunchinintuId(kId);
                                }}
                                required
                              >
                                <option value="">Select From Location</option>
                                {stockLocations.map((loc) => (
                                  <option
                                    key={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                    value={`${loc.kunchinintuId}-${loc.warehouseId}`}
                                  >
                                    {loc.kunchinintuCode} - {loc.warehouseName} ({loc.stockBags} bags)
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>
                        </>
                      )}

                      {!shouldShowSingleLocationFields && !shouldShowMultipleLocationFields && variety && !loadingStockLocations && (
                        <>
                          <SectionTitle>From Location</SectionTitle>
                          <FormRow>
                            <FormGroup>
                              <Label>From Kunchinittu *</Label>
                              <Select
                                value={fromKunchinintuId}
                                onChange={(e) => {
                                  setFromKunchinintuId(e.target.value);
                                  setFromWarehouseId('');
                                  setToKunchinintuId(e.target.value);
                                }}
                                required
                              >
                                <option value="">Select Kunchinittu</option>
                                {activeKunchinittus.map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>

                            <FormGroup>
                              <Label>From Warehouse *</Label>
                              <Select
                                value={fromWarehouseId}
                                onChange={(e) => setFromWarehouseId(e.target.value)}
                                required
                                disabled={!fromKunchinintuId}
                              >
                                <option value="">
                                  {fromKunchinintuId ? 'Select Warehouse' : 'Select Kunchinittu First'}
                                </option>
                                {availableFromWarehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.code}
                                  </option>
                                ))}
                              </Select>
                            </FormGroup>
                          </FormRow>
                        </>
                      )}

                      <SectionTitle>To Outturn</SectionTitle>
                      <FormRow>
                        <FormGroup>
                          <Label>Outturn Number *</Label>
                          <Select
                            value={toOutturnId}
                            onChange={(e) => {
                              setToOutturnId(e.target.value);
                              const selected = outturns.find(o => o.id === parseInt(e.target.value));
                              if (selected) {
                                setVariety(selected.allottedVariety);
                              }
                            }}
                            required
                          >
                            <option value="">Select Outturn</option>
                            {outturns.filter(o => !o.isCleared).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.code} - {o.allottedVariety}
                              </option>
                            ))}
                          </Select>
                        </FormGroup>
                      </FormRow>
                    </FormSection>
                  </>
                )}

                {/* Cutting Fields for Shifting */}
                <FormSection>
                  <FormRow>
                    <FormGroup>
                      <Label>Moisture (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={moisture}
                        onChange={(e) => setMoisture(e.target.value)}
                        placeholder="e.g., 12.5"
                        min="0"
                        max="100"
                      />
                    </FormGroup>

                    <FormGroup>
                      <Label>Cutting (multiply)</Label>
                      <TwoColumnRow>
                        <SmallInput
                          type="number"
                          value={cuttingValue1}
                          onChange={(e) => setCuttingValue1(e.target.value)}
                          placeholder="e.g., 20"
                          min="0"
                        />
                        <SmallInput
                          type="number"
                          value={cuttingValue2}
                          onChange={(e) => setCuttingValue2(e.target.value)}
                          placeholder="e.g., 10"
                          min="0"
                        />
                      </TwoColumnRow>
                      {/* Cutting total hidden as per user request */}
                    </FormGroup>
                  </FormRow>
                </FormSection>
              </>
            )}

            {/* Common Measurement Fields */}
            <FormSection>
              <SectionTitle>Measurements</SectionTitle>
              <FormRow>
                <FormGroup>
                  <Label>WB No <span style={{ color: '#ef4444' }}>*</span></Label>
                  <Input
                    type="text"
                    value={wbNo}
                    onChange={(e) => setWbNo(e.target.value.toUpperCase())}
                    placeholder="Weighbridge number"
                    required
                    style={{ textTransform: 'uppercase' }}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Gross Weight (kg) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={grossWeight}
                    onChange={(e) => setGrossWeight(e.target.value)}
                    placeholder="0.00"
                    required
                    min="0"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Tare Weight (kg) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tareWeight}
                    onChange={(e) => setTareWeight(e.target.value)}
                    placeholder="0.00"
                    required
                    min="0"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Net Weight (kg)</Label>
                  <Input
                    type="text"
                    value={netWeight}
                    disabled
                    style={{
                      background: '#f3f4f6',
                      fontWeight: 'bold',
                      color: '#059669'
                    }}
                  />
                  <InfoText>Auto-calculated (Gross - Tare)</InfoText>
                </FormGroup>

                <FormGroup>
                  <Label>Lorry Number *</Label>
                  <Input
                    type="text"
                    value={lorryNumber}
                    onChange={(e) => setLorryNumber(e.target.value.toUpperCase())}
                    placeholder="Vehicle registration"
                    required
                    style={{ textTransform: 'uppercase' }}
                  />
                </FormGroup>
              </FormRow>
            </FormSection>

            {/* Remarks */}
            <FormSection>
              <FormGroup>
                <Label>Remarks</Label>
                <Input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes"
                />
              </FormGroup>
            </FormSection>

            {/* Action Buttons */}
            <ButtonGroup>
              <Button type="button" className="secondary" onClick={handleReset}>
                Reset Form
              </Button>
              <Button type="submit" className="primary" disabled={isSubmitting || loading}>
                {isSubmitting ? 'Saving...' : `Save ${movementType === 'purchase' ? 'Purchase' : 'Shifting'}`}
              </Button>
            </ButtonGroup>

            {user?.role === 'staff' && (
              <InfoText style={{ textAlign: 'center', marginTop: '1rem' }}>
                ℹ️ Your entries will be pending until approved by Manager/Admin
              </InfoText>
            )}
          </form>
        </FormCard>

        {/* Right Side Info Panel */}
        <InfoPanel>
          <InfoTitle>📋 Quick Info</InfoTitle>

          {/* Show stock locations when in shifting mode */}
          {movementType === 'shifting' && variety && (
            <InfoTable>
              <InfoTableHeader>
                Variety Stock Locations
              </InfoTableHeader>
              <InfoTableBody>
                <InfoTableRow>
                  <InfoTableLabel>Variety:</InfoTableLabel>
                  <InfoTableValue>{variety}</InfoTableValue>
                </InfoTableRow>
                {loadingStockLocations && (
                  <InfoTableRow>
                    <InfoTableValue style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>
                      Loading stock locations...
                    </InfoTableValue>
                  </InfoTableRow>
                )}
                {!loadingStockLocations && stockLocations.length === 0 && (
                  <InfoTableRow>
                    <InfoTableValue style={{ textAlign: 'center', color: '#ef4444', padding: '1rem' }}>
                      ⚠️ No stock found for this variety
                    </InfoTableValue>
                  </InfoTableRow>
                )}
                {!loadingStockLocations && stockLocations.length > 0 && (
                  <>
                    <InfoTableRow>
                      <InfoTableValue style={{ color: '#10b981', fontWeight: 'bold', padding: '0.5rem' }}>
                        ✓ {stockLocations.length} {stockLocations.length === 1 ? 'location' : 'locations'} available
                      </InfoTableValue>
                    </InfoTableRow>
                    {stockLocations.map((loc, index) => (
                      <InfoTableRow key={`${loc.kunchinintuId}-${loc.warehouseId}`}>
                        <InfoTableLabel>Option {index + 1}:</InfoTableLabel>
                        <InfoTableValue>
                          <div style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#667eea' }}>{loc.kunchinintuCode}</div>
                            <div style={{ color: '#6b7280' }}>{loc.warehouseName}</div>
                            <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.25rem' }}>
                              {loc.stockBags} bags
                            </div>
                          </div>
                        </InfoTableValue>
                      </InfoTableRow>
                    ))}
                  </>
                )}
              </InfoTableBody>
            </InfoTable>
          )}

          {/* Show variety allocations for purchase mode */}
          {movementType === 'purchase' && variety && (
            <InfoTable>
              <InfoTableHeader>
                Variety Allocation
              </InfoTableHeader>
              <InfoTableBody>
                <InfoTableRow>
                  <InfoTableLabel>Variety:</InfoTableLabel>
                  <InfoTableValue>{variety}</InfoTableValue>
                </InfoTableRow>
                {varietyAllocations.length === 0 && (
                  <InfoTableRow>
                    <InfoTableValue style={{ textAlign: 'center', color: '#ef4444', padding: '1rem' }}>
                      ⚠️ No kunchinittu allocated for this variety
                    </InfoTableValue>
                  </InfoTableRow>
                )}
                {varietyAllocations.length > 0 && (
                  <>
                    <InfoTableRow>
                      <InfoTableValue style={{ color: '#10b981', fontWeight: 'bold', padding: '0.5rem' }}>
                        ✓ {varietyAllocations.length} {varietyAllocations.length === 1 ? 'option' : 'options'} available
                      </InfoTableValue>
                    </InfoTableRow>
                    {varietyAllocations.map((allocation, idx) => (
                      <InfoTableRow key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                        <InfoTableLabel>Option {idx + 1}:</InfoTableLabel>
                        <InfoTableValue>
                          <div style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#667eea' }}>{allocation.kunchinintuCode}</div>
                            <div style={{ color: '#6b7280' }}>{allocation.warehouseName}</div>
                          </div>
                        </InfoTableValue>
                      </InfoTableRow>
                    ))}
                  </>
                )}
              </InfoTableBody>
            </InfoTable>
          )}

          {/* Cutting Calculation table hidden as per user request */}

          {netWeight !== '0.00' && (
            <InfoTable>
              <InfoTableHeader style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                Net Weight
              </InfoTableHeader>
              <InfoTableBody>
                <InfoTableRow>
                  <InfoTableLabel>Gross Weight:</InfoTableLabel>
                  <InfoTableValue>{grossWeight} kg</InfoTableValue>
                </InfoTableRow>
                <InfoTableRow>
                  <InfoTableLabel>Tare Weight:</InfoTableLabel>
                  <InfoTableValue>{tareWeight} kg</InfoTableValue>
                </InfoTableRow>
                <InfoTableRow>
                  <InfoTableLabel>Net Weight:</InfoTableLabel>
                  <InfoTableValue style={{ color: '#f59e0b', fontSize: '1.2rem', fontWeight: 700 }}>
                    {netWeight} kg
                  </InfoTableValue>
                </InfoTableRow>
              </InfoTableBody>
            </InfoTable>
          )}
        </InfoPanel>
      </MainGrid>
      ) : null}
      {isDetailOpen && selectedDetailEntry && (
        <SampleEntryDetailModal
          detailEntry={selectedDetailEntry}
          detailMode="full"
          progressiveMode={true}
          completedLotsOrder={true}
          showCollectorLoginPair={true}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedDetailEntry(null);
          }}
        />
      )}
      {isTransitDetailOpen && selectedTransitDetail && (() => {
        const { entry, inspection } = selectedTransitDetail;
        const transitDetail = inspection?.lorryTransitDetail;
        const lorryNum = inspection?.lorryNumber || '-';
        const varietyName = inspection?.variety?.name || entry.variety || '-';
        const brokerName = entry.broker?.name || entry.brokerName || '-';
        const partyName = entry.fromParty?.name || entry.partyName || '-';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div style={{
              background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '600px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden', border: '1px solid #e2e8f0', animation: 'pulse 0.15s ease-out'
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff'
              }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>🚚 Lorry Transit Details — {lorryNum.toUpperCase()}</h3>
                <button
                  onClick={() => {
                    setIsTransitDetailOpen(false);
                    setSelectedTransitDetail(null);
                  }}
                  style={{
                    background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
                
                {/* Lorry Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>PARTY</span>
                    <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold' }}>{partyName}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>BROKER</span>
                    <span style={{ fontSize: '12px', color: '#0f172a' }}>{brokerName}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>VARIETY</span>
                    <span style={{ fontSize: '12px', color: '#0f172a' }}>{varietyName}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>LORRY NUMBER</span>
                    <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>{lorryNum.toUpperCase()}</span>
                  </div>
                </div>

                {/* Place Details */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>
                    📍 Placement Location Details
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Place Type</span>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>
                        {transitDetail?.placeType ? transitDetail.placeType.toUpperCase() : '-'}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Placement Date</span>
                      <span style={{ fontSize: '12px', color: '#0f172a' }}>
                        {transitDetail?.placeDate ? new Date(transitDetail.placeDate).toLocaleDateString('en-GB') : '-'}
                      </span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Allotted Location / Outturn</span>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold' }}>
                        {transitDetail?.placeWarehouse?.name || transitDetail?.placeKunchinittuData?.name || (transitDetail?.outturn ? `${transitDetail.outturn.code} (${transitDetail.outturn.allottedVariety})` : null) || '-'}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Place Status</span>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                        backgroundColor: transitDetail?.placeStatus === 'approved' ? '#dcfce7' : transitDetail?.placeStatus === 'pending' ? '#fef3c7' : '#f1f5f9',
                        color: transitDetail?.placeStatus === 'approved' ? '#166534' : transitDetail?.placeStatus === 'pending' ? '#92400e' : '#475569'
                      }}>
                        {transitDetail?.placeStatus ? transitDetail.placeStatus.toUpperCase() : 'NONE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weigh Bridge Details */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>
                    ⚖️ Weigh Bridge Details
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>WB Number</span>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold' }}>{transitDetail?.wbNo || '-'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Mill Weight Bridge</span>
                      <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{transitDetail?.millWeightBridge?.name || transitDetail?.partyWbName || '-'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Gross Weight</span>
                      <span style={{ fontSize: '12px', color: '#0f172a' }}>{transitDetail?.grossWeight ? `${transitDetail.grossWeight} Kg` : '-'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Tare Weight</span>
                      <span style={{ fontSize: '12px', color: '#0f172a' }}>{transitDetail?.tareWeight ? `${transitDetail.tareWeight} Kg` : '-'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Net Weight</span>
                      <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>{transitDetail?.netWeight ? `${transitDetail.netWeight} Kg` : '-'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>WB Status</span>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                        backgroundColor: transitDetail?.wbStatus === 'approved' ? '#dcfce7' : transitDetail?.wbStatus === 'pending' ? '#fef3c7' : '#f1f5f9',
                        color: transitDetail?.wbStatus === 'approved' ? '#166534' : transitDetail?.wbStatus === 'pending' ? '#92400e' : '#475569'
                      }}>
                        {transitDetail?.wbStatus ? transitDetail.wbStatus.toUpperCase() : 'NONE'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => {
                    setIsTransitDetailOpen(false);
                    setSelectedTransitDetail(null);
                  }}
                  style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #cbd5e1',
                    borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#334155'
                  }}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </Container>
  );
};

export default Arrivals;
