const fs = require('fs');
const content = fs.readFileSync('../client/src/pages/Arrivals.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('SampleEntryDetailModal')) {
    // Print the line and the next 10 lines
    for (let j = 0; j < 15; j++) {
      if (lines[i + j]) {
        console.log(`${i+1+j}: ${lines[i+j].trim()}`);
      }
    }
  }
});
