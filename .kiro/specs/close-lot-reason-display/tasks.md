# Implementation Plan

- [-] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Display Closed Reason When Present
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (closedReason values not displayed)
  - **Scoped PBT Approach**: For deterministic bug, scope the property to concrete failing cases - sample entries with non-empty closedReason values
  - Test that for all sample entries where `lotAllotment.closedReason` is not null and not empty, the Sample Entry Detail Modal displays the "Lot Closed Reason" field with the correct value
  - Generate test cases with various closedReason values:
    - Standard reason: "Party only sent 2000 of 4000 bags"
    - Custom reason: "Lot marked as completed by manager"
    - Long reason: Text with 100+ characters
  - Run test on UNFIXED code (before implementing interface changes and UI rendering)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Modal displays lot information but omits closedReason field
    - TypeScript may show compile errors if interface is missing the field
    - API response may or may not include closedReason
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [~] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Closed Lots and Existing Display
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Sample entries with lotAllotment.closedReason = null
    - Sample entries with lotAllotment.closedReason = ''
    - Sample entries without lot allotment
    - All other modal sections (quality parameters, cooking reports, etc.)
  - Write property-based tests capturing observed behavior patterns:
    - For all entries where closedReason is null or empty, verify no "Lot Closed Reason" field appears
    - For all entries, verify existing fields (supervisor, allotted bags, closed timestamp) display correctly
    - For all modal sections unrelated to closedReason, verify they render identically
  - Property-based testing generates many test cases for stronger preservation guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for Close Lot Reason Display

  - [~] 3.1 Update TypeScript interface to include closedReason field
    - Open `client/src/components/SampleEntryDetailModal.tsx`
    - Locate the `lotAllotment` interface definition (around lines 143-156)
    - Add `closedReason?: string | null;` to the interface
    - Verify TypeScript compilation succeeds without errors
    - _Bug_Condition: isBugCondition(input) where input.lotAllotment.closedReason is not null and not empty_
    - _Expected_Behavior: closedReason field is included in TypeScript interface and available for rendering_
    - _Preservation: All existing interface fields and type definitions remain unchanged_
    - _Requirements: 1.3, 2.3_

  - [~] 3.2 Verify backend API returns closedReason field
    - Test the API endpoint that returns sample entry details (inspect in DevTools Network tab)
    - If closedReason is missing from the response, update the backend route:
      - Check `server/routes/sample-entries.js` or equivalent route file
      - Ensure the Sequelize query includes the `closedReason` field in the lot allotment join
      - Verify the field is not excluded in any serialization logic
    - Test API response to confirm closedReason is now included when present
    - _Bug_Condition: isBugCondition(input) where API should return closedReason but does not_
    - _Expected_Behavior: API response includes closedReason field when it exists in database_
    - _Preservation: All other API response fields remain unchanged_
    - _Requirements: 1.1, 2.3_

  - [~] 3.3 Add UI rendering logic in SampleEntryDetailModal
    - Locate where "Final Price Remarks" section is rendered in the modal
    - After the "Final Price Remarks" section, add conditional rendering for "Lot Closed Reason":
    ```tsx
    {detailEntry?.lotAllotment?.closedReason && (
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#fffbeb',
        border: '1px solid #fbbf24',
        borderRadius: '4px',
        wordBreak: 'break-word'
      }}>
        <div style={{
          fontWeight: 'bold',
          marginBottom: '4px',
          color: '#92400e'
        }}>
          Lot Closed Reason
        </div>
        <div style={{ color: '#78350f' }}>
          {detailEntry.lotAllotment.closedReason}
        </div>
      </div>
    )}
    ```
    - Ensure proper text wrapping for long reason text (use `word-break: break-word`)
    - Make the field visually distinct with background color and border
    - Position it after "Final Price Remarks" column
    - _Bug_Condition: isBugCondition(input) where closedReason exists but is not rendered in UI_
    - _Expected_Behavior: "Lot Closed Reason" field displays when closedReason has value, with proper styling and positioning_
    - _Preservation: All other modal sections and rendering logic remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Display Closed Reason When Present
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 on FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that for all sample entries with non-empty closedReason:
      - "Lot Closed Reason" field is displayed in the modal
      - Field contains the correct closedReason text
      - Field is visually distinct (background color, border)
      - Field is positioned after "Final Price Remarks"
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Closed Lots and Existing Display
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 on FIXED code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - Entries with null closedReason show no "Lot Closed Reason" field
      - Entries with empty closedReason show no "Lot Closed Reason" field
      - All existing fields continue to display correctly
      - All other modal sections remain unchanged
    - If any preservation test fails, investigate and fix the regression
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [~] 4. Checkpoint - Ensure all tests pass
  - Run all bug condition and preservation tests
  - Verify no TypeScript compilation errors
  - Test manually with browser:
    - Open Sample Entry Detail Modal for a closed lot with reason
    - Verify "Lot Closed Reason" displays correctly with proper styling
    - Verify long text wraps properly without overflow
    - Open modal for a lot without closedReason
    - Verify no "Lot Closed Reason" field appears
    - Verify all other modal sections display correctly
  - Ensure all tests pass, ask the user if questions arise
