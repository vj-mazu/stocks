const fs = require('fs');
const content = fs.readFileSync('../server/routes/arrivals.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('approve-wb') || line.includes('reject-wb')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
