const fs = require('fs');
const path = require('path');

const searchDir = path.join(__dirname, '../client/src');
const query = /close/i;
let results = [];

function search(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (query.test(line)) {
          results.push(`${path.relative(searchDir, fullPath)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

search(searchDir);
fs.writeFileSync(path.join(__dirname, 'search_results.txt'), results.join('\n'));
console.log('Search complete. Results written to search_results.txt');
