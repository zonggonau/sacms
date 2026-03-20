import { Session } from "next-auth"
import { db } from "@/lib/database"

interface TenantAccess {
  tenantId: string
  role: string
}

/**
 * Resolves tenant access for a user.
 * Super admins can access any tenant without a membership record.
 * Returns null if the user has no access to the tenant.
 */
export async function getTenantAccess(
  session: Session,
  tenantSlug: string
): Promise<TenantAccess | null> {
  // Super admin can access any tenant
  if (session.user.role === "super_admin") {
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    })
    if (!tenant) return null
    return { tenantId: tenant.id, role: "owner" }
  }

  // Regular users need a membership
  const membership = await db.tenantMember.findFirst({
    where: {
      userId: session.user.id,
      tenant: { slug: tenantSlug },
    },
    select: {
      tenantId: true,
      role: true,
    },
  })

  if (!membership) return null
  return { tenantId: membership.tenantId, role: membership.role }
}
