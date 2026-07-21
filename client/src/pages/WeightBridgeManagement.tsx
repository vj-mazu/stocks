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
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #f3f4f6;
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  color: #1f2937;
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
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

const ActionButton = styled.button<{ variant?: 'danger' | 'primary' }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  background: ${props => props.variant === 'danger' ? '#ef4444' : '#2563eb'};
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.variant === 'danger' ? '#dc2626' : '#1d4ed8'};
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

const WeightBridgeManagement: React.FC = () => {
  const [bridges, setBridges] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingBridge, setEditingBridge] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const fetchBridges = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/weight-bridges`, {
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
      await axios.post(`${API_URL}/weight-bridges`, { name, location }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Weight Bridge created successfully!');
      setName('');
      setLocation('');
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
        location: editLocation
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

  return (
    <Container>
      <Title>⚖️ Weight Bridge Management</Title>

      <Card>
        <SectionTitle>Create Weight Bridge</SectionTitle>
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
          <Button type="submit" disabled={loading}>Create Bridge</Button>
        </Form>
      </Card>

      <Card style={{ padding: '1rem' }}>
        <SectionTitle style={{ paddingLeft: '1rem' }}>Active Weight Bridges</SectionTitle>
        {bridges.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>No active weight bridges found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead>
                <tr>
                  <Th>SL No</Th>
                  <Th>Name</Th>
                  <Th>Location</Th>
                  <Th style={{ textAlign: 'center' }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {bridges.map((bridge, index) => (
                  <tr key={bridge.id}>
                    <Td>{index + 1}</Td>
                    <Td style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{bridge.name}</Td>
                    <Td style={{ fontWeight: '600', color: '#059669' }}>{bridge.location || '—'}</Td>
                    <Td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <ActionButton type="button" onClick={() => handleEditClick(bridge)}>
                          ✏️ Edit
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
        <ModalOverlay>
          <ModalContent>
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
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setEditingBridge(null)}
                  style={{ padding: '0.75rem 1.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
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
