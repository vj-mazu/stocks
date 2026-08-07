import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: ('owner' | 'staff' | 'manager' | 'md' | 'admin' | 'quality_supervisor' | 'physical_supervisor' | 'inventory_staff' | 'inventory_head' | 'financial_account' | 'paddy_supervisor')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // MD has the same access as Admin; CEO inherits manager access
  const isInvHead = user?.role === 'inventory_head' || (user?.role === 'inventory_staff' && user?.subRole === 'head');
  const effectiveRole = user?.role === 'ceo' ? 'manager' : user?.role === 'md' ? 'admin' : isInvHead ? 'inventory_head' : user?.role;

  if (roles && user && !roles.includes(effectiveRole as any)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;