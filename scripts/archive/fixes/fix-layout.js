const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/content-types/[slug]/new/page.tsx');
const cmsPath = path.join(process.cwd(), 'src/app/cms/[tenant]/content/[slug]/new/page.tsx');

let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
let cmsContent = fs.readFileSync(cmsPath, 'utf8');

// Normalize line endings to LF
dashboardContent = dashboardContent.replace(/\r\n/g, '\n');
cmsContent = cmsContent.replace(/\r\n/g, '\n');

// 1. In CMS, extract the grid content.
const cmsGridStart = cmsContent.indexOf('<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">');
const cmsGridEndStr = '      </main>\n    </div>\n  )\n}\n';
const cmsGridEnd = cmsContent.indexOf(cmsGridEndStr);
const cmsGridHtml = cmsContent.substring(cmsGridStart, cmsGridEnd);

// 2. In Dashboard, extract from {/* Main Content */} to the end of the return statement
const dashMainStart = dashboardContent.indexOf('{/* Main Content */}');
const dashMainEndStr = '        </div>\n      </div>\n    </div>\n  )\n}\n';
const dashMainEnd = dashboardContent.indexOf(dashMainEndStr);

const newDashContent = dashboardContent.substring(0, dashMainStart) +
  '{/* Main Content */}\n' +
  '          <div className="p-6 lg:p-8 w-full flex-1 shrink-0">\n' +
  '            ' + cmsGridHtml + '\n          </div>\n' + dashMainEndStr;

fs.writeFileSync(dashboardPath, newDashContent);
console.log('Fixed dashboard new page');

// 3. For CMS, wrap the layout using the sticky header.
const cmsHeaderStart = cmsContent.indexOf('<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">');
const cmsHeaderEnd = cmsContent.indexOf('<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">');
let cmsHeaderHtml = cmsContent.substring(cmsHeaderStart, cmsHeaderEnd);
cmsHeaderHtml = cmsHeaderHtml.replace('gap-6', 'gap-4 max-w-7xl mx-auto w-full');

let newCmsGridHtml = cmsGridHtml.replace('<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">', '<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">');

const cmsReturnStart = cmsContent.indexOf('  return (\n');
const newCmsContent = cmsContent.substring(0, cmsReturnStart) +
'  return (\n' +
'    <div className="flex flex-1 flex-col w-full h-[calc(100vh-64px)] overflow-hidden">\n' +
'      <div className="flex-1 bg-[#f6f6f9] text-foreground flex w-full min-h-0 flex-col">\n' +
'        <div className="flex flex-col overflow-auto flex-1 min-h-0 w-full">\n' +
'          {/* Sticky Header */}\n' +
'          <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shrink-0">\n' +
'            <div className="w-full">\n' +
'              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">\n' +
'                ' + cmsHeaderHtml.replace('<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">\n', '') +
'            </div>\n' +
'          </div>\n' +
'          {/* Main Content */}\n' +
'          <div className="p-6 lg:p-8 w-full flex-1 shrink-0">\n' +
'            ' + newCmsGridHtml +
'          </div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n' +
'  )\n}\n';

fs.writeFileSync(cmsPath, newCmsContent);
console.log('Fixed cms new page');
