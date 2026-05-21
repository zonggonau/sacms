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

  // Fix the mistakes from previous script
  content = content.replace(/rounded-none-none/g, 'rounded-none');
  content = content.replace(/shadow-none-none/g, 'shadow-none');
  content = content.replace(/shadow-none-primary\/20/g, 'shadow-none');
  content = content.replace(/shadow-none-slate-200/g, 'shadow-none');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
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
console.log('Done fixing theme utility classes.');
