const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/app/dashboard/[tenant]/content-types/new/page.tsx',
  'src/app/dashboard/[tenant]/content-types/edit/[slug]/page.tsx',
  'src/app/dashboard/[tenant]/content-types/[slug]/[id]/edit/page.tsx', // Actually wait, CT edit is [slug]/edit/page.tsx or [slug]/[id]/edit/page.tsx?
  'src/app/dashboard/[tenant]/single-types/new/page.tsx',
  'src/app/dashboard/[tenant]/single-types/[singleTypeSlug]/edit/page.tsx',
  'src/app/dashboard/[tenant]/components/new/page.tsx',
  'src/app/dashboard/[tenant]/components/[componentSlug]/edit/page.tsx'
];

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  // 1. Layout wrappers
  content = content.replace(/className="flex min-h-screen bg-muted\/10"/g, 'className="flex h-screen overflow-hidden bg-muted/20"');
  content = content.replace(/<main className="flex-1 overflow-auto">/g, '<main className="flex-1 overflow-y-auto bg-[#f6f6f9] text-foreground flex flex-col">');

  // 2. Header and Main content container extraction
  // Find the pattern: <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6"> or max-w-7xl
  content = content.replace(
    /<div className="p-6 lg:p-8 max-w-[57]xl mx-auto space-y-6">([\s\S]*?)<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">/,
    (match, inner) => {
      // The inner part has the flex items-center justify-between header.
      // We will wrap inner in our sticky header
      return `
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shrink-0">
          <div className="max-w-5xl mx-auto w-full">
            ${inner}
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 lg:p-8 max-w-5xl mx-auto w-full flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`;
    }
  );

  // 3. Fix Title Typography
  content = content.replace(/text-3xl font-black tracking-tight uppercase/g, 'text-xl font-bold text-slate-800');
  content = content.replace(/text-muted-foreground text-sm/g, 'text-xs text-slate-500 font-medium mt-1');
  
  // 4. Cards
  content = content.replace(/<Card className="border-none shadow-none">/g, '<Card className="bg-white border border-slate-200 shadow-sm rounded-none">');
  content = content.replace(/<CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">/g, '<CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">');
  content = content.replace(/<Card className="border-dashed border-2 bg-transparent shadow-none">/g, '<Card className="border-dashed border-2 border-slate-200 bg-transparent shadow-none rounded-none">');
  
  // 5. Inputs & Textareas
  content = content.replace(/className="bg-muted\/30 border-none font-bold"/g, 'className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-10 font-medium text-sm"');
  content = content.replace(/className="bg-muted\/30 border-none font-mono text-xs"/g, 'className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-10 font-mono text-xs"');
  content = content.replace(/className="bg-muted\/30 border-none text-xs"/g, 'className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm p-3"');
  
  // 6. Section headers (Attributes List)
  content = content.replace(/<h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">/g, '<h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">');
  content = content.replace(/<Button variant="outline" size="sm" onClick=\{openTypeSelector\} className="rounded-none font-bold bg-card border-primary\/20 text-primary hover:bg-primary hover:text-white transition-all">/g, '<Button variant="outline" size="sm" onClick={openTypeSelector} className="rounded-none font-bold bg-white border-slate-200 text-primary hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm">');
  content = content.replace(/<Button variant="outline" size="sm" onClick=\{\(\) => setIsTypeSelectorOpen\(true\)\} className="rounded-none font-bold bg-card border-primary\/20 text-primary hover:bg-primary hover:text-white">/g, '<Button variant="outline" size="sm" onClick={() => setIsTypeSelectorOpen(true)} className="rounded-none font-bold bg-white border-slate-200 text-primary hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm">');

  // 7. Field List Items
  content = content.replace(/className="group bg-card border rounded-none p-4 flex items-center gap-4 hover:border-primary\/50 transition-all shadow-none"/g, 'className="group bg-white border border-slate-200 rounded-none p-4 flex items-center gap-4 hover:border-primary hover:shadow-sm transition-all shadow-none"');
  
  // 8. Buttons
  content = content.replace(/className="bg-primary hover:bg-primary\/90 font-bold px-6 shadow-none shadow-none"/g, 'className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-none shadow-none"');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

targetFiles.forEach(processFile);
console.log('Done redesigning schema builders.');
