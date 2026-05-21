const fs = require('fs');
const path = require('path');

const targetDirs = [
  'src/app/dashboard/[tenant]/content-types',
  'src/app/dashboard/[tenant]/single-types',
  'src/app/dashboard/[tenant]/components',
  'src/components/cms',
  'src/components/content'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace rounded-* with rounded-none
  content = content.replace(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/g, 'rounded-none');
  content = content.replace(/\brounded\b/g, 'rounded-none');
  
  // Replace shadow-* with shadow-none
  content = content.replace(/\bshadow-(sm|md|lg|xl|2xl|inner)\b/g, 'shadow-none');
  content = content.replace(/\bshadow\b/g, 'shadow-none');
  
  // Clean up shadow colors (e.g. shadow-primary/20) since we are using shadow-none
  content = content.replace(/\bshadow-\w+\/\d+\b/g, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

targetDirs.forEach(dir => processDir(path.join(process.cwd(), dir)));
console.log('Done replacing theme utility classes.');
