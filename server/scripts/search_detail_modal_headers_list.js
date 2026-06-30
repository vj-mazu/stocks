const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'components', 'SampleEntryDetailModal.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let tableHeaderFound = false;
  lines.forEach((line, index) => {
    if (line.includes('<th') || line.includes('headers =') || line.includes('headers:')) {
      tableHeaderFound = true;
      console.log(`${index + 1}: ${line}`);
    }
  });
} else {
  console.log('SampleEntryDetailModal.tsx not found');
}
