import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createPermissionSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

// GET /api/admin/rbac/permissions - platform-admin navigation permissions
export const GET = withAdminAuth(
  async () => {
    const permissions = await db.permission.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })

    // If no permissions exist yet, seed the defaults
    if (permissions.length === 0) {
      const defaults = [
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

      await db.permission.createMany({ data: defaults, skipDuplicates: true })
      const seeded = await db.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
      return NextResponse.json({ permissions: seeded })
    }

    return NextResponse.json({ permissions })
  },
  { allowRoles: ["admin"] },
)

// POST /api/admin/rbac/permissions - create a permission
export const POST = withAdminAuth(
  async (request) => {
    const result = await validateBody(request, createPermissionSchema)
    if ("error" in result) return result.error
    const { name, displayName, description, category } = result.data

    const existing = await db.permission.findUnique({ where: { name } })
    if (existing) return apiError("conflict", { message: "Permission with this name already exists" })

    const permission = await db.permission.create({
      data: { name, displayName: displayName || name, description: description || null, category: category || "general" },
    })
    return NextResponse.json({ permission })
  },
  { allowRoles: ["admin"] },
)
