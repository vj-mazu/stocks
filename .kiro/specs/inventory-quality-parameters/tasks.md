# Implementation Tasks: Inventory Quality Parameters

## Overview

Implement Inventory Quality Parameters feature for Band Malal Book with two-way approval workflow.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Database Setup",
      "tasks": ["1", "2", "3"]
    },
    {
      "name": "Wave 2: Backend API",
      "tasks": ["4", "5", "6", "7"]
    },
    {
      "name": "Wave 3: Frontend Form",
      "tasks": ["8", "9"]
    },
    {
      "name": "Wave 4: Frontend Display",
      "tasks": ["10"]
    },
    {
      "name": "Wave 5: Testing",
      "tasks": ["11"]
    }
  ]
}
```

## Tasks

- [x] 1. Create Database Migration

**Description**: Create migration file `145_create_inventory_quality_parameters.js` to add the `inventory_quality_parameters` table with all required fields.

**Implementation**:
- Create file `server/migrations/145_create_inventory_quality_parameters.js`
- Define table with columns: id (UUID), lorry_transit_detail_id, type (ENUM), status (ENUM), all quality fields, audit fields
- Add foreign key constraints to lorry_transit_details and users tables
- Set up CASCADE delete for lorry_transit_detail_id
- Include created_at and updated_at timestamps

**Acceptance Criteria**:
- Migration file created in correct location
- All columns defined with correct data types
- Foreign key constraints properly configured
- Migration runs without errors: `npm run migrate`
- Table created successfully in database

**Files**: `server/migrations/145_create_inventory_quality_parameters.js`

---

- [x] 2. Create Sequelize Model

**Description**: Create `InventoryQualityParameter` model with all fields and proper field mappings (camelCase to snake_case).

**Implementation**:
- Create file `server/models/InventoryQualityParameter.js`
- Define model with all fields matching migration schema
- Map camelCase properties to snake_case database columns
- Define associations: belongsTo LorryTransitDetail, belongsTo User (reporter), belongsTo User (approver)
- Enable timestamps with underscored option

**Acceptance Criteria**:
- Model file created with correct structure
- All fields properly defined with data types
- Field mappings (camelCase to snake_case) correct
- Associations defined correctly
- Model exports properly for registration

**Files**: `server/models/InventoryQualityParameter.js`

---

- [x] 3. Register Model and Associations

**Description**: Register `InventoryQualityParameter` model in `models/index.js` and set up associations with `LorryTransitDetail`.

**Implementation**:
- Add model registration: `db.InventoryQualityParameter = require('./InventoryQualityParameter')(sequelize, Sequelize);`
- Add association in LorryTransitDetail: `hasMany` to InventoryQualityParameter
- Ensure associations are bidirectional
- Test model loading by starting server

**Acceptance Criteria**:
- Model registered in db object
- LorryTransitDetail hasMany association added
- Server starts without model loading errors
- Associations work in queries

**Files**: `server/models/index.js`

---

- [x] 4. Create Add Quality Parameters Endpoint

**Description**: Implement `POST /arrivals/bmb/:transitDetailId/inventory-quality` endpoint to allow authorized users to submit quality parameters.

**Implementation**:
- Add endpoint after existing Band Malal Book endpoints in `server/routes/arrivals.js`
- Check authorization: Mill Staff, Location Staff, Inventory Staff, Inventory Head
- Validate transit detail exists
- Validate type field (lot_avg or full_lorry_avg)
- Check for existing approved record of same type (prevent duplicates)
- Create InventoryQualityParameter with status "pending"
- Return created record with reporter association
- Add proper error handling

**Acceptance Criteria**:
- Endpoint responds to POST requests
- Authorization works correctly (only authorized roles can add)
- Validation prevents invalid type values
- Prevents duplicate approved records of same type
- Creates record with status "pending"
- Returns created record with reporter info
- Returns 403 for unauthorized users

**Files**: `server/routes/arrivals.js`

---

- [x] 5. Create Approve Quality Parameters Endpoint

**Description**: Implement `POST /arrivals/bmb/inventory-quality/:qualityId/approve` endpoint to allow admins to approve pending quality parameters.

**Implementation**:
- Add endpoint after add endpoint in `server/routes/arrivals.js`
- Check authorization: Admin, Owner, Manager, CEO
- Validate quality parameter exists
- Check status is "pending"
- Prevent self-approval (reporter cannot approve their own submission)
- Check for existing approved record of same type
- Update status to "approved" and set approvedByUserId
- Return updated record with reporter and approver associations
- Add proper error handling

**Acceptance Criteria**:
- Endpoint responds to POST requests
- Authorization works correctly (only approvers can approve)
- Validates record exists and is pending
- Prevents self-approval
- Prevents duplicate approved records
- Updates status to "approved"
- Records approver user ID
- Returns updated record with associations

**Files**: `server/routes/arrivals.js`

---

- [x] 6. Create Reject Quality Parameters Endpoint

**Description**: Implement `POST /arrivals/bmb/inventory-quality/:qualityId/reject` endpoint to allow admins to reject pending quality parameters with a reason.

**Implementation**:
- Add endpoint after approve endpoint in `server/routes/arrivals.js`
- Check authorization: Admin, Owner, Manager, CEO
- Validate reject reason is provided
- Validate quality parameter exists
- Check status is "pending"
- Update status to "rejected", set approvedByUserId and rejectReason
- Return updated record with reporter and approver associations
- Add proper error handling

**Acceptance Criteria**:
- Endpoint responds to POST requests
- Authorization works correctly
- Requires reject reason (validates not empty)
- Validates record exists and is pending
- Updates status to "rejected"
- Records reject reason and approver ID
- Returns updated record with associations

**Files**: `server/routes/arrivals.js`

---

- [x] 7. Update Band Malal Book Endpoint to Include Quality Parameters

**Description**: Modify `GET /arrivals/band-malal-book` endpoint to fetch and include inventory quality parameters for each entry.

**Implementation**:
- Find the existing Band Malal Book endpoint (around line 1360)
- Inside the mapping loop for each LorryTransitDetail, add query to fetch InventoryQualityParameter records
- Include reporter and approver associations
- Order by createdAt DESC
- Add `inventoryQualityParameters` field to response object
- Test that endpoint returns quality params without breaking existing functionality

**Acceptance Criteria**:
- Band Malal Book endpoint returns inventory quality parameters
- Parameters include reporter and approver data
- Sorted by creation date (newest first)
- Existing endpoint functionality unchanged
- No performance degradation

**Files**: `server/routes/arrivals.js`

---

- [x] 8. Add Inventory Quality Button and Form in Band Malal Book Table

**Description**: Add "🔬 Inventory Quality" button in Band Malal Book table Actions column that opens a collapsible form to add quality parameters.

**Implementation**:
- Add state for expanded inventory quality row ID
- Add state for inventory quality type (separate from form data): 'lot_avg' | 'full_lorry_avg'
- Add state for inventory quality form data (all quality fields, NO type field in form)
- Add authorization check for current user (canAddInventoryQuality)
- Add button in Actions column (only if authorized)
- Add collapsible row below main row with form
- Form includes:
  - **Toggle Buttons at top**: Lot Avg or Full Lorry Avg (styled like Physical Inspection toggle - yes/no pattern)
  - Active button: purple background (#9333ea), white text
  - Inactive button: light purple background (#e9d5ff), dark purple text
  - All quality fields in 4-column grid layout: moisture, dry moisture, cutting, bend, grains, mix, s_mix, l_mix, kandu, oil, sk, wb_r, wb_bk, wb_t, smell, paddy_wb, p_color
  - Remarks textarea (full width)
  - Submit and Cancel buttons at bottom right
- Implement form submission handler calling POST endpoint with selected type from toggle
- Show success/error toasts
- Refresh Band Malal Book entries after submission
- Style form matching Band Malal Book design (purple theme)
- Toggle functionality: clicking button updates type state, visual feedback matches Physical Inspection pattern

**Acceptance Criteria**:
- Button appears only for authorized users
- Clicking button expands collapsible form row
- **Toggle buttons display at top**: "📊 Lot Avg" and "🚚 Full Lorry Avg"
- Toggle buttons styled like Physical Inspection (active: purple bg + white text, inactive: light purple bg + dark purple text)
- Clicking toggle button switches type visually
- Form includes all required quality fields in 4-column grid
- Remarks textarea spans full width
- Form validation prevents empty submissions
- Submit sends selected type from toggle + form data to API endpoint
- Success toast shows after submission
- Error toast shows on failure
- Table refreshes after submission
- Cancel button closes form
- Form styling matches Band Malal Book purple theme

**Files**: `client/src/pages/Arrivals.tsx`

---

- [x] 9. Add Approve/Reject Buttons for Pending Quality Parameters

**Description**: Add approve and reject buttons in the inventory quality form row for admins to review pending submissions.

**Implementation**:
- Check if current user is approver (Admin, Owner, Manager, CEO)
- If entry has pending inventory quality parameters, show them in the expanded row
- For each pending parameter, show:
  - Type (Lot Avg or Full Lorry Avg)
  - All quality field values
  - Reporter name
  - Approve button (green)
  - Reject button (red) - opens reject reason input
- Implement approve handler calling approve endpoint
- Implement reject handler with reject reason modal/input
- Show success/error toasts
- Refresh entries after approve/reject
- Style matching design

**Acceptance Criteria**:
- Approve/Reject buttons appear only for approvers
- Pending parameters display correctly
- Approve button works and updates status
- Reject button requires reason input
- Reject reason validation works
- Success toasts show after actions
- Table refreshes after actions
- Approved/Rejected records update display

**Files**: `client/src/pages/Arrivals.tsx`

---

- [x] 10. Display Approved Quality Parameters in Sample Entry Detail Modal

**Description**: Add "Inventory Quality Parameters" card in Sample Entry Detail Modal below the main Quality Parameters card to display approved quality records.

**Implementation**:
- Find the Quality Parameters section in SampleEntryDetailModal.tsx
- Add new card below it titled "Inventory Quality Parameters" with 🔬 icon
- Filter inventoryQualityParameters array to show only approved records
- Display in table format with columns:
  - Type (Lot Avg / Full Lorry Avg)
  - Moisture, Dry Moisture, Cutting, Bend, Grains
  - Mix, S Mix, L Mix, Kandu, Oil, SK
  - WB R, WB BK, WB T
  - Smell, Paddy WB, P Color
  - Remarks
  - Reporter (username)
  - Approver (username)
- Show "-" for empty fields
- Use purple theme matching modal design
- Only render card if approved records exist

**Acceptance Criteria**:
- Card appears below Quality Parameters
- Shows only approved records
- Lot Avg and Full Lorry Avg display separately
- All quality fields display correctly
- Reporter and approver names show
- Empty fields show "-"
- Card styling matches modal design
- Card hidden if no approved records

**Files**: `client/src/components/SampleEntryDetailModal.tsx`

---

- [x] 11. End-to-End Testing

**Description**: Test complete flow from adding quality parameters to approval to display in modal.

**Test Scenarios**:
1. **Authorization Test**:
   - Login as Inventory Staff → Verify can add quality params
   - Login as regular user → Verify cannot add quality params
   - Login as Admin → Verify can approve/reject
   - Login as Inventory Staff → Verify cannot approve

2. **Add Quality Parameters Test**:
   - Click "🔬 Inventory Quality" button
   - Select "Lot Avg" type
   - Fill quality fields
   - Submit → Verify saved as pending
   - Verify success toast
   - Verify table refreshes

3. **Duplicate Prevention Test**:
   - Add Lot Avg → Approve
   - Try to add another Lot Avg → Verify error prevents duplicate

4. **Approval Test**:
   - Login as Admin
   - View pending quality param
   - Click Approve → Verify status changes to approved
   - Verify approver name recorded

5. **Rejection Test**:
   - Add quality param
   - Login as Admin
   - Click Reject → Enter reason
   - Verify status changes to rejected
   - Verify reject reason recorded

6. **Modal Display Test**:
   - Open Sample Entry Detail Modal
   - Verify "Inventory Quality Parameters" card appears
   - Verify approved Lot Avg displays
   - Verify approved Full Lorry Avg displays
   - Verify reporter and approver names show

7. **Self-Approval Prevention Test**:
   - Login as Admin
   - Add quality param
   - Try to approve own submission → Verify error

8. **Data Flow Test**:
   - Add Lot Avg → Approve → Verify appears in modal
   - Add Full Lorry Avg → Approve → Verify both show in modal

**Acceptance Criteria**:
- All test scenarios pass
- No errors in browser console
- No errors in server logs
- Data flows correctly through entire system
- Authorization works correctly
- Validations prevent invalid data
- UI updates correctly after all actions

**Files**: Manual testing in browser

---

## Verification Checklist

### Backend
- [x] Migration runs without errors
- [x] Model loads without errors
- [ ] Add endpoint works and returns 201
- [ ] Approve endpoint works and returns 200
- [ ] Reject endpoint works and returns 200
- [ ] Authorization prevents unauthorized access
- [ ] Validation prevents invalid data
- [ ] Self-approval prevention works
- [ ] Duplicate prevention works

### Frontend
- [ ] Button appears for authorized users
- [ ] Form opens and closes correctly
- [ ] Form validation works
- [ ] Form submission succeeds
- [ ] Approve/Reject buttons work
- [ ] Modal card displays approved records
- [ ] Toasts show for success/error
- [ ] Table refreshes after actions

### Integration
- [ ] Complete flow works end-to-end
- [ ] No data loss
- [ ] No performance issues
- [ ] All roles tested
- [ ] All edge cases handled

## Notes

- Run migration before starting: `npm run migrate`
- Test with different user roles
- Verify database constraints work
- Check for SQL injection vulnerabilities
- Verify no N+1 query problems
