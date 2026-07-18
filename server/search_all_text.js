const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('../client/src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('WB INPUT TYPE') || content.includes('Location Name') || content.includes('LOCATION NAME') || content.includes('wbInputType') || content.includes('Gross Weight') || content.includes('Tare Weight')) {
    // Only print files in components or pages
    if (file.includes('components') || file.includes('pages')) {
      console.log(`Matched: ${file}`);
    }
  }
});
