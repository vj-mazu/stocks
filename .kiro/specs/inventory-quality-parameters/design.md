# Technical Design: Inventory Quality Parameters

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Band Malal Book Table                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │ [🔬 Inventory Quality] Button per row              │     │
│  │   ↓ Opens collapsible form                         │     │
│  │   ↓ Select Type: Lot Avg | Full Lorry Avg         │     │
│  │   ↓ Fill quality fields (no bags)                  │     │
│  │   ↓ Submit → status: "pending"                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Database: inventory_quality_parameters          │
│  • Links to lorry_transit_details (UUID)                    │
│  • Stores all quality fields                                │
│  • Status: pending/approved/rejected                        │
│  • Tracks reporter & approver                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Admin Approval (Admin/Owner/Manager/CEO)            │
│  • View pending quality parameters                          │
│  • Approve → status: "approved"                             │
│  • Reject → status: "rejected" + reason                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            Sample Entry Detail Modal                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Quality Parameters Card (existing)                 │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ NEW: Inventory Quality Parameters Card             │     │
│  │   • Shows ONLY approved entries                    │     │
│  │   • Lot Avg table row                              │     │
│  │   • Full Lorry Avg table row                       │     │
│  │   • Reporter & Approver names                      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### New Table: `inventory_quality_parameters`

```sql
CREATE TABLE inventory_quality_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lorry_transit_detail_id UUID NOT NULL,
    type ENUM('lot_avg', 'full_lorry_avg') NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    
    -- Quality Fields
    moisture VARCHAR(30),
    dry_moisture VARCHAR(30),
    cutting VARCHAR(30),
    bend VARCHAR(30),
    grains VARCHAR(30),
    mix VARCHAR(30),
    s_mix VARCHAR(30),
    l_mix VARCHAR(30),
    kandu VARCHAR(30),
    oil VARCHAR(30),
    sk VARCHAR(30),
    wb_r VARCHAR(30),
    wb_bk VARCHAR(30),
    wb_t VARCHAR(30),
    smell VARCHAR(30),
    paddy_wb VARCHAR(30),
    p_color VARCHAR(50),
    remarks TEXT,
    
    -- Audit Fields
    reported_by_user_id INTEGER NOT NULL,
    approved_by_user_id INTEGER,
    reject_reason TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    
    FOREIGN KEY (lorry_transit_detail_id) REFERENCES lorry_transit_details(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by_user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);
```

## Backend Implementation

### 1. Database Migration

**File:** `server/migrations/145_create_inventory_quality_parameters.js`

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('inventory_quality_parameters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      lorry_transit_detail_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'lorry_transit_details',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('lot_avg', 'full_lorry_avg'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false
      },
      moisture: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      dry_moisture: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      cutting: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      bend: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      grains: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      mix: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      s_mix: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      l_mix: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      kandu: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      oil: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      sk: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      wb_r: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      wb_bk: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      wb_t: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      smell: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      paddy_wb: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      p_color: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      reported_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      approved_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      reject_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('inventory_quality_parameters');
  }
};
```

### 2. Sequelize Model

**File:** `server/models/InventoryQualityParameter.js`

```javascript
module.exports = (sequelize, DataTypes) => {
  const InventoryQualityParameter = sequelize.define('InventoryQualityParameter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    lorryTransitDetailId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'lorry_transit_detail_id'
    },
    type: {
      type: DataTypes.ENUM('lot_avg', 'full_lorry_avg'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },
    moisture: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    dryMoisture: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'dry_moisture'
    },
    cutting: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    bend: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    grains: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    mix: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    sMix: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 's_mix'
    },
    lMix: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'l_mix'
    },
    kandu: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    oil: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    sk: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    wbR: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'wb_r'
    },
    wbBk: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'wb_bk'
    },
    wbT: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'wb_t'
    },
    smell: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    paddyWb: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'paddy_wb'
    },
    pColor: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'p_color'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reportedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reported_by_user_id'
    },
    approvedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'approved_by_user_id'
    },
    rejectReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reject_reason'
    }
  }, {
    tableName: 'inventory_quality_parameters',
    underscored: true,
    timestamps: true
  });

  InventoryQualityParameter.associate = (models) => {
    InventoryQualityParameter.belongsTo(models.LorryTransitDetail, {
      foreignKey: 'lorryTransitDetailId',
      as: 'lorryTransitDetail'
    });
    InventoryQualityParameter.belongsTo(models.User, {
      foreignKey: 'reportedByUserId',
      as: 'reporter'
    });
    InventoryQualityParameter.belongsTo(models.User, {
      foreignKey: 'approvedByUserId',
      as: 'approver'
    });
  };

  return InventoryQualityParameter;
};
```

### 3. Model Registration

**File:** `server/models/index.js`

Add after existing model registrations:

```javascript
db.InventoryQualityParameter = require('./InventoryQualityParameter')(sequelize, Sequelize);
```

Add association after existing associations:

```javascript
db.LorryTransitDetail.hasMany(db.InventoryQualityParameter, {
  foreignKey: 'lorryTransitDetailId',
  as: 'inventoryQualityParameters'
});
```

### 4. API Endpoints

**File:** `server/routes/arrivals.js`

#### Endpoint 1: Add Inventory Quality Parameters

```javascript
// POST /arrivals/bmb/:transitDetailId/inventory-quality
router.post('/bmb/:transitDetailId/inventory-quality', authenticateToken, async (req, res) => {
  try {
    const { transitDetailId } = req.params;
    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;
    const staffType = req.user.staffType;

    // Authorization: Mill Staff, Location Staff, Inventory Staff, Inventory Head
    const canAdd = 
      (userRole === 'staff' && (staffType === 'mill' || staffType === 'location' || staffType === 'inventory')) ||
      userRole === 'inventory_head' ||
      effectiveRole === 'inventory_head';

    if (!canAdd) {
      return res.status(403).json({ error: 'Not authorized to add inventory quality parameters' });
    }

    // Validate transit detail exists
    const transitDetail = await LorryTransitDetail.findByPk(transitDetailId);
    if (!transitDetail) {
      return res.status(404).json({ error: 'Transit detail not found' });
    }

    const {
      type,
      moisture,
      dryMoisture,
      cutting,
      bend,
      grains,
      mix,
      sMix,
      lMix,
      kandu,
      oil,
      sk,
      wbR,
      wbBk,
      wbT,
      smell,
      paddyWb,
      pColor,
      remarks
    } = req.body;

    // Validate type
    if (!['lot_avg', 'full_lorry_avg'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be lot_avg or full_lorry_avg' });
    }

    // Check for existing approved record of same type
    const existingApproved = await InventoryQualityParameter.findOne({
      where: {
        lorryTransitDetailId: transitDetailId,
        type: type,
        status: 'approved'
      }
    });

    if (existingApproved) {
      return res.status(400).json({ 
        error: `An approved ${type.replace('_', ' ')} record already exists for this entry` 
      });
    }

    // Create new quality parameter
    const qualityParam = await InventoryQualityParameter.create({
      lorryTransitDetailId: transitDetailId,
      type,
      status: 'pending',
      moisture,
      dryMoisture,
      cutting,
      bend,
      grains,
      mix,
      sMix,
      lMix,
      kandu,
      oil,
      sk,
      wbR,
      wbBk,
      wbT,
      smell,
      paddyWb,
      pColor,
      remarks,
      reportedByUserId: req.user.userId
    });

    // Fetch with associations
    const result = await InventoryQualityParameter.findByPk(qualityParam.id, {
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    res.json({ 
      message: 'Inventory quality parameters submitted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error adding inventory quality parameters:', error);
    res.status(500).json({ error: 'Failed to add inventory quality parameters' });
  }
});
```

#### Endpoint 2: Approve Inventory Quality Parameters

```javascript
// POST /arrivals/bmb/inventory-quality/:qualityId/approve
router.post('/bmb/inventory-quality/:qualityId/approve', authenticateToken, async (req, res) => {
  try {
    const { qualityId } = req.params;
    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;

    // Authorization: Admin, Owner, Manager, CEO
    const canApprove = 
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canApprove) {
      return res.status(403).json({ error: 'Not authorized to approve inventory quality parameters' });
    }

    const qualityParam = await InventoryQualityParameter.findByPk(qualityId);
    
    if (!qualityParam) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    if (qualityParam.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve ${qualityParam.status} record` });
    }

    // Check if approver is the same as reporter
    if (qualityParam.reportedByUserId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot approve your own submission' });
    }

    // Check for existing approved record of same type
    const existingApproved = await InventoryQualityParameter.findOne({
      where: {
        lorryTransitDetailId: qualityParam.lorryTransitDetailId,
        type: qualityParam.type,
        status: 'approved',
        id: { [Op.ne]: qualityId }
      }
    });

    if (existingApproved) {
      return res.status(400).json({ 
        error: `An approved ${qualityParam.type.replace('_', ' ')} record already exists` 
      });
    }

    await qualityParam.update({
      status: 'approved',
      approvedByUserId: req.user.userId
    });

    const result = await InventoryQualityParameter.findByPk(qualityId, {
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    res.json({ 
      message: 'Inventory quality parameters approved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error approving inventory quality parameters:', error);
    res.status(500).json({ error: 'Failed to approve inventory quality parameters' });
  }
});
```

#### Endpoint 3: Reject Inventory Quality Parameters

```javascript
// POST /arrivals/bmb/inventory-quality/:qualityId/reject
router.post('/bmb/inventory-quality/:qualityId/reject', authenticateToken, async (req, res) => {
  try {
    const { qualityId } = req.params;
    const { rejectReason } = req.body;
    const userRole = req.user.role;
    const effectiveRole = req.user.effectiveRole;

    // Authorization: Admin, Owner, Manager, CEO
    const canReject = 
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'manager' ||
      userRole === 'ceo' ||
      effectiveRole === 'ceo';

    if (!canReject) {
      return res.status(403).json({ error: 'Not authorized to reject inventory quality parameters' });
    }

    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ error: 'Reject reason is required' });
    }

    const qualityParam = await InventoryQualityParameter.findByPk(qualityId);
    
    if (!qualityParam) {
      return res.status(404).json({ error: 'Quality parameter not found' });
    }

    if (qualityParam.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject ${qualityParam.status} record` });
    }

    await qualityParam.update({
      status: 'rejected',
      approvedByUserId: req.user.userId,
      rejectReason: rejectReason.trim()
    });

    const result = await InventoryQualityParameter.findByPk(qualityId, {
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'username', 'fullName', 'role'] }
      ]
    });

    res.json({ 
      message: 'Inventory quality parameters rejected',
      data: result
    });
  } catch (error) {
    console.error('Error rejecting inventory quality parameters:', error);
    res.status(500).json({ error: 'Failed to reject inventory quality parameters' });
  }
});
```

#### Update Band Malal Book Endpoint

Modify the existing `GET /arrivals/band-malal-book` endpoint to include inventory quality parameters:

```javascript
// Inside the mapping loop, add:
const inventoryQualityParams = await InventoryQualityParameter.findAll({
  where: { lorryTransitDetailId: detail.id },
  include: [
    { model: User, as: 'reporter', attributes: ['id', 'username', 'fullName'] },
    { model: User, as: 'approver', attributes: ['id', 'username', 'fullName'] }
  ],
  order: [['createdAt', 'DESC']]
});

// Add to response object:
inventoryQualityParameters: inventoryQualityParams,
```

## Frontend Implementation

### 1. Band Malal Book Table - Add Quality Button

**File:** `client/src/pages/Arrivals.tsx`

Add state for inventory quality form:

```typescript
const [expandedInventoryQuality, setExpandedInventoryQuality] = useState<string | null>(null);
const [inventoryQualityType, setInventoryQualityType] = useState<'lot_avg' | 'full_lorry_avg'>('lot_avg');
const [inventoryQualityForm, setInventoryQualityForm] = useState({
  moisture: '',
  dryMoisture: '',
  cutting: '',
  bend: '',
  grains: '',
  mix: '',
  sMix: '',
  lMix: '',
  kandu: '',
  oil: '',
  sk: '',
  wbR: '',
  wbBk: '',
  wbT: '',
  smell: '',
  paddyWb: '',
  pColor: '',
  remarks: ''
});
```

Add button in Actions column:

```typescript
{/* Inventory Quality Button */}
{canAddInventoryQuality && (
  <button
    onClick={() => {
      if (expandedInventoryQuality === entry.id) {
        setExpandedInventoryQuality(null);
      } else {
        setExpandedInventoryQuality(entry.id);
        setInventoryQualityType('lot_avg'); // Reset to Lot Avg
        // Reset form
        setInventoryQualityForm({
          moisture: '',
          dryMoisture: '',
          cutting: '',
          bend: '',
          grains: '',
          mix: '',
          sMix: '',
          lMix: '',
          kandu: '',
          oil: '',
          sk: '',
          wbR: '',
          wbBk: '',
          wbT: '',
          smell: '',
          paddyWb: '',
          pColor: '',
          remarks: ''
        });
      }
    }}
    style={{
      padding: '6px 10px',
      background: expandedInventoryQuality === entry.id ? '#9333ea' : '#a855f7',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: '600'
    }}
  >
    🔬 Inventory Quality
  </button>
)}
```

Add collapsible form row after main row:

```typescript
{/* Inventory Quality Form Row */}
{expandedInventoryQuality === entry.id && (
  <tr>
    <td colSpan={14} style={{ padding: '16px', background: '#faf5ff', border: '2px solid #e9d5ff' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#6d28d9', marginBottom: '12px' }}>
          Select Quality Type
        </div>
        {/* Toggle Buttons - Same as Physical Inspection style */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setInventoryQualityType('lot_avg')}
            style={{
              padding: '8px 20px',
              background: inventoryQualityType === 'lot_avg' ? '#9333ea' : '#e9d5ff',
              color: inventoryQualityType === 'lot_avg' ? '#fff' : '#6d28d9',
              border: inventoryQualityType === 'lot_avg' ? '2px solid #9333ea' : '2px solid #e9d5ff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              transition: 'all 0.2s'
            }}
          >
            📊 Lot Avg
          </button>
          <button
            type="button"
            onClick={() => setInventoryQualityType('full_lorry_avg')}
            style={{
              padding: '8px 20px',
              background: inventoryQualityType === 'full_lorry_avg' ? '#9333ea' : '#e9d5ff',
              color: inventoryQualityType === 'full_lorry_avg' ? '#fff' : '#6d28d9',
              border: inventoryQualityType === 'full_lorry_avg' ? '2px solid #9333ea' : '2px solid #e9d5ff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              transition: 'all 0.2s'
            }}
          >
            🚚 Full Lorry Avg
          </button>
        </div>
      </div>
      
      {/* Quality Fields Form - Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {/* Moisture */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', display: 'block', marginBottom: '4px' }}>
            Moisture
          </label>
          <input
            type="text"
            value={inventoryQualityForm.moisture}
            onChange={(e) => setInventoryQualityForm({ ...inventoryQualityForm, moisture: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #e9d5ff', borderRadius: '4px' }}
          />
        </div>
        
        {/* Dry Moisture */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', display: 'block', marginBottom: '4px' }}>
            Dry Moisture
          </label>
          <input
            type="text"
            value={inventoryQualityForm.dryMoisture}
            onChange={(e) => setInventoryQualityForm({ ...inventoryQualityForm, dryMoisture: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #e9d5ff', borderRadius: '4px' }}
          />
        </div>
        
        {/* Cutting */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', display: 'block', marginBottom: '4px' }}>
            Cutting
          </label>
          <input
            type="text"
            value={inventoryQualityForm.cutting}
            onChange={(e) => setInventoryQualityForm({ ...inventoryQualityForm, cutting: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #e9d5ff', borderRadius: '4px' }}
          />
        </div>
        
        {/* Bend */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', display: 'block', marginBottom: '4px' }}>
            Bend
          </label>
          <input
            type="text"
            value={inventoryQualityForm.bend}
            onChange={(e) => setInventoryQualityForm({ ...inventoryQualityForm, bend: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #e9d5ff', borderRadius: '4px' }}
          />
        </div>
        
        {/* Add remaining fields similarly: grains, mix, sMix, lMix, kandu, oil, sk, wbR, wbBk, wbT, smell, paddyWb, pColor */}
      </div>
      
      {/* Remarks */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', display: 'block', marginBottom: '4px' }}>
          Remarks
        </label>
        <textarea
          value={inventoryQualityForm.remarks}
          onChange={(e) => setInventoryQualityForm({ ...inventoryQualityForm, remarks: e.target.value })}
          rows={3}
          style={{ width: '100%', padding: '6px', border: '1px solid #e9d5ff', borderRadius: '4px' }}
        />
      </div>
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setExpandedInventoryQuality(null)}
          style={{
            padding: '8px 16px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => handleSubmitInventoryQuality(entry.transitDetailId)}
          style={{
            padding: '8px 16px',
            background: '#9333ea',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Submit Quality Parameters
        </button>
      </div>
    </td>
  </tr>
)}
```

### 2. Sample Entry Detail Modal - Display Quality Parameters

**File:** `client/src/components/SampleEntryDetailModal.tsx`

Add new card below Quality Parameters:

```typescript
{/* Inventory Quality Parameters Card */}
{(detailEntry as any).inventoryQualityParameters && 
 (detailEntry as any).inventoryQualityParameters.some((iqp: any) => iqp.status === 'approved') && (
  <div style={{ marginTop: '16px', background: '#faf5ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #e9d5ff' }}>
    <div style={{ fontSize: '13px', color: '#6d28d9', marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      🔬 Inventory Quality Parameters
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f3e8ff', borderBottom: '2px solid #c084fc' }}>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Type</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Moisture</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Cutting</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Bend</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Grains</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Reporter</th>
          <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#6b21a8' }}>Approver</th>
        </tr>
      </thead>
      <tbody>
        {(detailEntry as any).inventoryQualityParameters
          .filter((iqp: any) => iqp.status === 'approved')
          .map((iqp: any, idx: number) => (
            <tr key={iqp.id} style={{ borderBottom: '1px solid #e9d5ff' }}>
              <td style={{ padding: '8px', fontSize: '12px' }}>
                {iqp.type === 'lot_avg' ? 'Lot Avg' : 'Full Lorry Avg'}
              </td>
              <td style={{ padding: '8px', fontSize: '12px' }}>{iqp.moisture || '-'}</td>
              <td style={{ padding: '8px', fontSize: '12px' }}>{iqp.cutting || '-'}</td>
              <td style={{ padding: '8px', fontSize: '12px' }}>{iqp.bend || '-'}</td>
              <td style={{ padding: '8px', fontSize: '12px' }}>{iqp.grains || '-'}</td>
              <td style={{ padding: '8px', fontSize: '12px', fontWeight: '600' }}>
                {iqp.reporter?.username || iqp.reporter?.fullName || '-'}
              </td>
              <td style={{ padding: '8px', fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                {iqp.approver?.username || iqp.approver?.fullName || '-'}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
)}
```

## Testing Strategy

### Unit Tests
- Test role-based authorization for add/approve/reject
- Test validation (type, required fields)
- Test duplicate approved record prevention
- Test self-approval prevention

### Integration Tests
- Test full flow: add → approve → display in modal
- Test rejection flow
- Test data integrity with cascading deletes

### Manual Testing
1. Login as Inventory Staff → Add Lot Avg quality params → Verify saved as pending
2. Login as Admin → Approve the params → Verify status changed to approved
3. Open Sample Entry Detail Modal → Verify Inventory Quality Parameters card displays
4. Test rejection flow with reject reason
5. Test that only authorized roles can add/approve

## Performance Considerations

- Use database indexes on `lorry_transit_detail_id` and `status`
- Fetch only approved records for modal display
- Use eager loading to avoid N+1 queries

## Security Considerations

- All endpoints protected with authentication middleware
- Role-based authorization on every endpoint
- Input validation on all fields
- SQL injection prevention via Sequelize parameterized queries
- Self-approval prevention

## Success Criteria

✅ Database migration runs without errors  
✅ Model associations work correctly  
✅ API endpoints respond with correct status codes  
✅ Authorization works for all roles  
✅ Form validation prevents invalid data  
✅ Approved records display in modal  
✅ No unauthorized access possible  
✅ Performance meets requirements (<3s page load)
