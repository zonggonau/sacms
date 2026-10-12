import { Session } from "next-auth"
import { db } from "@/lib/database"
import { isPlatformStaff } from "@/lib/platform-roles"

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
  isGlobal: boolean
}

/**
 * Resolves tenant access for a user.
 * Super admins and developers (platform staff — see lib/platform-roles.ts)
 * can access any tenant without a membership record.
 * Returns null if the user has no access to the tenant.
 */
export async function getTenantAccess(
  session: Session,
  tenantIdOrSlug: string
): Promise<TenantAccess | null> {
  const { getGlobalWorkspaceId } = await import("@/lib/settings")
  const globalId = await getGlobalWorkspaceId()

  // Platform staff (super_admin, developer) can access any tenant
  if (isPlatformStaff(session.user.role)) {
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
      },
      isGlobal: tenant.id === globalId || tenant.slug === globalId
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
    tenant: membership.tenant,
    isGlobal: membership.tenant.id === globalId || membership.tenant.slug === globalId
  }
}
