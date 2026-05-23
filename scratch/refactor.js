const fs = require('fs')
const path = require('path')

function processFile(filePath, viewToKeep) {
  let content = fs.readFileSync(filePath, 'utf8')

  // Remove top navbar
  content = content.replace(
    /\{\/\* Top Navbar \*\/\}\s*<nav className="h-16 bg-background border-b border-border px-6 md:px-10 flex items-center justify-between sticky top-0 z-50">[\s\S]*?<\/nav>/,
    ''
  )

  // Force active view state
  content = content.replace(
    /const \[activeView, setActiveView\] = useState<'workspaces' \| 'templates' \| 'billing'>\('workspaces'\)/,
    `const activeView = '${viewToKeep}';\n  const setActiveView = (view: string) => { if (view === 'templates') window.location.href = '/dashboard/templates'; else if (view === 'billing') window.location.href = '/dashboard/billing'; else window.location.href = '/dashboard'; };`
  )

  // Replace Link hrefs in activeView tabs
  content = content.replace(
    /onClick=\{\(\) => setActiveView\('workspaces'\)\}/g,
    `onClick={() => window.location.href = '/dashboard'}`
  )
  content = content.replace(
    /onClick=\{\(\) => setActiveView\('templates'\)\}/g,
    `onClick={() => window.location.href = '/dashboard/templates'}`
  )
  content = content.replace(
    /onClick=\{\(\) => setActiveView\('billing'\)\}/g,
    `onClick={() => window.location.href = '/dashboard/billing'}`
  )

  fs.writeFileSync(filePath, content)
  console.log(`Processed ${filePath} for ${viewToKeep}`)
}

const base = 'd:\\projek\\z.ai\\sacms\\src\\app\\dashboard\\(global)'

processFile(path.join(base, 'page.tsx'), 'workspaces')
processFile(path.join(base, 'templates', 'page.tsx'), 'templates')
processFile(path.join(base, 'billing', 'page.tsx'), 'billing')
