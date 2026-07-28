const fs = require('fs');
const content = fs.readFileSync('../client/src/components/SampleEntryDetailModal.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Weight Bridge Details') || line.includes('WEIGHT BRIDGE DETAILS')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
