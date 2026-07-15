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

const Arrivals: React.FC = () => {
  const { user } = useAuth();
  const { warehouses, kunchinittus, varieties, fetchWarehouses, fetchKunchinittus, fetchVarieties } = useLocation();

  // Form state
  const [slNo, setSlNo] = useState('');
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

  const [arrivalsActiveSubTab, setArrivalsActiveSubTab] = useState<'entry' | 'transit'>('transit');
  const [inTransitEntries, setInTransitEntries] = useState<any[]>([]);
  const [loadingTransit, setLoadingTransit] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transitNextCursor, setTransitNextCursor] = useState<string | null>(null);
  const [transitHasNextPage, setTransitHasNextPage] = useState(false);
  const [transitPageSize, setTransitPageSize] = useState(20);
  const [transitTotalLoaded, setTransitTotalLoaded] = useState(0);
  const [transitSearchQuery, setTransitSearchQuery] = useState('');
  const [transitDebouncedSearch, setTransitDebouncedSearch] = useState('');
  const searchTimerRef = useRef<any>(null);

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

  // Reset and refetch when search or pageSize changes
  useEffect(() => {
    if (arrivalsActiveSubTab === 'transit') {
      setTransitNextCursor(null);
      setTransitTotalLoaded(0);
      fetchInTransitEntries(null, false);
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
                    <tr style={{ background: 'linear-gradient(135deg, #1565c0, #1e88e5)', color: '#fff', borderBottom: '2px solid #0d47a1' }}>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Date</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Broker</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Party</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Lorry Number</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Variety</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Moisture</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Bags</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Linked</th>
                      <th style={{ padding: '10px 12px', fontWeight: '700' }}>STATUS</th>
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
                          flatTrips.push({
                            entry: e,
                            inspection: insp,
                            isPlaceholder: false,
                          });
                        });
                      });

                      return flatTrips.map((trip, idx) => {
                        const { entry, inspection, isPlaceholder } = trip;
                        const dateVal = isPlaceholder ? entry.entryDate : (inspection.inspectionDate || entry.entryDate);
                        const lorryNum = isPlaceholder ? (entry.lorryNumber || 'Pending Lorry') : (inspection.lorryNumber || 'Pending Lorry');
                        const bagsLoaded = isPlaceholder ? entry.bags : (inspection.bags || inspection.bagsLoaded || '-');
                        const isLinked = !isPlaceholder && !!inspection.linkedPattiRate;

                        return (
                          <React.Fragment key={isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`}>
                            {idx > 0 && (
                              <tr key={`spacer-${idx}`} style={{ height: '20px', backgroundColor: '#e2e8f0' }}>
                                <td colSpan={9} style={{ padding: 0, height: '20px', backgroundColor: '#f1f5f9', border: 'none' }} />
                              </tr>
                            )}
                            <tr style={{
                              borderBottom: '1px solid #cbd5e1',
                              background: idx % 2 === 0 ? '#f1f5f9' : '#ffffff'
                            }}>
                              <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: '700', color: '#111827', borderRight: '1px solid #cbd5e1' }}>{new Date(dateVal).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '700', color: '#111827', borderRight: '1px solid #cbd5e1' }}>{entry.brokerName}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '800', color: '#111827', borderRight: '1px solid #cbd5e1' }}>{entry.partyName || '-'}</td>
                              <td style={{ padding: '9px 12px', color: '#0369a1', fontWeight: '900', borderRight: '1px solid #cbd5e1' }}>
                                {lorryNum.toUpperCase()}
                              </td>
                              <td style={{ padding: '9px 12px', fontWeight: '800', color: '#111827', borderRight: '1px solid #cbd5e1' }}>{entry.variety}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '800', color: '#b91c1c', borderRight: '1px solid #cbd5e1', textAlign: 'left' }}>
                                {isPlaceholder ? '-' : (inspection.moisture ? `${Number(inspection.moisture)}%` : '-')}
                              </td>
                              <td style={{ padding: '9px 12px', fontWeight: '800', color: '#111827', borderRight: '1px solid #cbd5e1' }}>{bagsLoaded}</td>
                              <td style={{ padding: '9px 12px', fontWeight: '800', borderRight: '1px solid #cbd5e1', textAlign: 'center', color: '#111827' }}>{isLinked ? '✅' : '⏳'}</td>
                              <td style={{ padding: '9px 12px' }}>
                                {isLinked ? (
                                  <span style={{ color: '#16a34a', fontWeight: '800', background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '10px' }}>LINKED</span>
                                ) : (
                                  <span style={{ color: '#d97706', fontWeight: '800', background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '10px' }}>PENDING</span>
                                )}
                              </td>
                            </tr>
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
      ) : (
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
                  <Label>WB No *</Label>
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
      )}
    </Container>
  );
};

export default Arrivals;
