const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TS/TSX files
const findFiles = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

const allFiles = findFiles(path.join(__dirname, '../src'));
let modifiedCount = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Pattern 1: include: { fields: true } -> include: { schemaFields: true }
  content = content.replace(/include:\s*\{\s*fields:\s*true\s*\}/g, 'include: { schemaFields: true }');
  
  // Pattern 2: include: { fields: { orderBy: ... } } -> include: { schemaFields: { orderBy: ... } }
  content = content.replace(/include:\s*\{\s*fields:\s*\{/g, 'include: { schemaFields: {');
  
  // Pattern 3: db.contentTypeField -> db.schemaField
  content = content.replace(/db\.contentTypeField/g, 'db.schemaField');
  content = content.replace(/tenantDb\.contentTypeField/g, 'tenantDb.schemaField');
  content = content.replace(/tx\.contentTypeField/g, 'tx.schemaField');
  
  content = content.replace(/db\.singleTypeField/g, 'db.schemaField');
  content = content.replace(/tenantDb\.singleTypeField/g, 'tenantDb.schemaField');
  content = content.replace(/tx\.singleTypeField/g, 'tx.schemaField');
  
  content = content.replace(/db\.componentField/g, 'db.schemaField');
  content = content.replace(/tenantDb\.componentField/g, 'tenantDb.schemaField');
  content = content.replace(/tx\.componentField/g, 'tx.schemaField');

  // Specific mapping for API returns: if schemaFields is used but not mapped, map it for the frontend
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`\nFinished! Modified ${modifiedCount} files.`);
