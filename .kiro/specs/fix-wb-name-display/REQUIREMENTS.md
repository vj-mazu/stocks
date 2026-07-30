# Fix Weight Bridge Name Display in Sample Entry Detail Modal

## Problem Statement

In the Sample Entry Detail Modal, when displaying Weight Bridge (WB) details:
- **Current Behavior:** Mill WB Name column shows the WB slip number (e.g., "TEST-WB-1785333410991")
- **Expected Behavior:** Mill WB Name column should show the actual Weight Bridge name (e.g., "MARUTHI MILL")

## Root Cause

The API endpoints that return `LorryTransitDetail` data are not including the `WeightBridge` association, so the Mill WB name is not available to the frontend.

## Requirements

### 1. Backend - Include WeightBridge Association

**Affected Endpoints:**
- Any endpoint that returns `LorryTransitDetail` data (e.g., `/api/sample-entries/by-role`, `/api/arrivals/transit-approvals/pending`)

**Required Changes:**
- When querying `LorryTransitDetail`, include the `WeightBridge` association
- Fetch Weight Bridge details: `id`, `name`, `location`
- Ensure the association is defined in the model

**Example Pattern (from transit-approvals endpoint):**
```javascript
const millWb = detail.millWbId
  ? await WeightBridge.findByPk(detail.millWbId, { attributes: ['id', 'name', 'location'] })
  : null;
```

### 2. Frontend - Display Mill WB Name Correctly

**Affected Components:**
- `SampleEntryDetailModal.tsx` (and any other component displaying WB details)

**Required Changes:**
- Check if `transitDetail.millWeightBridge` or `transitDetail.millWb` exists
- Display the name: `transitDetail.millWeightBridge.name` or `transitDetail.millWb.name`
- Fall back to `wbNo` only if Mill WB data is not available
- Show location if available: `${name} (${location})`

**Display Logic:**
```typescript
// Priority order:
1. millWeightBridge.name + location (if available)
2. millWb.name + location (if available)  
3. wbNo (fallback)
4. "-" (if nothing available)
```

### 3. Data Structure

**LorryTransitDetail Response should include:**
```json
{
  "id": "...",
  "millWbId": 1,
  "wbNo": "TEST-WB-123",
  "millWeightBridge": {
    "id": 1,
    "name": "MARUTHI MILL",
    "location": "Main Gate"
  },
  "partyWbName": "Party WB Name",
  // ... other fields
}
```

## Acceptance Criteria

1. ✅ Sample Entry Detail Modal displays actual Mill WB name from `weight_bridges` table
2. ✅ If Mill WB has a location, display it as: "Name (Location)"
3. ✅ If Mill WB data is not available, fall back to showing the WB slip number
4. ✅ Party WB continues to show the party-provided name (not from weight_bridges table)
5. ✅ No performance degradation (use proper eager loading, not N+1 queries)

## Test Cases

### Test 1: Display Mill WB Name
- **Given:** A sample entry with Mill WB ID = 1 (MARUTHI MILL)
- **When:** User opens Sample Entry Detail Modal
- **Then:** WB NAME column shows "MARUTHI MILL" (not the slip number)

### Test 2: Display Mill WB Name with Location
- **Given:** Mill WB has location = "Main Gate"
- **When:** User opens Sample Entry Detail Modal
- **Then:** WB NAME column shows "MARUTHI MILL (Main Gate)"

### Test 3: Fallback to WB No
- **Given:** Mill WB data is not loaded
- **When:** User opens Sample Entry Detail Modal
- **Then:** WB NAME column shows the WB slip number

### Test 4: Party WB Shows Custom Name
- **Given:** Entry has Party WB with partyWbName = "ABC Traders WB"
- **When:** User opens Sample Entry Detail Modal
- **Then:** Party WB row shows "ABC Traders WB" (custom name, not from database)

## Technical Notes

- The `LorryTransitDetail` model already has the association defined:
  ```javascript
  LorryTransitDetail.belongsTo(models.WeightBridge, {
    foreignKey: 'millWbId',
    as: 'millWeightBridge'
  });
  ```
- Need to ensure all endpoints that return LorryTransitDetail include this association
- Use `include: [{ model: WeightBridge, as: 'millWeightBridge', attributes: ['id', 'name', 'location'] }]`
