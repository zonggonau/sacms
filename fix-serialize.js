const fs = require('fs');
const glob = require('glob'); // Not available? I'll just hardcode the paths

const files = [
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/edit/[slug]/edit-content-type-client.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/new/new-content-type-client.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/single-types/[singleTypeSlug]/edit/edit-single-type-client.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/single-types/new/new-single-type-client.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/components/[componentSlug]/edit/edit-component-client.tsx',
  'src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/components/new/new-component-client.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log('Not found:', file);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  
  const replacement = `const serializeFieldOptions = (field: Field) => {
    let options: any = {}
    
    try {
      if (typeof field.options === 'string') {
        try {
          options = JSON.parse(field.options)
        } catch (e) {
          if (field.type === 'select' || field.type === 'tags') {
            options = { choices: field.options.split(',').map(v => v.trim()).filter(Boolean) }
          } else {
            options = field.options
          }
        }
      } else {
        options = field.options || {}
      }
    } catch (e) {
      options = {}
    }

    if (field.type === "relation") {`;
    
  // replace from "const serializeFieldOptions" to "if (field.type === \"relation\") {"
  content = content.replace(/const serializeFieldOptions = \(field: Field\) => \{[\s\S]*?if \(field\.type === "relation"\) \{/, replacement);
  
  fs.writeFileSync(file, content);
  console.log('Updated', file);
}
