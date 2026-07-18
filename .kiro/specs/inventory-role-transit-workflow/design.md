# Design: Inventory Role Transit Workflow Enhancement

## Architecture Overview

### Component Structure
```
┌─────────────────────────────────────────────────────┐
│ Frontend (React)                                    │
├─────────────────────────────────────────────────────┤
│ - RoleBasedNavigation Component                    │
│ - NotificationBadge Component                       │
│ - PendingApprovalsPage (enhanced)                   │
│ - InTransitPage (role-aware)                        │
└─────────────────────────────────────────────────────┘
                        ↓ HTTP/REST
┌─────────────────────────────────────────────────────┐
│ Backend (Express.js)                                │
├─────────────────────────────────────────────────────┤
│ - Auth Middleware (enhanced role checks)            │
│ - Approvals API Routes                              │
│ - Arrivals API (WB optional support)                │
└─────────────────────────────────────────────────────┘
                        ↓ SQL
┌─────────────────────────────────────────────────────┐
│ Database (PostgreSQL)                               │
├─────────────────────────────────────────────────────┤
│ - arrivals table (nullable WB fields)               │
│ - lorry_transit_details                             │
│ - users (roles)                                      │
└─────────────────────────────────────────────────────┘
```

## Database Design

### Schema Changes

#### Migration: Make Weight Bridge Fields Optional
```javascript
// File: server/migrations/999_make_wb_fields_optional.js

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Make columns nullable
    await queryInterface.changeColumn('arrivals', 'wbNo', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'PENDING'
    });
    
    await queryInterface.changeColumn('arrivals', 'grossWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });
    
    await queryInterface.changeColumn('arrivals', 'tareWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });
    
    await queryInterface.changeColumn('arrivals', 'netWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });
    
    // 2. Update existing NULL/empty records
    await queryInterface.sequelize.query(`
      UPDATE arrivals 
      SET 
        "wbNo" = COALESCE(NULLIF("wbNo", ''), 'PENDING'),
        "grossWeight" = COALESCE("grossWeight", 0),
        "tareWeight" = COALESCE("tareWeight", 0),
        "netWeight" = COALESCE("netWeight", 0)
      WHERE "wbNo" IS NULL 
         OR "wbNo" = ''
         OR "grossWeight" IS NULL 
         OR "tareWeight" IS NULL 
         OR "netWeight" IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revert: Make required again (only if all have values)
    await queryInterface.changeColumn('arrivals', 'wbNo', {
      type: Sequelize.STRING(50),
      allowNull: false
    });
    
    await queryInterface.changeColumn('arrivals', 'grossWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    });
    
    await queryInterface.changeColumn('arrivals', 'tareWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    });
    
    await queryInterface.changeColumn('arrivals', 'netWeight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    });
  }
};
```

### Model Updates

#### Arrival Model Changes
```javascript
// File: server/models/Arrival.js
// Lines 130-145: Update allowNull properties

wbNo: {
  type: DataTypes.STRING(50),
  allowNull: true,  // Changed from false
  defaultValue: 'PENDING'
},
grossWeight: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,  // Changed from false
  defaultValue: 0
},
tareWeight: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,  // Changed from false
  defaultValue: 0
},
netWeight: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,  // Changed from false
  defaultValue: 0
},
```

## Backend API Design

### New Middleware: Role-Based Authorization

```javascript
// File: server/middleware/roleAuth.js

const requireInventoryRole = (req, res, next) => {
  const allowedRoles = ['inventory_staff', 'admin', 'manager', 'ceo'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied. Inventory role required.' 
    });
  }
  next();
};

const requireApproverRole = (req, res, next) => {
  const allowedRoles = ['admin', 'manager', 'ceo'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied. Approval permission required.' 
    });
  }
  next();
};

module.exports = {
  requireInventoryRole,
  requireApproverRole
};
```

### New Route: Approvals API

```javascript
// File: server/routes/approvals.js

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { requireApproverRole } = require('../middleware/roleAuth');
const { sequelize } = require('../config/database');

// GET /api/approvals/count - Get pending approval count
router.get('/count', auth, requireApproverRole, async (req, res) => {
  try {
    const result = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (WHERE "placeStatus" = 'pending') as pending_place,
        COUNT(*) FILTER (WHERE "wbStatus" = 'pending') as pending_wb,
        COUNT(*) as total_pending
      FROM lorry_transit_details
      WHERE "placeStatus" = 'pending' OR "wbStatus" = 'pending'
    `, { type: sequelize.QueryTypes.SELECT });
    
    res.json({
      pendingPlace: parseInt(result[0].pending_place) || 0,
      pendingWb: parseInt(result[0].pending_wb) || 0,
      total: parseInt(result[0].total_pending) || 0
    });
  } catch (error) {
    console.error('Get approval count error:', error);
    res.status(500).json({ error: 'Failed to get approval count' });
  }
});

// GET /api/approvals/pending - List pending approvals
router.get('/pending', auth, requireApproverRole, async (req, res) => {
  try {
    const PhysicalInspection = require('../models/PhysicalInspection');
    const LorryTransitDetail = require('../models/LorryTransitDetail');
    const SampleEntry = require('../models/SampleEntry');
    
    const pendingDetails = await LorryTransitDetail.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { placeStatus: 'pending' },
          { wbStatus: 'pending' }
        ]
      },
      include: [
        {
          model: PhysicalInspection,
          as: 'physicalInspection',
          include: [
            { model: SampleEntry, as: 'sampleEntry' }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ approvals: pendingDetails });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
});

module.exports = router;
```

### Update Existing Routes

#### Arrivals Route Updates
```javascript
// File: server/routes/arrivals.js
// Add role checks to existing endpoints

const { requireInventoryRole } = require('../middleware/roleAuth');

// POST /api/arrivals/:id/place - Inventory staff can submit
router.post('/:id/place', auth, requireInventoryRole, async (req, res) => {
  // Existing code...
});

// POST /api/arrivals/:id/wb - Inventory staff can submit
router.post('/:id/wb', auth, requireInventoryRole, async (req, res) => {
  // Existing code...
});

// Enhanced error handling in approve-place
router.post('/:id/approve-place', auth, authorize('admin', 'ceo', 'manager'), async (req, res) => {
  try {
    // ... existing validation ...
    
    // Enhanced logging
    console.log('📝 Creating arrival from Place approval:', {
      inspectionId: inspection.id,
      lorryNumber: inspection.lorryNumber,
      hasWB: !!detail.wbNo,
      wbStatus: detail.wbStatus,
      placeKunchinittuId: detail.placeKunchinittuId,
      placeWarehouseId: detail.placeWarehouseId
    });
    
    // Create arrival with proper defaults
    const createdArrival = await Arrival.create({
      slNo,
      date: detail.placeDate || new Date().toISOString().split('T')[0],
      movementType: 'purchase',
      broker: inspection.sampleEntry?.brokerName || null,
      variety: inspection.sampleEntry?.variety ? 
        inspection.sampleEntry.variety.trim().toUpperCase() : null,
      bags: inspection.bags || 0,
      fromLocation: inspection.sampleEntry?.location || null,
      toKunchinintuId: detail.placeKunchinittuId || null,
      toWarehouseId,
      outturnId: detail.outturnId || null,
      moisture: inspection.moisture || null,
      cutting: (inspection.cutting1 && inspection.cutting2)
        ? `${inspection.cutting1} x ${inspection.cutting2}`
        : (inspection.cutting1 || inspection.cutting2 || null),
      
      // WB fields with safe defaults
      wbNo: detail.wbNo || 'PENDING',
      grossWeight: detail.grossWeight || 0,
      tareWeight: detail.tareWeight || 0,
      netWeight: detail.netWeight || 0,
      
      lorryNumber: inspection.lorryNumber || 'N/A',
      status: 'approved',
      createdBy: req.user.userId,
      approvedBy: req.user.userId,
      approvedAt: new Date(),
      adminApprovedBy: req.user.userId,
      adminApprovedAt: new Date(),
      remarks: `Auto-created on Place approval for inspection #${inspection.id}`,
      wbInputType: detail.wbInputType || null,
      millWbId: detail.millWbId || null,
      partyWbName: detail.partyWbName || null,
      wbStatus: detail.wbStatus || 'none',
      wbRejectReason: detail.wbRejectReason || null,
      placeType: detail.placeType || null,
      placeWarehouseId: detail.placeWarehouseId || null,
      placeKunchinittuId: detail.placeKunchinittuId || null,
      placeDate: detail.placeDate || null,
      placeStatus: 'approved'
    });

    console.log('✅ Arrival created successfully:', {
      arrivalId: createdArrival.id,
      slNo: createdArrival.slNo,
      wbStatus: createdArrival.wbStatus
    });

    return res.json({ 
      message: 'Place approved — entry moved to Band Malal Book', 
      detail,
      arrival: {
        id: createdArrival.id,
        slNo: createdArrival.slNo,
        wbStatus: createdArrival.wbStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Approve place error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to approve place',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
```

## Frontend Design

### Navigation Component with Role-Based Rendering

```typescript
// File: client/src/components/Navbar.tsx
// Add role-based navigation logic

interface NavigationItem {
  path: string;
  label: string;
  icon?: string;
  roles: string[]; // Allowed roles
  badge?: boolean; // Show notification badge
}

const navigationItems: NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    roles: ['admin', 'manager', 'ceo', 'staff']
  },
  {
    path: '/arrivals',
    label: 'In-Transit',
    roles: ['admin', 'manager', 'ceo', 'staff', 'inventory_staff']
  },
  {
    path: '/pending-approvals',
    label: 'Pending Approvals',
    roles: ['admin', 'manager', 'ceo'],
    badge: true // Show notification badge
  },
  {
    path: '/records',
    label: 'Band Malal Book',
    roles: ['admin', 'manager', 'ceo', 'staff']
  },
  // ... other menu items
];

// Filter navigation based on user role
const visibleNavItems = navigationItems.filter(item => 
  item.roles.includes(userRole)
);
```

### Notification Badge Component

```typescript
// File: client/src/components/NotificationBadge.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface NotificationBadgeProps {
  show: boolean;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ show }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!show) return;

    const fetchCount = async () => {
      try {
        const response = await axios.get('/api/approvals/count');
        setCount(response.data.total);
      } catch (error) {
        console.error('Failed to fetch approval count:', error);
      }
    };

    fetchCount();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [show]);

  if (!show || count === 0) return null;

  return (
    <span className="notification-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};
```

### Enhanced Pending Approvals Page

```typescript
// File: client/src/pages/PendingApprovals.tsx
// Add inventory staff filtering and enhanced UI

// Show who submitted (inventory staff name)
// Group by pending type (Place / WB)
// Show submission timestamp
// Add quick approve/reject actions
```

## API Contracts

### GET /api/approvals/count
**Authorization**: Admin, Manager, CEO only

**Response**:
```json
{
  "pendingPlace": 5,
  "pendingWb": 3,
  "total": 8
}
```

### GET /api/approvals/pending
**Authorization**: Admin, Manager, CEO only

**Response**:
```json
{
  "approvals": [
    {
      "id": "uuid",
      "placeStatus": "pending",
      "wbStatus": "pending",
      "placeKunchinittuId": 123,
      "placeWarehouseId": 5,
      "wbNo": "WB-2024-0123",
      "netWeight": 5000,
      "physicalInspection": {
        "lorryNumber": "KA-01-AB-1234",
        "bags": 100,
        "moisture": 14.5,
        "sampleEntry": {
          "variety": "SONA MASURI",
          "brokerName": "Ram Traders"
        }
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Error Handling Strategy

### Database Constraint Errors
```javascript
try {
  await Arrival.create({...});
} catch (error) {
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(e => e.message)
    });
  }
  if (error.name === 'SequelizeDatabaseError') {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  throw error;
}
```

### Authorization Errors
```javascript
// Consistent 403 response
if (!hasPermission) {
  return res.status(403).json({
    error: 'Access denied',
    message: 'You do not have permission to perform this action'
  });
}
```

## Testing Strategy

### Unit Tests
- Role middleware functions
- Approval count query
- Navigation filtering logic

### Integration Tests
- Complete workflow: Submit → Approve → Verify in Band Malal
- Role-based access enforcement
- WB optional scenario
- Notification badge updates

### Manual Test Scenarios
1. Inventory Staff: Submit Place only → Approve → Verify in Band Malal
2. Inventory Staff: Submit Place + WB → Approve both → Verify
3. Verify other roles still have full access
4. Verify notification badge shows correct count
5. Verify unauthorized access is blocked

## Deployment Plan

### Phase 1: Database Migration
1. Run migration to make WB fields nullable
2. Update Arrival model
3. Verify no existing data breaks

### Phase 2: Backend API
1. Deploy new middleware
2. Deploy new approvals routes
3. Update existing routes with role checks
4. Deploy enhanced error handling

### Phase 3: Frontend Updates
1. Deploy role-based navigation
2. Deploy notification badge
3. Deploy enhanced pending approvals page
4. Update In-Transit page for inventory role

### Phase 4: Verification
1. Test all workflows
2. Verify role restrictions
3. Monitor error logs
4. Get user feedback

## Rollback Plan
- Keep migration down() function ready
- Feature flags for role restrictions
- Can revert to original navigation if issues
- Database backup before migration
