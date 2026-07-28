/**
 * Notification Badge Component
 * 
 * Displays a badge with the count of pending approvals
 * Auto-refreshes every 30 seconds
 * Only visible when count > 0
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';

interface NotificationBadgeProps {
  show: boolean;
}

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }
`;

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ show }) => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!show) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/approvals/count');
        setCount(response.data.total || 0);
      } catch (error: any) {
        // Silently fail if user doesn't have permission
        if (error.response?.status !== 403) {
          console.error('Failed to fetch approval count:', error);
        }
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchCount();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchCount, 30000);
    
    return () => clearInterval(interval);
  }, [show]);

  // Don't show badge if count is 0 or still loading initially
  if (!show || count === 0) {
    return null;
  }

  return (
    <Badge title={`${count} pending approval${count > 1 ? 's' : ''}`}>
      {count > 99 ? '99+' : count}
    </Badge>
  );
};

export default NotificationBadge;
