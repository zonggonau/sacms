const fs = require('fs');

const file = 'src/components/cms/field-config-modal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /value=\{editingField\.options as string \|\| ""\}/g,
  "value={typeof editingField.options === 'string' ? editingField.options : (editingField.options?.choices?.join(', ') || (Array.isArray(editingField.options) ? editingField.options.join(', ') : ''))}"
);

fs.writeFileSync(file, content);
console.log('Updated', file);
