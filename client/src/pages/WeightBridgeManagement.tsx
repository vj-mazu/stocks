import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from '../utils/toast';
import { API_URL } from '../config/api';

const Container = styled.div`
  animation: fadeIn 0.5s ease-in;
  max-width: 1000px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const AddButton = styled.button`
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  background: white;
  color: #d97706;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #f3f4f6;
  margin-bottom: 2rem;
`;

const FormCard = styled(Card)`
  border-color: #f59e0b;
  border-width: 2px;
  animation: slideDown 0.3s ease;
`;

const SectionTitle = styled.h2`
  color: #1f2937;
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Form = styled.form`
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1 1 250px;
`;

const SmallFormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 0 0 auto;
`;

const Label = styled.label`
  font-weight: 600;
  color: #4b5563;
  font-size: 0.875rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  transition: all 0.3s ease;
  height: fit-content;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  padding: 0.75rem 1.5rem;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  background: #f8fafc;
  color: #64748b;
  transition: all 0.2s ease;
  height: fit-content;

  &:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }
`;

const ToggleSwitch = styled.label<{ $active: boolean }>`
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: ${props => props.$active ? '#10b981' : '#cbd5e1'};
    border-radius: 26px;
    transition: all 0.3s ease;
  }

  .slider:before {
    content: "";
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s ease;
    transform: ${props => props.$active ? 'translateX(22px)' : 'translateX(0)'};
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
`;

const Th = styled.th`
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
  padding: 1rem;
  text-align: left;
  border-bottom: 2px solid #e5e7eb;
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #4b5563;
`;

const StatusBadge = styled.span<{ $active: boolean }>`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  background: ${props => props.$active ? '#d1fae5' : '#fee2e2'};
  color: ${props => props.$active ? '#065f46' : '#991b1b'};
`;

const ActionButton = styled.button<{ variant?: 'danger' | 'primary' | 'success' | 'warning' }>`
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  background: ${props => 
    props.variant === 'danger' ? '#ef4444' : 
    props.variant === 'success' ? '#10b981' : 
    props.variant === 'warning' ? '#f59e0b' : '#2563eb'};
  color: white;
  font-size: 0.8rem;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => 
      props.variant === 'danger' ? '#dc2626' : 
      props.variant === 'success' ? '#059669' : 
      props.variant === 'warning' ? '#d97706' : '#1d4ed8'};
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
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  cursor: pointer;
  margin-left: 1rem;
`;

const SubTabContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  padding-left: 1rem;
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

const WeightBridgeManagement: React.FC = () => {
  const [bridges, setBridges] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingBridge, setEditingBridge] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const fetchBridges = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/weight-bridges?all=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBridges(res.data?.bridges || []);
    } catch (err) {
      console.error('Failed to fetch weight bridges:', err);
      toast.error('Failed to fetch weight bridges');
    }
  }, []);

  useEffect(() => {
    fetchBridges();
  }, [fetchBridges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !name.trim()) {
      toast.error('Weight Bridge Name is required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/weight-bridges`, { name, location, isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weight Bridge created successfully!');
      setName('');
      setLocation('');
      setIsActive(true);
      setShowForm(false);
      fetchBridges();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create Weight Bridge');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (bridge: any) => {
    setEditingBridge(bridge);
    setEditName(bridge.name || '');
    setEditLocation(bridge.location || '');
    setEditIsActive(bridge.isActive !== false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBridge) return;
    if (!editName || !editName.trim()) {
      toast.error('Weight Bridge Name is required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/weight-bridges/${editingBridge.id}`, {
        name: editName,
        location: editLocation,
        isActive: editIsActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weight Bridge updated successfully!');
      setEditingBridge(null);
      fetchBridges();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update Weight Bridge');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (bridge: any) => {
    const newActive = !bridge.isActive;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/weight-bridges/${bridge.id}`, {
        isActive: newActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Weight Bridge ${newActive ? 'activated' : 'deactivated'} successfully!`);
      fetchBridges();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this Weight Bridge?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/weight-bridges/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weight Bridge deleted successfully!');
      fetchBridges();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete Weight Bridge');
    }
  };

  // Filter bridges
  const filteredBridges = bridges.filter(b => {
    if (statusFilter === 'active') return b.isActive !== false;
    if (statusFilter === 'inactive') return b.isActive === false;
    return true;
  });

  const handleCancel = () => {
    setShowForm(false);
    setName('');
    setLocation('');
    setIsActive(true);
  };

  return (
    <Container>
      <Title>
        ⚖️ Weight Bridge Management
        <AddButton onClick={() => { setShowForm(true); setEditingBridge(null); }}>
          + Add Weight Bridge
        </AddButton>
      </Title>

      {/* Create Form - shown only when Add button is clicked */}
      {showForm && (
        <FormCard>
          <SectionTitle>Create New Weight Bridge</SectionTitle>
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Label>Weight Bridge Name *</Label>
              <Input
                type="text"
                placeholder="e.g. MILL WEIGHT BRIDGE 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </FormGroup>
            <FormGroup>
              <Label>Location</Label>
              <Input
                type="text"
                placeholder="e.g. Gate 1 / Yard B / Main Mill"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
              />
            </FormGroup>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <Button type="submit" disabled={loading}>Create Bridge</Button>
              <CancelButton type="button" onClick={handleCancel} disabled={loading}>Cancel</CancelButton>
            </div>
          </Form>
        </FormCard>
      )}

      {/* Listing */}
      <Card style={{ padding: '1rem' }}>
        <SectionTitle style={{ paddingLeft: '1rem', borderBottom: 'none', marginBottom: '0.5rem' }}>
          <span>
            All Weight Bridges
            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#6b7280', fontWeight: 400 }}>
              ({filteredBridges.length} of {bridges.length})
            </span>
          </span>
        </SectionTitle>

        <SubTabContainer>
          <SubTabButton $active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
            Active Weight Bridges
          </SubTabButton>
          <SubTabButton $active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')}>
            Inactive Weight Bridges
          </SubTabButton>
        </SubTabContainer>
        {bridges.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            No weight bridges found.{' '}
            <button onClick={() => setShowForm(true)} style={{ background: 'none', border: 'none', color: '#f59e0b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              Add one now
            </button>
          </p>
        ) : filteredBridges.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            No {statusFilter} weight bridges found.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <Th>SL No</Th>
                  <Th>Name</Th>
                  <Th>Location</Th>
                  <Th style={{ textAlign: 'center' }}>Status</Th>
                  <Th style={{ textAlign: 'center' }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredBridges.map((bridge, index) => (
                  <tr key={bridge.id} style={{ 
                    opacity: bridge.isActive === false ? 0.7 : 1, 
                    background: bridge.isActive === false ? '#f9fafb' : '#fff' 
                  }}>
                    <Td>{index + 1}</Td>
                    <Td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{bridge.name}</Td>
                    <Td style={{ fontWeight: '600', color: '#059669' }}>{bridge.location || '—'}</Td>
                    <Td style={{ textAlign: 'center' }}>
                      <StatusBadge $active={bridge.isActive !== false}>
                        {bridge.isActive !== false ? '● Active' : '○ Inactive'}
                      </StatusBadge>
                    </Td>
                    <Td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <ActionButton type="button" onClick={() => handleEditClick(bridge)}>
                          ✏️ Edit
                        </ActionButton>
                        <ActionButton 
                          type="button" 
                          variant={bridge.isActive !== false ? 'warning' : 'success'} 
                          onClick={() => handleToggleActive(bridge)}
                          title={bridge.isActive !== false ? 'Deactivate' : 'Activate'}
                        >
                          {bridge.isActive !== false ? 'Deactivate' : 'Activate'}
                        </ActionButton>
                        {!bridge.isUsed && (
                          <ActionButton type="button" variant="danger" onClick={() => handleDelete(bridge.id)}>
                            🗑️ Delete
                          </ActionButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editingBridge && (
        <ModalOverlay onClick={() => setEditingBridge(null)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1e293b' }}>✏️ Edit Weight Bridge</h3>
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <Label style={{ display: 'block', marginBottom: '0.5rem' }}>Weight Bridge Name *</Label>
                  <Input
                    type="text"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label style={{ display: 'block', marginBottom: '0.5rem' }}>Location</Label>
                  <Input
                    type="text"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g. Gate 1 / Yard B"
                  />
                </div>
                <div>
                  <Label style={{ display: 'block', marginBottom: '0.5rem' }}>Active Status</Label>
                  <ToggleSwitch $active={editIsActive}>
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                    />
                    <span className="slider" />
                  </ToggleSwitch>
                  <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: editIsActive ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                    {editIsActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <CancelButton type="button" onClick={() => setEditingBridge(null)}>
                  Cancel
                </CancelButton>
                <Button type="submit" disabled={loading}>
                  Save Changes
                </Button>
              </div>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default WeightBridgeManagement;
