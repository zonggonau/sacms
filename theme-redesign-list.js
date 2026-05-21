const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/app/dashboard/[tenant]/content-types/page.tsx',
  'src/app/dashboard/[tenant]/single-types/page.tsx',
  'src/app/dashboard/[tenant]/components/page.tsx'
];

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  // 1. Layout wrappers
  content = content.replace(/className="flex h-screen overflow-hidden bg-muted\/10"/g, 'className="flex h-screen overflow-hidden bg-muted/20"');
  content = content.replace(/<main className="flex-1 overflow-y-auto">/g, '<main className="flex-1 overflow-y-auto bg-[#f6f6f9] text-foreground flex flex-col">');

  // 2. Header and Main content container extraction
  content = content.replace(
    /<div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">([\s\S]*?)<\!-- Schema Stats -->/,
    (match, inner) => {
      return `
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shrink-0">
          <div className="max-w-7xl mx-auto w-full">
            ${inner}
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1 space-y-6">
          <!-- Schema Stats -->`;
    }
  );

  // 3. Fix Typography in Header
  content = content.replace(/<h1 className="text-3xl font-extrabold tracking-tight">/g, '<h1 className="text-xl font-bold text-slate-800">');
  content = content.replace(/<p className="text-muted-foreground">/g, '<p className="text-xs text-slate-500 font-medium mt-1">');
  
  // 4. Cards
  content = content.replace(/<Card className="bg-card border-none shadow-none">/g, '<Card className="bg-white border border-slate-200 rounded-none shadow-sm">');
  content = content.replace(/<Card className="border-none shadow-none overflow-hidden bg-card">/g, '<Card className="border border-slate-200 shadow-sm overflow-hidden bg-white rounded-none">');
  content = content.replace(/<CardHeader className="bg-card border-b">/g, '<CardHeader className="bg-white border-b border-slate-200">');
  
  // 5. Inputs (Search)
  content = content.replace(/className="pl-10 h-9 bg-muted\/30 border-none"/g, 'className="pl-10 h-10 bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm font-medium"');
  
  // 6. Buttons
  content = content.replace(/className="bg-primary hover:bg-primary\/90 text-primary-foreground shadow-none shadow-none"/g, 'className="bg-primary hover:bg-primary/90 text-white font-bold rounded-none shadow-none"');
  content = content.replace(/className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold"/g, 'className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-none"');
  
  // 7. Table Styling
  content = content.replace(/<TableHeader className="bg-muted\/30">/g, '<TableHeader className="bg-[#f6f6f9] border-b border-slate-200">');
  content = content.replace(/<TableHead className="font-bold text-\[10px\] uppercase tracking-widest/g, '<TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes made to ${filePath}`);
  }
}

targetFiles.forEach(processFile);
console.log('Done redesigning list pages.');
