'use strict';
// Dry-run: report match counts for every pattern in apply-fixes.js WITHOUT writing files.
const fs = require('fs');
const ARR = 'client/src/pages/Arrivals.tsx';
const REPO = 'server/repositories/SampleEntryRepository.js';
let s = fs.readFileSync(ARR, 'utf8');
let r = fs.readFileSync(REPO, 'utf8');

const report = [];
function rep(label, old, { all = false, assert = 1 } = {}) {
  const re = new RegExp(old, all ? 'g' : '');
  const matches = (all ? s : s).match(re);
  const count = matches ? matches.length : 0;
  if (all) {
    report.push(`${label}: matched ${count} (all)`);
    return;
  }
  report.push(`${label}: matched ${count} (expected ${assert}) ${count !== assert ? '<<< MISMATCH' : 'ok'}`);
}

// same patterns as apply-fixes.js
rep('netWeight compute', String.raw`\(\s*parseFloat\(grossWeight \|\| 0\) - parseFloat\(tareWeight \|\| 0\)\) \|\| 0\)\.toFixed\(2\) : '0\.00';`);
rep('InfoPanel netWeight guard', String.raw`\{netWeight !== '0\.00' && \(`);
rep('WB modal mill sute net', String.raw`\{\(\(parseFloat\(wbGrossWeight \|\| 0\) - parseFloat\(wbTareWeight \|\| 0\) - \(parseFloat\(wbSute \|\| 0\) \* suteBags\(selectedLorryInspection, selectedLorryEntries\?\.\[0\]\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`);
rep('WB modal party sute net', String.raw`\{\(\(parseFloat\(partyGrossWeight \|\| 0\) - parseFloat\(partyTareWeight \|\| 0\) - \(parseFloat\(partySute \|\| 0\) \* suteBags\(selectedLorryInspection, selectedLorryEntries\?\.\[0\]\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`);
rep('WB confirm dialog party sute net', String.raw`\{\(\(parseFloat\(wbConfirmDialog\.detail\?\.partyGrossWeight \|\| 0\) - parseFloat\(wbConfirmDialog\.detail\?\.partyTareWeight \|\| 0\) - \(parseFloat\(wbConfirmDialog\.detail\?\.partySute \|\| 0\) \* \(Number\(wbConfirmDialog\.detail\?\.bags \|\| wbConfirmDialog\.detail\?\.bagsLoaded \|\| 1\)\)\)\) \|\| 0\)\.toFixed\(2\)\} Kg`);
rep('transit sute cell', String.raw`\{transitDetail\?\.suteNetWeight \? ` + '`' + String.raw`\$\{transitDetail\.suteNetWeight\} Kg` + '`' + String.raw` : '-'}`);
rep('BMB sute cell', String.raw`\{entry\.suteNetWeight \? ` + '`' + String.raw`\$\{entry\.suteNetWeight\} Kg` + '`' + String.raw` : '-'}`);
rep('transit godown edit gate', String.raw`\{placeStatus === 'approved' \? \(`);
rep('BMB godown edit gate', String.raw`\{placeStatus === 'approved' && \(`);
rep('BMB added-by', String.raw`<div>\{placeDisplay\}</div>`);
rep('transit added-by', String.raw`<div style=\{\{ marginTop: transitDetail && \(placeStatus === 'approved' \|\| placeStatus === 'pending' \|\| placeStatus === 'placed'\) \? '4px' : '0px' \}\}>`);
rep('transit reject wb dialog', String.raw`handleRejectWb\(inspection\?\.id \|\| entry\?\.id, transitDetail\)`);
rep('party auto sute', String.raw`onChange=\{\{?\(e\) => setPartyWbName\(e\.target\.value\)\}?\} placeholder="Party WB Name"`);
rep('pending states', String.raw`const \[bmbSearchQuery, setBmbSearchQuery\] = useState\(''\);`);
rep('transit pending memo', String.raw`return flatTrips\.filter\(trip => \{`);
rep('transit memo deps', String.raw`inTransitVarietyFilter\]\);`);
rep('BMB pending memo', String.raw`return bandMalalEntries\.filter\(\(entry\) => \{`);
rep('BMB memo deps', String.raw`bmbVarietyFilter, bmbSearchQuery\]\);`);
const toolbarRe = /<div style=\{\{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' \}\}>/g;
const tMatches = s.match(toolbarRe);
report.push(`toolbar toggles: matched ${tMatches ? tMatches.length : 0} (expected 2)`);
rep('transit date crash', String.raw`const dStr = new Date\(dateVal\)\.toISOString\(\)\.split\('T'\)\[0\];`);
rep('transit date display crash', String.raw`\{new Date\(dateVal\)\.toLocaleDateString\('en-GB'\)\}`);
rep('BMB date crash', String.raw`const dStr = new Date\(entry\.date\)\.toISOString\(\)\.split\('T'\)\[0\];`);
rep('BMB date display crash', String.raw`\{new Date\(entry\.date\)\.toLocaleDateString\('en-GB', \{ day: '2-digit', month: '2-digit', year: 'numeric' \}\)\}`);

console.log('=== ARRIVALS.TSX ===');
console.log(report.join('\n'));

// repo checks
const report2 = [];
function rep2(label, old, { assert = 1 } = {}) {
  const re = new RegExp(old, '');
  const matches = r.match(re);
  const count = matches ? matches.length : 0;
  report2.push(`${label}: matched ${count} (expected ${assert}) ${count !== assert ? '<<< MISMATCH' : 'ok'}`);
}
rep2('repo A (multi-line include)', String.raw`as: 'wbAddedByUser',(\s*)required: false,(\s*)attributes: \['id', 'username', 'fullName'\]([\s\S]*?)\}\]`);
rep2('repo B (one-line include)', String.raw`\{ model: User, as: 'wbAddedByUser', attributes: \['id', 'username', 'fullName'\] \},`);
console.log('=== SAMPLEENTRYREPOSITORY.JS ===');
console.log(report2.join('\n'));
