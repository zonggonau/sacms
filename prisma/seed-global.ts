import { execSync } from "child_process"
import path from "path"

async function main() {
  console.log("🚀 Running complete SaCMS global seeding...")
  const scriptPath = path.join(process.cwd(), "scripts", "seed-all-global.ts")
  execSync(`bun "${scriptPath}"`, { stdio: "inherit" })
}

main().catch((e) => {
  console.error("❌ Global seed failed:", e)
  process.exit(1)
})
