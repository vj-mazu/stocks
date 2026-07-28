const fs = require('fs');
const content = fs.readFileSync('client/src/pages/LoadingLots.tsx', 'utf8');
const lines = content.split('\n');
const results = [];
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('close') || line.toLowerCase().includes('rate')) {
    results.push(`${index + 1}: ${line.trim()}`);
  }
});
fs.writeFileSync('scratch/find_close_lot_results.txt', results.join('\n'));
console.log('Done');
