import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { exec } from "child_process"
import { promisify } from "util"
import { withAdminAuth } from "@/lib/api/route-helpers"

const execAsync = promisify(exec)

export const POST = withAdminAuth(async () => {
  const { getGlobalWorkspaceId, syncPlatformSettingsCache } = await import("@/lib/settings")
  const configuredId = await getGlobalWorkspaceId()

  let globalTenant = await db.tenant.findUnique({ where: { id: configuredId } })

  // Self-heal: a tenant named "SaCMS Global" may already exist under a
  // DIFFERENT id than the currently configured one — e.g. the admin used
  // "Acak Baru" to regenerate the configured id after setup already ran
  // once, which otherwise orphans the real one and creates a second,
  // empty duplicate every time this runs. Reuse the real one and point
  // the setting back at it instead of creating another duplicate.
  if (!globalTenant) {
    const existing = await db.tenant.findFirst({ where: { name: "SaCMS Global" } })
    if (existing) {
      globalTenant = existing
      await db.setting.upsert({
        where: { key: "globalTenantId" },
        update: { value: existing.id },
        create: { key: "globalTenantId", value: existing.id, tenantId: null },
      })
      await syncPlatformSettingsCache({ globalTenantId: existing.id })
    }
  }

  if (!globalTenant) {
    globalTenant = await db.tenant.create({
      data: {
        id: configuredId,
        name: "SaCMS Global",
        slug: configuredId,
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
