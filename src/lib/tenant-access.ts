import { Session } from "next-auth"
import { db } from "@/lib/database"

interface TenantAccess {
  tenantId: string
  userId: string
  role: string
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
  }
}

/**
 * Resolves tenant access for a user.
 * Super admins can access any tenant without a membership record.
 * Returns null if the user has no access to the tenant.
 */
export async function getTenantAccess(
  session: Session,
  tenantIdOrSlug: string
): Promise<TenantAccess | null> {
  // Super admin can access any tenant
  if (session.user.role === "super_admin") {
    const tenant = await db.tenant.findFirst({
      where: { 
        OR: [
          { id: tenantIdOrSlug },
          { slug: tenantIdOrSlug }
        ]
      },
      select: { id: true, name: true, slug: true, plan: true },
    })
    if (!tenant) return null
    return { 
      tenantId: tenant.id, 
      userId: session.user.id,
      role: "owner",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan
      }
    }
  }

  // Regular users need a membership
  const membership = await db.tenantMember.findFirst({
    where: {
      userId: session.user.id,
      OR: [
        { tenantId: tenantIdOrSlug },
        { tenant: { slug: tenantIdOrSlug } }
      ]
    },
    select: {
      tenantId: true,
      role: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true
        }
      }
    },
  })

  if (!membership || !membership.tenant) return null
  return { 
    tenantId: membership.tenantId, 
    userId: session.user.id,
    role: membership.role,
    tenant: membership.tenant
  }
}
