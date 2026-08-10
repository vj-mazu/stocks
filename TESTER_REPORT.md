# 🧪 TESTER REPORT — Mother India Stock Management (stocks-main)

> **Date:** 09-Aug-2026
> **How tested:** Real running server (Postgres DB connected, 43 tables) + real browser (Playwright/Chromium) + API tests + existing test suites.
> **Result summary:** Main user flows WORK. **4 real backend bugs found** (1 critical, 2 high, 1 medium), several test-suite problems, and 1 environment problem.

---

## ✅ WHAT WORKS (tested live in browser)

| Flow | Result |
|------|--------|
| Login / logout (admin) | ✅ works |
| Dashboard page | ✅ loads |
| Arrivals → In Transit tab | ✅ table loads, rows show status (WB/QS/GD), Quality buttons correct |
| Arrivals → Band Mall Book tab | ✅ table loads with quality + WB data |
| Mill Quality Sampling modal | ✅ opens, type selector (Lot Avg / Gutti), dedupe ✅ marks, form fields |
| Submit Lot Avg + Full Avg (admin auto-approves) | ✅ saved, shown as "QS: Approved / Sampling Complete" in both tabs |
| Duplicate same-type submit | ✅ blocked with 400 |
| Invalid type submit | ✅ blocked with 400 |
| Quality pending list API | ✅ 200 |
| Weight bridges, users, dashboard/stats, records, locations pages | ✅ no console errors |
| Sample entry detail modal (quality params display) | ✅ shown |

---

## 🐛 BUGS (confirmed — where to fix)

### 🔴 BUG 1 (CRITICAL) — Main Arrivals list API is broken (500)
- **URL:** `GET /api/arrivals` → **500**
- **Error:** `SequelizeEagerLoadingError: Kunchinittu is associated to Arrival multiple times. You must use the 'as' keyword to specify the alias`
- **Where:** `server/services/queryOptimizationService.js` line ~321 (`getArrivalsWithPagination`) — called from `server/routes/arrivals.js` line ~4859
- **Impact:** Any page/tool that reads the plain arrivals list gets a 500.
- **Fix:** In the `findAll` include list, every Kunchinittu include must have a unique `as:` alias (e.g. `as: 'kunchinittuFrom'`, `as: 'kunchinittuTo'`).

### 🟠 BUG 2 (HIGH) — Pending Approvals (arrivals) is broken (500)
- **URL:** `GET /api/arrivals/pending-list` → **500**
- **Error:** `EagerLoadingError: SampleEntry is not associated to Arrival!`
- **Where:** `server/routes/arrivals.js` line ~6814 (pending-list handler) — the query tries to include `SampleEntry` inside an `Arrival` query, but the `Arrival` model has no such association defined.
- **Impact (UI):**
  - `client/src/components/Navbar.tsx` line ~525 — pending-count badge (interval fetch)
  - `client/src/pages/PendingApprovals.tsx` line ~713 — Arrivals tab
  - `client/src/components/BulkApprovalModal.tsx` line ~287
- **Fix:** Either define the association on `Arrival` model or change the pending-list query to fetch `LorryTransitDetail`/`SampleEntry` correctly (include through the correct model, not `Arrival`).

### 🟠 BUG 3 (HIGH) — Rice Stock API broken (503)
- **URL:** `GET /api/rice-stock` → **503**
- **Error:** `SequelizeDatabaseError: column o.allotted_variety does not exist` (code 42703) — hint says DB column is `o.allottedVariety`
- **Where:** `server/routes/rice-stock.js` line ~127 (raw SQL uses `o.allotted_variety`)
- **Impact:** Rice Ledger / rice stock pages that call this API fail.
- **Fix:** Change `o.allotted_variety` → `o."allottedVariety"` in the SQL (match the actual DB column name), or add a migration to rename the column.

### 🟡 BUG 4 (MEDIUM) — Wrong column name used for user data check
- **Log:** `⚠️ Could not check data for user X: column RiceStockLocation.createdBy does not exist` (seen on `GET /api/admin/users`)
- **Where:** model `server/models/RiceStockLocation.js` (or the query using `createdBy`) vs DB table `rice_stock_locations` (no `createdBy` column).
- **Fix:** Remove/rename the field to match the DB schema (check migrations; likely `created_by` vs `createdBy` casing).

### 🟡 BUG 5 (MEDIUM) — Client uses wrong API paths (missing `/api` prefix)
- Some client calls use bare paths that **do not exist**:
  - `client/src/components/Navbar.tsx:525` → `axios.get('/arrivals/pending-list')`
  - `client/src/pages/PendingApprovals.tsx:713` → `/arrivals/pending-list`
  - `client/src/pages/Hamali.tsx:438` → `/records/arrivals`
  - `client/src/pages/HamaliEnhanced.tsx:283` → `/records/arrivals`
  - `client/src/components/BulkApprovalModal.tsx:287` → `/arrivals/pending-list`
- In dev (Vite) these silently return index.html (200) → data is `undefined` → badges show 0 / lists empty, **no visible error**.
- In production these return **404**.
- **Fix:** Prefix them with `${API_URL}` (i.e. `/api/...`). This is why the navbar pending-count and Pending Approvals arrivals tab look empty even after Bug 2 is fixed.

### 🟡 BUG 6 (LOW) — React console warning
- `Received %s for a non-boolean attribute 'active'` — a styled-component / NavLink prop is passed as a boolean to a DOM element. Cosmetic; fix by removing the stray `active` prop.

### 🟡 BUG 7 (LOW) — CORS allowlist too strict for local dev
- `server/index.js` line ~80 allowlist only has `localhost:3000`, `localhost:5173`, 2 Vercel domains, `CLIENT_URL`.
- If Vite picks another port (3001/3002/3003 — which happened because ports were busy) the browser is **blocked with "Not allowed by CORS"** and login fails with 500.
- **Fix:** In dev, allow any `localhost` port (e.g. regex `/^http:\/\/localhost:\d+$/`), or set `CLIENT_URL`.

---

## 🧪 AUTOMATED TEST SUITES

### Jest (`server/__tests__`) — 18/28 suites FAIL (67 failed / 79 passed)
Failure categories:
1. **Tests out of date with models:** `SampleEntry.create({...})` in fixtures missing now-required fields (`createdByUserId`, `partyName`, `entryType`) → `SequelizeValidationError`. Fix the test fixtures (e.g. `server/__tests__/cuttingHelperPreviousTrip.test.js`).
2. **Test requires missing file:** `require('../models/Mill')` — `server/models/Mill.js` does not exist (`server/__tests__/wbRejectionDataManagement.preservation.test.js`). Fix: remove/rename the require.
3. **"BUG CONFIRMED" tests (by design, documenting missing features):**
   - No `pending_wb_submissions` staging table
   - No `rejected_wb_submissions` audit table
   - WB reject reason stored but **NOT displayed** in `client/src/components/SampleEntryDetailModal.tsx`
4. **DB-dependent tests** query tables/columns missing in this DB (e.g. `rice_stock_locations` queries) — need matching migration/schema or they are environment-specific.

### TypeScript (`npx tsc --noEmit`) — FAILS
- `client` uses TypeScript **4.9.5** but `node_modules/fast-check/lib/types57/fast-check.d.ts` uses newer TS syntax → parser errors.
- `client/ts-errors.txt` also lists 88 real errors in `client/src/__tests__/bug1-party-name-popup.test.tsx` (axios typing mismatch).
- **Fix:** upgrade `typescript` to ^5.x in `client/package.json`, or pin `fast-check` to a version compatible with TS 4.9.

### Playwright (`tests/full-system.spec.js`)
- Requires the app running at `localhost:3000` + credentials via env vars. Not runnable as-is here (root `node_modules` not installed).

---

## ⚠️ ENVIRONMENT PROBLEM (found while testing)

**The app is NOT currently running on your machine:**
- Port **5000** is occupied by a *different* project (`node src/server.js` — serves a different client build). The Mother India API was **not running** when I started.
- I started the Mother India server on port **5001** and the Vite client on port **3000** to test; I have stopped both and removed my temp config file.
- **To run your app:** free port 5000 (stop the other `src/server.js` process), then `cd server && npm run dev` (or `npm start` at root) + `cd client && npm start`. DB (Postgres on 5432) is up and connected fine (43 tables).

---

## 📋 VERDICT

- **The Mill Quality Sampling feature you asked about works correctly** end-to-end (submit → auto-approve for admin → shown in In Transit + Band Mall Book → duplicate protection → pending/approve/reject/recheck flow in the code).
- The **critical fixes** are Bugs 1–3 (3 API endpoints returning 500/503) and Bug 5 (wrong API paths hiding those errors in the UI). Fix those and the app is in good shape.
- The automated test suite needs maintenance (outdated fixtures, missing model, TS upgrade) — the failures are mostly test-side, not app-side, except the WB audit-table gaps documented by the exploration tests.
