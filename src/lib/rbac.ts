import { db } from "./database"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { roleHasPermission, isWorkspaceAdmin } from "./rbac/staff"

/**
 * RBAC helper for staff (TenantMember) permission checks in server actions and
 * API routes. The role → capability map lives in `src/lib/rbac/staff.ts`;
 * this file adds the DB lookups (`hasPermission` / `checkPermission`).
 *
 * `PERMISSIONS` and `ROLE_PERMISSIONS` are re-exported so existing importers of
 * `@/lib/rbac` keep working.
 */
export { PERMISSIONS, ROLE_PERMISSIONS } from "./rbac/staff"

/**
 * Check if a user has a specific permission in a tenant.
 * Super admins and workspace owners/admins bypass all checks.
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permissionName: string,
  resourceOwnerId?: string,
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === "super_admin") return true

  const member = await db.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  })
  if (!member) return false
  if (isWorkspaceAdmin(member.role)) return true

  return roleHasPermission(member.role, permissionName, !!resourceOwnerId && resourceOwnerId === userId)
}

export async function getUserRole(userId: string, tenantId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === "super_admin") return "super_admin"

  const member = await db.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  })
  return member?.role ?? null
}

/** Convenience wrapper for API routes: resolve the session + tenant, then check. */
export async function checkPermission(
  tenantSlug: string,
  permissionName: string,
  resourceOwnerId?: string,
): Promise<{ allowed: boolean; userId?: string; tenantId?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { allowed: false }

  const tenant = await db.tenant.findFirst({
    where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    select: { id: true },
  })
  if (!tenant) return { allowed: false }

  const allowed = await hasPermission(session.user.id, tenant.id, permissionName, resourceOwnerId)
  return { allowed, userId: session.user.id, tenantId: tenant.id }
}
