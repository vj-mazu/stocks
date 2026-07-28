const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found "${query}" in: ${fullPath}`);
      }
    }
  }
}

const clientSrcDir = path.join(__dirname, '..', '..', 'client', 'src');
if (fs.existsSync(clientSrcDir)) {
  searchDir(clientSrcDir, 'Discolor');
  searchDir(clientSrcDir, 'ಕಡಿಗಾ');
} else {
  console.log('client/src not found');
}
