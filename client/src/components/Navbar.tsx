import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BulkApprovalModal from './BulkApprovalModal';
import { API_URL } from '../config/api';
import { toast } from '../utils/toast';

const Nav = styled.nav`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1000;
`;

const NavContainer = styled.div`
  width: 100%;
  max-width: none;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
`;

const Logo = styled(Link)`
  color: white;
  font-size: 1.25rem;
  margin: 0;
  font-weight: 700;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  
  &:hover {
    opacity: 0.9;
  }
`;

const HamburgerButton = styled.button`
  display: none;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  line-height: 1;
  z-index: 1002;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 1024px) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto !important;
    min-height: auto !important;
  }
`;

const MobileOverlay = styled.div<{ $open: boolean }>`
  display: none;
  @media (max-width: 1024px) {
    display: ${props => props.$open ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 999;
  }
`;

const NavLinks = styled.div<{ $mobileOpen?: boolean }>`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 0.35rem;
  min-width: 0;

  @media (max-width: 1024px) {
    position: fixed;
    top: 0;
    right: ${props => props.$mobileOpen ? '0' : '-300px'};
    width: 280px;
    height: 100vh;
    height: 100dvh;
    background: #059669; /* Solid fallback for older mobile browsers */
    background: linear-gradient(180deg, #10b981, #047857);
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 4rem 1rem 6rem;
    gap: 0.5rem;
    z-index: 1001;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: ${props => props.$mobileOpen ? '-4px 0 20px rgba(0,0,0,0.4)' : 'none'};
  }
`;

const NavLink = styled(Link) <{ $active: boolean }>`
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85rem;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 1024px) {
    padding: 0.8rem 1rem;
    font-size: 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    white-space: normal;
  }
`;

const DropdownWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownTrigger = styled.button<{ $active: boolean }>`
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85rem;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  border: none;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 1024px) {
    width: 100%;
    justify-content: space-between;
    padding: 0.8rem 1rem;
    font-size: 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    background: rgba(0,0,0,0.1);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  z-index: 2000;
  padding: 0.5rem 0;
  margin-top: 0;
  padding-top: 8px;
  border: 1px solid #e2e8f0;

  &::before {
    content: '';
    position: absolute;
    top: -8px;
    right: 20px;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid white;
  }

  @media (max-width: 1024px) {
    position: static;
    box-shadow: none;
    background: rgba(0,0,0,0.15);
    border: none;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    &::before {
      display: none;
    }
  }
`;

const DropdownLink = styled(Link) <{ $active: boolean }>`
  display: block;
  padding: 0.6rem 1.2rem;
  color: ${props => props.$active ? '#10b981' : '#334155'};
  text-decoration: none;
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: 0.85rem;
  background: ${props => props.$active ? '#f0fdf4' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    color: #10b981;
  }
`;

const DropdownDivider = styled.hr`
  border: none;
  border-top: 1px solid #f1f5f9;
  margin: 0.4rem 0;
`;

const NotificationBadge = styled.span`
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  margin-left: 4px;
`;

const ResampleBadge = styled(NotificationBadge)`
  background: #f97316;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
`;

const UserInfo = styled.div`
  color: white;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  padding-left: 0.75rem;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  white-space: nowrap;

  @media (max-width: 1024px) {
    margin: 1rem 0;
    padding: 1rem 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    justify-content: center;
    font-size: 1rem;
    flex-wrap: wrap;
  }
`;

const UserBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: capitalize;
  font-size: 0.75rem;
`;

const LogoutButton = styled.button`
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s;
  margin-left: 0.5rem;

  &:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  @media (max-width: 1024px) {
    margin: 0 0 2rem 0;
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    border-radius: 8px;
    background: #dc2626;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
`;

const ChangePasswordButton = styled.button`
  background: #f59e0b;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s;
  margin-left: 0.5rem;

  &:hover {
    background: #d97706;
    transform: translateY(-1px);
  }

  @media (max-width: 1024px) {
    margin: 0 0 0.5rem 0;
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    border-radius: 8px;
    background: #f59e0b;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
  z-index: 2001;
`;

const ModalContent = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
`;

const ModalTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2rem;
  color: #1a1a2e;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #374151;
  font-size: 0.9rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.95rem;
  &:focus {
    outline: none;
    border-color: #10b981;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
`;

const ModalButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 0.65rem 1rem;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  background: ${props => props.variant === 'primary' ? '#10b981' : '#f3f4f6'};
  color: ${props => props.variant === 'primary' ? 'white' : '#374151'};
  &:hover {
    background: ${props => props.variant === 'primary' ? '#059669' : '#e5e7eb'};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }
    setSavingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${API_URL}/admin/users/${user?.id}/credentials`, {
        password: newPassword
      }, { headers });
      
      toast.success('Password updated successfully!');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to change password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };
  const [pendingCount, setPendingCount] = useState(0);
  const [resampleCount, setResampleCount] = useState(0);
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);
  const [ledgersDropdownOpen, setLedgersDropdownOpen] = useState(false);
  const [masterDropdownOpen, setMasterDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ledgersRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ledgersRef.current && !ledgersRef.current.contains(event.target as Node)) {
        setLedgersDropdownOpen(false);
      }
      if (workflowRef.current && !workflowRef.current.contains(event.target as Node)) {
        setWorkflowDropdownOpen(false);
      }
      if (masterRef.current && !masterRef.current.contains(event.target as Node)) {
        setMasterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close all dropdowns + mobile menu on route change
  useEffect(() => {
    setLedgersDropdownOpen(false);
    setWorkflowDropdownOpen(false);
    setMasterDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (user && (user.role === 'manager' || user.role === 'ceo' || user.role === 'admin')) {
      fetchPendingCount();
      fetchResampleCount();
      fetchEditApprovalCount();
      const interval = setInterval(fetchPendingCount, 60000);
      const resampleInterval = setInterval(fetchResampleCount, 60000);
      const editApprovalInterval = setInterval(fetchEditApprovalCount, 60000);
      return () => {
        clearInterval(interval);
        clearInterval(resampleInterval);
        clearInterval(editApprovalInterval);
      };
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/arrivals/pending-list');
      const data = response.data as { count: number };
      setPendingCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  const fetchResampleCount = async () => {
    try {
      const response = await axios.get('/sample-entries/tabs/resample-assignments', {
        params: { page: 1, pageSize: 1 }
      });
      const data = response.data as { total?: number; entries?: unknown[] };
      if (typeof data.total === 'number') {
        setResampleCount(data.total);
      } else {
        setResampleCount(Array.isArray(data.entries) ? data.entries.length : 0);
      }
    } catch (error) {
      console.error('Error fetching resample count:', error);
    }
  };

  const fetchEditApprovalCount = async () => {
    try {
      const response = await axios.get('/sample-entries/tabs/edit-approvals');
      const data = response.data as { entries?: unknown[] };
      setEditApprovalCount(Array.isArray(data.entries) ? data.entries.length : 0);
    } catch (error) {
      console.error('Error fetching edit approval count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleApprovalModalClose = () => {
    setShowApprovalModal(false);
    fetchPendingCount();
  };

  const isActive = (path: string) => location.pathname === path;

  const workflowPaths = [
    '/sample-entry', '/rice-sample-entries', '/sample-entry-ledger', '/sample-workflow',
    '/inventory-entry', '/owner-financial', '/manager-financial',
    '/final-review', '/paddy-sample-reports', '/owner-sample-reports', '/allotting-supervisors',
    '/physical-inspection', '/pending-approvals', '/loading-lots', '/cooking-book'
  ];
  const ledgersPaths = ['/ledger', '/rice-ledger', '/sample-entry-ledger', '/hamali-book', '/egb-ledger'];
  const masterPaths = [
    '/locations',
    '/admin/users',
    '/admin/brokers',
    '/admin/varieties',
    '/admin/warehouses',
    '/admin/kunchinittus',
    '/admin/packaging',
    '/admin/paddy-hamali',
    '/admin/rice-hamali'
  ];

  const isWorkflowActive = workflowPaths.some(p => location.pathname === p);
  const isLedgersActive = ledgersPaths.some(p => location.pathname === p);
  const isMasterActive = masterPaths.some(p => location.pathname === p);

  return (
    <Nav>
      <NavContainer>
        <Logo to="/dashboard">KUI Stock Management</Logo>
        <HamburgerButton onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? '✕' : '☰'}
        </HamburgerButton>
        <MobileOverlay $open={mobileMenuOpen} onClick={() => setMobileMenuOpen(false)} />
        <NavLinks $mobileOpen={mobileMenuOpen}>
          {/* Close button inside mobile panel */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'none',
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              width: '40px',
              height: '40px',
              minHeight: '40px',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 1002,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="mobile-close-btn"
          >✕</button>
          <style>{`
            @media (max-width: 1024px) {
              .mobile-close-btn { display: flex !important; }
            }
          `}</style>
          {user?.role !== 'staff' && <NavLink to="/dashboard" $active={isActive('/dashboard')}>Dashboard</NavLink>}
          {user && (user.role === 'staff' || user.role === 'paddy_supervisor') && (
            <>
              <NavLink to="/sample-entry" $active={isActive('/sample-entry')}>Paddy Sample Entry</NavLink>
              <NavLink to="/rice-sample-entries" $active={isActive('/rice-sample-entries')}>Rice Sample Entry</NavLink>
              <NavLink to="/cooking-book" $active={isActive('/cooking-book')}>Cooking Book</NavLink>
              {user.staffType === 'location' && (
                <NavLink to="/physical-inspection" $active={isActive('/physical-inspection')}>Loading Allotted</NavLink>
              )}
            </>
          )}
          {user && (user.role === 'manager' || user.role === 'ceo') && (
            <>
              <NavLink to="/paddy-sample-reports" $active={isActive('/paddy-sample-reports') || isActive('/owner-sample-reports')} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.1 }}>
                Paddy Sample<br />Reports
                {resampleCount > 0 && <ResampleBadge>{resampleCount}</ResampleBadge>}
                {editApprovalCount > 0 && <NotificationBadge>{editApprovalCount}</NotificationBadge>}
              </NavLink>
              <NavLink to="/rice-sample-reports" $active={isActive('/rice-sample-reports')} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.1 }}>Rice Sample<br />Reports</NavLink>
              <NavLink to="/arrivals" $active={isActive('/arrivals')}>Arrivals</NavLink>
              <NavLink to="/records" $active={isActive('/records')}>Records Management</NavLink>
            </>
          )}
          {user && user.role === 'admin' && (
            <>
              <NavLink to="/paddy-sample-reports" $active={isActive('/paddy-sample-reports') || isActive('/owner-sample-reports')} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.1 }}>
                Paddy Sample<br />Reports
                {resampleCount > 0 && <ResampleBadge>{resampleCount}</ResampleBadge>}
                {editApprovalCount > 0 && <NotificationBadge>{editApprovalCount}</NotificationBadge>}
              </NavLink>
              <NavLink to="/rice-sample-reports" $active={isActive('/rice-sample-reports')} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.1 }}>Rice Sample<br />Reports</NavLink>
              <NavLink to="/arrivals" $active={isActive('/arrivals')}>Arrivals</NavLink>
              <NavLink to="/records" $active={isActive('/records')}>Records Management</NavLink>
            </>
          )}

          {/* Ledgers Dropdown - for Manager, CEO and Admin */}
          {(user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'admin') && (
            <DropdownWrapper ref={ledgersRef}>
              <DropdownTrigger
                $active={isLedgersActive}
                onClick={() => {
                  setLedgersDropdownOpen(!ledgersDropdownOpen);
                  setWorkflowDropdownOpen(false);
                  setMasterDropdownOpen(false);
                }}
              >Ledgers ▾</DropdownTrigger>
              {ledgersDropdownOpen && (
                <DropdownMenu>
                  <DropdownLink to="/sample-entry-ledger" $active={isActive('/sample-entry-ledger')}>Paddy Sample Book</DropdownLink>
                  <DropdownLink to="/ledger" $active={isActive('/ledger')}>Kunchinittu Ledger</DropdownLink>
                  <DropdownLink to="/rice-ledger" $active={isActive('/rice-ledger')}>Rice Ledger</DropdownLink>
                  <DropdownLink to="/hamali-book" $active={isActive('/hamali-book')}>Hamali Book</DropdownLink>
                  <DropdownLink to="/egb-ledger" $active={isActive('/egb-ledger')}>EGB Ledger</DropdownLink>
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}

          {/* Show Arrivals/Records for staff too */}
          {user?.role === 'staff' && (
            <>
              <NavLink to="/arrivals" $active={isActive('/arrivals')}>Arrivals</NavLink>
              <NavLink to="/records" $active={isActive('/records')}>Records Management</NavLink>
            </>
          )}
          <NavLink to="/hamali" $active={isActive('/hamali')}>Hamali</NavLink>

          {/* Master Creation Dropdown - for Manager, CEO and Admin */}
          {(user?.role === 'manager' || user?.role === 'ceo' || user?.role === 'admin') && (
            <DropdownWrapper ref={masterRef}>
              <DropdownTrigger
                $active={isMasterActive}
                onClick={() => {
                  setMasterDropdownOpen(!masterDropdownOpen);
                  setLedgersDropdownOpen(false);
                  setWorkflowDropdownOpen(false);
                }}
              >Master Creation ▾</DropdownTrigger>
              {masterDropdownOpen && (
                <DropdownMenu>
                  {user?.role === 'admin' && (
                    <DropdownLink to="/admin/users" $active={isActive('/admin/users')}>User Management</DropdownLink>
                  )}
                  <DropdownLink to="/admin/brokers" $active={isActive('/admin/brokers')}>Broker</DropdownLink>
                  <DropdownLink to="/admin/varieties" $active={isActive('/admin/varieties')}>Variety</DropdownLink>
                  <DropdownLink to="/admin/warehouses" $active={isActive('/admin/warehouses')}>Warehouse</DropdownLink>
                  <DropdownLink to="/admin/kunchinittus" $active={isActive('/admin/kunchinittus')}>Kunchinintu</DropdownLink>
                  <DropdownLink to="/admin/packaging" $active={isActive('/admin/packaging')}>Brand Management</DropdownLink>
                  <DropdownLink to="/admin/paddy-hamali" $active={isActive('/admin/paddy-hamali')}>Paddy Hamali</DropdownLink>
                  <DropdownLink to="/admin/rice-hamali" $active={isActive('/admin/rice-hamali')}>Rice Hamali</DropdownLink>
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}

          {/* Workflow Dropdown */}
          {user && user.role !== 'admin' && user.role !== 'manager' && user.role !== 'staff' && (
            <DropdownWrapper ref={workflowRef}>
              <DropdownTrigger
                $active={isWorkflowActive}
                onClick={() => {
                  setWorkflowDropdownOpen(!workflowDropdownOpen);
                  setLedgersDropdownOpen(false);
                }}
              >
                Workflow ▾
                {pendingCount > 0 && (user.role === 'manager' || user.role === 'ceo' || user.role === 'admin') && (
                  <NotificationBadge>{pendingCount}</NotificationBadge>
                )}
              </DropdownTrigger>
              {workflowDropdownOpen && (
                <DropdownMenu>
                  <DropdownLink to="/sample-entry" $active={isActive('/sample-entry')}>New Paddy Sample</DropdownLink>
                  {(user.role === 'manager' || user.role === 'ceo' || user.role === 'admin') && (
                    <>
                      <DropdownLink to="/sample-workflow" $active={isActive('/sample-workflow')}>Workflow Board</DropdownLink>
                      <DropdownLink to="/pending-approvals" $active={isActive('/pending-approvals')}>
                        Paddy Approvals {pendingCount > 0 ? `(${pendingCount})` : ''}
                      </DropdownLink>
                    </>
                  )}
                  {user.role !== 'staff' && <DropdownDivider />}
                  {(user.role === 'inventory_staff' || user.role === 'admin') && (
                    <DropdownLink to="/inventory-entry" $active={isActive('/inventory-entry')}>Inventory Entry</DropdownLink>
                  )}
                  {(user.role === 'physical_supervisor' || user.role === 'paddy_supervisor') && (
                    <DropdownLink to="/physical-inspection" $active={isActive('/physical-inspection')}>Lots Allotted</DropdownLink>
                  )}
                  {user.role === 'admin' && (
                    <DropdownLink to="/owner-financial" $active={isActive('/owner-financial')}>Owner Financial</DropdownLink>
                  )}
                  {(user.role === 'manager' || user.role === 'ceo' || user.role === 'admin') && (
                    <>
                      <DropdownDivider />
                      {user.role === 'admin' && (
                        <DropdownLink to="/manager-sample-reports" $active={isActive('/manager-sample-reports')}>Manager Sample Reports</DropdownLink>
                      )}
                      <DropdownLink to="/manager-financial" $active={isActive('/manager-financial')}>Manager Financial</DropdownLink>
                      <DropdownLink to="/final-review" $active={isActive('/final-review')}>Final Review</DropdownLink>
                      <DropdownLink to="/allotting-supervisors" $active={isActive('/allotting-supervisors')}>Allot Supervisor</DropdownLink>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <DropdownDivider />
                      <DropdownLink to="/paddy-sample-reports" $active={isActive('/paddy-sample-reports') || isActive('/owner-sample-reports')}>Paddy Sample Reports</DropdownLink>
                    </>
                  )}
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}



          <UserInfo>
            <UserBadge>{user?.role === 'staff' ? 'Paddy Supervisor' : user?.role}</UserBadge>
            <span style={{ textTransform: 'capitalize' }}>{user?.username}</span>
          </UserInfo>
          <ChangePasswordButton onClick={() => setShowPasswordModal(true)}>🔑 Password</ChangePasswordButton>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </NavLinks>
      </NavContainer>

      <BulkApprovalModal
        isOpen={showApprovalModal}
        onClose={handleApprovalModalClose}
        onApprovalComplete={fetchPendingCount}
      />

      {showPasswordModal && (
        <ModalOverlay onClick={() => setShowPasswordModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>✏️ Change Password</ModalTitle>
            <form onSubmit={handlePasswordChange}>
              <FormGroup>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={4}
                />
              </FormGroup>
              <ButtonRow>
                <ModalButton type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </ModalButton>
                <ModalButton type="submit" variant="primary" disabled={savingPassword}>
                  {savingPassword ? 'Saving...' : 'Save Password'}
                </ModalButton>
              </ButtonRow>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </Nav>
  );
};

export default Navbar;
