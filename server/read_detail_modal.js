const fs = require('fs');
const content = fs.readFileSync('../client/src/components/SampleEntryDetailModal.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 3690; i <= 3760; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
