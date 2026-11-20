import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { assignRolePermissionSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { AuditAction, logAudit } from "@/lib/audit-log"

const PLATFORM_ROLES = [
  { id: "super_admin", displayName: "Super Admin", isLocked: true, access: "Seluruh panel Admin dan workspace." },
  { id: "developer", displayName: "Developer Platform", access: "Akses operasional ke seluruh workspace." },
  { id: "employee", displayName: "Staf Internal", access: "Support, Penawaran, serta katalog Pricing dalam mode baca." },
  { id: "finance", displayName: "Bendahara", access: "Billing, penerbitan invoice, serta perubahan katalog Pricing." },
  { id: "owner", displayName: "Account Owner", access: "Workspace milik atau tempat bergabung, sesuai peran di masing-masing workspace." },
  { id: "user", displayName: "Pengguna", access: "Akun sendiri dan workspace tempat bergabung, sesuai peran di masing-masing workspace." },
]

const DEFAULT_PLATFORM_PERMISSIONS = [
  // Workspaces & Tenants
  { name: "workspaces.create", displayName: "Create Workspaces", description: "Ability to create new workspace instances", category: "workspaces" },
  { name: "workspaces.manage_own", displayName: "Manage Own Workspaces", description: "Configure settings for owned workspaces", category: "workspaces" },
  { name: "workspaces.manage_all", displayName: "Manage All Workspaces", description: "Super Admin full control over all platform workspaces", category: "workspaces" },
  { name: "workspaces.delete", displayName: "Delete Workspaces", description: "Ability to delete workspaces", category: "workspaces" },
  // Platform Accounts & Users
  { name: "users.manage_platform", displayName: "Manage Platform Accounts", description: "Manage platform users, roles, and plan overrides", category: "users" },
  { name: "users.view_platform", displayName: "View Platform Directory", description: "Browse platform account owners and admins", category: "users" },
  { name: "users.invite_members", displayName: "Invite Workspace Members", description: "Invite team members into owned workspaces", category: "users" },
  // Billing & Subscriptions
  { name: "billing.manage_own", displayName: "Manage Own Subscriptions", description: "Subscribe to plans, manage payment methods, view invoices", category: "billing" },
  { name: "billing.manage_all", displayName: "Manage Platform Billing", description: "Super Admin control over pricing plans and global billing", category: "billing" },
  // Platform System & Infrastructure
  { name: "settings.manage_platform", displayName: "Manage Platform Settings", description: "Configure global system settings and defaults", category: "system" },
  { name: "infrastructure.manage", displayName: "Manage Infrastructure", description: "Configure multi-tenant databases and storage buckets", category: "system" },
  { name: "audit_logs.view_all", displayName: "View Platform Audit Logs", description: "Super Admin access to platform-wide audit trail", category: "system" },
  // Security & Licenses
  { name: "licenses.manage", displayName: "Manage Enterprise Licenses", description: "Generate, inspect, and revoke Enterprise RSA licenses", category: "security" },
  { name: "rbac.manage", displayName: "Manage Platform RBAC", description: "Configure platform role permissions", category: "security" },
]

const DEFAULT_OWNER_GRANTS = new Set([
  "workspaces.create",
  "workspaces.manage_own",
  "workspaces.delete",
  "users.invite_members",
  "billing.manage_own",
])
const KNOWN_PLATFORM_ROLE_IDS = new Set(PLATFORM_ROLES.map((role) => role.id))
const assignmentSchema = z.union([
  assignRolePermissionSchema,
  z.object({
    roleId: z.string().min(1),
    permissionIds: z.array(z.string().min(1)).min(1).max(1000),
    granted: z.boolean(),
  }),
])

export const GET = withAdminAuth(async () => {
  const orderBy = [{ category: "asc" as const }, { name: "asc" as const }]
  let permissions = await db.permission.findMany({ orderBy })
  if (!permissions.some((permission) => permission.category === "workspaces" || permission.category === "system")) {
    await db.permission.createMany({ data: DEFAULT_PLATFORM_PERMISSIONS, skipDuplicates: true })
    permissions = await db.permission.findMany({ orderBy })
  }

  const assignments = await db.rolePermission.findMany({
    where: { tenantId: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
  const configured = new Map(assignments.map((entry) => [JSON.stringify([entry.roleId, entry.permissionId]), entry.granted]))

  const roles = PLATFORM_ROLES.map((role) => {
    const rolePermissions = permissions.filter((permission) =>
      role.isLocked || (configured.get(JSON.stringify([role.id, permission.id])) ??
        (role.id === "owner" && DEFAULT_OWNER_GRANTS.has(permission.name))),
    ).map(({ id, name, displayName, category }) => ({ id, name, displayName, category }))
    return {
      ...role,
      name: role.id,
      description: role.access,
      permissions: rolePermissions,
      permissionCount: rolePermissions.length,
    }
  })
  return NextResponse.json({ roles, permissions })
})

export const POST = withAdminAuth(async (request, _context, { session }) => {
  const result = await validateBody(request, assignmentSchema)
  if ("error" in result) return result.error
  const { roleId, granted } = result.data
  if (!KNOWN_PLATFORM_ROLE_IDS.has(roleId)) return apiError("validation", { message: "Peran platform tidak dikenal" })
  if (roleId === "super_admin") return apiError("validation", { message: "Peran Super Admin terkunci" })
  const permissionIds = "permissionIds" in result.data
    ? Array.from(new Set(result.data.permissionIds))
    : [result.data.permissionId]

  const assignments = await db.$transaction(async (tx) => {
    // PostgreSQL UNIQUE does not deduplicate records whose tenantId is NULL.
    // Serialize writes to the same global role and update older duplicates.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"platform-rbac:" + roleId}))`
    const permissions = await tx.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true } })
    if (permissions.length !== permissionIds.length) return null

    for (const permissionId of permissionIds) {
      const where = { tenantId: null, roleId, permissionId }
      const existing = await tx.rolePermission.updateMany({ where, data: { granted } })
      if (!existing.count) await tx.rolePermission.create({ data: { ...where, granted } })
    }
    return tx.rolePermission.findMany({ where: { tenantId: null, roleId, permissionId: { in: permissionIds } } })
  })
  if (!assignments) return apiError("validation", { message: "Izin tidak dikenal" })

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "RolePermission",
    entityId: roleId,
    data: { permissionIds, granted },
  })
  return NextResponse.json({ updated: permissionIds.length, rolePermission: assignments[0] })
})
