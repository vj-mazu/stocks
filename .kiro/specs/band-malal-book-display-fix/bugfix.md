# Bugfix Specification: Band Malal Book Display Issues

## Bug Summary
Band Malal Book shows entries after Place approval, but the display has multiple data mapping and formatting issues that make it unusable.

## Bug Condition

**Bug Condition C(X)**: Given a LorryTransitDetail entry with `placeStatus='approved'` that has Physical Inspection data with cutting values, when the Band Malal Book tab is opened, then:
1. Data appears in wrong columns (netWeight in bags column, lorryNumber in variety column)
2. Cutting field shows "0" or empty instead of actual cutting values from inspection
3. Table design doesn't match In-Transit's green theme
4. Missing data that should be fetched from previous steps (Physical Inspection/Sample Entry)

### Current Behavior (Incorrect)
```
Columns:    | SL No | Date | Broker | From/Party | Bags | Variety | Moisture | Cutting | WB Number | Place | Place Date | Net Weight | Lorry Number | Actions |
Actual Data:|   1   | 7/7  |  Sinc  |    Abc1    | 650Kg| KA33ER4567| -    |    -    | 32500.00  | Outturn | 7/7/2026  |  -Kg    | KA33EF3232  | [Buttons] |
```

**Problem**: netWeight (650Kg) shows in Bags column, Lorry Number (KA33ER4567) shows in Variety column, actual Cutting shows in WB Number, etc.

### Expected Behavior (Correct)
```
Columns:    | SL No | Date | Broker | From/Party | Bags    | Variety   | Moisture | Cutting | WB Number  | Place   | Place Date | Net Weight | Lorry Number | Actions |
Correct Data:|  1    | 7/7  |  Sinc  |    Abc1    | 650 (75Kg)| Sum25 Rnr |   11%    |  1x1    | KA33EF3232 | Outturn | 7/7/2026   | 32500.00 Kg| KA33ER4567  | [Buttons] |
```

## Root Cause Analysis

### 1. **Backend Data Mapping Issue** (`server/routes/arrivals.js` - Band Malal Book endpoint)
The endpoint at line 1220 (`GET /band-malal-book`) constructs the response object but has incorrect field mappings:
- `bags` field gets inspection data correctly
- `cutting` tries to construct from `inspection.cutting1` and `inspection.cutting2` but may be null
- Need to search through inspection stages to find cutting values (like In-Transit does)

### 2. **Frontend Column Mapping Issue** (`client/src/pages/Arrivals.tsx` - Band Malal Book table)
Lines 1915-1922 show wrong data in wrong columns:
```typescript
<td>{netWeightVal ? netWeightVal + ' Kg' : '-'}</td>  // This is in Bags column
<td>{(entry.lorryNumber || 'N/A').toUpperCase()}</td>  // This is in Variety column
```

The table cells don't match the header order defined in lines 1869-1882.

### 3. **Missing Cutting Data Logic**
In-Transit uses `getCuttingValue()` function (defined at line 256) to search through inspection stages for cutting values. Band Malal Book doesn't use this logic.

### 4. **Design Inconsistency**
- In-Transit header: `background: '#1a237e'` (dark blue)
- Band Malal Book header: `background: '#065f46'` (dark green) ✓ CORRECT
- But row styling and data display need improvement

## Affected Files

1. **server/routes/arrivals.js** (lines 1220-1348)
   - `GET /band-malal-book` endpoint
   - Needs to fetch cutting data properly from inspection stages

2. **client/src/pages/Arrivals.tsx** (lines 1855-1970)
   - Band Malal Book table rendering
   - Column mapping needs to be fixed
   - Need to use `getCuttingValue()` function for cutting display

## Correctness Properties

### Property 1: Data Column Alignment
**Property**: For each entry in Band Malal Book, the data displayed in each column MUST match the column header.
- Given: Entry with `{ bags: 650, variety: 'Sum25 Rnr', netWeight: 32500, lorryNumber: 'KA33ER4567' }`
- When: Displayed in Band Malal Book table
- Then: 
  - Bags column shows "650 (75 Kg)" format
  - Variety column shows "Sum25 Rnr"
  - Net Weight column shows "32500.00 Kg"
  - Lorry Number column shows "KA33ER4567"

### Property 2: Cutting Value Resolution
**Property**: Cutting values MUST be retrieved from inspection data using multi-stage fallback logic.
- Given: Physical Inspection with cutting data in any of: `cutting`, `cutting1+cutting2`, `qualityParameters.cutting1+cutting2`, or stage inspections
- When: Band Malal Book fetches the entry
- Then: Cutting displays in "NxM" format (e.g., "1x1", "1x2") or "-" if not available

### Property 3: Data Completeness
**Property**: All fields visible in In-Transit MUST also be properly displayed in Band Malal Book.
- Given: Entry with complete inspection data (bags, variety, moisture, cutting, broker, party name)
- When: Entry moves from In-Transit (after Place approval) to Band Malal Book
- Then: All data fields remain visible and correctly formatted

## Test Scenarios

### Scenario 1: Basic Display Test
```
GIVEN: 
  - LorryTransitDetail with placeStatus='approved'
  - PhysicalInspection with: bags=200, moisture=10%, cutting1=1, cutting2=2
  - SampleEntry with: variety='Sum25 Rnr', brokerName='Sinc', location='Abc1'
  
WHEN: Band Malal Book tab is opened

THEN:
  - Bags column shows "200 (75 Kg)"
  - Variety column shows "Sum25 Rnr"
  - Moisture column shows "10%"
  - Cutting column shows "1x2"
  - Broker column shows "Sinc"
  - From/Party column shows "Abc1"
```

### Scenario 2: Cutting Fallback Logic Test
```
GIVEN: 
  - PhysicalInspection with cutting1=null, cutting2=null, cutting=null
  - But inspection has samplingStages with stage data containing cutting values
  
WHEN: Band Malal Book endpoint processes this entry

THEN:
  - Cutting field searches through stages
  - Finds cutting from stage data
  - Returns formatted "NxM" string
```

### Scenario 3: Green Design Consistency Test
```
GIVEN: Band Malal Book tab is active

WHEN: User views the table

THEN:
  - Header background is green (#065f46) ✓
  - Border is green (#10b981) ✓
  - Design matches In-Transit quality and readability
```

## Fix Strategy

### Phase 1: Backend Fix (Cutting Data Resolution)
1. Add helper function to search for cutting values through inspection stages
2. Update Band Malal Book endpoint to use this helper
3. Ensure response includes all necessary fields with correct names

### Phase 2: Frontend Fix (Column Mapping)
1. Review and fix table cell order to match header order
2. Use `getCuttingValue()` function for cutting display
3. Format data display to match In-Transit style

### Phase 3: Verification
1. Test with real data from In-Transit → Place Approval → Band Malal Book
2. Verify all columns show correct data
3. Verify cutting values appear correctly
4. Verify green design theme is consistent

## Success Criteria

✅ All data columns in Band Malal Book align with their headers
✅ Cutting values display correctly (e.g., "1x1", "1x2") or "-" if unavailable
✅ Data formatting matches In-Transit quality (e.g., "650 (75 Kg)" for bags)
✅ Green design theme is consistent and readable
✅ No data is lost when entries move from In-Transit to Band Malal Book
✅ Table is usable and matches the screenshot expectations

## References

- In-Transit table structure: `client/src/pages/Arrivals.tsx` lines 1200-1850
- `getCuttingValue()` function: `client/src/pages/Arrivals.tsx` line 256
- Band Malal Book endpoint: `server/routes/arrivals.js` line 1220
- Band Malal Book table: `client/src/pages/Arrivals.tsx` line 1855
