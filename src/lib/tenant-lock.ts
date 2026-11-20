import "server-only"
import { db } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"

/**
 * Same "Locked" condition the dashboard's own SubscriptionGate uses
 * (src/app/(workspace)/dashboard/[tenant]/(dashboard)/layout.tsx) —
 * extracted here so the public-site lock (enforce-site-lock cron) applies
 * the exact same rule instead of drifting from it. A tenant is locked when
 * it's been explicitly suspended, or its latest subscription's period has
 * passed — unless it's a real (licensed) Enterprise tenant, which bypasses
 * both.
 */
export async function isTenantLocked(tenantId: string): Promise<boolean> {
  const [subscription, tenant, owner] = await Promise.all([
    db.subscription.findFirst({
      where: { tenantId },
      orderBy: { currentPeriodEnd: "desc" },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { status: true } }),
    db.tenantMember.findFirst({ where: { tenantId, role: "owner" }, select: { userId: true } }),
  ])

  if (!tenant) return false

  const enterprise = await isEnterpriseTenant(tenantId, owner?.userId)
  if (enterprise) return false

  return (
    tenant.status === "suspended" ||
    (subscription?.currentPeriodEnd ? new Date() > subscription.currentPeriodEnd : false)
  )
}
