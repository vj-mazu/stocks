const fs = require('fs');
const content = fs.readFileSync('../client/src/pages/Arrivals.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('isDetailOpen') || line.includes('selectedDetailEntry') || line.includes('SampleEntryDetailModal')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
