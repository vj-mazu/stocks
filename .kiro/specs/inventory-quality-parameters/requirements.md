# Requirements: Inventory Quality Parameters in Band Malal Book

## Feature Overview

Implement a new feature in the Band Malal Book tab to record **Inventory Quality Parameters** with a two-way approval workflow. This allows inventory staff to record quality checks (Lot Avg or Full Lorry Avg) after goods are placed in warehouses, requiring admin approval before display.

## User Stories

### US-1: Add Inventory Quality Parameters
**As an** Inventory Staff/Mill Staff/Location Staff/Inventory Head  
**I want to** add quality parameters (Lot Avg or Full Lorry Avg) for Band Malal Book entries  
**So that** we can track warehouse-level quality checks

**Acceptance Criteria:**
- Button "🔬 Inventory Quality" appears in Band Malal Book table Actions column
- Clicking opens a collapsible form
- Form allows selection of type: Lot Avg OR Full Lorry Avg
- Form includes all quality fields (moisture, cutting, bend, grains, mix, kandu, oil, sk, wb_r, wb_bk, wb_t, smell, paddy_wb, p_color, remarks)
- Form does NOT include bags field
- Submitted data is saved with status "pending"
- Only authorized roles can access the add interface

### US-2: Approve/Reject Inventory Quality Parameters
**As an** Admin/Owner/Manager/CEO  
**I want to** approve or reject pending inventory quality parameters  
**So that** only verified quality data is visible to users

**Acceptance Criteria:**
- Pending quality parameters show approve/reject buttons
- Approve button changes status to "approved" and records approver ID
- Reject button changes status to "rejected" and requires reject reason
- Only approved parameters appear in Sample Entry Detail Modal
- Only authorized roles can approve/reject

### US-3: View Inventory Quality Parameters
**As a** User  
**I want to** see approved inventory quality parameters in the Sample Entry Detail Modal  
**So that** I can review warehouse-level quality checks

**Acceptance Criteria:**
- New card "Inventory Quality Parameters" appears below main Quality Parameters
- Shows Lot Avg and/or Full Lorry Avg data (only approved entries)
- Displays reporter name and approver name
- Shows all quality fields in table format

## Functional Requirements

### FR-1: Role-Based Access Control
**Priority:** Must Have

**Description:**
- **Add Quality:** Mill Staff, Location Staff, Inventory Staff, Inventory Head
- **Approve/Reject:** Admin, Owner, Manager, CEO

### FR-2: Quality Parameter Fields
**Priority:** Must Have

**Description:**
The following fields must be recorded:
- Type: lot_avg | full_lorry_avg
- Moisture
- Dry Moisture
- Cutting
- Bend
- Grains Count
- Mix, S Mix, L Mix
- Kandu
- Oil
- SK
- WB R, WB BK, WB T
- Smell
- Paddy WB
- P Color
- Remarks

**Note:** Bags field is explicitly excluded.

### FR-3: Approval Workflow
**Priority:** Must Have

**Description:**
- Default status: "pending"
- Admin/Owner/Manager/CEO can approve → status becomes "approved"
- Admin/Owner/Manager/CEO can reject → status becomes "rejected" (requires reason)
- Only approved parameters are visible in Sample Entry Detail Modal

### FR-4: Data Association
**Priority:** Must Have

**Description:**
- Each quality parameter record links to a specific LorryTransitDetail (Band Malal Book entry)
- Tracks reporter (user who added the data)
- Tracks approver (user who approved the data)
- Multiple quality records can exist per entry (e.g., one Lot Avg + one Full Lorry Avg)

## Non-Functional Requirements

### NFR-1: Performance
- Adding quality parameters should complete within 2 seconds
- Approving/rejecting should complete within 2 seconds
- Loading Band Malal Book with quality parameters should not exceed 3 seconds

### NFR-2: Data Integrity
- All database constraints must be enforced
- Cascading deletes: if LorryTransitDetail is deleted, quality parameters are deleted
- User references must be valid

### NFR-3: Usability
- Form validation with clear error messages
- Success/error toasts for all actions
- Collapsible UI to avoid cluttering the table

## Business Rules

### BR-1: Quality Type Restriction
- Each entry can have maximum 1 Lot Avg record in "approved" status
- Each entry can have maximum 1 Full Lorry Avg record in "approved" status
- Pending/rejected records do not count toward this limit

### BR-2: Authorization
- Users cannot approve their own submissions
- Only the designated approver roles can change status from pending

### BR-3: Data Visibility
- Pending and rejected quality parameters are visible only to:
  - The reporter
  - Approvers (Admin/Owner/Manager/CEO)
- Approved quality parameters are visible to all users in the Sample Entry Detail Modal

## Out of Scope

- Editing existing quality parameters (must reject and resubmit)
- Bulk approval/rejection
- Quality parameter history/audit log
- Notifications for approval/rejection

## Success Metrics

- ✅ Inventory staff can successfully add quality parameters
- ✅ Admins can successfully approve/reject parameters
- ✅ Approved parameters display correctly in Sample Entry Detail Modal
- ✅ No unauthorized access to add/approve features
- ✅ Zero data loss or corruption
- ✅ All validations work correctly

## Open Questions

None. Requirements are clear.

## References

- Band Malal Book Feature: `client/src/pages/Arrivals.tsx`
- Sample Entry Detail Modal: `client/src/components/SampleEntryDetailModal.tsx`
- Arrivals API Routes: `server/routes/arrivals.js`
