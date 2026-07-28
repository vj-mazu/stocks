const fs = require('fs');
const content = fs.readFileSync('../client/src/pages/Arrivals.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('cutting') || line.includes('previous') || line.includes('allot') || line.includes('Allotted')) {
    if (line.includes('0') || line.includes('find') || line.includes('search') || line.includes('===')) {
      console.log(`${i+1}: ${line.trim()}`);
    }
  }
});
