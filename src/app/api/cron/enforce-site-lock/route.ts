import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { isTenantLocked } from "@/lib/tenant-lock"
import { setDomainRedirect, clearDomainRedirect } from "@/lib/vercel-client"
import { ROOT_DOMAIN } from "@/lib/portal-urls"
import { logAudit, AuditAction } from "@/lib/audit-log"

const SUSPENDED_URL = `https://${ROOT_DOMAIN}/suspended`

/**
 * GET /api/cron/enforce-site-lock
 *
 * Keeps every deployed tenant's public-facing domains (their
 * <slug>.sites.sacms.cloud subdomain and verified custom domain) in sync
 * with the same "Locked" condition the dashboard itself already enforces
 * (src/lib/tenant-lock.ts) — a Vercel domain-level redirect to /suspended
 * while locked, cleared the moment the tenant is unlocked again. Only acts
 * on a real state transition (Tenant.siteLockRedirectActive) so an
 * already-correct domain costs nothing on repeat runs.
 *
 * Requires CRON_SECRET, same as the other cron routes — schedule this on
 * the same external cron infrastructure that triggers suspend-tenants,
 * ideally every 5-10 minutes so a lock/unlock takes effect quickly.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const tenants = await db.tenant.findMany({
      where: { vercelProjectId: { not: null } },
      select: {
        id: true,
        slug: true,
        vercelProjectId: true,
        customDomain: true,
        customDomainStatus: true,
        siteLockRedirectActive: true,
      },
    })

    let redirected = 0
    let restored = 0
    let failed = 0

    for (const tenant of tenants) {
      if (!tenant.vercelProjectId) continue

      const domains = [`${tenant.slug}.sites.${ROOT_DOMAIN}`]
      if (tenant.customDomain && tenant.customDomainStatus === "verified") {
        domains.push(tenant.customDomain)
      }

      try {
        const locked = await isTenantLocked(tenant.id)

        if (locked && !tenant.siteLockRedirectActive) {
          for (const domain of domains) {
            await setDomainRedirect(tenant.vercelProjectId, domain, SUSPENDED_URL)
          }
          await db.tenant.update({ where: { id: tenant.id }, data: { siteLockRedirectActive: true } })
          logAudit({
            tenantId: tenant.id,
            action: AuditAction.TENANT_UPDATED,
            entity: "Tenant",
            entityId: tenant.id,
            data: { reason: "Site locked — redirected to /suspended", domains },
          })
          redirected++
        } else if (!locked && tenant.siteLockRedirectActive) {
          for (const domain of domains) {
            await clearDomainRedirect(tenant.vercelProjectId, domain)
          }
          await db.tenant.update({ where: { id: tenant.id }, data: { siteLockRedirectActive: false } })
          logAudit({
            tenantId: tenant.id,
            action: AuditAction.TENANT_UPDATED,
            entity: "Tenant",
            entityId: tenant.id,
            data: { reason: "Site unlocked — redirect to /suspended cleared", domains },
          })
          restored++
        }
      } catch (error) {
        console.error(`[enforce-site-lock] Failed for tenant ${tenant.slug}:`, error)
        failed++
      }
    }

    return NextResponse.json({ success: true, redirected, restored, failed, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Cron enforce-site-lock error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
