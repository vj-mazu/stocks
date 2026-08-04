// Replicates the three cutting handlers to find functional differences
const X = '\u00D7'; // ×

// PhysicalInspection module-level handleCuttingInput (line 55): first is substring(0,4)
function piModuleCut(v) {
  let clean = v.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, X);
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf(X);
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes(X) && /^\d$/.test(clean)) {
    clean = clean + X;
  }
  const parts = clean.split(X);
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes(X) ? first + X + second : first;
  return clean;
}

// PhysicalInspection handleStageInputChange inline cutting logic (line 568): first is substring(0,1)
function piStageCut(v) {
  let clean = String(v || '').replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, X);
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf(X);
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes(X) && /^\d$/.test(clean)) {
    clean = clean + X;
  }
  const parts = clean.split(X);
  const first = (parts[0] || '').substring(0, 1);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes(X) ? first + X + second : first;
  return clean;
}

// SampleEntry handleCuttingInput (line 862): first is substring(0,1)
function seCut(v) {
  let clean = v.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, X);
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf(X);
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes(X) && /^\d$/.test(clean)) {
    clean = clean + X;
  }
  const parts = clean.split(X);
  const first = (parts[0] || '').substring(0, 1);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes(X) ? first + X + second : first;
  return clean;
}

// Simulate typing in PhysicalInspection card: onChange -> piModuleCut(raw) -> piStageCut(raw) stored
function piTypingSequence() {
  let val = '';
  const result = [];
  const keys = ['1', '2', X, '4'];
  for (const k of keys) {
    val = val + k;
    const raw = piModuleCut(val);
    val = piStageCut(raw);
    result.push([k, val]);
  }
  return result;
}

// Simulate typing in SampleEntry card: onChange -> seCut stored
function seTypingSequence() {
  let val = '';
  const result = [];
  const keys = ['1', '2', X, '4'];
  for (const k of keys) {
    val = val + k;
    val = seCut(val);
    result.push([k, val]);
  }
  return result;
}

console.log('PI typing:', JSON.stringify(piTypingSequence()));
console.log('SE typing:', JSON.stringify(seTypingSequence()));

// Focus prefill '1×' then typing
let piVal = piStageCut('1' + X);
console.log('PI prefill then type 2:', piVal, '->', piStageCut(piModuleCut(piVal + '2')));
