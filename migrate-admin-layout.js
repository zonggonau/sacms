const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), 'src/app/admin');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('page.tsx')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
}

const files = walkSync(targetDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Remove imports
  content = content.replace(/import\s+\{\s*GlobalAdminSidebar\s*\}\s+from\s+["'][^"']*global-admin-sidebar["']\s*;?\n?/g, '');

  // 2. Remove GlobalAdminSidebar components
  content = content.replace(/\s*<GlobalAdminSidebar[^>]*\/>\s*\n?/g, '\n');

  // 3. Transform outer wrappers that have h-screen or min-h-screen
  content = content.replace(/<div className="([^"]*(?:min-h-screen|h-screen)[^"]*)"([^>]*)>/g, (match, classes, rest) => {
    let newClasses = classes.replace(/(?:min-h-screen|h-screen|w-full|overflow-hidden|bg-muted\/\d+|bg-background)/g, '').trim();
    if (!newClasses.includes('flex-1')) newClasses += ' flex-1';
    if (!newClasses.includes('flex-col')) newClasses += ' flex-col';
    if (!newClasses.includes('w-full')) newClasses += ' w-full';
    
    newClasses = newClasses.replace(/\s+/g, ' ').trim();
    
    return `<div className="${newClasses}"${rest}>`;
  });

  // 4. Transform main tag to div, removing overflow since layout handles it
  content = content.replace(/<main\s+className="([^"]*)"([^>]*)>/g, (match, classes, rest) => {
    let newClasses = classes.replace(/(?:overflow-y-auto|overflow-auto)/g, '').trim();
    if (!newClasses.includes('flex-1')) newClasses += ' flex-1';
    if (!newClasses.includes('flex-col')) newClasses += ' flex-col';
    if (!newClasses.includes('w-full')) newClasses += ' w-full';
    
    newClasses = newClasses.replace(/\s+/g, ' ').trim();
    
    return `<div className="${newClasses}"${rest}>`;
  });
  
  // Transform <main> without classes
  content = content.replace(/<main>/g, '<div className="flex-1 w-full flex flex-col">');
  
  // Replace closing tags
  content = content.replace(/<\/main>/g, '</div>');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Migrated: ${file.replace(process.cwd(), '')}`);
  }
}

console.log('Admin Migration completed.');
