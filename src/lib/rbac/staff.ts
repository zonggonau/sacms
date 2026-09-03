/**
 * Staff RBAC — the single source of truth for what a CMS operator (a
 * `TenantMember`) may do inside a workspace.
 *
 * There are two other permission systems in the codebase, deliberately separate:
 *   - `src/lib/permissions-engine.ts` — `MemberRole` / `MemberRolePermission`:
 *     governs tenant END-USERS hitting the public API (Strapi parity).
 *   - `Permission` / `RolePermission` tables + `/api/admin/rbac/*`: a
 *     platform-admin navigation-permission matrix for the `/admin` portal.
 *
 * This module is only about staff. The role set is fixed (there is no
 * per-tenant custom staff role — that experiment lived in the now-deleted
 * `TenantRole` table). Fine-grained per-member overrides for the content
 * workflow are carried on `TenantMember.customPermissions` (an array of
 * `workflow.*` strings) and consumed by `content-workflow-rules.ts`.
 */

/** Canonical workspace staff roles, low → high authority. */
export const STAFF_ROLES = [
  "viewer",
  "subscriber",
  "contributor",
  "author",
  "editor",
  "admin",
  "owner",
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

const RANK: Record<string, number> = Object.fromEntries(STAFF_ROLES.map((r, i) => [r, i]))

/**
 * Whether `role` meets (is at or above) the `min` staff role.
 * Unknown roles never meet a bar.
 */
export function roleMeets(role: string, min: StaffRole): boolean {
  const have = RANK[role]
  return have !== undefined && have >= RANK[min]
}

/** `owner` and `admin` are unrestricted within their workspace. */
export function isWorkspaceAdmin(role: string): boolean {
  return role === "owner" || role === "admin"
}

// ── Capability map ───────────────────────────────────────────────────────

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

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL = Object.values(PERMISSIONS)

const EDITOR: Permission[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.CONTENT_DELETE,
  PERMISSIONS.CONTENT_PUBLISH,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_DELETE,
  PERMISSIONS.CONTENT_TYPE_READ,
]

const AUTHOR: Permission[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE_OWN,
  PERMISSIONS.CONTENT_DELETE_OWN,
  PERMISSIONS.CONTENT_PUBLISH,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.CONTENT_TYPE_READ,
]

const CONTRIBUTOR: Permission[] = [
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE_OWN,
  PERMISSIONS.CONTENT_DELETE_OWN,
  PERMISSIONS.CONTENT_TYPE_READ,
]

const READ_ONLY: Permission[] = [PERMISSIONS.CONTENT_READ, PERMISSIONS.MEDIA_READ, PERMISSIONS.CONTENT_TYPE_READ]

/** role → the permissions it is granted. owner/admin bypass this map entirely. */
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  owner: [...ALL],
  admin: [...ALL],
  editor: EDITOR,
  author: AUTHOR,
  contributor: CONTRIBUTOR,
  subscriber: READ_ONLY,
  viewer: READ_ONLY,
}

/**
 * Pure permission check against the role map. Ownership-scoped permissions
 * (`*.own`) are honoured when `isOwner` is true.
 */
export function roleHasPermission(role: string, permission: string, isOwner = false): boolean {
  if (isWorkspaceAdmin(role)) return true
  const granted = ROLE_PERMISSIONS[role as StaffRole] ?? []
  if (granted.includes(permission as Permission)) return true

  if (isOwner) {
    if (permission === PERMISSIONS.CONTENT_UPDATE && granted.includes(PERMISSIONS.CONTENT_UPDATE_OWN)) return true
    if (permission === PERMISSIONS.CONTENT_DELETE && granted.includes(PERMISSIONS.CONTENT_DELETE_OWN)) return true
  }
  return false
}
