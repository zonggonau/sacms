const fs = require('fs');
const path = require('path');

const files = [
  'src/app/dashboard/page.tsx',
  'src/app/dashboard/[tenant]/page.tsx',
  'src/components/dashboard/tenant-sidebar.tsx',
  'src/components/dashboard/header.tsx',
  'src/components/dashboard/sidebar.tsx',
  'src/app/dashboard/payment/page.tsx',
  'src/app/dashboard/payment-result/page.tsx',
  'src/app/dashboard/dashboard-layout.tsx'
];

files.forEach(file => {
  const p = path.join('d:/projek/z.ai/sacms', file);
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf-8');
  
  // Replace all rounded variants with rounded-none (except for very specific exceptions if needed, but none here)
  content = content.replace(/rounded-(xl|2xl|3xl|full|lg|md|sm|\[.*?\])/g, 'rounded-none');
  
  // Replace all shadow variants with shadow-none
  content = content.replace(/shadow-(xl|md|lg|sm|2xl|inner)(\/[0-9]+)?/g, 'shadow-none');
  
  // Replace thick borders with normal borders
  content = content.replace(/border-[248]/g, 'border');
  
  // Replace bg-muted/10 with standard bg-zinc-50
  // content = content.replace(/bg-muted\/10/g, 'bg-zinc-50');

  // Replace gradients
  content = content.replace(/bg-gradient-to-[a-z]+ from-[a-z0-9\/]+ via-[a-z0-9\/]+ to-[a-z0-9\/]+/g, 'bg-zinc-100');

  fs.writeFileSync(p, content, 'utf-8');
  console.log(`Updated ${file}`);
});
