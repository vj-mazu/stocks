const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'components', 'SampleEntryDetailModal.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('Discolor') || line.includes('discolor') || line.includes('ಕಡಿಗಾ') || line.includes('kadiga')) {
      console.log(`${index + 1}: ${line}`);
    }
  });
} else {
  console.log('SampleEntryDetailModal.tsx not found');
}
