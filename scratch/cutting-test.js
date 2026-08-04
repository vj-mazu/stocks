// Compare cutting/bend sanitization logic
function sampleEntryCut(v) {
  let clean = v.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 1);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return clean;
}

// PhysicalInspection module-level
function piCutModule(v) {
  let clean = v.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 4);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return { raw: clean, part1: first, part2: second || '' };
}

// PI handleStageInputChange re-process
function piStage(v) {
  let clean = String(v || '').replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
  const xCount = (clean.match(/×/g) || []).length;
  if (xCount > 1) {
    const idx = clean.indexOf('×');
    clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
  }
  if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
    clean = clean + '×';
  }
  const parts = clean.split('×');
  const first = (parts[0] || '').substring(0, 1);
  const second = (parts[1] || '').substring(0, 4);
  clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
  return clean;
}

const tests = ['1', '2', '1×', '1×4', '12×4', '1x4', '1.5×2', '3×4.5', '0×2', '4', '5×', '10×2'];
for (const t of tests) {
  const se = sampleEntryCut(t);
  const piRaw = piCutModule(t);
  const piFinal = piStage(piRaw.raw);
  const same = se === piFinal ? 'SAME' : 'DIFF';
  console.log(`in=${JSON.stringify(t)} | SE=${JSON.stringify(se)} | PI(full)=${JSON.stringify(piFinal)} | ${same}`);
}
