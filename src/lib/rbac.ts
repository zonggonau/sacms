import { db } from "./database.ts"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth.ts"

/**
 * RBAC Helper
 * Centralizes permission checking for tenants.
 * This maps to the Permission and RolePermission models in Prisma.
 */

/**
 * Standard Permissions in ContentFlow
 */
export const PERMISSIONS = {
  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",
  MEDIA_READ: "media.read",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  USER_INVITE: "user.invite",
  USER_REMOVE: "user.remove",
  SETTING_UPDATE: "settings.update",
  API_TOKEN_MANAGE: "api-token.manage",
} as const

/**
 * Check if a user has a specific permission in a tenant.
 * Super Admins bypass all checks.
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permissionName: string
): Promise<boolean> {
  // 1. Get user role in the tenant
  const member = await db.tenantMember.findUnique({
    where: {
      tenantId_userId: { tenantId, userId },
    },
    include: {
      user: {
        select: { role: true }
      }
    }
  })

  if (!member) return false

  // 2. Super admin bypass
  if (member.user.role === "super_admin") return true
  
  // 3. Owners bypass most checks
  if (member.role === "owner") return true

  // 4. Check granular permission
  const permission = await db.permission.findUnique({
    where: { name: permissionName }
  })

  if (!permission) return false

  // Check global default only (all tenants follow global)
  const granted = await db.rolePermission.findFirst({
    where: {
      tenantId: null,
      roleId: member.role,
      permissionId: permission.id
    }
  })

  return granted?.granted ?? false
}

/**
 * Convenience wrapper for API routes.
 */
export async function checkPermission(
  tenantSlug: string,
  permissionName: string
): Promise<{ allowed: boolean; userId?: string; tenantId?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { allowed: false }

  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug }
  })

  if (!tenant) return { allowed: false }

  const allowed = await hasPermission(session.user.id, tenant.id, permissionName)
  
  return { 
    allowed, 
    userId: session.user.id, 
    tenantId: tenant.id 
  }
}
