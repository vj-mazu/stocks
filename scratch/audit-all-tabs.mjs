import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

// Every route/tab in the app (from App.tsx + Navbar)
const ROUTES = [
  ['/dashboard', 'Dashboard'],
  ['/arrivals', 'Arrivals'],
  ['/records', 'Records Management'],
  ['/locations', 'Locations'],
  ['/ledger', 'Kunchinittu Ledger'],
  ['/rice-ledger', 'Rice Ledger'],
  ['/hamali', 'Hamali'],
  ['/hamali-book', 'Hamali Book'],
  ['/admin/users', 'User Management'],
  ['/admin/brokers', 'Broker Management'],
  ['/admin/varieties', 'Variety Management'],
  ['/admin/warehouses', 'Warehouse Management'],
  ['/admin/rice-stock-locations', 'Rice Stock Locations'],
  ['/admin/production', 'Production Management'],
  ['/admin/kunchinittus', 'Kunchinintu Management'],
  ['/admin/weight-bridges', 'Weight Bridge'],
  ['/admin/packaging', 'Packaging Management'],
  ['/admin/paddy-hamali', 'Paddy Hamali Management'],
  ['/admin/rice-hamali', 'Rice Hamali Management'],
  ['/pending-approvals', 'Pending Approvals'],
  ['/sample-entry', 'Sample Entry (Paddy)'],
  ['/rice-sample-entries', 'Rice Sample Entry'],
  ['/sample-entry-ledger', 'Sample Entry Ledger'],
  ['/paddy-sample-reports', 'Paddy Sample Reports'],
  ['/manager-sample-reports', 'Manager Sample Reports'],
  ['/rice-sample-reports', 'Rice Sample Reports'],
  ['/resample-allotment', 'Resample Allotment'],
  ['/allotting-supervisors', 'Allotting Supervisors'],
  ['/physical-inspection', 'Physical Inspection'],
  ['/cooking-book', 'Cooking Book'],
  ['/inventory-entry', 'Inventory Entry'],
  ['/owner-financial', 'Owner Financial'],
  ['/manager-financial', 'Manager Financial'],
  ['/final-review', 'Final Review'],
  ['/sample-workflow', 'Sample Workflow'],
  ['/egb-ledger', 'EGB Ledger'],
];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await ctx.newPage();

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

const results = [];
let failures = 0;

for (const [route, name] of ROUTES) {
  const entry = { route, name };
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1800);

    const audit = await page.evaluate(() => {
      const doc = document.documentElement;
      const tables = Array.from(document.querySelectorAll('table'));
      const cardTables = tables.filter((t) => t.classList.contains('mobile-card-table'));
      const inputs = document.querySelectorAll('input:not([type="hidden"])').length;
      const selects = document.querySelectorAll('select').length;
      const buttons = document.querySelectorAll('button').length;
      const horizOverflow = doc.scrollWidth > window.innerWidth + 1;

      // Identify tables with thead that did NOT get cardified (gaps)
      const uncardifiedWithHead = tables.filter((t) => !!t.querySelector('thead') && !t.classList.contains('mobile-card-table')).length;

      return {
        horizOverflow,
        docW: doc.scrollWidth,
        winW: window.innerWidth,
        tables,
        cardTables: cardTables.length,
        uncardifiedWithHead,
        inputs,
        selects,
        buttons,
        hasNav: !!document.querySelector('nav'),
      };
    });

    entry.audit = audit;
    if (audit.horizOverflow) {
      entry.status = 'FAIL-overflow';
      failures++;
    } else if (audit.uncardifiedWithHead > 0) {
      entry.status = 'WARN-uncardified-table';
    } else {
      entry.status = 'OK';
    }
  } catch (e) {
    entry.status = 'ERR-' + String(e).slice(0, 60);
    failures++;
  }
  results.push(entry);
}

console.log('=== MOBILE AUDIT (390px viewport) — ' + ROUTES.length + ' pages ===');
let okCount = 0, warnCount = 0;
for (const r of results) {
  const flag = r.status === 'OK' ? '✅' : r.status.startsWith('WARN') ? '⚠️' : '❌';
  if (r.status === 'OK') okCount++;
  else if (r.status.startsWith('WARN')) warnCount++;
  const a = r.audit || {};
  console.log(
    `${flag} ${r.name.padEnd(28)} ${r.status.padEnd(22)} overflow:${a.horizOverflow ? 'YES' : 'no'} cards:${a.cardTables ?? '-'}/${a.tables ?? '-'} uncarded:${a.uncardifiedWithHead ?? '-'} inputs:${a.inputs ?? '-'} selects:${a.selects ?? '-'}`
  );
}
console.log(`\nTOTAL: ${ROUTES.length} pages | OK: ${okCount} | WARN: ${warnCount} | FAIL: ${failures}`);
await browser.close();
