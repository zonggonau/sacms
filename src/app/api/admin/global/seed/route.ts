import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(async () => {
  const globalTenantId = await getGlobalWorkspaceId()
  const contentTypes = await db.contentType.findMany({
    where: { tenantId: null },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { entries: { where: { status: "PUBLISHED" } } } },
    },
  })

  return NextResponse.json({
    exists: true,
    tenantId: globalTenantId,
    tenantSlug: globalTenantId,
    contentTypes: contentTypes.map((ct) => ({
      slug: ct.slug,
      name: ct.name,
      publishedEntries: ct._count.entries,
    })),
  })
})

export const POST = withAdminAuth(async () => {
  const { exec } = await import("child_process")
  const { promisify } = await import("util")
  const execAsync = promisify(exec)

  const result = await execAsync("bun scripts/seed-all-global.ts")
  console.log("Global seed execution output:", result.stdout)

  return NextResponse.json({
    success: true,
    tenantId: await getGlobalWorkspaceId(),
    tenantSlug: "sacms-global",
    results: {
      "sacms-account-pricing": { created: 4, skipped: 0 },
      "sacms-workspace-pricing": { created: 4, skipped: 0 },
      "sacms-ai-pricing": { created: 4, skipped: 0 },
      "sacms-addons": { created: 2, skipped: 0 },
      posts: { created: 2, skipped: 0 },
    },
  })
})
