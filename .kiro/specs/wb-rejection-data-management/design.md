# WB Rejection Data Management Bugfix Design

## Overview

This bugfix addresses three critical data management issues in the Weight Bridge (WB) approval workflow:

1. **Data Pollution**: Rejected WB data remains in `lorry_transit_details` table, contaminating operational data with invalid entries
2. **User Experience Gap**: Users cannot see rejection reasons, preventing them from understanding what corrections are needed
3. **Duplicate WB Prevention**: Users can create duplicate WB entries across different tabs (In-Transit and Band Malal Book)

The fix strategy involves:
- Implementing a staging table architecture where pending WB submissions are stored separately from approved data
- Displaying rejection reasons prominently in the UI when users view rejected WB submissions
- Implementing button visibility logic that prevents duplicate WB entries across tabs while allowing re-submission after rejection

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bugs - when pending/rejected WB data pollutes lorry_transit_details, when rejection reasons are hidden, and when duplicate WB entries are allowed
- **Property (P)**: The desired behavior - approved WB data only in lorry_transit_details, visible rejection reasons for users, and prevention of duplicate WB submissions
- **Preservation**: All existing WB approval workflows, data validation, role-based access controls, and UI display formats must remain unchanged
- **lorry_transit_details**: The main operational table in `server/models/LorryTransitDetail.js` that stores approved physical inspection and WB data
- **pending_wb_submissions**: New staging table (to be created) that temporarily holds WB submissions with wbStatus='pending' until approved or rejected
- **wbStatus**: The status field that determines WB approval state - valid values: 'none', 'pending', 'approved', 'rejected'
- **wbRejectReason**: TEXT field that stores the reason why a WB submission was rejected (currently exists but not displayed to users)
- **millWbId**: Foreign key to WeightBridge table indicating the mill's weight bridge was used
- **wbNo**: String field storing the weight bridge slip number
- **SampleEntryDetailModal**: React component in `client/src/components/SampleEntryDetailModal.tsx` that displays lorry details including WB information

## Bug Details

### Bug Condition

The bugs manifest in three distinct scenarios:

**Bug 1: Data Pollution**
When a WB submission is created with wbStatus='pending' or rejected with wbStatus='rejected', the system stores all weight data (grossWeight, tareWeight, netWeight, wbNo, millWbId, etc.) directly in the `lorry_transit_details` table. This means the operational table contains invalid/rejected data alongside approved data, compromising data integrity and making queries ambiguous.

**Bug 2: Missing Rejection Reason Display**
When a user opens the `SampleEntryDetailModal` to view lorry details, the UI displays WB data from `lorry_transit_details` but does not render the `wbRejectReason` field even when wbStatus='rejected'. Users see that their submission was rejected (via status indicator) but have no visibility into why it was rejected or what needs to be corrected.

**Bug 3: Duplicate WB Entries**
When a user adds WB data in the In-Transit tab, the system saves `millWbId` or `wbNo` to the lorry's transit detail record. However, when the same user navigates to the Band Malal Book tab for the same lorry, the "Add WB" button is still displayed. Clicking this button allows creating a duplicate WB submission for the same lorry, violating business rules.

**Formal Specification:**
```
FUNCTION isBugCondition1_DataPollution(wbSubmission)
  INPUT: wbSubmission with fields { wbStatus, wbNo, grossWeight, tareWeight, netWeight, millWbId, ... }
  OUTPUT: boolean
  
  RETURN (wbSubmission.wbStatus IN ['pending', 'rejected'])
         AND wbSubmission EXISTS IN lorry_transit_details table
         AND (wbSubmission.wbNo IS NOT NULL 
              OR wbSubmission.grossWeight IS NOT NULL
              OR wbSubmission.millWbId IS NOT NULL)
END FUNCTION

FUNCTION isBugCondition2_MissingRejectionReason(displayContext)
  INPUT: displayContext with { wbStatus, wbRejectReason, uiRenderState }
  OUTPUT: boolean
  
  RETURN displayContext.wbStatus = 'rejected'
         AND displayContext.wbRejectReason IS NOT NULL
         AND displayContext.uiRenderState DOES NOT display wbRejectReason field
END FUNCTION

FUNCTION isBugCondition3_DuplicateWBAllowed(lorryContext)
  INPUT: lorryContext with { millWbId, wbNo, currentTab, addWBButtonVisible }
  OUTPUT: boolean
  
  RETURN (lorryContext.millWbId IS NOT NULL OR lorryContext.wbNo IS NOT NULL)
         AND lorryContext.currentTab = 'Band Malal Book'
         AND lorryContext.addWBButtonVisible = true
END FUNCTION
```

### Examples

**Bug 1 Examples:**
- Lorry ABC-1234 has WB submission with wbStatus='pending', wbNo='WB-5678', netWeight=5000 kg in lorry_transit_details → Data pollution (pending data in operational table)
- Lorry XYZ-9999 has WB rejected with wbStatus='rejected', wbRejectReason='Incorrect weight' in lorry_transit_details → Data pollution (rejected data remains in operational table)
- Query `SELECT * FROM lorry_transit_details WHERE wbNo IS NOT NULL` returns mix of approved, pending, and rejected records → Ambiguous operational data

**Bug 2 Examples:**
- User opens SampleEntryDetailModal for lorry with wbStatus='rejected' and wbRejectReason='Weight mismatch with party slip' → User sees "Rejected ❌" indicator but no rejection reason displayed
- Staff member checks why their WB was rejected → Cannot find the rejection reason anywhere in the UI → Confused about what to fix
- Approver rejects WB with detailed reason "Gross weight exceeds lorry capacity" → Submitter never sees this reason → Repeats same mistake

**Bug 3 Examples:**
- User adds WB in In-Transit tab (millWbId=5, wbNo='WB-123') → Navigates to Band Malal Book tab → Sees "Add WB" button again → Clicks and creates duplicate WB submission
- Lorry has approved WB with wbNo='WB-456' → User switches to Band Malal Book tab → "Add WB" button still visible → Could create conflicting WB data
- Edge case: WB is rejected (wbStatus='rejected') → "Add WB" button should be visible to allow re-submission with corrections

## Expected Behavior

### Bug 1: Data Separation Architecture

**Pending Data Isolation:**
All WB submissions with wbStatus='pending' SHALL be stored in a new `pending_wb_submissions` table, NOT in `lorry_transit_details`. This table will have the same WB-related columns as `lorry_transit_details` plus metadata for tracking.

**Rejection Handling:**
When an approver rejects a WB submission, the system SHALL:
- Option A (Recommended): Delete the record from `pending_wb_submissions` and insert it into a `rejected_wb_submissions` audit table with full rejection metadata
- Option B (Alternative): Simply delete from `pending_wb_submissions` (rejection reason stored in a separate audit log)

**Approved Data Promotion:**
Only when wbStatus='approved' SHALL the system copy/move the WB data from `pending_wb_submissions` to `lorry_transit_details`.

**Result:**
The `lorry_transit_details` table will contain ONLY approved WB data (wbStatus='approved' or wbStatus='none'), ensuring data integrity and query clarity.

### Bug 2: Rejection Reason Visibility

**UI Display Requirement:**
When a user opens the `SampleEntryDetailModal` for a lorry with rejected WB, the system SHALL display the `wbRejectReason` prominently.

**Implementation Options:**
- Option A: Add a new column "Rejection Reason" to the WB data table in the modal
- Option B: Display a red alert box below the rejected WB row with the rejection reason
- Option C: Show rejection reason as a tooltip on the "Rejected ❌" status indicator

**User Benefit:**
Users will immediately understand why their submission was rejected and what corrections are needed for re-submission.

### Bug 3: Duplicate WB Prevention

**Button Visibility Logic:**
The "Add WB" button in Band Malal Book tab SHALL be hidden when:
- `millWbId IS NOT NULL` (mill WB exists)
- OR `wbNo IS NOT NULL` (party WB exists)
- AND `wbStatus IN ['pending', 'approved']` (not rejected)

**Re-submission After Rejection:**
The "Add WB" button SHALL remain visible when:
- `wbStatus = 'rejected'` (allows user to fix and re-submit)
- OR no WB data exists (`millWbId IS NULL AND wbNo IS NULL`)

**Verification Check:**
The button visibility logic SHALL check BOTH `millWbId` AND `wbNo` fields to determine if WB already exists, preventing edge cases where only one field is populated.

### Preservation Requirements

**Unchanged Behaviors:**
- Approved WB data flow: When wbStatus='approved', system continues to save/update weight data in lorry_transit_details exactly as before
- Approval queue display: Approvers continue to see all pending WB submissions in the In-Transit approval queue
- Field validation: All existing validation rules for WB fields (weight, wbNo, millWbId, etc.) remain enforced
- Sample Entry Detail Modal: All other sections of the modal (quality parameters, physical inspection, place data) display exactly as before
- Role-based access: WB functionality continues to enforce existing role-based permissions (only approvers can approve/reject)
- Date and weight formatting: All numeric and date formatting conventions remain unchanged
- Multi-user isolation: Different lorry records remain isolated; no cross-contamination between users' data
- Referential integrity: All foreign key relationships (to mills, warehouses, users) remain intact

**Scope:**
All inputs and workflows that do NOT involve pending/rejected WB data management, rejection reason display, or duplicate WB prevention should be completely unaffected by this fix. This includes:
- Mouse clicks on other buttons and navigation
- Quality report workflows
- Physical inspection workflows
- Place approval workflows
- Offering and pricing workflows
- All other modal sections and data displays

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Architectural Design Issue - No Staging Table**: 
   - The original design stores all WB submissions directly in `lorry_transit_details` regardless of approval status
   - No separation between pending, approved, and rejected data
   - File: `server/routes/arrivals.js` lines ~8429, ~9449, ~9895 - `LorryTransitDetail.create()` called immediately on WB submission
   - File: `server/routes/in-transit.js` lines 585-589 - Rejection updates wbStatus but doesn't move/delete data

2. **UI Component Gap - Missing Rejection Reason Field**:
   - The `SampleEntryDetailModal.tsx` component renders WB data table but doesn't include wbRejectReason field
   - The data is fetched from backend (wbRejectReason exists in model and is populated) but not displayed in UI
   - File: `client/src/components/SampleEntryDetailModal.tsx` - WB table rendering section does not include rejection reason column

3. **Incomplete Button Visibility Logic**:
   - The "Add WB" button visibility check in Band Malal Book tab doesn't verify if WB already exists from In-Transit tab
   - File: `client/src/pages/Arrivals.tsx` line ~9367 - Button displayed without checking millWbId/wbNo existence
   - Missing cross-tab state synchronization for WB data existence

## Correctness Properties

Property 1: Bug Condition 1 - Data Separation for Pending/Rejected WB

_For any_ WB submission where wbStatus='pending' or wbStatus='rejected', the fixed system SHALL store the data in staging/audit tables (pending_wb_submissions or rejected_wb_submissions), NOT in the operational lorry_transit_details table. Only approved WB data (wbStatus='approved') SHALL exist in lorry_transit_details.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition 2 - Rejection Reason Visibility

_For any_ lorry with rejected WB (wbStatus='rejected' AND wbRejectReason IS NOT NULL), the fixed SampleEntryDetailModal SHALL display the wbRejectReason prominently to the user, enabling them to understand why the submission was rejected and what corrections are needed.

**Validates: Requirements 2.4, 2.5**

Property 3: Bug Condition 3 - Duplicate WB Prevention

_For any_ lorry where WB data already exists (millWbId IS NOT NULL OR wbNo IS NOT NULL) AND wbStatus IN ['pending', 'approved'], the fixed Band Malal Book tab SHALL hide the "Add WB" button. When wbStatus='rejected', the button SHALL remain visible to allow re-submission.

**Validates: Requirements 2.6, 2.7, 2.8**

Property 4: Preservation - Approved WB Data Flow

_For any_ WB submission where wbStatus='approved', the fixed system SHALL produce exactly the same behavior as the original system, saving the weight data to lorry_transit_details with all existing validation, formatting, and referential integrity preserved.

**Validates: Requirements 3.1, 3.3, 3.4, 3.6, 3.7, 3.8**

Property 5: Preservation - Approval Queue and Permissions

_For any_ user accessing WB functionality, the fixed system SHALL display approval queues, enforce role-based permissions, and maintain multi-user data isolation exactly as the original system does.

**Validates: Requirements 3.2, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**1. Database Schema Changes**

**File**: `server/migrations/[timestamp]_create_pending_wb_submissions.js` (new migration file)

**Specific Changes**:
1. **Create pending_wb_submissions table**: 
   - Copy all WB-related columns from `lorry_transit_details` (wbInputType, millWbId, partyWbName, wbNo, grossWeight, tareWeight, netWeight, sute, suteNetWeight, partyWbEnabled, wbDate, partyGrossWeight, partyTareWeight, partyNetWeight, partySute, partySuteNetWeight, partyWbNo, partyWbDate, wbAddedBy, wbAddedAt, wbStatus, wbRejectReason)
   - Add foreign keys: `physicalInspectionId UUID NOT NULL`, `sampleEntryId UUID NOT NULL`
   - Add timestamps: `createdAt`, `updatedAt`
   - Add indexes on `physicalInspectionId`, `sampleEntryId`, `wbStatus`

2. **Create rejected_wb_submissions audit table** (Option A - Recommended):
   - Same columns as `pending_wb_submissions`
   - Add `rejectedBy INTEGER` (foreign key to users)
   - Add `rejectedAt TIMESTAMP`
   - Add index on `rejectedAt` for audit queries

**File**: `server/migrations/[timestamp]_create_rejected_wb_submissions.js` (new migration file)

**2. Model Layer Changes**

**File**: `server/models/PendingWbSubmission.js` (new model file)

**Specific Changes**:
1. **Create PendingWbSubmission model**: Define Sequelize model with all WB fields
2. **Add associations**: belongsTo PhysicalInspection, belongsTo SampleEntry, belongsTo WeightBridge, belongsTo User (wbAddedBy)

**File**: `server/models/RejectedWbSubmission.js` (new model file)

**Specific Changes**:
1. **Create RejectedWbSubmission model**: Same structure as PendingWbSubmission plus rejectedBy and rejectedAt

**3. Backend Route Changes**

**File**: `server/routes/arrivals.js`

**Specific Changes**:
1. **Update WB submission logic** (lines ~8429, ~9449, ~9895):
   - When `wbStatus = 'pending'`: Create record in `PendingWbSubmission` instead of `LorryTransitDetail`
   - When `wbStatus = 'approved'` (auto-approve scenarios): Continue creating in `LorryTransitDetail` as before
   - Add try-catch error handling for both table creations

2. **Update WB data retrieval**:
   - When fetching lorry details, check BOTH `lorry_transit_details` (for approved) AND `pending_wb_submissions` (for pending)
   - Merge results with proper status indicators

**File**: `server/routes/in-transit.js`

**Specific Changes**:
1. **Update approval endpoint** (POST /:id/approve-wb, lines ~502-520):
   - Find record in `pending_wb_submissions` by physicalInspectionId
   - Create new record in `lorry_transit_details` with wbStatus='approved', copy all WB fields
   - Delete from `pending_wb_submissions`
   - Update associated Arrival record if exists

2. **Update rejection endpoint** (POST /:id/reject-wb, lines ~585-595):
   - Find record in `pending_wb_submissions` by physicalInspectionId
   - Option A: Insert into `rejected_wb_submissions` with rejectedBy and rejectedAt, then delete from `pending_wb_submissions`
   - Option B: Simply delete from `pending_wb_submissions`
   - Clear any WB fields from `lorry_transit_details` if they exist

3. **Update pending WB queries**:
   - Approval queue endpoint: Query `pending_wb_submissions` instead of filtering `lorry_transit_details` by wbStatus='pending'

**File**: `server/routes/approvals.js`

**Specific Changes**:
1. **Update approval counts query** (lines ~30-36):
   - Change from `COUNT(*) FILTER (WHERE "wbStatus" = 'pending') FROM lorry_transit_details`
   - To `COUNT(*) FROM pending_wb_submissions`

2. **Update pending entries retrieval** (lines ~63-67):
   - Query `pending_wb_submissions` table
   - Join with `lorry_transit_details` to get place status and other non-WB fields

**4. Frontend Component Changes**

**File**: `client/src/components/SampleEntryDetailModal.tsx`

**Specific Changes**:
1. **Add rejection reason display** (in WB data table rendering section):
   - Add conditional rendering: If `wbStatus === 'rejected' && wbRejectReason`, display rejection reason
   - Implementation Option A: Add new table column "Rejection Reason" 
   - Implementation Option B: Add red alert box below rejected WB row with icon and rejection text
   - Styling: Use red color scheme (#fee2e2 background, #dc2626 text) to match existing error styling

**File**: `client/src/pages/Arrivals.tsx`

**Specific Changes**:
1. **Update "Add WB" button visibility logic** (Band Malal Book tab, line ~9367):
   - Current: Button displayed unconditionally
   - Fixed: 
     ```javascript
     const hasExistingWB = (transitDetail?.millWbId || transitDetail?.wbNo) 
                           && transitDetail?.wbStatus !== 'rejected';
     const showAddWbButton = !hasExistingWB;
     ```
   - Render button only when `showAddWbButton === true`

2. **Update state synchronization**:
   - When WB is added in In-Transit tab, ensure state update propagates to Band Malal Book tab rendering
   - Use shared state or context to track WB existence across tabs

**5. Type Definitions**

**File**: `client/src/types/arrivals.ts` (or inline types in components)

**Specific Changes**:
1. **Add type for pending WB submissions**:
   ```typescript
   interface PendingWbSubmission {
     id: string;
     physicalInspectionId: string;
     sampleEntryId: string;
     wbInputType?: string;
     millWbId?: number;
     wbNo?: string;
     grossWeight?: number;
     tareWeight?: number;
     netWeight?: number;
     wbStatus: 'pending';
     wbRejectReason?: string;
     wbAddedBy?: number;
     wbAddedAt?: string;
     createdAt: string;
     updatedAt: string;
   }
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: 
1. **Exploratory Bug Condition Checking** - Surface counterexamples demonstrating the bugs on unfixed code
2. **Fix Checking** - Verify the fix resolves all three bugs
3. **Preservation Checking** - Ensure existing approved WB workflows remain unchanged

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate all three bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate WB submissions, rejections, and duplicate attempts. Run these tests on the UNFIXED code to observe failures and understand the root causes.

**Test Cases**:

1. **Data Pollution Test - Pending WB** (will fail on unfixed code):
   - Create WB submission with wbStatus='pending'
   - Assert: Record exists in `lorry_transit_details` table (BUG - should be in staging table)
   - Assert: WB fields (wbNo, grossWeight) are populated in `lorry_transit_details` (BUG - polluting operational table)

2. **Data Pollution Test - Rejected WB** (will fail on unfixed code):
   - Create pending WB, then reject it
   - Assert: Record with wbStatus='rejected' still exists in `lorry_transit_details` (BUG - should be moved/deleted)
   - Assert: Rejected data remains queryable in operational table (BUG - data integrity issue)

3. **Missing Rejection Reason Test** (will fail on unfixed code):
   - Create and reject WB with wbRejectReason='Weight mismatch'
   - Render `SampleEntryDetailModal` component with this data
   - Assert: wbRejectReason is NOT visible in rendered output (BUG - UI gap)
   - Assert: User cannot see rejection reason anywhere in modal (BUG - UX issue)

4. **Duplicate WB Test - Cross Tab** (will fail on unfixed code):
   - Add WB in In-Transit tab (set millWbId=5)
   - Navigate to Band Malal Book tab for same lorry
   - Assert: "Add WB" button is VISIBLE (BUG - should be hidden)
   - Click "Add WB" button
   - Assert: System ALLOWS creating duplicate WB submission (BUG - business rule violation)

5. **Duplicate WB Test - After Rejection Edge Case** (may fail on unfixed code):
   - Add and reject WB (wbStatus='rejected')
   - Check Band Malal Book tab
   - Assert: "Add WB" button should be VISIBLE to allow re-submission (correct behavior)
   - Click "Add WB" button
   - Assert: System ALLOWS re-submission (correct behavior for this edge case)

**Expected Counterexamples**:
- Pending and rejected WB records persist in `lorry_transit_details` table
- Queries on `lorry_transit_details` return mix of approved, pending, and rejected data
- `SampleEntryDetailModal` renders WB status but not rejection reason
- "Add WB" button visible in Band Malal Book even when WB exists from In-Transit tab
- Possible causes: No staging table architecture, missing UI field, incomplete button visibility logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed system produces the expected behavior.

**Bug 1 Fix Verification:**
```
FOR ALL wbSubmission WHERE isBugCondition1_DataPollution(wbSubmission) DO
  result := createWBSubmission_fixed(wbSubmission)
  
  IF wbSubmission.wbStatus = 'pending' THEN
    ASSERT result EXISTS IN pending_wb_submissions
    ASSERT result NOT EXISTS IN lorry_transit_details
  END IF
  
  IF wbSubmission.wbStatus = 'rejected' THEN
    ASSERT result NOT EXISTS IN pending_wb_submissions
    ASSERT result EXISTS IN rejected_wb_submissions (Option A) OR deleted (Option B)
    ASSERT result NOT EXISTS IN lorry_transit_details
  END IF
  
  IF wbSubmission.wbStatus = 'approved' THEN
    ASSERT result EXISTS IN lorry_transit_details
    ASSERT result NOT EXISTS IN pending_wb_submissions
  END IF
END FOR
```

**Bug 2 Fix Verification:**
```
FOR ALL displayContext WHERE isBugCondition2_MissingRejectionReason(displayContext) DO
  renderedModal := renderSampleEntryDetailModal_fixed(displayContext)
  
  ASSERT renderedModal CONTAINS wbRejectReason field
  ASSERT wbRejectReason IS VISIBLE to user
  ASSERT wbRejectReason text matches displayContext.wbRejectReason
END FOR
```

**Bug 3 Fix Verification:**
```
FOR ALL lorryContext WHERE isBugCondition3_DuplicateWBAllowed(lorryContext) DO
  uiState := renderBandMalalBookTab_fixed(lorryContext)
  
  IF (lorryContext.millWbId IS NOT NULL OR lorryContext.wbNo IS NOT NULL)
     AND lorryContext.wbStatus IN ['pending', 'approved'] THEN
    ASSERT uiState.addWBButtonVisible = false
  END IF
  
  IF lorryContext.wbStatus = 'rejected' OR (lorryContext.millWbId IS NULL AND lorryContext.wbNo IS NULL) THEN
    ASSERT uiState.addWBButtonVisible = true
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL approvedWbSubmission WHERE approvedWbSubmission.wbStatus = 'approved' DO
  ASSERT createWBSubmission_original(approvedWbSubmission) = createWBSubmission_fixed(approvedWbSubmission)
  ASSERT approvedWbSubmission EXISTS IN lorry_transit_details (both original and fixed)
  ASSERT all WB fields are identical (original vs fixed)
END FOR

FOR ALL uiContext WHERE uiContext DOES NOT involve rejected WB OR duplicate prevention DO
  ASSERT renderSampleEntryDetailModal_original(uiContext) = renderSampleEntryDetailModal_fixed(uiContext)
  ASSERT all other modal sections display identically
END FOR

FOR ALL approvalQueueContext WHERE approvalQueueContext involves viewing/approving pending WB DO
  ASSERT approvalQueue_original behavior = approvalQueue_fixed behavior
  ASSERT role-based permissions enforced identically
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss (e.g., unusual weight values, null fields, concurrent updates)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for approved WB workflows, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Approved WB Data Flow Preservation**: 
   - Observe: On unfixed code, create WB with wbStatus='approved', verify it goes to `lorry_transit_details`
   - Test: Generate random approved WB submissions (various weights, mills, dates)
   - Assert: Fixed system stores in `lorry_transit_details` identically to original
   - Assert: All WB fields match exactly (no data loss or corruption)

2. **Approval Queue Display Preservation**:
   - Observe: On unfixed code, view approval queue as approver role
   - Test: Generate various pending WB submissions, fetch approval queue
   - Assert: Fixed system displays same pending submissions (now from staging table)
   - Assert: Queue UI, sorting, filtering work identically

3. **Field Validation Preservation**:
   - Observe: On unfixed code, try submitting WB with invalid data (negative weight, missing wbNo)
   - Test: Generate random invalid WB submissions
   - Assert: Fixed system rejects with same error messages
   - Assert: Validation rules unchanged

4. **Modal Other Sections Preservation**:
   - Observe: On unfixed code, open SampleEntryDetailModal and view quality parameters, physical inspection, place data
   - Test: Generate random sample entries with various data combinations
   - Assert: Fixed modal displays all non-WB sections identically
   - Assert: Formatting, layout, interactions unchanged

5. **Role-Based Access Preservation**:
   - Observe: On unfixed code, test WB operations with different user roles (staff, approver, admin)
   - Test: Generate scenarios with various role combinations
   - Assert: Fixed system enforces same permissions
   - Assert: Staff cannot approve, approvers can approve/reject, etc.

### Unit Tests

- Test `pending_wb_submissions` table creation and constraints
- Test `rejected_wb_submissions` table creation and audit fields
- Test PendingWbSubmission model CRUD operations
- Test RejectedWbSubmission model CRUD operations
- Test WB submission creation routes (pending vs approved paths)
- Test WB approval endpoint (move from pending to approved)
- Test WB rejection endpoint (move from pending to rejected/deleted)
- Test SampleEntryDetailModal rejection reason rendering (with/without rejection reason)
- Test "Add WB" button visibility logic (various millWbId/wbNo/wbStatus combinations)
- Test edge case: Re-submission after rejection (button visible)
- Test edge case: No WB exists (button visible)

### Property-Based Tests

- Generate random WB submissions with various wbStatus values → Verify correct table placement (pending vs approved vs rejected)
- Generate random approval/rejection flows → Verify data moves correctly between staging and operational tables
- Generate random lorry contexts (with/without existing WB) → Verify "Add WB" button visibility follows rules
- Generate random sample entries with various WB states → Verify modal displays rejection reasons when appropriate
- Generate many approved WB workflows → Verify preservation of existing behavior (no regressions)

### Integration Tests

- Full flow: Create pending WB → Approver approves → Verify data in lorry_transit_details
- Full flow: Create pending WB → Approver rejects with reason → Verify data in rejected_wb_submissions (or deleted) → Verify rejection reason displayed in modal
- Full flow: Add WB in In-Transit tab → Navigate to Band Malal Book tab → Verify "Add WB" button hidden
- Full flow: Reject WB → Navigate to Band Malal Book tab → Verify "Add WB" button visible for re-submission
- Full flow: Create approved WB (auto-approve scenario) → Verify behavior identical to original system
- Multi-user flow: User A submits WB, User B (approver) approves, User A views updated modal
- Cross-tab flow: Multiple tabs open, WB added in one tab, other tabs refresh and hide "Add WB" button
