# Tasks: Inventory Role Transit Workflow Enhancement

## Task 1: Database Migration - Make WB Fields Optional
**Dependencies**: None  
**Estimated effort**: 1 hour

### Subtasks:
1.1. Create migration file `999_make_wb_fields_optional.js`
1.2. Write up() function to:
    - Change wbNo to allow NULL with default 'PENDING'
    - Change grossWeight to allow NULL with default 0
    - Change tareWeight to allow NULL with default 0
    - Change netWeight to allow NULL with default 0
    - Update existing NULL records with defaults
1.3. Write down() function for rollback
1.4. Test migration on development database
1.5. Verify existing arrivals still work

**Acceptance Criteria**:
- Migration runs without errors
- Existing arrivals remain valid
- New arrivals can be created without WB fields
- Database constraints allow NULL values

---

## Task 2: Update Arrival Model
**Dependencies**: Task 1  
**Estimated effort**: 30 minutes

### Subtasks:
2.1. Update `server/models/Arrival.js`
2.2. Change wbNo: allowNull to true, add defaultValue: 'PENDING'
2.3. Change grossWeight: allowNull to true, add defaultValue: 0
2.4. Change tareWeight: allowNull to true, add defaultValue: 0
2.5. Change netWeight: allowNull to true, add defaultValue: 0
2.6. Test model validation

**Acceptance Criteria**:
- Model matches database schema
- Can create Arrival without WB fields
- Defaults apply correctly

---

## Task 3: Create Role-Based Auth Middleware
**Dependencies**: None  
**Estimated effort**: 1 hour

### Subtasks:
3.1. Create `server/middleware/roleAuth.js`
3.2. Implement `requireInventoryRole` middleware
    - Allow: inventory_staff, admin, manager, ceo
    - Return 403 for others
3.3. Implement `requireApproverRole` middleware
    - Allow: admin, manager, ceo only
    - Return 403 for others
3.4. Add unit tests for middleware
3.5. Test with different user roles

**Acceptance Criteria**:
- Middleware correctly identifies allowed roles
- Returns 403 with clear error message for unauthorized
- Works with existing auth middleware

---

## Task 4: Create Approvals API Routes
**Dependencies**: Task 3  
**Estimated effort**: 2 hours

### Subtasks:
4.1. Create `server/routes/approvals.js`
4.2. Implement `GET /api/approvals/count`
    - Query pending Place count
    - Query pending WB count
    - Return total count
    - Apply requireApproverRole middleware
4.3. Implement `GET /api/approvals/pending`
    - Fetch lorry_transit_details with pending status
    - Include related inspection and sample data
    - Apply requireApproverRole middleware
4.4. Register routes in server/index.js
4.5. Test endpoints with Postman/curl
4.6. Add error handling

**Acceptance Criteria**:
- Count endpoint returns correct numbers
- Pending endpoint returns complete data
- Only admin/ceo/manager can access
- Proper error responses

---

## Task 5: Update Existing Arrivals Routes
**Dependencies**: Task 2, Task 3  
**Estimated effort**: 2 hours

### Subtasks:
5.1. Update `POST /api/arrivals/:id/place`
    - Add requireInventoryRole middleware
    - Test with inventory_staff role
5.2. Update `POST /api/arrivals/:id/wb`
    - Add requireInventoryRole middleware
    - Test with inventory_staff role
5.3. Enhance `POST /api/arrivals/:id/approve-place`
    - Add detailed logging
    - Improve error handling
    - Handle NULL WB fields gracefully
    - Return created arrival details
5.4. Test complete workflow:
    - inventory_staff submits Place (no WB)
    - admin approves Place
    - Verify arrival created in database
    - Verify entry shows in Band Malal Book

**Acceptance Criteria**:
- inventory_staff can submit Place and WB
- inventory_staff cannot approve
- admin/manager/ceo can approve
- Arrival created successfully without WB
- No database errors
- Entry visible in Band Malal Book

---

## Task 6: Create Notification Badge Component
**Dependencies**: Task 4  
**Estimated effort**: 1.5 hours

### Subtasks:
6.1. Create `client/src/components/NotificationBadge.tsx`
6.2. Implement badge component:
    - Fetch count from `/api/approvals/count`
    - Display count (99+ for > 99)
    - Auto-refresh every 30 seconds
    - Only show if count > 0
6.3. Add CSS styling:
    - Red circular badge
    - Position top-right of menu item
    - Visible and prominent
6.4. Test with different counts (0, 1, 50, 150)

**Acceptance Criteria**:
- Badge shows correct count
- Updates automatically
- Shows 99+ for large numbers
- Hidden when count is 0
- Visually appealing

---

## Task 7: Implement Role-Based Navigation
**Dependencies**: None  
**Estimated effort**: 2 hours

### Subtasks:
7.1. Update `client/src/components/Navbar.tsx`
7.2. Define navigation items with role restrictions:
    ```typescript
    interface NavigationItem {
      path: string;
      label: string;
      roles: string[];
      badge?: boolean;
    }
    ```
7.3. Filter navigation items based on user role
7.4. Integrate NotificationBadge for Pending Approvals
7.5. Test with different roles:
    - inventory_staff: Only sees In-Transit
    - admin/manager/ceo: Sees all tabs + badge
    - staff: Sees all tabs (no badge)

**Acceptance Criteria**:
- inventory_staff only sees In-Transit tab
- Admin/manager/ceo see all tabs
- Pending Approvals shows badge
- Navigation is clean and intuitive
- No console errors

---

## Task 8: Enhance Pending Approvals Page
**Dependencies**: Task 4, Task 6  
**Estimated effort**: 2 hours

### Subtasks:
8.1. Update `client/src/pages/PendingApprovals.tsx`
8.2. Fetch data from `/api/approvals/pending`
8.3. Display approvals grouped by type:
    - Pending Place approvals
    - Pending WB approvals
8.4. Show relevant details:
    - Lorry number
    - Variety
    - Bags
    - Submitted by (user)
    - Submission time
8.5. Add Approve/Reject actions
8.6. Show loading and error states

**Acceptance Criteria**:
- All pending approvals displayed
- Clear grouping by type
- Shows complete information
- Approve/Reject work correctly
- Good UX (loading, errors)

---

## Task 9: Update In-Transit Page for Inventory Role
**Dependencies**: Task 7  
**Estimated effort**: 1 hour

### Subtasks:
9.1. Update `client/src/pages/Arrivals.tsx` (In-Transit page)
9.2. Add role-based UI adjustments:
    - Show "Submit for Approval" instead of "Approve" for inventory_staff
    - Disable approval buttons for inventory_staff
9.3. Add helpful text for inventory_staff:
    - "Your submission will be reviewed by management"
9.4. Test UI with inventory_staff role

**Acceptance Criteria**:
- inventory_staff sees correct UI
- Cannot trigger approval actions
- Clear messaging about workflow
- Other roles unaffected

---

## Task 10: Integration Testing
**Dependencies**: All previous tasks  
**Estimated effort**: 2 hours

### Subtasks:
10.1. Test complete workflow as inventory_staff:
     - Login as inventory_staff
     - Navigate to In-Transit
     - Submit Place for a lorry
     - Verify cannot approve
     - Verify submission appears in database
10.2. Test approval workflow as admin:
     - Login as admin
     - See notification badge
     - Open Pending Approvals
     - Approve Place
     - Verify entry in Band Malal Book
10.3. Test WB optional scenario:
     - Submit Place without WB
     - Approve Place
     - Verify arrival created with WB='PENDING'
     - Add WB later in Band Malal Book
10.4. Test role restrictions:
     - Verify inventory_staff cannot access other tabs
     - Verify other roles retain full access
10.5. Test edge cases:
     - Multiple pending approvals
     - Badge count accuracy
     - Concurrent submissions

**Acceptance Criteria**:
- All workflows complete successfully
- No errors in console or logs
- Role restrictions enforced
- Notification badge accurate
- Data integrity maintained

---

## Task 11: Documentation and Deployment
**Dependencies**: Task 10  
**Estimated effort**: 1 hour

### Subtasks:
11.1. Update README with:
     - New inventory_staff role
     - Workflow changes
     - API endpoints
11.2. Create deployment checklist:
     - Run migration
     - Restart server
     - Clear caches
     - Verify functionality
11.3. Prepare rollback plan
11.4. Monitor production logs

**Acceptance Criteria**:
- Documentation complete and clear
- Deployment plan ready
- Rollback procedure documented
- Team trained on new workflow

---

## Summary

**Total Tasks**: 11  
**Total Estimated Effort**: 16 hours  
**Critical Path**: Tasks 1 → 2 → 5 → 10

**Priority Order**:
1. Task 1, 2 (Database changes - foundation)
2. Task 5 (Fix approval workflow - critical bug)
3. Task 3, 4 (Backend APIs)
4. Task 6, 7 (Frontend navigation)
5. Task 8, 9 (UI enhancements)
6. Task 10, 11 (Testing and deployment)
