# Requirements: Inventory Role Transit Workflow Enhancement

## Overview
Enhance the In-Transit to Band Malal Book workflow with proper role-based access control for Inventory Staff roles and fix Weight Bridge optional field issues.

## Business Requirements

### BR-1: Role-Based Access Control
**Priority**: High  
**As a**: System Administrator  
**I want**: Inventory Staff to only access In-Transit functionality  
**So that**: They can submit Place and Weight Bridge information without accessing other system features

**Acceptance Criteria**:
- Inventory Staff (`inventory_staff` role) can ONLY access "In-Transit" tab
- All other navigation tabs are hidden for Inventory Staff
- Inventory Staff CANNOT approve their own submissions
- Admin, CEO, Manager roles retain full access to all tabs

### BR-2: Approval Workflow Separation
**Priority**: High  
**As a**: Admin/CEO/Manager  
**I want**: To see and approve Place & Weight Bridge submissions from Inventory Staff  
**So that**: I can maintain quality control over storage decisions and weight verification

**Acceptance Criteria**:
- Only Admin, CEO, Manager roles can access "Pending Approvals" tab
- Pending Approvals shows submissions from Inventory Staff
- Notification badge shows count of pending approvals (Place + WB)
- Approval actions only available to authorized roles

### BR-3: Weight Bridge Optional in In-Transit
**Priority**: Critical  
**As a**: Inventory Staff  
**I want**: Weight Bridge to be optional when submitting Place  
**So that**: Entry can move to Band Malal Book and WB can be added later

**Acceptance Criteria**:
- Place submission is MANDATORY to move to Band Malal Book
- Weight Bridge is OPTIONAL in In-Transit stage
- Entry appears in Band Malal Book after Place approval (even without WB)
- WB fields (wbNo, grossWeight, tareWeight, netWeight) allow NULL values
- WB is MANDATORY in Band Malal Book before final processing

### BR-4: Notification System
**Priority**: High  
**As a**: Admin/CEO/Manager  
**I want**: Visual notification of pending approvals  
**So that**: I can quickly see items requiring my attention

**Acceptance Criteria**:
- Badge on "Pending Approvals" tab shows count
- Count includes: pending Place + pending WB submissions
- Badge updates in real-time or on page refresh
- Count is role-specific (only shows items user can approve)

## User Roles

### Inventory Staff
- **Access**: In-Transit tab only
- **Permissions**:
  - View lorries in In-Transit
  - Submit Place (where to store)
  - Submit Weight Bridge (mill or party)
  - Cannot approve own submissions
- **Navigation**: All other tabs hidden

### Inventory Head (if exists)
- **Access**: Same as Inventory Staff
- **Permissions**: Same as Inventory Staff
- **Note**: Verify if this role exists or is same as inventory_staff

### Admin, CEO, Manager
- **Access**: All tabs including Pending Approvals
- **Permissions**:
  - View pending submissions
  - Approve/Reject Place
  - Approve/Reject Weight Bridge
  - Full system access retained

## Data Requirements

### Database Schema Changes

#### 1. Arrivals Table - Make WB Fields Nullable
```sql
ALTER TABLE arrivals
ALTER COLUMN "wbNo" DROP NOT NULL,
ALTER COLUMN "grossWeight" DROP NOT NULL,
ALTER COLUMN "tareWeight" DROP NOT NULL,
ALTER COLUMN "netWeight" DROP NOT NULL;
```

#### 2. Default Values
- wbNo: 'PENDING' (when NULL)
- grossWeight: 0 (when NULL)
- tareWeight: 0 (when NULL)
- netWeight: 0 (when NULL)

### API Endpoints

#### Existing - Need Updates
- `POST /api/arrivals/:id/place` - Submit place (inventory_staff access)
- `POST /api/arrivals/:id/wb` - Submit WB (inventory_staff access)
- `POST /api/arrivals/:id/approve-place` - Approve place (admin/ceo/manager only)
- `POST /api/arrivals/:id/approve-wb` - Approve WB (admin/ceo/manager only)
- `GET /api/arrivals/weight-bridges` - List WB (inventory_staff access)

#### New Endpoints
- `GET /api/approvals/count` - Get pending approval count
- `GET /api/approvals/pending` - List pending approvals (admin/ceo/manager only)

## Workflow

### Current State (In-Transit)
1. Sample Entry created → Status: in_transit
2. Physical Inspection done
3. **Inventory Staff** submits Place (mandatory)
4. **Inventory Staff** submits WB (optional at this stage)
5. Status: pending approval

### Approval State
1. **Admin/CEO/Manager** views in Pending Approvals tab
2. Reviews Place submission
3. Reviews WB submission (if submitted)
4. Approves Place → **Entry moves to Band Malal Book**
5. WB can be approved now or later

### Band Malal Book State
1. Entry appears with Place information
2. If WB not submitted: Shows "WB: PENDING"
3. **Staff/Manager** can add WB in Band Malal Book (mandatory before final)
4. Two WB types:
   - Mill WB: Select from dropdown (mandatory choice)
   - Party WB: Enter party name (mandatory entry)

## Non-Functional Requirements

### Performance
- Notification badge count query must execute < 100ms
- Navigation menu rendering < 50ms
- Role checks cached per session

### Security
- Role verification on backend for all sensitive operations
- Frontend role checks for UI only (not security)
- API endpoints validate user role before execution

### Usability
- Clear visual indication when WB is pending
- Role-specific navigation is intuitive
- Notification badge is prominent and visible

## Success Metrics
- Zero unauthorized access attempts
- 100% of Place approvals create Band Malal entries
- < 2 clicks to see pending approvals
- Notification badge accuracy: 100%

## Dependencies
- Existing auth middleware (`auth`, `authorize`)
- React Router for navigation
- Context API for user role state
- Existing notification system

## Risks & Mitigations

### Risk 1: Existing database has NOT NULL constraints
**Mitigation**: Migration to alter column constraints first

### Risk 2: Existing code assumes WB is always present
**Mitigation**: Add null checks, default values throughout codebase

### Risk 3: Role names mismatch
**Mitigation**: Verify exact role names from User model before implementation

### Risk 4: Breaking existing workflows for other roles
**Mitigation**: Maintain all existing functionality, only add restrictions for inventory_staff

## Out of Scope
- Creating new user roles
- Modifying physical inspection workflow
- Changing hamali book functionality
- Modifying stock calculation logic
