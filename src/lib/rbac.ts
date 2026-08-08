import { db } from "./database"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"

/**
 * RBAC Helper
 * Centralizes permission checking using static WordPress-style roles.
 */

export const PERMISSIONS = {
  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_UPDATE_OWN: "content.update.own",
  CONTENT_DELETE: "content.delete",
  CONTENT_DELETE_OWN: "content.delete.own",
  CONTENT_PUBLISH: "content.publish",
  MEDIA_READ: "media.read",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  USER_INVITE: "user.invite",
  USER_REMOVE: "user.remove",
  USER_UPDATE: "user.update",
  SETTING_UPDATE: "settings.update",
  API_TOKEN_MANAGE: "api-token.manage",
  CONTENT_TYPE_READ: "content-type.read",
  CONTENT_TYPE_CREATE: "content-type.create",
  CONTENT_TYPE_UPDATE: "content-type.update",
  CONTENT_TYPE_DELETE: "content-type.delete",
} as const

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(PERMISSIONS),
  editor: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_DELETE,
  ],
  author: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE_OWN,
    PERMISSIONS.CONTENT_DELETE_OWN,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.MEDIA_READ,
    PERMISSIONS.MEDIA_UPLOAD,
  ],
  contributor: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE_OWN,
    PERMISSIONS.CONTENT_DELETE_OWN,
  ],
  subscriber: [
    PERMISSIONS.CONTENT_READ,
  ]
}

/**
 * Check if a user has a specific permission in a tenant.
 * Super Admins and Tenant Admins bypass all checks.
 */
export async function hasPermission(
  userId: string,
  tenantId: string,
  permissionName: string,
  resourceOwnerId?: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  
  // Super Admin has global full access
  if (user?.role === "super_admin") return true

  const member = await db.tenantMember.findUnique({
    where: {
      tenantId_userId: { tenantId, userId },
    }
  })

  if (!member) return false

  const role = member.role
  
  // Workspace Admins (Owners) have full access within the workspace
  if (role === "admin" || role === "owner") return true

  const grantedPermissions = ROLE_PERMISSIONS[role] || []

  // Check direct permission
  if (grantedPermissions.includes(permissionName)) {
    return true
  }

  // Handle ownership overrides for author/contributor
  if (resourceOwnerId && resourceOwnerId === userId) {
    if (permissionName === PERMISSIONS.CONTENT_UPDATE && grantedPermissions.includes(PERMISSIONS.CONTENT_UPDATE_OWN)) return true
    if (permissionName === PERMISSIONS.CONTENT_DELETE && grantedPermissions.includes(PERMISSIONS.CONTENT_DELETE_OWN)) return true
  }

  return false
}

export async function getUserRole(
  userId: string,
  tenantId: string
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  
  if (user?.role === "super_admin") return "super_admin"

  const member = await db.tenantMember.findUnique({
    where: {
      tenantId_userId: { tenantId, userId },
    }
  })

  return member?.role || null
}

/**
 * Convenience wrapper for API routes.
 */
export async function checkPermission(
  tenantSlug: string,
  permissionName: string,
  resourceOwnerId?: string
): Promise<{ allowed: boolean; userId?: string; tenantId?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { allowed: false }

  const tenant = await db.tenant.findFirst({
    where: {
      OR: [
        { slug: tenantSlug },
        { id: tenantSlug }
      ]
    }
  })

  if (!tenant) return { allowed: false }

  const allowed = await hasPermission(session.user.id, tenant.id, permissionName, resourceOwnerId)
  
  return { 
    allowed, 
    userId: session.user.id, 
    tenantId: tenant.id 
  }
}
