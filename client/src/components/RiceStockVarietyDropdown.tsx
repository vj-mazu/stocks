import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';

/**
 * Rice Stock Variety Dropdown Component
 * 
 * This component provides standardized variety selection specifically for rice stock operations
 * (Purchase, Sale, Palti). It works with outturn IDs instead of free-text varieties.
 * 
 * This component is separate from UnifiedVarietyDropdown which is used by arrivals
 * and other systems that continue to use free-text varieties.
 */

const Container = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
`;

const Label = styled.label`
  font-weight: 600;
  color: #374151;
  font-size: 0.85rem;
  display: block;
  margin-bottom: 0.5rem;
  white-space: nowrap;
`;

const Select = styled.select`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.95rem;
  background: white;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.error {
    border-color: #ef4444;
  }
`;

const SearchInput = styled.input`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  width: 100%;
  margin-bottom: 0.5rem;

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
`;

const FilterButton = styled.button<{ active: boolean }>`
  padding: 0.25rem 0.75rem;
  border: 1px solid ${props => props.active ? '#10b981' : '#d1d5db'};
  background: ${props => props.active ? '#10b981' : 'white'};
  color: ${props => props.active ? 'white' : '#374151'};
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #10b981;
    background: ${props => props.active ? '#059669' : '#f0fdf4'};
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.8rem;
  margin-top: 0.25rem;
`;

const LoadingMessage = styled.div`
  color: #6b7280;
  font-size: 0.9rem;
  padding: 0.5rem;
  text-align: center;
`;

const VarietyInfo = styled.div`
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #166534;
`;

interface RiceStockVariety {
  id: number;
  code: string;
  standardized_variety: string;
  allotted_variety: string;
  processing_type: 'Raw' | 'Steam';
  created_at?: string;
  is_cleared?: boolean;
  usage_count?: number;
}

interface RiceStockVarietyDropdownProps {
  value: number | null; // outturn_id
  varietyName?: string; // variety text name
  onChange: (outturnId: number | null, varietyData?: RiceStockVariety) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  processingTypeFilter?: 'Raw' | 'Steam' | 'all';
  showSearch?: boolean;
  showFilters?: boolean;
  showVarietyInfo?: boolean;
  disabled?: boolean;
  error?: string;
}

const RiceStockVarietyDropdown: React.FC<RiceStockVarietyDropdownProps> = ({
  value,
  varietyName,
  onChange,
  label = "Rice Variety",
  placeholder = "-- Select Rice Variety --",
  required = false,
  processingTypeFilter = 'all',
  showSearch = false,
  showFilters = false,
  showVarietyInfo = false,
  disabled = false,
  error
}) => {
  const [varieties, setVarieties] = useState<RiceStockVariety[]>([]);
  const [genericVarieties, setGenericVarieties] = useState<any[]>([]);
  const [filteredVarieties, setFilteredVarieties] = useState<RiceStockVariety[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Raw' | 'Steam'>(processingTypeFilter);
  const [selectedVariety, setSelectedVariety] = useState<RiceStockVariety | null>(null);

  // Fetch varieties from rice stock API
  const fetchVarieties = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (processingTypeFilter !== 'all') {
        params.append('processing_type', processingTypeFilter);
      }
      
      if (showVarietyInfo) {
        params.append('include_metadata', 'true');
      }
      
      params.append('limit', '200'); // Reasonable limit for dropdown

      console.log('🔍 RiceStockVarietyDropdown: Fetching varieties from API...');
      console.log('   URL:', `/rice-stock/varieties?${params.toString()}`);
      console.log('   Token exists:', !!token);

      const response = await axios.get<{
        varieties: RiceStockVariety[];
        total: number;
      }>(`/rice-stock/varieties?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ RiceStockVarietyDropdown: API Response received');
      console.log('   Varieties count:', response.data.varieties?.length || 0);

      // Also fetch generic rice varieties from Locations
      let fetchedRiceVarieties: any[] = [];
      try {
        const riceVarietiesResponse = await axios.get<{ varieties: any[] }>('/locations/rice-varieties', {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchedRiceVarieties = (riceVarietiesResponse.data as any).varieties || [];
        console.log('✅ RiceStockVarietyDropdown: Rice varieties from locations:', fetchedRiceVarieties.length);
        setGenericVarieties(fetchedRiceVarieties);
      } catch (locationsErr) {
        console.error('⚠️ RiceStockVarietyDropdown: Error fetching locations rice varieties:', locationsErr);
      }

      const fetchedVarieties = response.data.varieties || [];
      setVarieties(fetchedVarieties);
    } catch (error) {
      console.error('❌ RiceStockVarietyDropdown: Error fetching rice stock varieties:', error);
      
      // Type-safe error handling
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('   Error details:', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message
        });
      } else {
        console.error('   Error details:', {
          message: error instanceof Error ? error.message : String(error)
        });
      }
      
      setVarieties([]);
      setFilteredVarieties([]);
    } finally {
      setLoading(false);
    }
  }, [processingTypeFilter, showVarietyInfo]);

  // Sync selected variety when value or varietyName changes without re-fetching
  useEffect(() => {
    if (value && value > 0 && varieties.length > 0) {
      const selected = varieties.find(v => v.id === value);
      setSelectedVariety(selected || null);
    } else if (varietyName) {
      const selectedOutturn = varieties.find(v => v.standardized_variety === varietyName);
      if (selectedOutturn) {
        setSelectedVariety(selectedOutturn);
      } else if (genericVarieties.length > 0) {
        const selectedGeneric = genericVarieties.find(v => v.name === varietyName);
        if (selectedGeneric) {
          setSelectedVariety({
            id: null as any,
            code: selectedGeneric.code,
            standardized_variety: selectedGeneric.name,
            allotted_variety: selectedGeneric.name,
            processing_type: selectedGeneric.name.toUpperCase().includes('STEAM') ? 'Steam' : 'Raw'
          });
        }
      }
    }
  }, [value, varietyName, varieties, genericVarieties]);

  // Filter varieties based on search and filter criteria
  const filterVarieties = useCallback(() => {
    // Map outturns
    const mappedOutturns: RiceStockVariety[] = varieties.map(v => ({ ...v, isGeneric: false } as any));
    
    // Map generic varieties from Locations
    const mappedGenerics: RiceStockVariety[] = genericVarieties.map(gv => ({
      id: -gv.id, // Use negative ID to prevent collision with outturns
      code: gv.code,
      standardized_variety: gv.name,
      allotted_variety: gv.name,
      processing_type: gv.name.toUpperCase().includes('STEAM') ? 'Steam' : 'Raw',
      isGeneric: true,
      genericId: gv.id
    } as any));

    let combined = [...mappedOutturns, ...mappedGenerics];

    // Apply processing type filter
    if (activeFilter !== 'all') {
      combined = combined.filter(v => v.processing_type === activeFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      combined = combined.filter(v => 
        v.standardized_variety.toLowerCase().includes(search) ||
        v.allotted_variety.toLowerCase().includes(search) ||
        (v.code && v.code.toLowerCase().includes(search))
      );
    }

    // Deduplicate by standardized_variety so no duplicates appear
    const varietyMap = new Map<string, RiceStockVariety>();
    for (const item of combined) {
      const key = (item.standardized_variety || '').trim().toUpperCase();
      if (!key) continue;

      if (!varietyMap.has(key)) {
        varietyMap.set(key, { ...item });
      } else {
        const existing = varietyMap.get(key)!;
        if (item.usage_count !== undefined) {
          existing.usage_count = (existing.usage_count || 0) + item.usage_count;
        }
        // Prefer real outturn ID (> 0) over generic ID (< 0)
        if (item.id && item.id > 0 && (!existing.id || existing.id < 0 || existing.id < item.id)) {
          existing.id = item.id;
          existing.code = item.code || existing.code;
        }
      }
    }

    const uniqueList = Array.from(varietyMap.values());
    // Sort alphabetically by standardized variety
    uniqueList.sort((a, b) => a.standardized_variety.localeCompare(b.standardized_variety));

    setFilteredVarieties(uniqueList);
  }, [varieties, genericVarieties, activeFilter, searchTerm]);

  // Fetch varieties on component mount and when dependencies change
  useEffect(() => {
    fetchVarieties();
  }, [fetchVarieties]);

  // Filter varieties when search term or filter changes
  useEffect(() => {
    filterVarieties();
  }, [filterVarieties]);

  // Get active option value based on outturn ID and fallback variety name
  const getSelectValue = () => {
    if (value && value > 0) {
      const directMatch = filteredVarieties.find(v => v.id === value);
      if (directMatch) return String(directMatch.id);

      const orig = varieties.find(v => v.id === value);
      if (orig) {
        const nameMatch = filteredVarieties.find(
          v => v.standardized_variety.trim().toUpperCase() === orig.standardized_variety.trim().toUpperCase()
        );
        if (nameMatch) return String(nameMatch.id);
      }
      return String(value);
    }
    if (varietyName) {
      const match = filteredVarieties.find(
        v => v.standardized_variety.trim().toUpperCase() === varietyName.trim().toUpperCase()
      );
      if (match) return String(match.id);
    }
    return '';
  };

  // Handle variety selection
  const handleSelectionChange = (selectedId: string) => {
    if (!selectedId) {
      setSelectedVariety(null);
      onChange(null);
      return;
    }

    const numericId = Number.parseInt(selectedId, 10);
    const selected = filteredVarieties.find(v => v.id === numericId);
    
    if (selected) {
      setSelectedVariety(selected);
      if (selected.id < 0) {
        // Generic variety selected - pass null as outturnId, but pass the variety object
        onChange(null, selected);
      } else {
        // Outturn variety selected - pass outturnId
        onChange(selected.id, selected);
      }
    } else {
      setSelectedVariety(null);
      onChange(null);
    }
  };

  // Handle filter change
  const handleFilterChange = (filter: 'all' | 'Raw' | 'Steam') => {
    setActiveFilter(filter);
  };

  return (
    <Container>
      {label && (
        <Label>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </Label>
      )}

      {showSearch && (
        <SearchInput
          type="text"
          placeholder="Search varieties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled || loading}
        />
      )}

      {showFilters && (
        <FilterContainer>
          <FilterButton
            active={activeFilter === 'all'}
            onClick={() => handleFilterChange('all')}
            disabled={disabled || loading}
            type="button"
          >
            All Types
          </FilterButton>
          <FilterButton
            active={activeFilter === 'Raw'}
            onClick={() => handleFilterChange('Raw')}
            disabled={disabled || loading}
            type="button"
          >
            Raw
          </FilterButton>
          <FilterButton
            active={activeFilter === 'Steam'}
            onClick={() => handleFilterChange('Steam')}
            disabled={disabled || loading}
            type="button"
          >
            Steam
          </FilterButton>
        </FilterContainer>
      )}

      <Select
        value={getSelectValue()}
        onChange={(e) => handleSelectionChange(e.target.value)}
        required={required}
        disabled={disabled || loading}
        className={error ? 'error' : ''}
      >
        <option value="">
          {loading ? 'Loading varieties...' : placeholder}
        </option>
        {filteredVarieties.map((variety) => (
          <option key={variety.id} value={variety.id}>
            {variety.standardized_variety}
            {showVarietyInfo && typeof variety.usage_count === 'number' && variety.usage_count > 0 ? (
              ` (${variety.usage_count} uses)`
            ) : null}
          </option>
        ))}
      </Select>

      {loading && (
        <LoadingMessage>Loading rice varieties...</LoadingMessage>
      )}

      {!loading && filteredVarieties.length === 0 && (varieties.length > 0 || genericVarieties.length > 0) && (
        <ErrorMessage>No varieties match your search criteria.</ErrorMessage>
      )}

      {!loading && varieties.length === 0 && (
        <ErrorMessage>
          No rice varieties available. Please contact administrator.
          <br />
          <small style={{ fontSize: '0.7rem', opacity: 0.8 }}>
            Debug: Check browser console for API errors. Varieties are loaded from outturns in Location → Production.
          </small>
        </ErrorMessage>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {showVarietyInfo && selectedVariety && (
        <VarietyInfo>
          <div><strong>Code:</strong> {selectedVariety.code}</div>
          <div><strong>Variety:</strong> {selectedVariety.allotted_variety}</div>
          <div><strong>Type:</strong> {selectedVariety.processing_type}</div>
          {selectedVariety.usage_count !== undefined && (
            <div><strong>Usage Count:</strong> {selectedVariety.usage_count}</div>
          )}
        </VarietyInfo>
      )}
    </Container>
  );
};

export default RiceStockVarietyDropdown;