const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const rootDir = path.resolve(__dirname, '..');
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(rootDir, '.next', 'standalone', '.next', 'static');
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(rootDir, '.next', 'standalone', 'public');

if (fs.existsSync(staticSrc)) {
  console.log('[Build] Copying .next/static to .next/standalone/.next/static...');
  copyDir(staticSrc, staticDest);
}

if (fs.existsSync(publicSrc)) {
  console.log('[Build] Copying public/ to .next/standalone/public...');
  copyDir(publicSrc, publicDest);
}

console.log('[Build] Standalone static assets copied successfully.');
