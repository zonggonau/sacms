
const fs = require('fs');
const files = [
  'src/actions/content-types.ts',
  'src/actions/single-types.ts',
  'src/actions/content.ts',
  'src/actions/components.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const count1 = (content.match(/access\.tenant\.slug === 'sacms-global'/g) || []).length;
  content = content.replace(/access\.tenant\.slug === 'sacms-global'/g, 'access.isGlobal');
  
  const count2 = (content.match(/access\.tenant\.slug !== 'sacms-global'/g) || []).length;
  content = content.replace(/access\.tenant\.slug !== 'sacms-global'/g, '!access.isGlobal');
  
  const count3 = (content.match(/access\.tenant\.slug === \"sacms-global\"/g) || []).length;
  content = content.replace(/access\.tenant\.slug === \"sacms-global\"/g, 'access.isGlobal');

  const count4 = (content.match(/access\.tenant\.slug !== \"sacms-global\"/g) || []).length;
  content = content.replace(/access\.tenant\.slug !== \"sacms-global\"/g, '!access.isGlobal');
  
  fs.writeFileSync(file, content);
  console.log('Updated', file, 'Replacements:', count1 + count3, 'and', count2 + count4);
}

