const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'PhysicalInspection.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('Half Lorry') || line.includes('HalfLorry') || line.includes('Balanced') || line.includes('balanced') || line.includes('Lot Avg') || line.includes('lotAvg') || line.includes('nit')) {
      console.log(`${index + 1}: ${line}`);
    }
  });
} else {
  console.log('PhysicalInspection.tsx not found');
}
