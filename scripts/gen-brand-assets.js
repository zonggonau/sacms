const fs = require("fs")

const black = fs.readFileSync("public/assets/img/sacms-icon-black-96.png").toString("base64")
const white = fs.readFileSync("public/assets/img/sacms-icon-white-96.png").toString("base64")

const content = `// Auto-generated from public/assets/img/sacms-icon-{black,white}.png (96x96
// PNG, base64-inlined) — used wherever a logo image needs to be embeddable
// without a network/filesystem fetch, e.g. client-side jsPDF generation
// (src/lib/pdf-generator.ts), which runs entirely in the browser and has no
// access to the server's public/ directory. Regenerate by re-running
// scripts/gen-brand-assets.js if the source logo art changes.

export const SACMS_ICON_BLACK_PNG_BASE64 =
  "data:image/png;base64,${black}"

export const SACMS_ICON_WHITE_PNG_BASE64 =
  "data:image/png;base64,${white}"
`

fs.writeFileSync("src/lib/brand-assets.ts", content)
console.log("wrote src/lib/brand-assets.ts", content.length, "chars")
