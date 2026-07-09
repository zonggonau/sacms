const fs = require('fs');

const files = [
  'src/app/(workspace)/dashboard/[tenant]/(cms)/cms/content/[slug]/edit/[id]/page.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(cms)/cms/content/[slug]/new/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(
    /if \(Array\.isArray\(opts\)\) options = opts/g,
    'if (Array.isArray(opts)) options = opts; else if (opts && Array.isArray(opts.choices)) options = opts.choices'
  );
  
  fs.writeFileSync(file, content);
  console.log('Updated', file);
}
