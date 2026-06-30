const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'SampleEntry.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let foundTh = false;
let thLineIndex = -1;

lines.forEach((line, index) => {
  if (line.includes('Sample Collected By') && line.includes('<th')) {
    thLineIndex = index;
    foundTh = true;
  }
});

if (foundTh && thLineIndex !== -1) {
  console.log('Found Sample Collected By header at line', thLineIndex + 1);
  // Let's print around that line to see the table cells
  for (let i = Math.max(0, thLineIndex - 5); i < Math.min(lines.length, thLineIndex + 100); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} else {
  console.log('Could not find <th> containing Sample Collected By');
}
