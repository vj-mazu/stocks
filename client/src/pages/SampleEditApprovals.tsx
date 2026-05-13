import React from 'react';
import AdminSampleBook2 from './AdminSampleBook2';

interface SampleEditApprovalsProps {
  entryType?: string;
  excludeEntryType?: string;
  onCountChange?: (count: number) => void;
}

const SampleEditApprovals: React.FC<SampleEditApprovalsProps> = ({ entryType, excludeEntryType, onCountChange }) => {
  return <AdminSampleBook2 entryType={entryType} excludeEntryType={excludeEntryType} approvalMode="only" onApprovalCountChange={onCountChange} />;
};

export default SampleEditApprovals;
