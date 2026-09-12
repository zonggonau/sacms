import { db, type PrismaClient } from "@/lib/database"
import { checkVercelProjectExists } from "@/lib/vercel-client"

export interface TenantHostingStatus {
  deployed: boolean
  url: string | null
  projectId: string | null
  /** True when this call just discovered the Vercel project is gone and
   *  cleared the stale record — callers should treat this exactly like
   *  "never deployed" (show the build/deploy empty state). */
  wasCleared?: boolean
}

/**
 * Resolve whether a tenant's stored Vercel deployment is still real, not
 * just "do we have a URL saved" — a project deleted directly on vercel.com
 * otherwise keeps showing as "Live" forever, since nothing else ever
 * re-checks it.
 *
 * Only calls the Vercel API when there's actually a projectId to check —
 * a tenant that never deployed (or already knows it's not deployed) costs
 * nothing extra. A confirmed 404 clears the stale DB fields so this never
 * needs re-checking on future loads; an inconclusive check (no token,
 * network hiccup, rate limit) fails OPEN — it keeps showing the site as
 * live rather than risk hiding one that's actually still up.
 */
export async function resolveTenantHostingStatus(
  tenantId: string,
  vercelDeploymentUrl: string | null | undefined,
  vercelProjectId: string | null | undefined,
  /** The `Tenant` row lives in whichever DB this tenant actually uses
   *  (shared master, or its own dedicated appliance for VPS/VDS/Storage
   *  plans — see getTenantDb) — write the clear-out back to the same one
   *  the caller read from, defaulting to the shared master `db`. */
  client: PrismaClient = db,
): Promise<TenantHostingStatus> {
  if (!vercelDeploymentUrl || !vercelProjectId) {
    return { deployed: false, url: null, projectId: null }
  }

  const exists = await checkVercelProjectExists(vercelProjectId)
  if (exists === false) {
    await Promise.all([
      client.tenant
        .update({ where: { id: tenantId }, data: { vercelDeploymentUrl: null, vercelProjectId: null } })
        .catch((err) => console.warn(`[hosting-status] Failed to clear stale Vercel fields for tenant ${tenantId}:`, err)),
      // Settings are always platform/master-scoped regardless of which DB
      // the tenant's own data lives in.
      db.setting
        .deleteMany({
          where: { key: { in: [`${tenantId}_vercelDeploymentUrl`, `${tenantId}_vercelProjectId`] } },
        })
        .catch(() => {}),
    ])
    return { deployed: false, url: null, projectId: null, wasCleared: true }
  }

  return { deployed: true, url: vercelDeploymentUrl, projectId: vercelProjectId }
}
