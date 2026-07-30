# Tasks: Fix Weight Bridge Name Display

## Task 1: Update Sample Entry API to Include WeightBridge Association
**Status:** not_started

Find all API endpoints that return `LorryTransitDetail` data and ensure they include the `WeightBridge` association.

**Sub-tasks:**
- [x] 1.1: Find endpoint that returns sample entry detail with inspection/transit data
- [x] 1.2: Add WeightBridge association to LorryTransitDetail include
- [ ] 1.3: Update response to include millWeightBridge with name and location
- [x] 1.4: Test the endpoint returns correct Mill WB name

**Acceptance:**
- API response includes `millWeightBridge: { id, name, location }` when millWbId exists

---

## Task 2: Update Frontend to Display Mill WB Name
**Status:** not_started
**Depends on:** Task 1

Update the Sample Entry Detail Modal to display the actual Mill WB name from the WeightBridge table instead of the WB slip number.

**Sub-tasks:**
- [x] 2.1: Find where WB NAME is displayed in SampleEntryDetailModal.tsx
- [x] 2.2: Update display logic to show millWeightBridge.name
- [x] 2.3: Add location display if available: "Name (Location)"
- [~] 2.4: Add fallback to wbNo if millWeightBridge is not available

**Acceptance:**
- Modal shows "MARUTHI MILL" instead of "TEST-WB-123"
- If location exists, shows "MARUTHI MILL (Main Gate)"
- Falls back to WB slip number if Mill WB data is not loaded

---

## Task 3: Write Test Cases
**Status:** not_started
**Depends on:** Task 1, Task 2

Create automated tests to verify Mill WB name is fetched and displayed correctly.

**Sub-tasks:**
- [~] 3.1: Test API returns Mill WB name in response
- [~] 3.2: Test frontend displays Mill WB name correctly
- [~] 3.3: Test fallback to WB No when Mill WB not loaded
- [~] 3.4: Test Party WB still shows custom name

**Acceptance:**
- All test cases pass
- No regression in existing WB functionality
