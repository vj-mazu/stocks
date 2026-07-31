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

  const renderUnifiedStatus = (item: any, isPlaceholder = false) => {
    if (isPlaceholder) return '-';

    // 1. WB Status
    const wbStatus = item.wbStatus || item.lorryTransitDetail?.wbStatus || 'none';
    let wbBadge = null;
    if (wbStatus === 'approved') {
      wbBadge = <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>WB: Approved</span>;
    } else if (wbStatus === 'pending') {
      wbBadge = <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>WB: Pending</span>;
    } else if (wbStatus === 'rejected') {
      wbBadge = <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>WB: Rejected</span>;
    } else {
      wbBadge = <span style={{ background: '#f1f5f9', color: '#64748b', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>WB: Required</span>;
    }

    // 2. QS Status
    const params = item.inventoryQualityParameters || 
                   item.lorryTransitDetail?.inventoryQualityParameters || 
                   (item.physicalInspections && item.physicalInspections[0]?.inventoryQualityParameters) || 
                   [];
    const lotApproved = params.some((p: any) => p.type === 'lot_avg' && p.status === 'approved');
    const fullApproved = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');
    const lotPending = params.some((p: any) => p.type === 'lot_avg' && p.status === 'pending');
    const fullPending = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'pending');
    const lotRejected = params.some((p: any) => p.type === 'lot_avg' && p.status === 'rejected');
    const fullRejected = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'rejected');
    
    const hasLotRecheck = params.some((p: any) => p.type === 'lot_avg' && p.status === 'rejected' && p.rejectReason && p.rejectReason.startsWith('RECHECK:'));
    const hasFullRecheck = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'rejected' && p.rejectReason && p.rejectReason.startsWith('RECHECK:'));

    let qsBadge = null;
    if (lotApproved && fullApproved) {
      qsBadge = <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>QS: Approved</span>;
    } else if (hasLotRecheck || hasFullRecheck) {
      qsBadge = <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>QS: Recheck</span>;
    } else if (lotRejected || fullRejected) {
      qsBadge = <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>QS: Rejected</span>;
    } else if (lotPending || fullPending) {
      qsBadge = <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>QS: Pending</span>;
    } else {
      qsBadge = <span style={{ background: '#f1f5f9', color: '#64748b', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>QS: Pending</span>;
    }

    // 3. GD Status
    const placeStatus = item.placeStatus || item.lorryTransitDetail?.placeStatus || 'none';
    let gdBadge = null;
    if (placeStatus === 'approved') {
      gdBadge = <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>GD: Approved</span>;
    } else if (placeStatus === 'placed') {
      gdBadge = <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>GD: Placed</span>;
    } else if (placeStatus === 'pending') {
      gdBadge = <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>GD: Pending</span>;
    } else {
      gdBadge = <span style={{ background: '#f1f5f9', color: '#64748b', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold', fontSize: '9px', width: '80px', display: 'inline-block', textAlign: 'center' }}>GD: None</span>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
        {wbBadge}
        {qsBadge}
        {gdBadge}
      </div>
    );
  };



  const { warehouses, kunchinittus, varieties, fetchWarehouses, fetchKunchinittus, fetchVarieties } = useLocation();







  const [slNo, setSlNo] = useState('');
  const [inTransitDateFilter, setInTransitDateFilter] = useState('');
  const [inTransitBrokerFilter, setInTransitBrokerFilter] = useState('');
  const [inTransitVarietyFilter, setInTransitVarietyFilter] = useState('');
  const [inTransitPage, setInTransitPage] = useState(1);
  const [inTransitFilteredCount, setInTransitFilteredCount] = useState(0);
  const [bmbDateFilter, setBmbDateFilter] = useState('');
  const [bmbBrokerFilter, setBmbBrokerFilter] = useState('');
  const [bmbVarietyFilter, setBmbVarietyFilter] = useState('');
  const [bmbSearchQuery, setBmbSearchQuery] = useState('');
  const [bmbPage, setBmbPage] = useState(1);

  const [selectedDetailEntry, setSelectedDetailEntry] = useState<any>(null);
  const [isQualitySamplingModalOpen, setIsQualitySamplingModalOpen] = useState(false);
  const [qualitySamplingEntry, setQualitySamplingEntry] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);



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
    fetchUsers();



  }, []);



 



  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsersList(res.data.success ? res.data.users : []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };



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



    ((parseFloat(grossWeight || 0) - parseFloat(tareWeight || 0)) || 0).toFixed(2) : '0.00';







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



  



  // New WB fields (Sute, Date, Party WB toggle)



  const [wbDate, setWbDate] = useState(new Date().toISOString().split('T')[0]);



  const [wbSute, setWbSute] = useState('');






  const [partyWbEnabled, setPartyWbEnabled] = useState<'yes' | 'no' | ''>('');
  const [wbConfirmDialog, setWbConfirmDialog] = useState<any>(null);
  const [partyWbNo, setPartyWbNo] = useState('');
  const [partyWbDate, setPartyWbDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyGrossWeight, setPartyGrossWeight] = useState('');
  const [partyTareWeight, setPartyTareWeight] = useState('');
  const [partyNetWeight, setPartyNetWeight] = useState('');
  const [partySute, setPartySute] = useState('');



  



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







  // Mill Quality Parameters State



  const [expandedInventoryQuality, setExpandedInventoryQuality] = useState<string | null>(null);



  const [inventoryQualityType, setInventoryQualityType] = useState<'lot_avg' | 'full_lorry_avg'>('lot_avg');



  const [inventoryQualityForm, setInventoryQualityForm] = useState({
    moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
    mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
    smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: '',
    wbR: '', wbBk: '', wbT: '', reportedByUserId: ''
  });

  const [wbEnabled, setWbEnabled] = useState(false);

  const [inventoryQualityToggle, setInventoryQualityToggle] = useState({
    dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
  });

  // Auto-calculate WB (T) = WB (R) + WB (BK)
  useEffect(() => {
    const wbR = wbEnabled ? (parseFloat(inventoryQualityForm.wbR) || 0) : 0;
    const wbBk = wbEnabled ? (parseFloat(inventoryQualityForm.wbBk) || 0) : 0;
    const wbT = (wbR + wbBk).toString();
    if (inventoryQualityForm.wbT !== wbT) {
      setInventoryQualityForm(prev => ({ ...prev, wbT }));
    }
  }, [inventoryQualityForm.wbR, inventoryQualityForm.wbBk, wbEnabled]);

  const activeRecheck = useMemo(() => {
    if (!qualitySamplingEntry) return null;
    const entryData = qualitySamplingEntry;
    const params = entryData.inventoryQualityParameters || 
                   entryData.lorryTransitDetail?.inventoryQualityParameters || 
                   (entryData.physicalInspections && entryData.physicalInspections[0]?.inventoryQualityParameters) || 
                   [];
    return params.find((p: any) => p.type === inventoryQualityType && p.status === 'rejected' && p.rejectReason && p.rejectReason.startsWith('RECHECK:'));
  }, [qualitySamplingEntry, inventoryQualityType]);

  const filteredBmbEntries = useMemo(() => {
    return bandMalalEntries.filter((entry) => {
      // 1. Date filter
      if (bmbDateFilter) {
        const entryDate = entry.date ? new Date(entry.date).toISOString().split('T')[0] : '';
        if (entryDate !== bmbDateFilter) return false;
      }
      // 2. Broker filter
      if (bmbBrokerFilter) {
        const brokerName = (entry.broker || '').toLowerCase();
        if (brokerName !== bmbBrokerFilter.toLowerCase()) return false;
      }
      // 3. Variety filter
      if (bmbVarietyFilter) {
        const varietyName = (entry.variety || '').toLowerCase();
        if (!varietyName.includes(bmbVarietyFilter.toLowerCase())) return false;
      }
      // 4. Search query
      if (bmbSearchQuery) {
        const q = bmbSearchQuery.toLowerCase();
        const broker = (entry.broker || '').toLowerCase();
        const variety = (entry.variety || '').toLowerCase();
        const party = (entry.partyName || entry.fromLocation || '').toLowerCase();
        const lorry = (entry.lorryNumber || '').toLowerCase();
        const wb = (entry.wbNo || '').toLowerCase();
        if (
          !broker.includes(q) &&
          !variety.includes(q) &&
          !party.includes(q) &&
          !lorry.includes(q) &&
          !wb.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [bandMalalEntries, bmbDateFilter, bmbBrokerFilter, bmbVarietyFilter, bmbSearchQuery]);

  const paginatedBmbEntries = useMemo(() => {
    const start = (bmbPage - 1) * 12;
    return filteredBmbEntries.slice(start, start + 12);
  }, [filteredBmbEntries, bmbPage]);

  // Auto-pagination: Switch to the last page when a new entry is added
  const prevBmbLengthRef = useRef(0);
  useEffect(() => {
    if (bandMalalEntries.length > prevBmbLengthRef.current) {
      const lastPage = Math.max(1, Math.ceil(filteredBmbEntries.length / 12));
      setBmbPage(lastPage);
    }
    prevBmbLengthRef.current = bandMalalEntries.length;
  }, [bandMalalEntries.length, filteredBmbEntries.length]);

  const prevTransitLengthRef = useRef(0);
  useEffect(() => {
    if (inTransitEntries.length > prevTransitLengthRef.current) {
      const lastPage = Math.max(1, Math.ceil(inTransitFilteredCount / 12));
      setInTransitPage(lastPage);
    }
    prevTransitLengthRef.current = inTransitEntries.length;
  }, [inTransitEntries.length, inTransitFilteredCount]);

  useEffect(() => {
    if (!isQualitySamplingModalOpen || !qualitySamplingEntry) return;
    if (activeRecheck) {
      setInventoryQualityForm({
        moisture: String(activeRecheck.moisture ?? ''),
        dryMoisture: String(activeRecheck.dryMoisture ?? ''),
        cutting: String(activeRecheck.cutting ?? ''),
        bend: String(activeRecheck.bend ?? ''),
        grains: String(activeRecheck.grains ?? ''),
        mix: String(activeRecheck.mix ?? ''),
        sMix: String(activeRecheck.sMix ?? ''),
        lMix: String(activeRecheck.lMix ?? ''),
        kandu: String(activeRecheck.kandu ?? ''),
        oil: String(activeRecheck.oil ?? ''),
        sk: String(activeRecheck.sk ?? ''),
        wbR: String(activeRecheck.wbR ?? ''),
        wbBk: String(activeRecheck.wbBk ?? ''),
        wbT: String(activeRecheck.wbT ?? ''),
        smell: String(activeRecheck.smell ?? ''),
        paddyWb: String(activeRecheck.paddyWb ?? ''),
        pColor: String(activeRecheck.pColor ?? ''),
        kadiga: String(activeRecheck.kadiga ?? 'No'),
        remarks: String(activeRecheck.remarks ?? ''),
        reportedByUserId: String(activeRecheck.reportedByUserId ?? activeRecheck.createdBy ?? '')
      });
      setInventoryQualityToggle({
        dryMoisture: activeRecheck.dryMoisture ? 'Y' : 'N',
        sMix: activeRecheck.sMix ? 'Y' : 'N',
        lMix: activeRecheck.lMix ? 'Y' : 'N',
        paddyWb: activeRecheck.paddyWb ? 'Y' : 'N',
        kadiga: activeRecheck.kadiga === 'Yes' ? 'Yes' : 'No',
        smellHas: activeRecheck.smell ? 'Yes' : 'No'
      });
      setWbEnabled(!!activeRecheck.wbR || !!activeRecheck.wbBk);
    } else {
      setInventoryQualityForm({
        moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
        mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
        wbR: '', wbBk: '', wbT: '',
        smell: '', paddyWb: '', pColor: '', kadiga: 'No', remarks: '',
        reportedByUserId: ''
      });
      setInventoryQualityToggle({
        dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
      });
      setWbEnabled(false);
    }
  }, [inventoryQualityType, isQualitySamplingModalOpen, qualitySamplingEntry, activeRecheck]);







  const sanitizeInventoryQualityField = (field: string, value: string) => {



    let clean = String(value || '');







    if (field === 'cutting' || field === 'bend') {



      clean = clean.replace(/[^0-9×xX]/g, '').replace(/[xX]/g, '×');



      const xCount = (clean.match(/×/g) || []).length;



      if (xCount > 1) {



        const idx = clean.indexOf('×');



        clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');



      }



      if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {



        clean = `${clean}×`;



      }



      const parts = clean.split('×');



      const first = (parts[0] || '').substring(0, 1);



      const second = (parts[1] || '').substring(0, 4);



      clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;



    } else if (['moisture', 'dryMoisture', 'grains', 'mix', 'sMix', 'lMix', 'sk', 'kandu', 'oil', 'paddyWb'].includes(field)) {



      clean = clean.replace(/[^0-9.]/g, '');



      const parts = clean.split('.');



      if (parts.length > 2) {



        clean = `${parts[0]}.${parts.slice(1).join('')}`;



      }



      const maxLength = field === 'grains' ? 3 : 6;



      if (clean.length > maxLength) {



        clean = clean.slice(0, maxLength);



      }



    }







    return clean;



  };







  const [rejectInventoryQualityId, setRejectInventoryQualityId] = useState<string | null>(null);



  const [rejectInventoryQualityReason, setRejectInventoryQualityReason] = useState('');

  const [placeConfirmDialog, setPlaceConfirmDialog] = useState<{
    trip: any;
    action: 'move' | 'reject';
    warnings?: string[];
  } | null>(null);

  const [placeRejectReason, setPlaceRejectReason] = useState('');
  const [wbRejectReason, setWbRejectReason] = useState('');







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



        pageSize: 1000,



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



      toast.success('Godown approved!');



      fetchInTransitEntries();



      fetchBandMalalEntries();



    } catch (err: any) {



      toast.error(err.response?.data?.error || 'Failed to approve place');



    }
  };


  const handleMoveToBmb = (trip: any) => {
    const { entry, inspection, isPlaceholder } = trip;
    if (isPlaceholder) return;

    const transitDetail = inspection?.lorryTransitDetail;
    const placeStatus = transitDetail?.placeStatus || 'none';

    if (placeStatus !== 'placed' && placeStatus !== 'pending') {
      toast.error('Place/Godown details must be added before moving to Band Mall Book.');
      return;
    }

    const wbStatus = transitDetail?.wbStatus || 'none';
    const params = (inspection?.inventoryQualityParameters) || (entry?.inventoryQualityParameters) || (transitDetail?.inventoryQualityParameters) || [];
    const hasApprovedQuality = params.some((p: any) => p.status === 'approved');

    const warnings: string[] = [];
    if (wbStatus !== 'approved') {
      warnings.push('Weighbridge details are not approved.');
    }
    if (!hasApprovedQuality) {
      warnings.push('Quality parameters are not approved.');
    }

    setPlaceConfirmDialog({
      trip,
      action: 'move',
      warnings: warnings.length > 0 ? warnings : undefined
    });
  };

  const handleRejectPlace = (trip: any) => {
    setPlaceConfirmDialog({
      trip,
      action: 'reject'
    });
  };







  const handleApproveWb = async (id: string, detail?: any) => {



    if (detail && !wbConfirmDialog) {



      setWbConfirmDialog({ id, action: 'approve', detail });



      return;



    }



    try {



      const token = localStorage.getItem('token');



      await axios.post(`${API_URL}/arrivals/${id}/approve-wb`, {}, {



        headers: { Authorization: `Bearer ${token}` }



      });



      toast.success('Weigh Bridge approved!');



      setWbConfirmDialog(null);



      fetchInTransitEntries();



      fetchBandMalalEntries();



    } catch (err: any) {



      toast.error(err.response?.data?.error || 'Failed to approve WB');



    }



  };







  const handleRejectWb = async (id: string, reasonParam?: string) => {
    const reason = reasonParam !== undefined ? reasonParam : prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/arrivals/${id}/reject-wb`, { reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weigh Bridge rejected!');
      setWbConfirmDialog(null);
      setWbRejectReason('');
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



      const data = response.data.arrivals || [];

      data.forEach((entry: any) => {

        if (entry.debugError) {

          console.error(`[BMB Backend Diagnostic for ID ${entry.id}]:`, entry.debugError);

          if (entry.debugStack) {

            console.error(entry.debugStack);

          }

        }

      });

      setBandMalalEntries(data);



    } catch (err) {



      console.error('Error fetching Band Mall entries:', err);



    } finally {



      setLoadingTransit(false);



    }



  }, []);







  // Mill Quality Parameters Authorization



  const canAddInventoryQuality = user && (



    (user.role === 'staff' && ['mill', 'location'].includes(user.staffType)) ||



    user.role === 'inventory_staff' ||



    user.role === 'inventory_head' ||



    user.effectiveRole === 'inventory_head' ||



    user.role === 'admin' ||



    user.role === 'owner' ||



    user.role === 'manager' ||



    user.role === 'ceo' ||



    user.effectiveRole === 'ceo'



  );







  const canApproveInventoryQuality = user && ['admin', 'owner', 'manager', 'ceo'].includes(user.role);







  // Mill Quality Parameters Handlers



  const handleSubmitInventoryQuality = async (transitDetailId: string, showToast = true): Promise<boolean> => {



    // Client-side validation matching Physical Inspection pattern - every required field



    if (!inventoryQualityForm.moisture.trim()) {



      toast.error('Moisture is required');



      return false;



    }



    if (!inventoryQualityForm.dryMoisture || !inventoryQualityForm.dryMoisture.trim()) {
      toast.error('Dry Moisture value is required');
      return false;
    }



    if (!inventoryQualityForm.cutting.trim()) {



      toast.error('Cutting is required');



      return false;



    }



    if (!inventoryQualityForm.bend.trim()) {



      toast.error('Bend is required');



      return false;



    }



    if (!inventoryQualityForm.mix.trim()) {



      toast.error('Mix is required');



      return false;



    }



    if (!inventoryQualityForm.grains.trim()) {



      toast.error('Grains Count is required');



      return false;



    }



    if (!inventoryQualityForm.kandu.trim()) {



      toast.error('Kandu is required');



      return false;



    }



    if (!inventoryQualityForm.oil.trim()) {



      toast.error('Oil is required');



      return false;



    }



    if (!inventoryQualityForm.sk.trim()) {



      toast.error('SK is required');



      return false;



    }



    if (!inventoryQualityForm.sMix || !inventoryQualityForm.sMix.trim()) {
      toast.error('S Mix value is required');
      return false;
    }

    if (!inventoryQualityForm.lMix || !inventoryQualityForm.lMix.trim()) {
      toast.error('L Mix value is required');
      return false;
    }



    if (!inventoryQualityToggle.smellHas || inventoryQualityToggle.smellHas.trim() === '') {



      toast.error('Smell Yes/No is required');



      return false;



    }



    if (inventoryQualityToggle.smellHas === 'Yes' && !inventoryQualityForm.smell.trim()) {



      toast.error('Smell type is required');



      return false;



    }



    if (!inventoryQualityForm.pColor.trim()) {



      toast.error('Paddy discolor is required');



      return false;



    }



    if (!inventoryQualityForm.kadiga || !inventoryQualityForm.kadiga.trim()) {
      toast.error('Kadiga value is required');
      return false;
    }

    if (!inventoryQualityToggle.paddyWb || inventoryQualityToggle.paddyWb.trim() === '') {
      toast.error('Paddy WB Yes/No is required');
      return false;
    }

    if (inventoryQualityToggle.paddyWb === 'Yes' && (!inventoryQualityForm.paddyWb || !inventoryQualityForm.paddyWb.trim())) {
      toast.error('Paddy WB value is required');
      return false;
    }







    try {



      const token = localStorage.getItem('token');



      const response = await axios.post(



        `${API_URL}/arrivals/bmb/${transitDetailId}/inventory-quality`,



        {



          type: inventoryQualityType,



          ...inventoryQualityForm



        },



        {



          headers: { Authorization: `Bearer ${token}` }



        }



      );



      if (showToast) {
        const isApproved = response?.data?.qualityParam?.status === 'approved' || user?.role === 'admin';
        if (isApproved) {
          toast.success('Mill quality parameters saved & approved successfully!');
        } else {
          toast.success(response?.data?.message || 'Mill quality parameters submitted successfully');
        }
      }



      setExpandedInventoryQuality(null);



      // Reset form



      setInventoryQualityForm({



        moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',



        mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',



        smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''



      });



      fetchBandMalalEntries();
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit mill quality parameters');
      return false;
    }
  };



  // Handler for the Quality Sampling popup modal "Next/Save" button

  // Submit Lot Avg only — saves data without transitioning to Full Lorry
  const handleSubmitLotAvg = async () => {
    if (!qualitySamplingEntry) return;
    const transitDetailId =
      qualitySamplingEntry?.transitDetailId ||
      qualitySamplingEntry?.lorryTransitDetail?.id ||
      qualitySamplingEntry?.id;
    if (!transitDetailId) {
      toast.error('Could not find Transit Detail ID. Please try again.');
      return;
    }
    const success = await handleSubmitInventoryQuality(String(transitDetailId), false);
    if (!success) return;
    const isApproved = user?.role === 'admin';
    if (isApproved) {
      toast.success('Before Unloading (Lot Avg) saved & approved successfully.');
    } else {
      toast.success('Before Unloading (Lot Avg) saved successfully.');
    }
    setIsQualitySamplingModalOpen(false);
    setQualitySamplingEntry(null);
    fetchInTransitEntries();
    fetchBandMalalEntries();
  };

  // Next on Lot Avg: saves Lot Avg (if data exists) AND transitions to Full Lorry
  // Submit on Full Lorry: validates, saves, and closes modal
  const handleQualitySamplingNext = async () => {
    if (!qualitySamplingEntry) return;
    const transitDetailId =
      qualitySamplingEntry?.transitDetailId ||
      qualitySamplingEntry?.lorryTransitDetail?.id ||
      qualitySamplingEntry?.id;
    if (!transitDetailId) {
      toast.error('Could not find Transit Detail ID. Please try again.');
      return;
    }

    // Check if any quality data was entered in Lot Avg form
    const qualityFields = ['moisture', 'dryMoisture', 'cutting', 'bend', 'grains', 'mix', 'sMix', 'lMix', 'kandu', 'oil', 'sk', 'pColor', 'paddyWb'];
    const hasLotAvgData = qualityFields.some(
      field => inventoryQualityForm[field as keyof typeof inventoryQualityForm]?.toString().trim() !== ''
    );

    if (inventoryQualityType === 'lot_avg') {
      if (hasLotAvgData) {
        // Save Lot Avg data to backend, then transition to Full Lorry
        const success = await handleSubmitInventoryQuality(String(transitDetailId), false);
        if (!success) return;
        const isApproved = user?.role === 'admin';
        if (isApproved) {
          toast.info('Before Unloading (Lot Avg) saved & approved. Please enter Full Lorry Avg (Gutti) parameters.');
        } else {
          toast.info('Before Unloading (Lot Avg) saved. Please enter Full Lorry Avg (Gutti) parameters.');
        }
      } else {
        // No data entered — skip submission, will add later after Full Lorry is approved
        toast.info('Lot Avg data will be added later. Please enter Full Lorry Avg parameters now.');
      }
      // Transition to full lorry avg next
      setInventoryQualityType('full_lorry_avg');
      // Reset form fields for full lorry entry
      setInventoryQualityForm({
        moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
        mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
        wbR: '', wbBk: '', wbT: '',
        smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
      });
      setInventoryQualityToggle({
        dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
      });
      setWbEnabled(false);
    } else {
      // Full Lorry Avg — submit and close
      const success = await handleSubmitInventoryQuality(String(transitDetailId));
      if (!success) return;
      setIsQualitySamplingModalOpen(false);
      setQualitySamplingEntry(null);
    }
    // Refresh both tabs
    fetchInTransitEntries();
    fetchBandMalalEntries();
  };







  const handleApproveInventoryQuality = async (qualityId: string | number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mill quality parameters approved successfully');
      
      if (selectedDetailEntry) {
        const response = await axios.get(`${API_URL}/sample-entries/${selectedDetailEntry.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedDetailEntry(response.data);
      }
      fetchBandMalalEntries();
      fetchInTransitEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve mill quality parameters');
    }
  };

  const handleRejectInventoryQualityDirect = async (qualityId: string | number, reason: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/reject`,
        { rejectReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mill quality parameters rejected successfully');
      if (selectedDetailEntry) {
        const response = await axios.get(`${API_URL}/sample-entries/${selectedDetailEntry.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedDetailEntry(response.data);
      }
      fetchBandMalalEntries();
      fetchInTransitEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject mill quality parameters');
    }
  };

  const handleRecheckInventoryQualityDirect = async (qualityId: string | number, reason: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/arrivals/bmb/inventory-quality/${qualityId}/recheck`,
        { rejectReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mill quality parameters status set to Recheck');
      if (selectedDetailEntry) {
        const response = await axios.get(`${API_URL}/sample-entries/${selectedDetailEntry.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedDetailEntry(response.data);
      }
      fetchBandMalalEntries();
      fetchInTransitEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to request recheck');
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



      toast.success('Mill quality parameters rejected');



      setRejectInventoryQualityId(null);



      setRejectInventoryQualityReason('');



      fetchBandMalalEntries();



    } catch (error: any) {



      toast.error(error.response?.data?.error || 'Failed to reject mill quality parameters');



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







      {/* Subtab selection for all roles, with Arrivals Data Entry hidden for Location/Mill staff */}



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



        {!(user && (user as any).role === 'staff' && ['mill', 'location'].includes((user as any).staffType)) && (



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
        )}
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







          {/* Search + Top Filters Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            
            {/* Date Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Date</label>
              <input
                type="date"
                value={inTransitDateFilter}
                onChange={(e) => { setInTransitDateFilter(e.target.value); setInTransitPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {/* Broker Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Broker Name</label>
              <select
                value={inTransitBrokerFilter}
                onChange={(e) => { setInTransitBrokerFilter(e.target.value); setInTransitPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', height: '30px' }}
              >
                <option value="">-- All Brokers --</option>
                {[...brokersList]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Variety Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Variety</label>
              <select
                value={inTransitVarietyFilter}
                onChange={(e) => { setInTransitVarietyFilter(e.target.value); setInTransitPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', height: '30px' }}
              >
                <option value="">-- All Varieties --</option>
                {varieties?.map((v: any) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => { setInTransitDateFilter(''); setInTransitBrokerFilter(''); setInTransitVarietyFilter(''); setTransitSearchQuery(''); setInTransitPage(1); }}
                style={{ width: '100%', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
              >
                Clear Filters
              </button>
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
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Mill WB Name</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Net Weight</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Sute Net Wt</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Godown</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Lorry Number</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Status</th>
                      <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Actions</th>



                      



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

                      // Apply top filters
                      const filteredTrips = flatTrips.filter(trip => {
                        const dateVal = trip.isPlaceholder ? trip.entry.entryDate : (trip.inspection?.inspectionDate || trip.entry.entryDate);
                        const dateStr = dateVal ? new Date(dateVal).toISOString().split('T')[0] : '';
                        if (inTransitDateFilter && dateStr !== inTransitDateFilter) return false;
                        
                        if (inTransitBrokerFilter) {
                          const bName = (trip.entry?.brokerName || '').toLowerCase();
                          if (!bName.includes(inTransitBrokerFilter.toLowerCase())) return false;
                        }
                        
                        if (inTransitVarietyFilter) {
                          const vName = (trip.entry?.variety || '').toLowerCase();
                          if (!vName.includes(inTransitVarietyFilter.toLowerCase())) return false;
                        }
                        return true;
                      });

                      // Update total count for pagination footer (outside IIFE scope)
                      if (inTransitFilteredCount !== filteredTrips.length) {
                        setTimeout(() => setInTransitFilteredCount(filteredTrips.length), 0);
                      }

                      // Slicing to 12 records per page
                      const paginatedTrips = filteredTrips.slice((inTransitPage - 1) * 12, inTransitPage * 12);

                      return paginatedTrips.map((trip, idx) => {



                        const { entry, inspection, isPlaceholder } = trip;



                        const dateVal = isPlaceholder ? entry.entryDate : (inspection.inspectionDate || entry.entryDate);



                        const lorryNum = isPlaceholder ? (entry.lorryNumber || 'Pending Lorry') : (inspection.lorryNumber || 'Pending Lorry');



                        const bagsLoaded = isPlaceholder ? entry.bags : (inspection.bags || inspection.bagsLoaded || '-');



                        const isLinked = !isPlaceholder && !!inspection.linkedPattiRate;







                        const transitDetail = isPlaceholder ? null : inspection?.lorryTransitDetail;



                        const placeStatus = transitDetail?.placeStatus || 'none';



                        const wbStatus = transitDetail?.wbStatus || 'none';



                        const wbNoVal = (transitDetail?.wbInputType === 'mill') ? (transitDetail?.wbNo || '-') : '-';



                        const netWeightVal = transitDetail?.netWeight || '-';



                        const suteVal = transitDetail?.sute || null;



                        const displayNetWeight = transitDetail?.suteNetWeight !== undefined && transitDetail?.suteNetWeight !== null ? 
                          `${transitDetail.suteNetWeight} Kg` : (netWeightVal !== '-' && netWeightVal !== null ? `${netWeightVal} Kg` : '-');







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
                              background: (() => {
                                const qParams = (inspection?.inventoryQualityParameters) || (entry?.inventoryQualityParameters) || (transitDetail?.inventoryQualityParameters) || [];
                                const isWbPending = wbStatus === 'pending';
                                const isQsPending = qParams.some((p: any) => p.status === 'pending');
                                return (isWbPending || isQsPending) ? '#fffbeb' : (idx % 2 === 0 ? '#ffffff' : '#f9f9f9');
                              })()
                            }}>



                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>{(inTransitPage - 1) * 12 + idx + 1}</td>



                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{new Date(dateVal).toLocaleDateString('en-GB')}</td>



                              <td style={{ border: '1px solid #000', padding: '5px', wordBreak: 'break-word', fontWeight: 'bold' }}>
                                <span style={{ background: '#f0fdfa', color: '#0f766e', border: '1px solid #ccfbf1', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  {entry.brokerName || '-'}
                                </span>
                              </td>



                              <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', wordBreak: 'break-word' }}>



                                <button



                                  onClick={async () => {
                                    const entryId = entry.id || `${idx}`;
                                    setDetailLoadingId(entryId);
                                    try {
                                      const sampleEntryId = entry.id;
                                      if (sampleEntryId) {
                                        const token = localStorage.getItem('token');
                                        const res = await axios.get(`${API_URL}/sample-entries/${sampleEntryId}`, {
                                          headers: { Authorization: `Bearer ${token}` }
                                        });
                                        const fullSampleEntry = res.data.entry || res.data.sampleEntry || res.data;
                                        const mergedEntry = {
                                          ...fullSampleEntry,
                                          ...entry,
                                          ...transitDetail,
                                          id: sampleEntryId,
                                          lorryNumber: lorryNum,
                                          partyWbName: transitDetail?.partyWbName || null,
                                          qualityParameters: fullSampleEntry.qualityParameters || entry.qualityParameters || null,
                                          qualityAttemptDetails: fullSampleEntry.qualityAttemptDetails || entry.qualityAttemptDetails || []
                                        };
                                        setSelectedDetailEntry(mergedEntry);
                                        setIsDetailOpen(true);
                                      }
                                    } catch (err) {
                                      console.error("Error fetching detail sample entry:", err);
                                      setSelectedDetailEntry({
                                        ...entry,
                                        lorryNumber: lorryNum
                                      });
                                      setIsDetailOpen(true);
                                    } finally {
                                      setDetailLoadingId(null);
                                    }
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



                                  {detailLoadingId === (entry.id || `${idx}`) ? (
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>Loading...</span>
                                  ) : (
                                    entry.partyName || '-'
                                  )}



                                </button>



                              </td>



                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>



                                <div><div style={{ fontWeight: '700' }}>{bagsLoaded}</div>{entry.packaging ? <div style={{ fontSize: '10px', color: '#64748b' }}>{entry.packaging} Kg</div> : ''}</div>



                              </td>



                              <td style={{ border: '1px solid #000', padding: '5px' }}>{entry.variety || '-'}</td>



                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700', color: '#b91c1c' }}>
                                {isPlaceholder ? '-' : (() => {
                                  const iqParams = (inspection?.inventoryQualityParameters) || (entry?.inventoryQualityParameters) || (inspection?.lorryTransitDetail?.inventoryQualityParameters) || [];
                                  const approvedFull = iqParams.find((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');
                                  const approvedLot = iqParams.find((p: any) => p.type === 'lot_avg' && p.status === 'approved');
                                  const iqSource = approvedLot || approvedFull;
                                  return iqSource && iqSource.moisture ? `${Number(iqSource.moisture)}%` : '-';
                                })()}
                              </td>

                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                                {isPlaceholder ? '-' : (() => {
                                  const iqParams = (inspection?.inventoryQualityParameters) || (entry?.inventoryQualityParameters) || (inspection?.lorryTransitDetail?.inventoryQualityParameters) || [];
                                  const approvedFull = iqParams.find((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');
                                  const approvedLot = iqParams.find((p: any) => p.type === 'lot_avg' && p.status === 'approved');
                                  const iqSource = approvedLot || approvedFull;
                                  return iqSource && iqSource.cutting ? iqSource.cutting : '-';
                                })()}
                              </td>



                              {/* 1. WB Number */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', verticalAlign: 'middle' }}>
                                {transitDetail && (wbStatus === 'approved' || wbStatus === 'pending') ? (
                                  <span style={{ 
                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                    background: wbStatus === 'approved' ? '#dcfce7' : '#fef3c7',
                                    color: wbStatus === 'approved' ? '#166534' : '#92400e'
                                  }}>
                                    {wbNoVal}
                                    {wbStatus === 'pending' && ' ⏳'}
                                  </span>
                                ) : wbStatus === 'rejected' ? (
                                  <div>
                                    <span style={{ 
                                      padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                      background: '#fee2e2',
                                      color: '#991b1b'
                                    }}>
                                      ❌ Rejected
                                    </span>
                                    {transitDetail?.wbRejectReason && (
                                      <div style={{ fontSize: '9px', color: '#b91c1c', marginTop: '4px', fontWeight: 'bold', maxWidth: '120px', wordBreak: 'break-word', margin: '4px auto 0 auto' }}>
                                        Reason: {transitDetail.wbRejectReason}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                                <div style={{ 
                                  marginTop: transitDetail && (wbStatus === 'approved' || wbStatus === 'pending' || wbStatus === 'rejected') ? '4px' : '0px', 
                                  borderTop: transitDetail && (wbStatus === 'approved' || wbStatus === 'pending' || wbStatus === 'rejected') ? '1px solid #e2e8f0' : 'none', 
                                  paddingTop: transitDetail && (wbStatus === 'approved' || wbStatus === 'pending' || wbStatus === 'rejected') ? '3px' : '0px' 
                                }}>
                                  {(() => {
                                    const tDetail = transitDetail;
                                    const wbSt = tDetail?.wbStatus || '';
                                    const isApprov = user && ['admin', 'ceo', 'manager', 'inventory_head'].includes((user as any).role);
                                    if (wbSt === 'pending') {
                                      return isApprov ? (
                                        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                          <button onClick={() => handleApproveWb(inspection?.id || entry?.id, transitDetail)} style={{ padding: '2px 4px', border: 'none', borderRadius: '3px', background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '9px', cursor: 'pointer' }}>Approve WB</button>
                                          <button onClick={() => handleRejectWb(inspection?.id || entry?.id, transitDetail)} style={{ padding: '2px 4px', border: 'none', borderRadius: '3px', background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '9px', cursor: 'pointer' }}>Reject WB</button>
                                        </div>
                                      ) : (<span style={{ fontSize: '9px', color: '#92400e', fontWeight: 'bold' }}>⏳ Pending</span>);
                                    } else if (wbSt === 'approved') {
                                      return <div><span style={{ fontSize: '9px', color: '#16a34a', fontWeight: 'bold' }}>✅ WB Done</span></div>;
                                    } else {
                                      const isRejected = wbSt === 'rejected';
                                      return (
                                        <button onClick={() => {
                                          const rk = isPlaceholder ? 'p-' + entry.id : 'i-' + (inspection?.id || entry?.id);
                                          if (selectedLorryForWB === rk) {
                                            setSelectedLorryForWB(null);
                                            setSelectedLorryEntries([]);
                                            setSelectedLorryInspection(null);
                                          } else {
                                            setSelectedLorryForWB(rk);
                                            setSelectedLorryForPlace(null);
                                            setSelectedLorryEntries([entry]);
                                            setSelectedLorryInspection(inspection || entry);
                                            setWbInputType(isRejected ? 'mill' : (tDetail?.wbInputType || 'mill'));
                                            setWbNumber(isRejected ? '' : (tDetail?.wbNo || ''));
                                            setMillWbId(isRejected ? '' : (tDetail?.millWbId || ''));
                                            setWbGrossWeight(isRejected ? '' : (tDetail?.grossWeight || ''));
                                            setWbTareWeight(isRejected ? '' : (tDetail?.tareWeight || ''));
                                            setWbNetWeight(isRejected ? '' : (tDetail?.netWeight || ''));
                                            setWbSute(isRejected ? '' : (tDetail?.sute || ''));
                                            setPartyWbEnabled(isRejected ? '' : (tDetail?.partyWbEnabled || ''));
                                            setPartyWbNo(isRejected ? '' : (tDetail?.partyWbNo || ''));
                                            setPartyWbDate(new Date().toISOString().split('T')[0]);
                                            setPartyWbName(isRejected ? '' : (tDetail?.partyWbName || ''));
                                            setPartyGrossWeight(isRejected ? '' : (tDetail?.partyGrossWeight || ''));
                                            setPartyTareWeight(isRejected ? '' : (tDetail?.partyTareWeight || ''));
                                            setPartyNetWeight(isRejected ? '' : (tDetail?.partyNetWeight || ''));
                                            setPartySute(isRejected ? '' : (tDetail?.partySute || ''));
                                            setWbDate(new Date().toISOString().split('T')[0]);
                                          }
                                        }} style={{ padding: '2px 5px', border: 'none', borderRadius: '3px', background: selectedLorryForWB === (isPlaceholder ? 'p-' + entry.id : 'i-' + (inspection?.id || entry?.id)) ? '#64748b' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 'bold', fontSize: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{isRejected ? '⚖️ Add fresh WB' : '⚖️ WB'}</button>
                                      );
                                    }
                                  })()}
                                </div>
                              </td>

                              {/* 2. Mill WB Name */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: '#0369a1' }}>
                                {transitDetail?.wbInputType === 'party' ? (
                                  transitDetail.partyWbName ? (
                                    <span style={{ fontWeight: 'bold', color: '#0369a1' }}>{transitDetail.partyWbName}</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>-</span>
                                  )
                                ) : (
                                  (transitDetail?.millWeightBridge?.name || millWBList.find(w => String(w.id) === String(transitDetail?.millWbId))?.name) ? (
                                    <span style={{ fontWeight: 'bold', color: '#0369a1' }}>{transitDetail?.millWeightBridge?.name || millWBList.find(w => String(w.id) === String(transitDetail?.millWbId))?.name}</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>-</span>
                                  )
                                )}
                              </td>

                              {/* 3. Net Weight */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>
                                <div>{netWeightVal !== '-' && netWeightVal !== null ? `${netWeightVal} Kg` : '-'}</div>
                                {suteVal && <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>({suteVal} Kg)</div>}
                              </td>

                              {/* 4. Sute Net Wt */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700' }}>
                                {transitDetail?.suteNetWeight ? `${transitDetail.suteNetWeight} Kg` : '-'}
                              </td>

                              {/* 5. Godown */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px', verticalAlign: 'middle' }}>
                                {transitDetail && (placeStatus === 'approved' || placeStatus === 'pending' || placeStatus === 'placed') ? (
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
                                  </span>
                                ) : null}
                                <div style={{ marginTop: transitDetail && (placeStatus === 'approved' || placeStatus === 'pending' || placeStatus === 'placed') ? '4px' : '0px' }}>                                  {placeStatus === 'approved' ? (
                                    <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>📍 Done</span>
                                  ) : placeStatus === 'placed' ? (
                                     <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>📍 Placed ✅</span>
                                  ) : (user?.role === 'staff' && (user?.staffType === 'location' || user?.staffType === 'mill')) ? null : (
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
                                          setPlaceWarehouseId('');
                                          setPlaceKunchinittuId('');
                                          setPlaceOutturnId('');
                                          setPlaceType('production');
                                        }
                                      }}
                                      style={{
                                        padding: '3px 6px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        background: selectedLorryForPlace === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) ? '#64748b' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        fontSize: '10px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      📍 Godown
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* 6. Lorry Number */}
                              <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '800', color: '#1e40af', textAlign: 'center' }}>{lorryNum.toUpperCase()}</td>

                              {/* 5.5 Unified Status */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px', verticalAlign: 'middle' }}>
                                {renderUnifiedStatus(isPlaceholder ? entry : { ...entry, ...(inspection || {}) }, isPlaceholder)}
                              </td>

                              {/* 7. Actions */}
                              <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px', verticalAlign: 'middle' }}>
                                {(() => {
                                  const params = (inspection?.inventoryQualityParameters) || (entry?.inventoryQualityParameters) || (inspection?.lorryTransitDetail?.inventoryQualityParameters) || [];
                                  const isFullApproved = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');
                                  const isLotApproved = params.some((p: any) => p.type === 'lot_avg' && p.status === 'approved');
                                  const isLotPending = params.some((p: any) => p.type === 'lot_avg' && p.status === 'pending');
                                  const isFullPending = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'pending');
                                  const hasLotRejected = params.some((p: any) => p.type === 'lot_avg' && p.status === 'rejected');

                                  let btnText = '🔬 Quality Parameters';
                                  let btnBg = '#a855f7';
                                  let isBtnDisabled = false;
                                  if (isLotApproved && isFullApproved) {
                                    btnText = '✅ Sampling Complete';
                                    btnBg = '#059669';
                                    isBtnDisabled = true;
                                  } else if (isLotApproved) {
                                    btnText = '🔬 Add Gutti';
                                    btnBg = '#0284c7';
                                  } else if (isLotPending) {
                                    btnText = '⏳ Lot Pending';
                                    btnBg = '#d97706';
                                    isBtnDisabled = true;
                                  } else if (isFullApproved) {
                                    btnText = '🔬 Add Lot Avg';
                                    btnBg = '#a855f7';
                                  } else if (isFullPending) {
                                    btnText = '⏳ Full Lorry Pending';
                                    btnBg = '#b45309';
                                    isBtnDisabled = true;
                                  }

                                  const canMoveToBmb = transitDetail && placeStatus === 'placed' && !(user?.role === 'staff' && (user?.staffType === 'location' || user?.staffType === 'mill'));

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                      <button
                                        disabled={isBtnDisabled}
                                        onClick={() => {
                                          setQualitySamplingEntry(isPlaceholder ? entry : { ...entry, ...(inspection || {}) });
                                          setIsQualitySamplingModalOpen(true);
                                          const hasLot = params.some((p: any) => p.type === 'lot_avg' && p.status !== 'rejected');
                                          setInventoryQualityType(!hasLot ? 'lot_avg' : 'full_lorry_avg');
                                          setInventoryQualityForm({
                                            moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
                                            mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
                                            wbR: '', wbBk: '', wbT: '',
                                            smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
                                          });
                                          setInventoryQualityToggle({
                                            dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
                                          });
                                        }}
                                        style={{
                                          padding: '3px 6px',
                                          background: isBtnDisabled ? '#94a3b8' : btnBg,
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
                                          fontSize: '10px',
                                          fontWeight: '600',
                                          width: '100%',
                                          whiteSpace: 'normal',
                                          lineHeight: '1.2',
                                          opacity: isBtnDisabled ? 0.8 : 1
                                        }}
                                      >
                                        {btnText}
                                      </button>
                                      {canMoveToBmb && (
                                        <button 
                                          onClick={() => handleMoveToBmb(trip)}
                                          style={{ padding: '3px 6px', border: 'none', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap', width: '100%' }}
                                        >
                                          🚚 Move to BMB
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>



                              


                            </tr>



                            



                            {/* COLLAPSIBLE WB ROW */}



                            {selectedLorryForWB === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) && (



                              <tr>



                                <td colSpan={ (((user as any)?.role === 'inventory_staff' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) ? 14 : 14 } style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>



                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>



                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>



                                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>⚖️ Add Weight Bridge for {lorryNum.toUpperCase()}</h4>






                                    </div>



                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '14px' }}>

                                      <div>

                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Date</label>

                                        <input

                                          type="date"

                                          value={wbDate}

                                          onChange={(e) => setWbDate(e.target.value)}

                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}

                                        />

                                      </div>




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



                                      






                                        <div>



                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Mill WB Name <span style={{ color: '#ef4444' }}>*</span></label>



                                          <select 



                                            value={millWbId}



                                            onChange={(e) => setMillWbId(e.target.value)}



                                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}



                                          >



                                            <option value="">Select Mill Weight Bridge</option>



                                            {millWBList?.map(wb => (



                                              <option key={wb.id} value={wb.id}>{wb.name}{wb.location ? ` (${wb.location})` : ''}</option>



                                            ))}



                                          </select>



                                        </div>






                                      



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



                                        <div>
                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Sute (Deduction)</label>
                                          <input 
                                            type="number"
                                            value={wbSute}
                                            onChange={(e) => setWbSute(e.target.value)}
                                            placeholder="Enter sute"
                                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Sute Net Wt</label>
                                          <div style={{ padding: '6px 8px', background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: '6px', fontWeight: '700', color: '#059669', fontSize: '12px', textAlign: 'center' }}>
                                            {((parseFloat(wbGrossWeight || 0) - parseFloat(wbTareWeight || 0) - parseFloat(wbSute || 0)) || 0).toFixed(2)} Kg
                                          </div>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Party WB</label>
                                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                              <input type="radio" name="partyWbEnabled" value="yes" checked={partyWbEnabled === 'yes'} onChange={() => setPartyWbEnabled('yes')} /> Yes
                                            </label>
                                            <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                              <input type="radio" name="partyWbEnabled" value="no" checked={partyWbEnabled === 'no'} onChange={() => setPartyWbEnabled('no')} /> No
                                            </label>
                                            {partyWbEnabled && (
                                              <button onClick={() => setPartyWbEnabled('')} style={{ fontSize: '10px', border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}>Clear</button>
                                            )}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%', paddingBottom: '2px' }}>
                                          <button 
                                            onClick={() => { setSelectedLorryForWB(null); setPartyWbNo(''); setPartyWbDate(new Date().toISOString().split('T')[0]); setPartyGrossWeight(''); setPartyTareWeight(''); setPartyNetWeight(''); setPartySute(''); }}
                                            style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                                          >
                                            Cancel
                                          </button>
                                          <button 
                                            onClick={async () => {
                                              if (!wbNumber || !millWbId) {
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
                                                  wbInputType: 'mill',
                                                  millWbId: millWbId ? Number(millWbId) : null,
                                                  partyWbName: partyWbEnabled === 'yes' ? partyWbName : null,
                                                  wbNo: wbNumber,                                               
                                                  grossWeight: Number(wbGrossWeight),
                                                  tareWeight: Number(wbTareWeight),
                                                  netWeight: wbNetWeight,
                                                  sute: wbSute || null,
                                                  partyWbEnabled: partyWbEnabled || null,
                                                  wbDate: wbDate || null,
                                                  partyGrossWeight: partyWbEnabled === 'yes' && partyGrossWeight ? Number(partyGrossWeight) : null,
                                                  partyTareWeight: partyWbEnabled === 'yes' && partyTareWeight ? Number(partyTareWeight) : null,
                                                  partyNetWeight: partyWbEnabled === 'yes' && partyNetWeight ? Number(partyNetWeight) : null,
                                                  partySute: partyWbEnabled === 'yes' && partySute ? Number(partySute) : null,
                                                  partyWbNo: partyWbEnabled === 'yes' ? partyWbNo : null,
                                                  partyWbDate: partyWbEnabled === 'yes' ? partyWbDate : null
                                                }, {
                                                  headers: { Authorization: `Bearer ${token}` }
                                                });

                                                const responseDetail = response?.data?.detail || response?.data?.entry || response?.data || {};
                                                const savedStatus = wbInputType === 'party' ? 'approved' : (responseDetail?.wbStatus || response?.data?.wbStatus || 'pending');
                                                const savedWbNo = responseDetail?.wbNo || response?.data?.wbNo || wbNumber;
                                                const savedNetWeight = responseDetail?.netWeight ?? response?.data?.netWeight ?? wbNetWeight;

                                                try {
                                                  setInTransitEntries(prev => applyWbSaveToEntries(prev, selectedLorryInspection?.id ?? entry.id, {
                                                    wbStatus: savedStatus,
                                                    wbNo: savedWbNo,
                                                    netWeight: savedNetWeight,
                                                    partyWbName: wbInputType === 'party' ? partyWbName : (responseDetail?.partyWbName || undefined),
                                                    wbInputType: 'mill',
                                                    millWbId: wbInputType === 'mill' ? Number(millWbId) : undefined,
                                                    grossWeight: Number(wbGrossWeight),
                                                    tareWeight: Number(wbTareWeight)
                                                  }));
                                                } catch (reactErr) {
                                                  console.error('In-Transit state update error:', reactErr);
                                                }

                                                if (savedStatus === 'approved') {
                                                  toast.success('Weight Bridge saved & approved successfully!');
                                                } else {
                                                  toast.success('Weight Bridge saved & submitted for approval!');
                                                }

                                                setSelectedLorryForWB(null);
                                                setSelectedLorryInspection(null);
                                                fetchInTransitEntries();
                                              } catch (error: any) {
                                                toast.error(error.response?.data?.error || 'Failed to submit WB');
                                              }
                                            }}
                                            style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: '#1e3a8a', color: '#fff', cursor: 'pointer' }}
                                          >
                                            Save Weight Bridge
                                          </button>
                                        </div>

                                    </div>

                                    {partyWbEnabled === 'yes' && (
                                      <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '2px solid #f59e0b', marginBottom: '14px' }}>
                                        <h5 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #fcd34d', paddingBottom: '6px' }}>
                                          &#x26A1; Party WeighBridge Details
                                        </h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Date</label>
                                            <input type="date" value={partyWbDate} onChange={(e) => setPartyWbDate(e.target.value)}
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Number</label>
                                            <input type="text" value={partyWbNo} onChange={(e) => setPartyWbNo(e.target.value.toUpperCase())} placeholder="Party WB No"
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Name</label>
                                            <input type="text" value={partyWbName} onChange={(e) => setPartyWbName(e.target.value)} placeholder="Party WB Name"
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Gross Weight (Kg)</label>
                                            <input type="number" value={partyGrossWeight}
                                              onChange={(e) => { const v = e.target.value; setPartyGrossWeight(v); if (v && partyTareWeight) setPartyNetWeight(String(Number(v) - Number(partyTareWeight))); }}
                                              placeholder="Party Gross" style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tare Weight (Kg)</label>
                                            <input type="number" value={partyTareWeight}
                                              onChange={(e) => { const v = e.target.value; setPartyTareWeight(v); if (partyGrossWeight && v) setPartyNetWeight(String(Number(partyGrossWeight) - Number(v))); }}
                                              placeholder="Party Tare" style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Net Weight (Kg)</label>
                                            <input type="text" value={partyNetWeight} disabled
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px', background: '#fef3c7' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sute (Deduction)</label>
                                            <input type="number" value={partySute} onChange={(e) => setPartySute(e.target.value)} placeholder="Party Sute"
                                              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                          </div>
                                          <div>
                                            <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sute Net Weight</label>
                                            <div style={{ padding: '6px 8px', background: '#fef3c7', border: '1.5px solid #d97706', borderRadius: '6px', fontWeight: '700', color: '#92400e', fontSize: '12px', textAlign: 'center' }}>
                                              {((parseFloat(partyGrossWeight || 0) - parseFloat(partyTareWeight || 0) - parseFloat(partySute || 0)) || 0).toFixed(2)} Kg
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}





                                  </div>



                                </td>



                              </tr>



                            )}



                            



                            {/* COLLAPSIBLE PLACE ROW */}



                            {selectedLorryForPlace === (isPlaceholder ? `p-${entry.id}` : `i-${inspection.id}`) && (



                              <tr>



                                <td colSpan={ (((user as any)?.role === 'inventory_staff' || (user as any)?.role === 'inventory_head' || (user as any)?.effectiveRole === 'inventory_head' || (user as any)?.role === 'ceo' || (user as any)?.effectiveRole === 'ceo' || (user as any)?.role === 'admin' || (user as any)?.role === 'manager') && !(user?.staffType === 'mill')) ? 14 : 14 } style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>



                                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>



                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>



                                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>📍 Set Godown Location for {lorryNum.toUpperCase()}</h4>



                                    </div>



                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>



                                      <div>



                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Godown Date</label>



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



                                            const isApproved = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'owner' || user?.role === 'ceo';
                                             if (isApproved) {
                                               toast.success('Godown details saved & approved successfully!');
                                             } else {
                                               toast.success('Godown submitted for approval!');
                                             }



                                            setSelectedLorryForPlace(null);



                                            setSelectedLorryEntries([]);



                                            setSelectedLorryInspection(null);



                                            fetchInTransitEntries();



                                          } catch (err: any) {



                                            toast.error(err.response?.data?.error || 'Failed to save Godown');



                                          }



                                        }}



                                        style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: '#1a237e', color: '#fff', cursor: 'pointer' }}



                                      >



                                        Save Godown



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







              {/* Client-side Pagination Footer */}
              {inTransitFilteredCount > 12 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <button 
                    disabled={inTransitPage <= 1} 
                    onClick={() => setInTransitPage(p => p - 1)} 
                    style={{ padding: '6px 12px', borderRadius: '4px', cursor: inTransitPage <= 1 ? 'not-allowed' : 'pointer', background: inTransitPage <= 1 ? '#f1f5f9' : 'white', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                    Page {inTransitPage} of {Math.ceil(inTransitFilteredCount / 12)} ({inTransitFilteredCount} records)
                  </span>
                  <button 
                    disabled={inTransitPage >= Math.ceil(inTransitFilteredCount / 12)} 
                    onClick={() => setInTransitPage(p => p + 1)} 
                    style={{ padding: '6px 12px', borderRadius: '4px', cursor: inTransitPage >= Math.ceil(inTransitFilteredCount / 12) ? 'not-allowed' : 'pointer', background: inTransitPage >= Math.ceil(inTransitFilteredCount / 12) ? '#f1f5f9' : 'white', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    Next
                  </button>
                </div>
              )}



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



          {/* BMB Search + Top Filters Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            {/* Search Query */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Search Broker/Party/Variety/Lorry/WB</label>
              <input
                type="text"
                placeholder="Search..."
                value={bmbSearchQuery}
                onChange={(e) => { setBmbSearchQuery(e.target.value); setBmbPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {/* Date Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Date</label>
              <input
                type="date"
                value={bmbDateFilter}
                onChange={(e) => { setBmbDateFilter(e.target.value); setBmbPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {/* Broker Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Broker Name</label>
              <select
                value={bmbBrokerFilter}
                onChange={(e) => { setBmbBrokerFilter(e.target.value); setBmbPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', height: '30px' }}
              >
                <option value="">-- All Brokers --</option>
                {[...brokersList]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Variety Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>Filter by Variety</label>
              <select
                value={bmbVarietyFilter}
                onChange={(e) => { setBmbVarietyFilter(e.target.value); setBmbPage(1); }}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', height: '30px' }}
              >
                <option value="">-- All Varieties --</option>
                {varieties?.map((v: any) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => { setBmbDateFilter(''); setBmbBrokerFilter(''); setBmbVarietyFilter(''); setBmbSearchQuery(''); setBmbPage(1); }}
                style={{ width: '100%', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            </div>
          </div>



          {loadingTransit ? (



            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>⏳ Loading...</div>



          ) : filteredBmbEntries.length === 0 ? (



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



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '12%' }}>Party</th>



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>No. of Bags</th>



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'left', width: '10%' }}>Variety</th>



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Moisture</th>



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '6%' }}>Cutting</th>



                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>WB Number</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Mill WB Name</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Net Weight</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '8%' }}>Sute Net Wt</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Godown</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '12%' }}>Lorry Number</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '10%' }}>Status</th>
                    <th style={{ border: '1px solid #000', padding: '5px', fontWeight: '700', textAlign: 'center', width: '5%' }}>Actions</th>



                  </tr>



                </thead>



                <tbody>



                  {paginatedBmbEntries.map((entry, idx) => {



                    const wbStatus = entry.wbStatus || 'none';



                    const wbNoVal = entry.wbNo || (wbStatus === 'none' ? '⚠️ Required' : '-');



                    const netWeightVal = entry.netWeight || 0;



                    const suteVal = entry.sute || null;



                    const displayNetWeight = entry.suteNetWeight !== undefined && entry.suteNetWeight !== null ? 
                      `${entry.suteNetWeight} Kg` : (netWeightVal ? `${netWeightVal} Kg` : '-');



                    const placeStatus = entry.placeStatus || 'none';



                    



                    // Format bags display (bags count + packaging size)



                    const bagsCount = entry.bags || '-';



                    const bagsKg = entry.packaging ? `${entry.packaging} Kg` : '';



                    



                    // Use getCuttingValue helper for cutting display



                    // ponytail: moisture/cutting from approved quality params



                    const iqParams = entry.inventoryQualityParameters || [];



                    const approvedFull = iqParams.find((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');



                    const approvedLot = iqParams.find((p: any) => p.type === 'lot_avg' && p.status === 'approved');



                    const iqSource = approvedLot || approvedFull;



                    const cuttingDisplay = iqSource ? (iqSource.cutting || '-') : '-';



                    



                    // Format moisture display



                    const moistureDisplay = iqSource ? `${iqSource.moisture || '-'}%` : '-';



                    



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



                        <tr style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: (() => {
                            const qParams = entry.inventoryQualityParameters || [];
                            const isWbPending = entry.wbStatus === 'pending';
                            const isQsPending = qParams.some((p: any) => p.status === 'pending');
                            return (isWbPending || isQsPending) ? '#fffbeb' : (idx % 2 === 0 ? '#fff' : '#f8fafc');
                          })()
                        }}>



                          {/* Column 1: SL No - persistent index from backend */}



                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600' }}>



                            {entry.slNo}



                          </td>



                          



                          {/* Column 2: Date */}



                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>



                            {entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}



                          </td>



                          



                          {/* Column 3: Broker */}
                          <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>
                            <span style={{ background: '#f0fdfa', color: '#0f766e', border: '1px solid #ccfbf1', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                              {entry.broker || '-'}
                            </span>
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



                                    // Build merged entry with clear field-level ownership:



                                    // - Sample entry level: shared data (partyName, broker, variety)



                                    // - Transit detail level: per-lorry data (WB info, place info)



                                    // IMPORTANT: Party WB data is PER-LORRY (transit detail level).



                                    // The sample entry API response may carry party WB data from



                                    // a different lorry — never inherit it at the sample entry level.



                                    const mergedEntry = {



                                      ...fullSampleEntry,



                                      ...entry,



                                      id: sampleEntryId,



                                      lorryNumber: entry.lorryNumber,



                                      isBandMalalBook: true,



                                      // Explicitly scope party WB to this lorry only



                                      partyWbName: entry.partyWbName || null,



                                      // Explicitly preserve sample entry quality data

                                      qualityParameters: fullSampleEntry.qualityParameters || entry.qualityParameters || null,

                                      qualityAttemptDetails: fullSampleEntry.qualityAttemptDetails || entry.qualityAttemptDetails || []



                                    };



                                    // Prevent nested sampleEntry from carrying another lorry's party WB data



                                    if (mergedEntry.sampleEntry) {



                                      mergedEntry.sampleEntry = {



                                        ...mergedEntry.sampleEntry,



                                        partyWbName: entry.partyWbName || null,



                                      };



                                    }



                                    setSelectedDetailEntry(mergedEntry);



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



                            <div><div style={{ fontWeight: '700' }}>{bagsCount}</div>{bagsKg && <div style={{ fontSize: '10px', color: '#64748b' }}>{bagsKg}</div>}</div>



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
                          
                          {/* Column 9: WB Number (Mill WB No) */}
                          <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {entry.wbNo && wbStatus !== 'rejected' ? (
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                background: wbStatus === 'approved' ? '#dcfce7' : wbStatus === 'pending' ? '#fef3c7' : '#f1f5f9',
                                color: wbStatus === 'approved' ? '#166534' : wbStatus === 'pending' ? '#92400e' : '#475569'
                              }}>
                                {entry.wbNo}{wbStatus === 'pending' ? ' ⏳' : ''}
                              </span>
                            ) : wbStatus === 'rejected' ? (
                              <div>
                                <span style={{
                                  padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                  background: '#fee2e2',
                                  color: '#991b1b'
                                }}>
                                  ❌ Rejected
                                </span>
                                {entry.wbRejectReason && (
                                  <div style={{ fontSize: '9px', color: '#b91c1c', marginTop: '4px', fontWeight: 'bold', maxWidth: '120px', wordBreak: 'break-word', margin: '4px auto 0 auto' }}>
                                    Reason: {entry.wbRejectReason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>{wbStatus === 'none' ? '⚠️ Required' : '-'}</span>
                            )}
                          </td>

                           {/* Column 11b: Mill WB Name */}
                           <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: '#0369a1' }}>
                             {entry.wbInputType === 'party' ? (
                               entry.partyWbName ? (
                                 <span style={{ fontWeight: 'bold', color: '#0369a1' }}>{entry.partyWbName}</span>
                               ) : (
                                 <span style={{ color: '#94a3b8' }}>-</span>
                               )
                             ) : (
                               (entry.millWeightBridge?.name || millWBList.find(w => String(w.id) === String(entry.millWbId))?.name) ? (
                                 <span style={{ fontWeight: 'bold', color: '#0369a1' }}>{entry.millWeightBridge?.name || millWBList.find(w => String(w.id) === String(entry.millWbId))?.name}</span>
                               ) : (
                                 <span style={{ color: '#94a3b8' }}>-</span>
                               )
                             )}
                           </td>
                           
                           {/* Column 12: Net Weight */}
                           <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>
                             <div>{entry.netWeight ? `${entry.netWeight} Kg` : '-'}</div>
                             {entry.sute && <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>({entry.sute} Kg)</div>}
                           </td>

                           {/* Column 11: Sute Net Wt */}
                           <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: '#d97706' }}>
                             {entry.suteNetWeight ? `${entry.suteNetWeight} Kg` : '-'}
                           </td>

                           {/* Column 10: Godown */}
                           <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontWeight: '600', color: '#7c3aed' }}>
                             {placeDisplay}
                           </td>

                           {/* Column 12: Lorry Number */}
                           <td style={{ border: '1px solid #000', padding: '5px', fontWeight: '800', color: '#1e40af', textAlign: 'center' }}>
                             {(entry.lorryNumber || 'N/A').toUpperCase()}
                           </td>

                           {/* Unified Status */}
                           <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '11px', verticalAlign: 'middle' }}>
                             {renderUnifiedStatus(entry)}
                           </td>




                          {/* Column 13: Actions */}



                            <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>



                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>



                                {/* Weight Bridge Actions */}
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>



                                    {wbStatus === 'pending' && isApprover ? (



                                      <>



                                        <button onClick={() => handleApproveWb(entry.id, detail)} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Approve</button>



                                        <button onClick={() => handleRejectWb(entry.id, detail)} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Reject</button>



                                      </>



                                    ) : wbStatus === 'pending' ? (



                                      <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>WB Pending</span>



                                    ) : wbStatus === 'approved' ? (



                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>



                                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✅ WB Approved</span>



                                        {entry.partyWbName && (



                                          <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold' }}>Party: {entry.partyWbName}</span>



                                        )}



                                      </div>



                                    ) : (



                                      <button onClick={() => {
                                        const lorry = (entry.lorryNumber || 'N/A').toUpperCase();
                                        if (selectedLorryForWB === lorry) {
                                          setSelectedLorryForWB(null);
                                          setSelectedLorryInspection(null);
                                        } else {
                                          setSelectedLorryForWB(lorry);
                                          setSelectedLorryInspection(entry);
                                          setWbInputType(entry.wbInputType || 'mill');
                                          setWbNumber(entry.wbNo || '');
                                          setMillWbId(entry.millWbId || '');
                                          setWbGrossWeight(entry.grossWeight || '');
                                          setWbTareWeight(entry.tareWeight || '');
                                          setWbNetWeight(entry.netWeight || '');
                                          setWbSute(entry.sute || '');
                                          setPartyWbEnabled(entry.partyWbEnabled || '');
                                          setPartyWbNo(entry.partyWbNo || '');
                                          setPartyWbDate(entry.partyWbDate || new Date().toISOString().split('T')[0]);
                                          setPartyWbName(entry.partyWbName || '');
                                          setPartyGrossWeight(entry.partyGrossWeight || '');
                                          setPartyTareWeight(entry.partyTareWeight || '');
                                          setPartyNetWeight(entry.partyNetWeight || '');
                                          setPartySute(entry.partySute || '');
                                          setWbDate(entry.wbDate || new Date().toISOString().split('T')[0]);
                                        }
                                      }} style={{ padding: '4px 6px', border: 'none', borderRadius: '4px', background: selectedLorryForWB === (entry.lorryNumber || 'N/A').toUpperCase() ? '#64748b' : 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>Add WB</button>
                                  )}
                                  </div>



                                {/* Mill Quality Button */}



                                 {canAddInventoryQuality && (() => {



                                   const params = entry.inventoryQualityParameters || [];



                                   const isFullApproved = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'approved');



                                   const isLotApproved = params.some((p: any) => p.type === 'lot_avg' && p.status === 'approved');



                                   const isFullPending = params.some((p: any) => p.type === 'full_lorry_avg' && p.status === 'pending');



                                   const isLotPending = params.some((p: any) => p.type === 'lot_avg' && p.status === 'pending');



                                   



                                    let btnText = '🔬 Quality Parameters';
                                    let btnBg = '#a855f7';
                                    let isBtnDisabled = false;

                                    if (isFullApproved) {
                                       btnText = '✅ Quality Approved';
                                       btnBg = '#059669';
                                       isBtnDisabled = true;
                                     } else if (isFullPending) {
                                       btnText = '⏳ Full Lorry Avg Pending';
                                       btnBg = '#b45309';
                                       isBtnDisabled = true;
                                     } else {
                                       btnText = '🔬 Add Gutti';
                                       btnBg = '#0284c7';
                                     }



                                   return (



                                     <button



                                       disabled={isBtnDisabled}



                                       onClick={() => {
                                         setQualitySamplingEntry(entry);
                                         setIsQualitySamplingModalOpen(true);
                                         setInventoryQualityType('full_lorry_avg');
                                         setInventoryQualityForm({
                                           moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '',
                                           mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '',
                                           wbR: '', wbBk: '', wbT: '',
                                           smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: ''
                                         });
                                         setInventoryQualityToggle({
                                           dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No'
                                         });
                                       }}



                                       style={{



                                         padding: '6px 10px',



                                         background: expandedInventoryQuality === entry.transitDetailId ? '#9333ea' : btnBg,



                                         color: '#fff',



                                         border: 'none',



                                         borderRadius: '6px',



                                         cursor: isBtnDisabled ? 'not-allowed' : 'pointer',



                                         opacity: isBtnDisabled ? 0.8 : 1,



                                         fontSize: '11px',



                                         fontWeight: '600',



                                         width: '100%',



                                          whiteSpace: 'normal',
                                          lineHeight: '1.2'



                                       }}



                                     >



                                       {btnText}



                                     </button>



                                   );



                                 })()}



                              </div>



                            </td>



                        </tr>


                        {selectedLorryForWB === (entry.lorryNumber || 'N/A').toUpperCase() && selectedLorryInspection?.id === entry.id && (
                          <tr>
                            <td colSpan={14} style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '13px', fontWeight: 'bold' }}>⚖️ Add Weight Bridge for {(entry.lorryNumber || 'N/A').toUpperCase()}</h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '14px' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Date</label>
                                    <input
                                      type="date"
                                      value={wbDate}
                                      onChange={(e) => setWbDate(e.target.value)}
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                  </div>
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
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Mill WB Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select 
                                      value={millWbId}
                                      onChange={(e) => setMillWbId(e.target.value)}
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    >
                                      <option value="">Select Mill Weight Bridge</option>
                                      {millWBList?.map(wb => (
                                        <option key={wb.id} value={wb.id}>{wb.name}{wb.location ? ` (${wb.location})` : ''}</option>
                                      ))}
                                    </select>
                                  </div>
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
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Sute (Deduction)</label>
                                    <input 
                                      type="number"
                                      value={wbSute}
                                      onChange={(e) => setWbSute(e.target.value)}
                                      placeholder="Enter sute"
                                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #cbd5e1', borderRadius: '6px' }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Sute Net Wt</label>
                                    <div style={{ padding: '6px 8px', background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: '6px', fontWeight: '700', color: '#059669', fontSize: '12px', textAlign: 'center' }}>
                                      {((parseFloat(wbGrossWeight || 0) - parseFloat(wbTareWeight || 0) - parseFloat(wbSute || 0)) || 0).toFixed(2)} Kg
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Party WB</label>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <input type="radio" name="partyWbEnabled" value="yes" checked={partyWbEnabled === 'yes'} onChange={() => setPartyWbEnabled('yes')} /> Yes
                                      </label>
                                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <input type="radio" name="partyWbEnabled" value="no" checked={partyWbEnabled === 'no'} onChange={() => setPartyWbEnabled('no')} /> No
                                      </label>
                                      {partyWbEnabled && (
                                        <button onClick={() => setPartyWbEnabled('')} style={{ fontSize: '10px', border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}>Clear</button>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%', paddingBottom: '2px' }}>
                                    <button 
                                      onClick={() => { setSelectedLorryForWB(null); setSelectedLorryInspection(null); }}
                                      style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        if (!wbNumber || !millWbId) {
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
                                            wbInputType: 'mill',
                                            millWbId: millWbId ? Number(millWbId) : null,
                                            partyWbName: partyWbEnabled === 'yes' ? partyWbName : null,
                                            wbNo: wbNumber,
                                            grossWeight: Number(wbGrossWeight),
                                            tareWeight: Number(wbTareWeight),
                                            netWeight: Number(wbNetWeight),
                                            sute: Number(wbSute) || null,
                                            partyWbEnabled: partyWbEnabled || null,
                                            wbDate: wbDate || null,
                                            partyGrossWeight: partyWbEnabled === 'yes' && partyGrossWeight ? Number(partyGrossWeight) : null,
                                            partyTareWeight: partyWbEnabled === 'yes' && partyTareWeight ? Number(partyTareWeight) : null,
                                            partyNetWeight: partyWbEnabled === 'yes' && partyNetWeight ? Number(partyNetWeight) : null,
                                            partySute: partyWbEnabled === 'yes' && partySute ? Number(partySute) : null,
                                            partyWbNo: partyWbEnabled === 'yes' ? partyWbNo : null,
                                            partyWbDate: partyWbEnabled === 'yes' ? partyWbDate : null
                                          }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                          });

                                          const responseDetail = response?.data?.detail || response?.data?.entry || response?.data || {};
                                          const savedStatus = wbInputType === 'party' ? 'approved' : (responseDetail?.wbStatus || response?.data?.wbStatus || 'pending');
                                          const savedWbNo = responseDetail?.wbNo || response?.data?.wbNo || wbNumber;
                                          const savedNetWeight = responseDetail?.netWeight ?? response?.data?.netWeight ?? Number(wbNetWeight);

                                          try {
                                            setBandMalalEntries(prev => prev.map(item => {
                                              if (String(item.id) === String(entry.id)) {
                                                return {
                                                  ...item,
                                                  wbStatus: savedStatus,
                                                  wbNo: savedWbNo,
                                                  netWeight: savedNetWeight,
                                                  partyWbName: wbInputType === 'party' ? partyWbName : (responseDetail?.partyWbName || undefined),
                                                  wbInputType: 'mill',
                                                  millWbId: wbInputType === 'mill' ? Number(millWbId) : undefined,
                                                  grossWeight: Number(wbGrossWeight),
                                                  tareWeight: Number(wbTareWeight)
                                                };
                                              }
                                              return item;
                                            }));
                                          } catch (reactErr) {
                                            console.error('BMB state update error:', reactErr);
                                          }

                                          if (savedStatus === 'approved') {
                                            toast.success('Weight Bridge saved & approved successfully!');
                                          } else {
                                            toast.success('Weight Bridge saved & submitted for approval!');
                                          }

                                          setSelectedLorryForWB(null);
                                          setSelectedLorryInspection(null);
                                          fetchBandMalalEntries();
                                        } catch (error: any) {
                                          toast.error(error.response?.data?.error || 'Failed to submit WB');
                                        }
                                      }}
                                      style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', border: 'none', borderRadius: '4px', background: '#1e3a8a', color: '#fff', cursor: 'pointer' }}
                                    >
                                      Save Weight Bridge
                                    </button>
                                  </div>
                                </div>

                                {partyWbEnabled === 'yes' && (
                                  <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '2px solid #f59e0b', marginBottom: '14px' }}>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #fcd34d', paddingBottom: '6px' }}>
                                      ⚡ Party WeighBridge Details
                                    </h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Date</label>
                                        <input type="date" value={partyWbDate} onChange={(e) => setPartyWbDate(e.target.value)}
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Number</label>
                                        <input type="text" value={partyWbNo} onChange={(e) => setPartyWbNo(e.target.value.toUpperCase())} placeholder="Party WB No"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Party WB Name</label>
                                        <input type="text" value={partyWbName} onChange={(e) => setPartyWbName(e.target.value)} placeholder="Party WB Name"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Gross Weight (Kg)</label>
                                        <input type="number" value={partyGrossWeight}
                                          onChange={(e) => { const v = e.target.value; setPartyGrossWeight(v); if (v && partyTareWeight) setPartyNetWeight(String(Number(v) - Number(partyTareWeight))); }}
                                          placeholder="Party Gross" style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tare Weight (Kg)</label>
                                        <input type="number" value={partyTareWeight}
                                          onChange={(e) => { const v = e.target.value; setPartyTareWeight(v); if (partyGrossWeight && v) setPartyNetWeight(String(Number(partyGrossWeight) - Number(v))); }}
                                          placeholder="Party Tare" style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Net Weight (Kg)</label>
                                        <input type="text" value={partyNetWeight} disabled
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px', background: '#fef3c7' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sute (Deduction)</label>
                                        <input type="number" value={partySute} onChange={(e) => setPartySute(e.target.value)} placeholder="Party Sute"
                                          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1.5px solid #d97706', borderRadius: '6px' }} />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sute Net Weight</label>
                                        <div style={{ padding: '6px 8px', background: '#fef3c7', border: '1.5px solid #d97706', borderRadius: '6px', fontWeight: '700', color: '#92400e', fontSize: '12px', textAlign: 'center' }}>
                                          {((parseFloat(partyGrossWeight || 0) - parseFloat(partyTareWeight || 0) - parseFloat(partySute || 0)) || 0).toFixed(2)} Kg
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}


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



            {/* Pagination Footer */}
            {filteredBmbEntries.length > 12 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <button 
                  disabled={bmbPage <= 1} 
                  onClick={() => setBmbPage(p => p - 1)} 
                  style={{ padding: '6px 12px', borderRadius: '4px', cursor: bmbPage <= 1 ? 'not-allowed' : 'pointer', background: bmbPage <= 1 ? '#f1f5f9' : 'white', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px' }}
                >
                  Prev
                </button>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  Page {bmbPage} of {Math.ceil(filteredBmbEntries.length / 12)} ({filteredBmbEntries.length} records)
                </span>
                <button 
                  disabled={bmbPage >= Math.ceil(filteredBmbEntries.length / 12)} 
                  onClick={() => setBmbPage(p => p + 1)} 
                  style={{ padding: '6px 12px', borderRadius: '4px', cursor: bmbPage >= Math.ceil(filteredBmbEntries.length / 12) ? 'not-allowed' : 'pointer', background: bmbPage >= Math.ceil(filteredBmbEntries.length / 12) ? '#f1f5f9' : 'white', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px' }}
                >
                  Next
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{filteredBmbEntries.length}</span>
                lots loaded (total: {bandMalalEntries.length})
              </div>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✅ Filtered successfully</span>
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
          isCompactOverride={arrivalsActiveSubTab === 'transit' || arrivalsActiveSubTab === 'bandmalal'}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedDetailEntry(null);
          }}
          onApproveQuality={handleApproveInventoryQuality}
          onRejectQuality={handleRejectInventoryQualityDirect}
          onRecheckQuality={handleRecheckInventoryQualityDirect}
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
              background: '#fff', borderRadius: '12px', width: '95%', maxWidth: '820px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden', border: '1px solid #e2e8f0', animation: 'pulse 0.15s ease-out'
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff'
              }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>🚚 Lorry Transit Details — {lorryNum.toUpperCase()}</h3>
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
              <div style={{ padding: '12px', display: 'flex', gap: '10px', maxHeight: '80vh', overflowY: 'auto' }}>
                
                {/* Lorry Info */}
                <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a' }}>
                    🚚 Lorry Info
                  </div>
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>PARTY</span><strong>{partyName}</strong></div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>BROKER</span>{brokerName}</div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>VARIETY</span>{varietyName}</div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>LORRY NUMBER</span><strong style={{ color: '#1e40af' }}>{lorryNum.toUpperCase()}</strong></div>
                  </div>
                </div>

                {/* Godown Details */}
                <div style={{ flex: 1.2, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold', color: '#7c3aed' }}>
                    📍 Godown Location Details
                  </div>
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Godown Type</span><strong>{transitDetail?.placeType ? transitDetail.placeType.toUpperCase() : '-'}</strong></div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Allotted Location / Outturn</span><strong>{transitDetail?.placeWarehouse?.name || transitDetail?.placeKunchinittuData?.name || (transitDetail?.outturn ? `${transitDetail.outturn.code} (${transitDetail.outturn.allottedVariety})` : null) || '-'}</strong></div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Godown Date</span>{transitDetail?.placeDate ? new Date(transitDetail.placeDate).toLocaleDateString('en-GB') : '-'}</div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>Godown Status</span>
                      <span style={{
                        display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                        backgroundColor: transitDetail?.placeStatus === 'approved' ? '#dcfce7' : transitDetail?.placeStatus === 'placed' ? '#dbeafe' : (transitDetail?.placeStatus === 'pending') ? '#fef3c7' : '#f1f5f9',
                        color: transitDetail?.placeStatus === 'approved' ? '#166534' : transitDetail?.placeStatus === 'placed' ? '#1e40af' : (transitDetail?.placeStatus === 'pending') ? '#92400e' : '#475569'
                      }}>
                        {transitDetail?.placeStatus ? transitDetail.placeStatus.toUpperCase() : 'NONE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weigh Bridge Details */}
                <div style={{ flex: 1.5, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold', color: '#16a34a' }}>
                    ⚖️ Weigh Bridge Details
                  </div>
                  <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>WB Number</span><strong>{transitDetail?.wbNo || '-'}</strong></div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Mill Weight Bridge</span>{transitDetail?.millWeightBridge?.name || transitDetail?.partyWbName || '-'}</div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Gross Weight</span>{transitDetail?.grossWeight ? `${transitDetail.grossWeight} Kg` : '-'}</div>
                    <div><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Tare Weight</span>{transitDetail?.tareWeight ? `${transitDetail.tareWeight} Kg` : '-'}</div>
                    <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold' }}>Net Weight</span><strong style={{ color: '#10b981', fontSize: '13px' }}>{transitDetail?.netWeight ? `${transitDetail.netWeight} Kg` : '-'}</strong></div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>WB Status</span>
                      <span style={{
                        display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
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
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => {
                    setIsTransitDetailOpen(false);
                    setSelectedTransitDetail(null);
                  }}
                  style={{
                    padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1',
                    borderRadius: '4px', background: '#fff', cursor: 'pointer', color: '#334155'
                  }}
                >
                  Close Details


                </button>



              </div>



            </div>



          </div>



        );



      })()}




      {wbConfirmDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
              {wbConfirmDialog.action === 'approve' ? '✅ Confirm WB Approval' : '❌ Confirm WB Rejection'}
            </h3>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <div style={{ gridColumn: 'span 2', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', color: '#1a237e' }}>🏭 Mill Weighbridge Details</div>
                <div><strong>WB Number:</strong> {wbConfirmDialog.detail?.wbNo || '-'}</div>
                <div><strong>Mill WB:</strong> {wbConfirmDialog.detail?.millWbId ? 'Selected' : '-'}</div>
                <div><strong>Gross Wt:</strong> {wbConfirmDialog.detail?.grossWeight || '-'} Kg</div>
                <div><strong>Tare Wt:</strong> {wbConfirmDialog.detail?.tareWeight || '-'} Kg</div>
                <div><strong>Net Wt:</strong> {wbConfirmDialog.detail?.netWeight || '-'} Kg</div>
                <div><strong>Sute:</strong> {wbConfirmDialog.detail?.sute || '-'} Kg</div>
                <div><strong>Date:</strong> {wbConfirmDialog.detail?.wbDate || '-'}</div>
                <div><strong>Party WB:</strong> {wbConfirmDialog.detail?.partyWbName || '-'}</div>
                
                {wbConfirmDialog.detail?.partyWbEnabled === 'yes' && (
                  <>
                    <div style={{ gridColumn: 'span 2', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', paddingTop: '8px', color: '#7c3aed' }}>⚡ Party Weighbridge Details</div>
                    <div><strong>Party WB Name:</strong> {wbConfirmDialog.detail?.partyWbName || '-'}</div>
                    <div><strong>Party WB No:</strong> {wbConfirmDialog.detail?.partyWbNo || '-'}</div>
                    <div><strong>Party Gross:</strong> {wbConfirmDialog.detail?.partyGrossWeight || '-'} Kg</div>
                    <div><strong>Party Tare:</strong> {wbConfirmDialog.detail?.partyTareWeight || '-'} Kg</div>
                    <div><strong>Party Net:</strong> {wbConfirmDialog.detail?.partyNetWeight || '-'} Kg</div>
                    <div><strong>Party Sute:</strong> {wbConfirmDialog.detail?.partySute || '-'} Kg</div>
                  </>
                )}
              </div>
            </div>
            {wbConfirmDialog.action === 'reject' && (
              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Reason for rejecting weighbridge:</label>
                <textarea 
                  value={wbRejectReason} 
                  onChange={(e) => setWbRejectReason(e.target.value)} 
                  placeholder="Enter rejection reason..."
                  style={{ width: '100%', height: '80px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '16px', background: '#fef2f2', padding: '8px', borderRadius: '6px' }}>
              {wbConfirmDialog.action === 'approve' 
                ? 'Are you sure you want to APPROVE this weighbridge?'
                : 'Are you sure you want to REJECT this weighbridge?'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setWbConfirmDialog(null); setWbRejectReason(''); }} style={{
                padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff',
                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={() => {
                if (wbConfirmDialog.action === 'approve') {
                  handleApproveWb(wbConfirmDialog.id);
                } else {
                  if (!wbRejectReason.trim()) {
                    toast.error('Rejection reason is required');
                    return;
                  }
                  handleRejectWb(wbConfirmDialog.id, wbRejectReason);
                }
              }} style={{
                padding: '8px 20px', border: 'none', borderRadius: '6px',
                background: wbConfirmDialog.action === 'approve' ? '#10b981' : '#ef4444',
                color: '#fff', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
              }}>
                {wbConfirmDialog.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {placeConfirmDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
              {placeConfirmDialog.action === 'move' ? '🚚 Move Lorry to Band Mall Book' : '❌ Reject Godown Place'}
            </h3>
            
            {placeConfirmDialog.action === 'move' ? (
              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
                {placeConfirmDialog.warnings && placeConfirmDialog.warnings.length > 0 ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#92400e', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Warnings:</div>
                    {placeConfirmDialog.warnings?.map((w, idx) => <div key={idx}>- {w}</div>)}
                  </div>
                ) : (
                  <div style={{ color: '#16a34a', fontWeight: 'bold', marginBottom: '12px' }}>✓ Ready to move. All parameters (Weighbridge and Quality) are approved.</div>
                )}
                Are you sure you want to move this lorry to the Band Mall Book?
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Reason for rejecting place:</label>
                <textarea 
                  value={placeRejectReason} 
                  onChange={(e) => setPlaceRejectReason(e.target.value)} 
                  placeholder="Enter rejection reason..."
                  style={{ width: '100%', height: '80px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setPlaceConfirmDialog(null); setPlaceRejectReason(''); }} 
                style={{
                  padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff',
                  fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!placeConfirmDialog) return;
                  const { trip, action } = placeConfirmDialog;
                  const targetId = trip.inspection?.id || trip.entry?.id;
                  const token = localStorage.getItem('token');
                  
                  try {
                    if (action === 'move') {
                      await axios.post(`${API_URL}/arrivals/${targetId}/approve-place`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      toast.success('Lorry moved to Band Mall Book!');
                    } else {
                      if (!placeRejectReason.trim()) {
                        toast.error('Rejection reason is required');
                        return;
                      }
                      await axios.post(`${API_URL}/arrivals/${targetId}/reject-place`, { reason: placeRejectReason }, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      toast.success('Godown rejected!');
                    }
                    setPlaceConfirmDialog(null);
                    setPlaceRejectReason('');
                    fetchInTransitEntries();
                    fetchBandMalalEntries();
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || `Failed to perform action`);
                  }
                }} 
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: '6px',
                  background: placeConfirmDialog.action === 'move' ? '#10b981' : '#ef4444',
                  color: '#fff', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                {placeConfirmDialog.action === 'move' ? 'Confirm Move' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Sampling Popup Modal */}
      {isQualitySamplingModalOpen && qualitySamplingEntry && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff', borderRadius: '8px', padding: '14px', maxWidth: '560px', width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            position: 'relative', border: '1px solid #e2e8f0'
          }}>
            {/* Header Strip */}
            <div style={{ background: '#1b5e20', padding: '12px 14px', borderRadius: '8px 8px 0 0', margin: '-14px -14px 10px -14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                Add Quality Parameters
              </h3>
              <button onClick={() => setIsQualitySamplingModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>✕</button>
            </div>

            {/* Metadata Sub-strip */}
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '11.5px' }}>
              <div><strong style={{ color: '#1e293b' }}>Broker:</strong> {qualitySamplingEntry.brokerName || qualitySamplingEntry.broker || '-'}</div>
              <div><strong style={{ color: '#1e293b' }}>Variety:</strong> {qualitySamplingEntry.varietyName || qualitySamplingEntry.variety || '-'}</div>
              <div><strong style={{ color: '#1e293b' }}>Party:</strong> {qualitySamplingEntry.partyName || qualitySamplingEntry.fromParty?.name || '-'}</div>
              <div><strong style={{ color: '#1e293b' }}>Bags:</strong> {qualitySamplingEntry.bags || '-'}</div>
              <div style={{ gridColumn: 'span 2' }}><strong style={{ color: '#1e293b' }}>Lorry:</strong> <span style={{ fontWeight: 'bold', color: '#b91c1c' }}>{(qualitySamplingEntry.lorryNumber || 'N/A').toUpperCase()}</span></div>
            </div>

            {/* Active Recheck Banner */}
            {activeRecheck && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #ef4444', color: '#991b1b', padding: '8px', borderRadius: '6px', marginBottom: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                🔄 RECHECK REQUESTED: {activeRecheck.rejectReason.replace(/^RECHECK:\s*/, '')}
              </div>
            )}

            {/* Type Toggle */}
            {(() => {
              const modalParams = qualitySamplingEntry?.inventoryQualityParameters || 
                                  qualitySamplingEntry?.lorryTransitDetail?.inventoryQualityParameters || 
                                  (qualitySamplingEntry?.physicalInspections && qualitySamplingEntry?.physicalInspections[0]?.inventoryQualityParameters) || 
                                  [];
              const isLotAlreadyDone = modalParams.some((p: any) => p.type === 'lot_avg' && p.status !== 'rejected');
              const isFullAlreadyDone = modalParams.some((p: any) => p.type === 'full_lorry_avg' && p.status !== 'rejected');

              return (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px 0' }}>
                  <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '30px', border: '1px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                    <button type="button" 
                      disabled={isLotAlreadyDone}
                      onClick={() => setInventoryQualityType('lot_avg')}
                      style={{ 
                        padding: '6px 14px', 
                        border: 'none', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        cursor: isLotAlreadyDone ? 'not-allowed' : 'pointer', 
                        background: inventoryQualityType === 'lot_avg' ? '#1b5e20' : 'transparent', 
                        color: inventoryQualityType === 'lot_avg' ? '#fff' : '#64748b',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                      <span>1. Lot Avg (Before Unloading)</span>
                      {isLotAlreadyDone && <span style={{ fontSize: '10px' }}>✅</span>}
                    </button>
                    
                    <div style={{ width: '1px', background: '#cbd5e1', margin: '4px 6px' }} />

                    <button type="button" 
                      disabled={isFullAlreadyDone}
                      onClick={() => setInventoryQualityType('full_lorry_avg')}
                      style={{ 
                        padding: '6px 14px', 
                        border: 'none', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        cursor: isFullAlreadyDone ? 'not-allowed' : 'pointer', 
                        background: inventoryQualityType === 'full_lorry_avg' ? '#1b5e20' : 'transparent', 
                        color: inventoryQualityType === 'full_lorry_avg' ? '#fff' : '#64748b',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                      <span>2. Gutti (Full Avg)</span>
                      {isFullAlreadyDone && <span style={{ fontSize: '10px' }}>✅</span>}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                { label: 'Moisture (%)', key: 'moisture', type: 'text', placeholder: '16.5', required: true },
                { label: 'Dry Moisture', key: 'dryMoisture', type: 'text', placeholder: '14.2', required: true },
                { label: 'Grains Count', key: 'grains', type: 'text', placeholder: '85', required: true },
                { label: 'Cutting', key: 'cutting', type: 'text', placeholder: '1x', required: true },
                { label: 'Bend', key: 'bend', type: 'text', placeholder: '1x', required: true },
                { label: 'Mix (%)', key: 'mix', type: 'text', placeholder: '5', required: true },
                { label: 'SMix', key: 'sMix', type: 'text', placeholder: '2', required: true },
                { label: 'LMix', key: 'lMix', type: 'text', placeholder: '1', required: true },
                { label: 'SK (%)', key: 'sk', type: 'text', placeholder: '0.5', required: true },
                { label: 'Kandu (%)', key: 'kandu', type: 'text', placeholder: '1', required: true },
                { label: 'Oil (%)', key: 'oil', type: 'text', placeholder: '0.5', required: true },
                { label: 'Paddy Discolor', key: 'pColor', type: 'select', options: ['Normal Color', 'Light Discolor', 'Medium Discolor', 'Dark Discolor'] },
                { label: 'Kadiga', key: 'kadiga', type: 'kadiga', required: true },
                { label: 'Smell', key: 'smell', type: 'smell' }
              ].map((field) => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', minHeight: '52px' }}>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '10px', marginBottom: '2px' }}>
                    {field.label}{field.required && <span style={{ color: '#e53935' }}>*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select value={inventoryQualityForm[field.key]} onChange={(e) => setInventoryQualityForm(p => ({ ...p, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '4px', border: activeRecheck ? '1.5px solid #ef4444' : '1px solid #ccc', borderRadius: '3px', fontSize: '11px', boxSizing: 'border-box', background: activeRecheck ? '#fef2f2' : '#fff', height: '28px' }}>
                      <option value=''>Select</option>
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'kadiga' ? (
                    <div style={{ display: 'flex', gap: '8px', height: '28px', alignItems: 'center' }}>
                      {['Yes', 'No'].map(v => (
                        <label key={v} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'normal' }}>
                          <input type="radio" name="kadiga_qs" checked={inventoryQualityForm.kadiga === v}
                            onChange={() => setInventoryQualityForm(p => ({ ...p, kadiga: v }))}
                            style={{ margin: 0 }} /> {v}
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'smell' ? (
                    <>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                        {['Yes', 'No'].map(v => (
                          <label key={v} style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="smell_has_qs" checked={inventoryQualityToggle.smellHas === v}
                              onChange={() => { setInventoryQualityToggle(p => ({ ...p, smellHas: v })); if (v === 'No') setInventoryQualityForm(p => ({ ...p, smell: '' })); }}
                              style={{ margin: 0 }} /> {v}
                          </label>
                        ))}
                      </div>
                      {inventoryQualityToggle.smellHas === 'Yes' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {['Light', 'Medium', 'Dark'].map(opt => (
                            <label key={opt} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}>
                              <input type="radio" name="smell_type_qs" checked={inventoryQualityForm.smell === opt}
                                onChange={() => setInventoryQualityForm(p => ({ ...p, smell: opt }))} /> {opt}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <input type="text" value={inventoryQualityForm[field.key]} onChange={(e) => setInventoryQualityForm(p => ({ ...p, [field.key]: sanitizeInventoryQualityField(field.key, e.target.value) }))}
                      style={{ width: '100%', padding: '4px', border: activeRecheck ? '1.5px solid #ef4444' : '1px solid #ccc', borderRadius: '3px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: activeRecheck ? '#fef2f2' : '#fff' }}
                      placeholder={field.placeholder} />
                  )}
                </div>
              ))}
            </div>

            {/* WB Parameters */}
            <div style={{ background: '#f0f7ff', borderRadius: '4px', border: '1px solid #d0e3f7', padding: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#1565c0', marginBottom: '6px' }}>WB PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '10px' }}>WB (R) & WB (BK)</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                    {['Yes', 'No'].map(v => (
                      <label key={v} style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input type="radio" name="wbEnabled_qs" checked={v === 'Yes' ? wbEnabled : !wbEnabled}
                          onChange={() => { if (v === 'No') { setWbEnabled(false); setInventoryQualityForm(p => ({ ...p, wbR: '', wbBk: '' })); } else setWbEnabled(true); }}
                          style={{ margin: 0 }} /> {v}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', visibility: wbEnabled ? 'visible' : 'hidden' }}>
                    <input type="number" step="0.01" placeholder="R" value={inventoryQualityForm.wbR} onChange={(e) => setInventoryQualityForm(p => ({ ...p, wbR: e.target.value }))} disabled={!wbEnabled}
                      style={{ flex: 1, padding: '3px', border: activeRecheck ? '1.5px solid #ef4444' : '1px solid #ccc', borderRadius: '3px', fontSize: '10px', backgroundColor: activeRecheck ? '#fef2f2' : '#fff' }} />
                    <input type="number" step="0.01" placeholder="BK" value={inventoryQualityForm.wbBk} onChange={(e) => setInventoryQualityForm(p => ({ ...p, wbBk: e.target.value }))} disabled={!wbEnabled}
                      style={{ flex: 1, padding: '3px', border: activeRecheck ? '1.5px solid #ef4444' : '1px solid #ccc', borderRadius: '3px', fontSize: '10px', backgroundColor: activeRecheck ? '#fef2f2' : '#fff' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '10px' }}>WB (T) — Auto</label>
                  <input type="number" step="0.01" readOnly value={inventoryQualityForm.wbT}
                    style={{ width: '100%', padding: '3px', border: '1px solid #a5d6a7', borderRadius: '3px', fontSize: '10px', backgroundColor: '#e8f5e9', fontWeight: '700', cursor: 'not-allowed', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: '600', color: '#333', fontSize: '10px' }}>Paddy WB</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                    {['Yes', 'No'].map(v => (
                      <label key={v} style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <input type="radio" name="paddyWbHas_qs" checked={(v === 'Yes' && inventoryQualityToggle.paddyWb !== 'No') || (v === 'No' && inventoryQualityToggle.paddyWb === 'No')}
                          onChange={() => {
                            setInventoryQualityToggle(p => ({ ...p, paddyWb: v }));
                            if (v === 'No') {
                              setInventoryQualityForm(p => ({ ...p, paddyWb: '' }));
                            }
                          }}
                          style={{ margin: 0 }} /> {v}
                      </label>
                    ))}
                  </div>
                  {(inventoryQualityToggle.paddyWb !== 'No') && (
                    <input type="number" step="0.01" value={inventoryQualityForm.paddyWb} onChange={(e) => setInventoryQualityForm(p => ({ ...p, paddyWb: sanitizeInventoryQualityField('paddyWb', e.target.value) }))}
                      style={{ width: '100%', padding: '4px', border: activeRecheck ? '1.5px solid #ef4444' : '1px solid #ccc', borderRadius: '3px', fontSize: '10px', boxSizing: 'border-box', backgroundColor: activeRecheck ? '#fef2f2' : '#fff' }}
                      placeholder="Val" />
                  )}
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
              <label style={{ fontWeight: '600', color: '#333', fontSize: '10px', marginBottom: '2px' }}>Remarks</label>
              <input type="text" value={inventoryQualityForm.remarks} onChange={(e) => setInventoryQualityForm(p => ({ ...p, remarks: e.target.value }))}
                style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px', boxSizing: 'border-box' }}
                placeholder="Notes..." />
            </div>

            {/* Reported By */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
              <label style={{ fontWeight: '600', color: '#333', fontSize: '10px', whiteSpace: 'nowrap' }}>Reported By <span style={{ color: '#e53935' }}>*</span></label>
              <select value={inventoryQualityForm.reportedByUserId || user?.id || ''} onChange={(e) => setInventoryQualityForm(p => ({ ...p, reportedByUserId: e.target.value }))}
                style={{ padding: '3px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '10px', background: '#fff', height: '26px', maxWidth: '180px' }}>
                <option value="">Choose</option>
                {usersList.map(u => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
              </select>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => {
                if (inventoryQualityType === 'lot_avg') {
                  setInventoryQualityType('full_lorry_avg');
                  setInventoryQualityForm({ moisture: '', dryMoisture: '', cutting: '', bend: '', grains: '', mix: '', sMix: '', lMix: '', kandu: '', oil: '', sk: '', wbR: '', wbBk: '', wbT: '', smell: '', paddyWb: '', pColor: '', kadiga: '', remarks: '' });
                  setInventoryQualityToggle({ dryMoisture: 'Y', sMix: 'Y', lMix: 'Y', paddyWb: 'Y', kadiga: 'Y', smellHas: 'No' });
                  toast.info('Lot Avg skipped. Enter Full Lorry Avg.');
                } else {
                  setIsQualitySamplingModalOpen(false); setQualitySamplingEntry(null);
                }
              }} style={{ padding: '5px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#64748b' }}>
                {inventoryQualityType === 'lot_avg' ? 'Skip' : 'Close'}
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                {inventoryQualityType === 'lot_avg' && (
                  <button type="button" onClick={handleSubmitLotAvg}
                    style={{ padding: '5px 14px', border: '1px solid #16a34a', borderRadius: '4px', background: '#fff', color: '#16a34a', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Submit
                  </button>
                )}
                <button type="button" onClick={handleQualitySamplingNext}
                  style={{ padding: '5px 14px', border: 'none', borderRadius: '4px', background: 'linear-gradient(135deg, #1a237e, #3b82f6)', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {inventoryQualityType === 'lot_avg' ? 'Next' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </Container>



  );



};







export default Arrivals;



