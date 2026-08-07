'use strict';
const fs = require('fs');

const ARR = 'client/src/pages/Arrivals.tsx';
const REPO = 'server/repositories/SampleEntryRepository.js';

function load(p) { return fs.readFileSync(p, 'utf8'); }
function save(p, c) { fs.writeFileSync(p, c, 'utf8'); }

const report = [];
function rep(s, label, old, next, { all = false, assert = 1 } = {}) {
  const re = new RegExp(old, all ? 'g' : '');
  const matches = s.match(re);
  const count = matches ? matches.length : 0;
  if (all) {
    report.push(`${label}: matched ${count} (replaced all)`);
    return s.replace(re, next);
  }
  report.push(`${label}: matched ${count} (expected ${assert})`);
  if (count !== assert) return s;
  return s.replace(re, next);
}

let s = load(ARR);

// ── 1. netWeight computation: strip trailing .00 ──
s = rep(s, 'netWeight compute', String.raw`\(\(parseFloat\(grossWeight \|\| 0\) - parseFloat\(tareWeight \|\| 0\)\) \|\| 0\)\.toFixed\(2\) : '0\.00';`,
  "cleanDecimal((parseFloat(grossWeight || 0) - parseFloat(tareWeight || 0))) : '';");

// ── 2. InfoPanel net weight guard ──
s = rep(s, 'InfoPanel netWeight guard', String.raw`\{netWeight !== '0\.00' && \(`, '{netWeight && (');

// ── 3. WB modal sute net weight .toFixed(2) → cleanDecimal (3 spots) ──
s = rep(s, 'WB modal mill sute net', String.raw`\{\(\(parseFloat\(wbGrossWeight \|\| 0\) - parseFloat\(wbTareWeight \|\| 0\) - \(parseFloat\(wbSute \|\| 0\) \* suteBags\(selectedLorryInspection, selectedLorryEntries\?\.\[0\]\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`,
  "{cleanDecimal((parseFloat(wbGrossWeight || 0) - parseFloat(wbTareWeight || 0) - (parseFloat(wbSute || 0) * suteBags(selectedLorryInspection, selectedLorryEntries?.[0]))))} Kg");
s = rep(s, 'WB modal party sute net', String.raw`\{\(\(parseFloat\(partyGrossWeight \|\| 0\) - parseFloat\(partyTareWeight \|\| 0\) - \(parseFloat\(partySute \|\| 0\) \* suteBags\(selectedLorryInspection, selectedLorryEntries\?\.\[0\]\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`,
  "{cleanDecimal((parseFloat(partyGrossWeight || 0) - parseFloat(partyTareWeight || 0) - (parseFloat(partySute || 0) * suteBags(selectedLorryInspection, selectedLorryEntries?.[0]))))} Kg");
s = rep(s, 'WB confirm dialog party sute net', String.raw`\{\(\(parseFloat\(wbConfirmDialog\.detail\?\.partyGrossWeight \|\| 0\) - parseFloat\(wbConfirmDialog\.detail\?\.partyTareWeight \|\| 0\) - \(parseFloat\(wbConfirmDialog\.detail\?\.partySute \|\| 0\) \* \(Number\(wbConfirmDialog\.detail\?\.bags \|\| wbConfirmDialog\.detail\?\.bagsLoaded \|\| 1\)\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`,
  "{cleanDecimal((parseFloat(wbConfirmDialog.detail?.partyGrossWeight || 0) - parseFloat(wbConfirmDialog.detail?.partyTareWeight || 0) - (parseFloat(wbConfirmDialog.detail?.partySute || 0) * (Number(wbConfirmDialog.detail?.bags || wbConfirmDialog.detail?.bagsLoaded || 1)))))} Kg");

// ── 4. Transit Sute Net Wt cell: cleanDecimal + dedicated edit button (only when WB/godown exists) ──
s = rep(s, 'transit sute cell',
  String.raw`\{transitDetail\?\.suteNetWeight \? \`\$\{transitDetail\.suteNetWeight\} Kg\` : '-'\}`,
  "{transitDetail?.suteNetWeight ? `${cleanDecimal(transitDetail.suteNetWeight)} Kg` : '-'}\r\n" +
  "                                {transitDetail && (transitDetail.wbNo || placeStatus === 'placed' || placeStatus === 'pending' || placeStatus === 'approved') && (\r\n" +
  "                                  <button\r\n" +
  "                                    onClick={() => openWbEditModal(isPlaceholder ? 'p-' + entry.id : 'i-' + (inspection?.id || entry?.id), transitDetail, entry, inspection)}\r\n" +
  "                                    title=\"Edit WB\"\r\n" +
  "                                    style={{ marginTop: '2px', padding: '2px 5px', border: 'none', borderRadius: '3px', background: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }}\r\n" +
  "                                  >✏️ Edit</button>\r\n" +
  "                                )}");

// ── 5. BMB Sute Net Wt cell: cleanDecimal + dedicated edit button ──
s = rep(s, 'BMB sute cell',
  String.raw`\{entry\.suteNetWeight \? \`\$\{entry\.suteNetWeight\} Kg\` : '-'\}`,
  "{entry.suteNetWeight ? `${cleanDecimal(entry.suteNetWeight)} Kg` : '-'}\r\n" +
  "                             {entry.wbNo && (\r\n" +
  "                               <button\r\n" +
  "                                 onClick={() => openWbEditModal((entry.lorryNumber || 'N/A').toUpperCase(), entry, entry, null)}\r\n" +
  "                                 title=\"Edit WB\"\r\n" +
  "                                 style={{ marginTop: '2px', padding: '2px 5px', border: 'none', borderRadius: '3px', background: '#0284c7', color: '#fff', fontWeight: 'bold', fontSize: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }}\r\n" +
  "                               >✏️ Edit</button>\r\n" +
  "                             )}");

// ── 6. Gate Godown EDIT to approvers ──
// Transit (dead branch) + BMB (live branch)
s = rep(s, 'transit godown edit gate', String.raw`\{placeStatus === 'approved' \? \(`,
  "{placeStatus === 'approved' && isApprover ? (");
s = rep(s, 'BMB godown edit gate', String.raw`\{placeStatus === 'approved' && \(`,
  "{placeStatus === 'approved' && isApprover && (");

// ── 7. "Added By" in BMB Godown cell ──
s = rep(s, 'BMB added-by', String.raw`<div>\{placeDisplay\}</div>`,
  "<div>{placeDisplay}</div>\r\n" +
  "                              {entry.placeApprover?.fullName ? (\r\n" +
  "                                <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>Added by: {entry.placeApprover.fullName}</div>\r\n" +
  "                              ) : null}");

// ── 8. "Added By" in transit Godown cell (before the status row) ──
s = rep(s, 'transit added-by', String.raw`<div style=\{\{ marginTop: transitDetail && \(placeStatus === 'approved' \|\| placeStatus === 'pending' \|\| placeStatus === 'placed'\) \? '4px' : '0px' \}\}>`,
  "{transitDetail?.placeApprover?.fullName ? (\r\n" +
  "                                    <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>Added by: {transitDetail.placeApprover.fullName}</div>\r\n" +
  "                                  ) : null}\r\n" +
  "                                <div style={{ marginTop: transitDetail && (placeStatus === 'approved' || placeStatus === 'pending' || placeStatus === 'placed') ? '4px' : '0px' }}>");

// ── 9. Fix Reject WB passing the transitDetail OBJECT as reason ──
s = rep(s, 'transit reject wb dialog', String.raw`handleRejectWb\(inspection\?\.id \|\| entry\?\.id, transitDetail\)`,
  "setWbConfirmDialog({ id: inspection?.id || entry?.id, action: 'reject', detail: transitDetail })");

// ── 10. Party WB name → auto-fill sute ──
s = rep(s, 'party auto sute', String.raw`onChange=\{\(e\) => setPartyWbName\(e\.target\.value\)\} placeholder="Party WB Name"`,
  "onChange={(e) => {\r\n" +
  "                                      const v = e.target.value;\r\n" +
  "                                      setPartyWbName(v);\r\n" +
  "                                      if (v.trim() && partyWbEnabled === 'yes' && !partySute) {\r\n" +
  "                                        const auto = getAutoSuteValue(selectedLorryEntries?.[0], selectedLorryInspection);\r\n" +
  "                                        if (auto) setPartySute(auto);\r\n" +
  "                                      }\r\n" +
  "                                    }} placeholder=\"Party WB Name\"");

// ── 11. Pending-only filter states ──
s = rep(s, 'pending states', String.raw`const \[bmbSearchQuery, setBmbSearchQuery\] = useState\(''\);`,
  "const [bmbSearchQuery, setBmbSearchQuery] = useState('');\r\n" +
  "\r\n" +
  "  const [transitPendingOnly, setTransitPendingOnly] = useState(false);\r\n" +
  "\r\n" +
  "  const [bmbPendingOnly, setBmbPendingOnly] = useState(false);");

// ── 12. Pending filter logic in transit memo ──
s = rep(s, 'transit pending memo', String.raw`return flatTrips\.filter\(trip => \{`,
  "return flatTrips.filter(trip => {\r\n" +
  "\r\n" +
  "      // Pending-only filter: show only entries awaiting approval (WB/quality/place)\r\n" +
  "\r\n" +
  "      if (transitPendingOnly) {\r\n" +
  "        const ltd = trip.inspection?.lorryTransitDetail || {};\r\n" +
  "        const qParams = trip.inspection?.inventoryQualityParameters || trip.entry?.inventoryQualityParameters || ltd.inventoryQualityParameters || [];\r\n" +
  "        const hasPending = (ltd.wbStatus === 'pending') || qParams.some((p: any) => p.status === 'pending') || (ltd.placeStatus === 'pending');\r\n" +
  "        if (!hasPending) return false;\r\n" +
  "      }");
// transit memo deps
s = rep(s, 'transit memo deps', String.raw`inTransitVarietyFilter\]\);`,
  "inTransitVarietyFilter, transitPendingOnly]);");

// ── 13. Pending filter logic in BMB memo ──
s = rep(s, 'BMB pending memo', String.raw`return bandMalalEntries\.filter\(\(entry\) => \{`,
  "return bandMalalEntries.filter((entry) => {\r\n" +
  "\r\n" +
  "      // Pending-only filter: show only entries awaiting approval (WB/quality/place)\r\n" +
  "\r\n" +
  "      if (bmbPendingOnly) {\r\n" +
  "        const qParams = entry.inventoryQualityParameters || [];\r\n" +
  "        const hasPending = (entry.wbStatus === 'pending') || qParams.some((p: any) => p.status === 'pending') || (entry.placeStatus === 'pending');\r\n" +
  "        if (!hasPending) return false;\r\n" +
  "      }");
// BMB memo deps
s = rep(s, 'BMB memo deps', String.raw`bmbVarietyFilter, bmbSearchQuery\]\);`,
  "bmbVarietyFilter, bmbPendingOnly, bmbSearchQuery]);");

// ── 14. Toolbar toggle buttons (transit first occurrence, BMB second) ──
const toolbarRe = /<div style=\{\{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' \}\}>/g;
let tCount = 0;
s = s.replace(toolbarRe, (m) => {
  tCount++;
  const btn = tCount === 1
    ? `<button\r\n` +
      `                onClick={() => setTransitPendingOnly(p => !p)}\r\n` +
      `                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: transitPendingOnly ? '#f59e0b' : '#f8fafc', color: transitPendingOnly ? '#fff' : '#475569', cursor: 'pointer', fontSize: '12px', fontWeight: 600, height: '32px' }}\r\n` +
      `              >⏳ {transitPendingOnly ? 'Pending only' : 'Pending'}</button>\r\n` +
      `            </div>\r\n` +
      `            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>`
    : `<button\r\n` +
      `                onClick={() => setBmbPendingOnly(p => !p)}\r\n` +
      `                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: bmbPendingOnly ? '#f59e0b' : '#f8fafc', color: bmbPendingOnly ? '#fff' : '#475569', cursor: 'pointer', fontSize: '12px', fontWeight: 600, height: '32px' }}\r\n` +
      `              >⏳ {bmbPendingOnly ? 'Pending only' : 'Pending'}</button>\r\n` +
      `            </div>\r\n` +
      `            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>`;
  return m + '\r\n' + btn;
});
report.push(`toolbar toggles: matched ${tCount} (expected 2)`);

// ── 15. Safe date parsing (crash guard) ──
s = rep(s, 'transit date crash', String.raw`const dStr = new Date\(dateVal\)\.toISOString\(\)\.split\('T'\)\[0\];`,
  "const dStr = dateVal ? new Date(dateVal).toISOString().split('T')[0] : '';");
s = rep(s, 'transit date display crash', String.raw`\{new Date\(dateVal\)\.toLocaleDateString\('en-GB'\)\}`,
  "{dateVal ? new Date(dateVal).toLocaleDateString('en-GB') : '-'}");
s = rep(s, 'BMB date crash', String.raw`const dStr = new Date\(entry\.date\)\.toISOString\(\)\.split\('T'\)\[0\];`,
  "const dStr = entry.date ? new Date(entry.date).toISOString().split('T')[0] : '';");
s = rep(s, 'BMB date display crash', String.raw`\{new Date\(entry\.date\)\.toLocaleDateString\('en-GB', \{ day: '2-digit', month: '2-digit', year: 'numeric' \}\)\}`,
  "{entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}");

save(ARR, s);

// ── 16. Repository: include placeApprover on lorryTransitDetail (both sites) ──
let r = load(REPO);
r = rep(r, 'repo A (multi-line include)', String.raw`as: 'wbAddedByUser',(\s*)required: false,(\s*)attributes: \['id', 'username', 'fullName'\](\s*)\}\s*\]`,
  "as: 'wbAddedByUser',$1required: false,$2attributes: ['id', 'username', 'fullName']$3},\r\n" +
  "                {\r\n" +
  "                  model: User,\r\n" +
  "                  as: 'placeApprover',\r\n" +
  "                  required: false,\r\n" +
  "                  attributes: ['id', 'username', 'fullName']\r\n" +
  "                }\r\n" +
  "              ]");
r = rep(r, 'repo B (one-line include)', String.raw`\{ model: User, as: 'wbAddedByUser', attributes: \['id', 'username', 'fullName'\] \},`,
  "{ model: User, as: 'wbAddedByUser', attributes: ['id', 'username', 'fullName'] },\r\n" +
  "          { model: User, as: 'placeApprover', attributes: ['id', 'username', 'fullName'] },");
save(REPO, r);

console.log(report.join('\n'));
console.log('DONE');
