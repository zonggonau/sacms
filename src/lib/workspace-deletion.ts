import { db } from "@/lib/database"
import { dropEnterpriseDb } from "@/lib/enterprise-db"
import { deleteTenantStorage } from "@/lib/r2"

type Workspace = { id: string; slug: string; name: string; databaseUrl: string | null }

function isManagedWorkspaceDatabase(workspace: Workspace): boolean {
  if (!workspace.databaseUrl || !process.env.DATABASE_URL) return false
  try {
    const dedicated = new URL(workspace.databaseUrl)
    const shared = new URL(process.env.DATABASE_URL)
    const expectedName = "sacms_tenant_" + workspace.slug.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    return dedicated.hostname === shared.hostname &&
      (dedicated.port || "5432") === (shared.port || "5432") &&
      dedicated.username === shared.username &&
      dedicated.pathname === "/" + expectedName &&
      dedicated.pathname !== shared.pathname
  } catch {
    return false
  }
}

/** Keep the workspace available for a retry until cleanup and ledger archival finish. */
export async function removeWorkspace(workspace: Workspace, removeGlobalSetting = false) {
  const claimed = await db.tenant.updateMany({ where: { id: workspace.id }, data: { status: "deleting" } })
  if (!claimed.count) return
  if (workspace.slug) await deleteTenantStorage(workspace)
  if (workspace.databaseUrl && isManagedWorkspaceDatabase(workspace)) {
    const otherConnection = await db.tenant.findFirst({
      where: { databaseUrl: workspace.databaseUrl, id: { not: workspace.id } },
      select: { id: true },
    })
    if (!otherConnection && !(await dropEnterpriseDb(workspace.databaseUrl))) {
      throw new Error("Workspace database cleanup failed; retry workspace deletion.")
    }
  }

  await db.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { tenantId: workspace.id },
      data: {
        tenantId: null,
        status: "archived",
        cancelAtPeriodEnd: true,
        tenantNameSnapshot: workspace.name,
        tenantSlugSnapshot: workspace.slug,
      },
    })
    await tx.customPlanOverride.deleteMany({ where: { tenantId: workspace.id } })
    if (removeGlobalSetting) {
      await tx.setting.deleteMany({ where: { key: "globalTenantId", value: { in: [workspace.id, workspace.slug] } } })
    }
    await tx.tenant.deleteMany({ where: { id: workspace.id } })
  })
}
