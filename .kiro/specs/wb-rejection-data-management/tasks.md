# Implementation Plan

## Overview
This implementation plan follows the exploratory bugfix workflow for three critical data management issues in the Weight Bridge (WB) approval system. The plan includes exploration tests to understand the bugs, preservation tests to protect existing behavior, and implementation tasks with verification.

---

## Phase 1: Bug Exploration (Write Tests BEFORE Fix)

- [x] 1. Write bug condition exploration tests for all three bugs
  - **Property 1: Bug Condition** - WB Data Management Issues
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the properties to the concrete failing cases to ensure reproducibility

  ### Bug 1: Data Pollution Test
  - Test that pending WB submissions (wbStatus='pending') are stored in `lorry_transit_details` table (BUG)
  - Test that rejected WB submissions (wbStatus='rejected') remain in `lorry_transit_details` table (BUG)
  - Create WB submission with wbStatus='pending', verify it exists in `lorry_transit_details` with WB fields populated
  - Create pending WB, reject it, verify rejected record remains in `lorry_transit_details` (data pollution)
  - Query `lorry_transit_details` and assert it returns mix of approved, pending, and rejected records (data integrity issue)
  
  ### Bug 2: Missing Rejection Reason Test
  - Test that `SampleEntryDetailModal` does NOT display `wbRejectReason` field when wbStatus='rejected'
  - Create and reject WB with wbRejectReason='Weight mismatch'
  - Render `SampleEntryDetailModal` component
  - Assert: wbRejectReason is NOT visible in rendered output (BUG - UI gap)
  - Document that users cannot see why their WB was rejected
  
  ### Bug 3: Duplicate WB Prevention Test
  - Test that "Add WB" button is visible in Band Malal Book tab even when WB exists from In-Transit tab (BUG)
  - Add WB in In-Transit tab (set millWbId=5, wbNo='WB-123')
  - Navigate to Band Malal Book tab for same lorry
  - Assert: "Add WB" button is VISIBLE (BUG - should be hidden)
  - Attempt to create duplicate WB submission
  - Assert: System ALLOWS creating duplicate (BUG - business rule violation)
  - Test edge case: After rejection (wbStatus='rejected'), button should be VISIBLE to allow re-submission (correct behavior)
  
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found:
    - Pending/rejected WB records in `lorry_transit_details`
    - Mix of approved/pending/rejected data in operational table queries
    - Rejection reason not displayed in UI
    - Duplicate WB button visible across tabs
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

---

## Phase 2: Preservation Tests (Write Tests BEFORE Fix)

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Approved WB Workflows and UI Display
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (approved WB workflows)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  
  ### Test 1: Approved WB Data Flow Preservation
  - Observe: On unfixed code, create WB with wbStatus='approved', verify it goes to `lorry_transit_details`
  - Write property: For all approved WB submissions (wbStatus='approved'), system stores in `lorry_transit_details` with all fields intact
  - Generate random approved WB submissions (various weights, mills, dates)
  - Assert: Data stored in `lorry_transit_details` correctly
  - Assert: All WB fields preserved (grossWeight, tareWeight, netWeight, wbNo, millWbId, etc.)
  
  ### Test 2: Approval Queue Display Preservation
  - Observe: On unfixed code, view approval queue as approver role
  - Write property: For all pending WB submissions, approval queue displays submissions with correct UI, sorting, filtering
  - Generate various pending WB submissions
  - Assert: Queue displays all pending submissions
  - Assert: UI layout, controls, and interactions work correctly
  
  ### Test 3: Field Validation Preservation
  - Observe: On unfixed code, try submitting WB with invalid data (negative weight, missing wbNo)
  - Write property: For all invalid WB submissions, system rejects with appropriate error messages
  - Generate random invalid WB submissions
  - Assert: Validation rules enforced
  - Assert: Error messages match expected patterns
  
  ### Test 4: Modal Other Sections Preservation
  - Observe: On unfixed code, open SampleEntryDetailModal and view quality parameters, physical inspection, place data
  - Write property: For all sample entries, modal displays non-WB sections identically
  - Generate random sample entries with various data combinations
  - Assert: Quality parameters section displays correctly
  - Assert: Physical inspection section displays correctly
  - Assert: Place data section displays correctly
  - Assert: Formatting, layout, interactions unchanged
  
  ### Test 5: Role-Based Access Preservation
  - Observe: On unfixed code, test WB operations with different user roles (staff, approver, admin)
  - Write property: For all user roles, system enforces same permissions
  - Generate scenarios with various role combinations
  - Assert: Staff cannot approve WB
  - Assert: Approvers can approve/reject WB
  - Assert: Admin has full access
  
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 3: Implementation

- [ ] 3. Fix for WB Rejection Data Management

  ### 3.1 Database Schema Changes
  
  - [ ] 3.1.1 Create pending_wb_submissions staging table
    - Create migration file: `server/migrations/[timestamp]_create_pending_wb_submissions.js`
    - Copy all WB-related columns from `lorry_transit_details`:
      - wbInputType, millWbId, partyWbName, wbNo, grossWeight, tareWeight, netWeight
      - sute, suteNetWeight, partyWbEnabled, wbDate
      - partyGrossWeight, partyTareWeight, partyNetWeight, partySute, partySuteNetWeight
      - partyWbNo, partyWbDate, wbAddedBy, wbAddedAt, wbStatus, wbRejectReason
    - Add foreign keys: `physicalInspectionId UUID NOT NULL`, `sampleEntryId UUID NOT NULL`
    - Add timestamps: `createdAt`, `updatedAt`
    - Add indexes on `physicalInspectionId`, `sampleEntryId`, `wbStatus`
    - Run migration to create table
    - _Bug_Condition: isBugCondition1_DataPollution where wbStatus='pending' exists in lorry_transit_details_
    - _Expected_Behavior: Pending WB data stored in pending_wb_submissions, NOT lorry_transit_details_
    - _Preservation: Approved WB data continues to be stored in lorry_transit_details exactly as before_
    - _Requirements: 2.1, 2.2, 3.1, 3.3_
  
  - [ ] 3.1.2 Create rejected_wb_submissions audit table
    - Create migration file: `server/migrations/[timestamp]_create_rejected_wb_submissions.js`
    - Same columns as `pending_wb_submissions`
    - Add `rejectedBy INTEGER` (foreign key to users)
    - Add `rejectedAt TIMESTAMP`
    - Add index on `rejectedAt` for audit queries
    - Run migration to create table
    - _Bug_Condition: isBugCondition1_DataPollution where wbStatus='rejected' remains in lorry_transit_details_
    - _Expected_Behavior: Rejected WB data moved to rejected_wb_submissions audit table_
    - _Preservation: Audit trail maintained, no impact on approved WB workflows_
    - _Requirements: 2.2, 2.3, 3.8_

  ### 3.2 Model Layer Changes
  
  - [ ] 3.2.1 Create PendingWbSubmission model
    - Create file: `server/models/PendingWbSubmission.js`
    - Define Sequelize model with all WB fields
    - Add associations:
      - belongsTo PhysicalInspection
      - belongsTo SampleEntry
      - belongsTo WeightBridge (for millWbId)
      - belongsTo User (for wbAddedBy)
    - Add validation rules matching existing WB validation
    - _Bug_Condition: No staging table architecture in original system_
    - _Expected_Behavior: Separate model for pending WB submissions with proper associations_
    - _Preservation: Does not affect existing LorryTransitDetail model_
    - _Requirements: 2.1, 3.3_
  
  - [ ] 3.2.2 Create RejectedWbSubmission model
    - Create file: `server/models/RejectedWbSubmission.js`
    - Same structure as PendingWbSubmission plus rejectedBy and rejectedAt
    - Add associations to User (rejectedBy)
    - Add audit query methods (e.g., findRecentRejections)
    - _Bug_Condition: Rejected data remains in operational table_
    - _Expected_Behavior: Separate audit model for tracking rejections_
    - _Preservation: Maintains audit trail without affecting operational data_
    - _Requirements: 2.2, 2.3, 3.8_

  ### 3.3 Backend Route Changes
  
  - [ ] 3.3.1 Update WB submission logic in arrivals.js
    - File: `server/routes/arrivals.js`
    - Lines ~8429, ~9449, ~9895: Update WB submission creation
    - When `wbStatus = 'pending'`:
      - Create record in `PendingWbSubmission` instead of `LorryTransitDetail`
      - Include physicalInspectionId, sampleEntryId, and all WB fields
    - When `wbStatus = 'approved'` (auto-approve scenarios):
      - Continue creating in `LorryTransitDetail` as before
    - Add try-catch error handling for both table creations
    - Add transaction support to ensure atomicity
    - _Bug_Condition: isBugCondition1_DataPollution(wbSubmission) where pending data goes to lorry_transit_details_
    - _Expected_Behavior: Pending submissions stored in staging table, approved in operational table_
    - _Preservation: Auto-approved WB submissions continue same flow_
    - _Requirements: 2.1, 3.1, 3.3_
  
  - [ ] 3.3.2 Update WB data retrieval in arrivals.js
    - When fetching lorry details for display:
      - Check BOTH `lorry_transit_details` (for approved) AND `pending_wb_submissions` (for pending)
      - Merge results with proper status indicators
      - Include wbRejectReason field in response
    - Update query to LEFT JOIN both tables
    - Return unified WB data structure to frontend
    - _Bug_Condition: Original system only queries lorry_transit_details_
    - _Expected_Behavior: Queries check both staging and operational tables, return complete WB state_
    - _Preservation: Response format unchanged, only data source expanded_
    - _Requirements: 2.1, 2.4, 3.3_
  
  - [ ] 3.3.3 Update WB approval endpoint in in-transit.js
    - File: `server/routes/in-transit.js`
    - Endpoint: POST /:id/approve-wb (lines ~502-520)
    - Find record in `pending_wb_submissions` by physicalInspectionId
    - Create new record in `lorry_transit_details` with wbStatus='approved'
    - Copy all WB fields from pending submission
    - Delete from `pending_wb_submissions`
    - Update associated Arrival record if exists
    - Use transaction to ensure atomicity
    - _Bug_Condition: Original approval doesn't move data between tables_
    - _Expected_Behavior: Approval promotes data from staging to operational table_
    - _Preservation: Approval workflow UX and permissions unchanged_
    - _Requirements: 2.1, 3.1, 3.2, 3.3_
  
  - [ ] 3.3.4 Update WB rejection endpoint in in-transit.js
    - File: `server/routes/in-transit.js`
    - Endpoint: POST /:id/reject-wb (lines ~585-595)
    - Find record in `pending_wb_submissions` by physicalInspectionId
    - Insert into `rejected_wb_submissions` with rejectedBy and rejectedAt
    - Delete from `pending_wb_submissions`
    - Clear any WB fields from `lorry_transit_details` if they exist
    - Use transaction to ensure atomicity
    - _Bug_Condition: isBugCondition1_DataPollution where rejected data remains in lorry_transit_details_
    - _Expected_Behavior: Rejection moves data to audit table and clears operational table_
    - _Preservation: Rejection workflow UX and permissions unchanged_
    - _Requirements: 2.2, 2.3, 3.2, 3.8_
  
  - [ ] 3.3.5 Update pending WB queries in in-transit.js
    - Approval queue endpoint: Query `pending_wb_submissions` instead of filtering `lorry_transit_details` by wbStatus='pending'
    - Update all queries that look for pending WB submissions
    - Ensure proper joins to get related data (lorry info, place status, etc.)
    - _Bug_Condition: Original queries filter operational table by status_
    - _Expected_Behavior: Queries read from staging table for pending submissions_
    - _Preservation: Approval queue UI and functionality unchanged_
    - _Requirements: 2.1, 3.2, 3.3_
  
  - [ ] 3.3.6 Update approval counts in approvals.js
    - File: `server/routes/approvals.js`
    - Lines ~30-36: Update approval counts query
    - Change from `COUNT(*) FILTER (WHERE "wbStatus" = 'pending') FROM lorry_transit_details`
    - To `COUNT(*) FROM pending_wb_submissions`
    - Update pending entries retrieval (lines ~63-67)
    - Query `pending_wb_submissions` table with joins to `lorry_transit_details` for non-WB fields
    - _Bug_Condition: Original counts include pending data mixed with approved data_
    - _Expected_Behavior: Counts query staging table for accurate pending count_
    - _Preservation: Approval counts display and badge behavior unchanged_
    - _Requirements: 2.1, 3.2, 3.3_

  ### 3.4 Frontend Component Changes
  
  - [ ] 3.4.1 Add rejection reason display in SampleEntryDetailModal
    - File: `client/src/components/SampleEntryDetailModal.tsx`
    - Locate WB data table rendering section
    - Add conditional rendering:
      ```javascript
      {wbStatus === 'rejected' && wbRejectReason && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
            <div>
              <p className="text-sm font-medium text-red-800">Rejection Reason</p>
              <p className="text-sm text-red-700 mt-1">{wbRejectReason}</p>
            </div>
          </div>
        </div>
      )}
      ```
    - Style with red color scheme (#fee2e2 background, #dc2626 text)
    - Place rejection reason alert below rejected WB row in table
    - _Bug_Condition: isBugCondition2_MissingRejectionReason where wbRejectReason not displayed_
    - _Expected_Behavior: Rejection reason prominently displayed to users when WB is rejected_
    - _Preservation: All other modal sections display identically_
    - _Requirements: 2.4, 2.5, 3.4_
  
  - [ ] 3.4.2 Update "Add WB" button visibility logic in Arrivals.tsx
    - File: `client/src/pages/Arrivals.tsx`
    - Line ~9367: Update Band Malal Book tab "Add WB" button logic
    - Replace unconditional button display with:
      ```javascript
      const hasExistingWB = (transitDetail?.millWbId || transitDetail?.wbNo) 
                            && transitDetail?.wbStatus !== 'rejected';
      const showAddWbButton = !hasExistingWB;
      
      // Render button only when showAddWbButton === true
      {showAddWbButton && (
        <button onClick={handleAddWB}>Add WB</button>
      )}
      ```
    - Test edge cases:
      - millWbId present, wbStatus='approved' → button hidden
      - wbNo present, wbStatus='pending' → button hidden
      - wbStatus='rejected' → button visible (allow re-submission)
      - No WB data → button visible
    - _Bug_Condition: isBugCondition3_DuplicateWBAllowed where button visible despite existing WB_
    - _Expected_Behavior: Button hidden when WB exists (pending/approved), visible when rejected or no WB_
    - _Preservation: Button functionality and styling unchanged, only visibility logic updated_
    - _Requirements: 2.6, 2.7, 2.8, 3.4_
  
  - [ ] 3.4.3 Update state synchronization across tabs
    - When WB is added in In-Transit tab:
      - Ensure state update propagates to Band Malal Book tab rendering
      - Use shared state or context to track WB existence across tabs
      - Trigger re-render of Band Malal Book tab when WB data changes
    - Test cross-tab scenarios:
      - Add WB in In-Transit → Switch to Band Malal Book → Verify button hidden
      - Refresh data in one tab → Other tabs reflect updated WB state
    - _Bug_Condition: Original system lacks cross-tab state synchronization_
    - _Expected_Behavior: WB existence tracked consistently across all tabs_
    - _Preservation: Tab navigation and functionality unchanged_
    - _Requirements: 2.6, 2.7, 3.4_

  ### 3.5 Type Definitions
  
  - [ ] 3.5.1 Add TypeScript types for new models
    - File: `client/src/types/arrivals.ts` (or inline types in components)
    - Add type for pending WB submissions:
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
        sute?: number;
        suteNetWeight?: number;
        wbStatus: 'pending';
        wbRejectReason?: string;
        wbAddedBy?: number;
        wbAddedAt?: string;
        createdAt: string;
        updatedAt: string;
      }
      
      interface RejectedWbSubmission extends PendingWbSubmission {
        rejectedBy: number;
        rejectedAt: string;
      }
      ```
    - Update existing WB-related types to include wbRejectReason
    - Ensure type safety across frontend components
    - _Preservation: Existing type definitions unchanged, only extended_
    - _Requirements: 3.4_

  - [ ] 3.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - WB Data Management Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    
    ### Expected Test Results:
    - **Bug 1 Tests**: Pending WB stored in `pending_wb_submissions`, rejected WB in `rejected_wb_submissions`, approved WB in `lorry_transit_details`
    - **Bug 2 Tests**: Rejection reason displayed in `SampleEntryDetailModal` when wbStatus='rejected'
    - **Bug 3 Tests**: "Add WB" button hidden when WB exists (pending/approved), visible when rejected or no WB
    
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - Document that all three bugs are resolved:
      - Data separation architecture working (staging table isolates pending/rejected data)
      - Rejection reasons visible to users
      - Duplicate WB prevention enforced across tabs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Approved WB Workflows Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass:
      - Approved WB data flow identical to original system
      - Approval queue displays correctly with new staging table
      - Field validation rules unchanged
      - Modal other sections display identically
      - Role-based access controls enforced same as before
    - Document that no regressions were introduced
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Phase 4: Final Verification

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite:
    - Bug condition tests (should all pass)
    - Preservation property tests (should all pass)
    - Unit tests for new models and routes
    - Integration tests for full WB workflows
  - Manual testing:
    - Test pending WB submission → verify data in staging table
    - Test WB approval → verify data moves to operational table
    - Test WB rejection → verify data moves to audit table, reason displayed in UI
    - Test duplicate prevention → verify button hidden across tabs
    - Test re-submission after rejection → verify button visible, allows new submission
    - Test approved WB workflow → verify behavior identical to before fix
  - Verify no regressions:
    - All existing WB workflows work correctly
    - Approval queues display properly
    - Role-based permissions enforced
    - UI displays correctly across all sections
  - If any issues arise, document and ask the user for guidance
  - _Requirements: All (2.1-2.8, 3.1-3.8)_

---

## Notes

**Bug Condition Methodology Applied:**
- **C(X)**: Bug Conditions identified for three bugs (data pollution, missing rejection reason, duplicate WB)
- **P(result)**: Expected behaviors defined (staging table architecture, rejection reason display, button visibility logic)
- **¬C(X)**: Preservation requirements for non-buggy inputs (approved WB workflows, other UI sections, role-based access)
- **F → F'**: Original system to fixed system transformation through staged implementation

**Key Success Criteria:**
1. All pending WB data isolated in staging table (no pollution of operational data)
2. All rejected WB data moved to audit table with rejection reasons preserved
3. Rejection reasons visible to users in UI
4. Duplicate WB submissions prevented across tabs
5. Re-submission after rejection allowed
6. All existing approved WB workflows preserved without regressions
