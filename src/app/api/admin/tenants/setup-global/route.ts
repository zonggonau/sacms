import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { withAdminAuth } from "@/lib/api/route-helpers"

const execAsync = promisify(exec)

/**
 * Re-seeds the platform-level marketing content (landing page, blog posts —
 * see scripts/seed-all-global.ts, which now writes directly to
 * `tenantId: null`) back to its default values. No longer provisions a
 * "SaCMS Global" tenant — that system workspace was retired once its only
 * two jobs (serving this content, and the Website/Schema Template MCP
 * catalog) stopped needing a tenant row to hang off of. Kept as an internal
 * recovery action (not currently linked from any admin page) for the rare
 * case platform content needs resetting to its defaults.
 */
export const POST = withAdminAuth(async () => {
  try {
    const { stdout, stderr } = await execAsync("bun run scripts/seed-all-global.ts")
    console.log("Seed Script Output:", stdout)
    if (stderr) console.error("Seed Script Error:", stderr)
  } catch (err) {
    console.error("Failed to run seed script:", err)
    return NextResponse.json({ error: "Seed script failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "Platform content reset to defaults." })
})
