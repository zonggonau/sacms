const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/page.tsx');
const clientPath = path.join(process.cwd(), 'src/app/dashboard/[tenant]/client-page.tsx');

try {
  execSync('git checkout -- "src/app/dashboard/[tenant]/page.tsx"');
  console.log("Restored page.tsx");
} catch (e) {
  console.log("Failed to restore page.tsx", e.message);
}

if (fs.existsSync(clientPath)) {
  fs.unlinkSync(clientPath);
  console.log("Deleted client-page.tsx");
}
