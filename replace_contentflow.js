import fs from 'fs';
import path from 'path';

const replacements = [
  { search: /ContentFlow/g, replace: 'SaCMS' },
  { search: /contentflow/g, replace: 'sacms' },
  { search: /CONTENTFLOW/g, replace: 'SACMS' }
];

const ignoredDirs = ['.git', 'node_modules', '.next', 'db/backups', 'public/upload'];
const ignoredFiles = ['replace_contentflow.js', 'package-lock.json', 'bun.lock'];

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!ignoredDirs.includes(file)) {
        walkDir(filePath, fileList);
      }
    } else {
      if (!ignoredFiles.includes(file)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const files = walkDir('.');
console.log(`Scanning ${files.length} files...`);

const modifiedFiles = [];

files.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    for (const { search, replace } of replacements) {
      if (search.test(newContent)) {
        newContent = newContent.replace(search, replace);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      modifiedFiles.push(filePath);
      console.log(`Modified: ${filePath}`);
    }
  } catch (err) {
    // console.error(`Error processing ${filePath}:`, err.message);
  }
});

console.log('\nSummary of modified files:');
modifiedFiles.forEach(f => console.log(`- ${f}`));
