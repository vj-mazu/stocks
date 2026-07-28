const fs = require('fs');
const content = fs.readFileSync('../client/src/components/SampleEntryDetailModal.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('/wb') || line.includes('submitWb') || line.includes('saveWb') || line.includes('/approve-wb') || line.includes('/reject-wb')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
