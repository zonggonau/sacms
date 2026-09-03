import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { assignRolePermissionSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

// Platform-level roles for /admin/rbac
const PLATFORM_ROLES = [
  {
    id: "super_admin",
    name: "super_admin",
    displayName: "Super Admin",
    description: "Full control over the entire platform, all workspaces, infrastructure, settings, licenses, and accounts.",
    isLocked: true,
  },
  {
    id: "owner",
    name: "owner",
    displayName: "Account Owner",
    description: "Account owner with ability to create, own, and manage their workspaces, subscription billing, and team members.",
    isLocked: false,
  },
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

// GET /api/admin/rbac/roles - platform roles with their nav permissions
export const GET = withAdminAuth(
  async () => {
    // Ensure permissions table has platform permissions
    let allPerms = await db.permission.findMany()
    const hasPlatformPerms = allPerms.some((p) => p.category === "workspaces" || p.category === "system")
    
    if (!hasPlatformPerms) {
      await db.permission.createMany({ data: DEFAULT_PLATFORM_PERMISSIONS, skipDuplicates: true })
      allPerms = await db.permission.findMany()
    }

    // Get role-permission assignments (global only)
    let rolePermissions = await db.rolePermission.findMany({
      where: { tenantId: null },
      include: { permission: true },
    })

    const hasPlatformRolePerms = rolePermissions.some((rp) => rp.roleId === "super_admin" || rp.roleId === "owner")

    if (!hasPlatformRolePerms) {
      const DEFAULT_ROLE_PERMS: Record<string, (name: string) => boolean> = {
        super_admin: () => true,
        owner: (name) =>
          name === "workspaces.create" ||
          name === "workspaces.manage_own" ||
          name === "workspaces.delete" ||
          name === "users.invite_members" ||
          name === "billing.manage_own",
      }

      const seedInserts: Array<{ roleId: string; permissionId: string; granted: boolean; tenantId: string | null }> = []
      for (const role of PLATFORM_ROLES) {
        const checker = DEFAULT_ROLE_PERMS[role.id]
        if (!checker) continue
        for (const p of allPerms) {
          if (checker(p.name)) {
            seedInserts.push({
              roleId: role.id,
              permissionId: p.id,
              granted: true,
              tenantId: null,
            })
          }
        }
      }

      if (seedInserts.length > 0) {
        await db.rolePermission.createMany({ data: seedInserts, skipDuplicates: true })
      }

      rolePermissions = await db.rolePermission.findMany({
        where: { tenantId: null },
        include: { permission: true },
      })
    }

    // Map permissions to platform roles
    const rolesWithPermissions = PLATFORM_ROLES.map((role) => {
      const perms = rolePermissions
        .filter((rp) => rp.roleId === role.id && rp.granted)
        .map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          displayName: rp.permission.displayName,
          category: rp.permission.category,
        }))

      return {
        ...role,
        permissions: perms,
        permissionCount: perms.length,
      }
    })

    return NextResponse.json({ roles: rolesWithPermissions })
  },
  { allowRoles: ["admin"] },
)

// POST /api/admin/rbac/roles - assign a nav permission to a platform role
const KNOWN_PLATFORM_ROLE_IDS = new Set(PLATFORM_ROLES.map((r) => r.id))

export const POST = withAdminAuth(
  async (request) => {
    const result = await validateBody(request, assignRolePermissionSchema)
    if ("error" in result) return result.error
    const { roleId, permissionId, granted } = result.data

    // roleId / permissionId must be things we actually know about — no
    // arbitrary grant rows, no FK-breaking writes.
    if (!KNOWN_PLATFORM_ROLE_IDS.has(roleId)) {
      return apiError("validation", { message: `Unknown platform role: ${roleId}` })
    }
    const permission = await db.permission.findUnique({ where: { id: permissionId }, select: { id: true } })
    if (!permission) {
      return apiError("validation", { message: "Unknown permission" })
    }

    if (roleId === "super_admin" && !granted) {
      return apiError("validation", { message: "Super Admin permissions are locked and cannot be revoked." })
    }

    // Upsert role-permission assignment (global only)
    const existing = await db.rolePermission.findFirst({
      where: { tenantId: null, roleId, permissionId },
    })

    let rp
    if (existing) {
      rp = await db.rolePermission.update({
        where: { id: existing.id },
        data: { granted: granted !== false },
      })
    } else {
      rp = await db.rolePermission.create({
        data: {
          roleId,
          permissionId,
          granted: granted !== false,
        },
      })
    }

    return NextResponse.json({ rolePermission: rp })
  },
  { allowRoles: ["admin"] },
)
