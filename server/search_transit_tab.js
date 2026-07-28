const fs = require('fs');
const content = fs.readFileSync('../client/src/components/TransitApprovalsTab.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('WEIGHT BRIDGE DETAILS') || line.includes('PLACE DETAILS') || line.includes('WB INPUT TYPE')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
