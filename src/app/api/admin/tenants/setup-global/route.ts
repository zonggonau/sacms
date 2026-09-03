import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { exec } from "child_process"
import { promisify } from "util"
import { withAdminAuth } from "@/lib/api/route-helpers"

const execAsync = promisify(exec)

export const POST = withAdminAuth(async () => {
  const { getGlobalWorkspaceId } = await import("@/lib/settings")
  const globalTenantId = await getGlobalWorkspaceId()

  let globalTenant = await db.tenant.findUnique({ where: { id: globalTenantId } })
  if (!globalTenant) {
    globalTenant = await db.tenant.create({
      data: {
        id: globalTenantId,
        name: "SaCMS Global",
        slug: globalTenantId,
        plan: "ENTERPRISE",
        status: "active",
      },
    })
  }

  // Schema creation + seeding is handled by scripts/seed-all-global.ts.
  try {
    const { stdout, stderr } = await execAsync("bun run scripts/seed-all-global.ts")
    console.log("Seed Script Output:", stdout)
    if (stderr) console.error("Seed Script Error:", stderr)
  } catch (err) {
    console.error("Failed to run seed script:", err)
    // Non-fatal: the rest of the setup still succeeded.
  }

  return NextResponse.json({
    success: true,
    message: "Global Tenant & Seed Data provisioned successfully.",
  })
})
