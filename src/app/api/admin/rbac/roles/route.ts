import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { assignRolePermissionSchema } from "@/lib/validations"

// System roles - these are not stored in DB, they're part of TenantMember.role
const SYSTEM_ROLES = [
  {
    id: "owner",
    name: "owner",
    displayName: "Owner",
    description: "Full control over the tenant. Can manage all settings, users, and content.",
  },
  {
    id: "admin",
    name: "admin",
    displayName: "Admin",
    description: "Administrative access. Can manage content, users, and most settings.",
  },
  {
    id: "editor",
    name: "editor",
    displayName: "Editor",
    description: "Can create, edit, and publish content. Can manage media library.",
  },
  {
    id: "viewer",
    name: "viewer",
    displayName: "Viewer",
    description: "Read-only access to content and media.",
  },
]

// GET /api/admin/rbac/roles - List all roles with their permissions
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get role-permission assignments (global only)
    const rolePermissions = await db.rolePermission.findMany({
      where: { tenantId: null },
      include: { permission: true },
    })

    // Map permissions to roles
    const rolesWithPermissions = SYSTEM_ROLES.map((role) => {
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
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/rbac/roles - Assign permission to role
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, assignRolePermissionSchema)
    if ("error" in result) return result.error
    const { roleId, permissionId, granted } = result.data

    // Upsert role-permission assignment (global only)
    const existing = await db.rolePermission.findFirst({
      where: { tenantId: null, roleId, permissionId },
    })

    let rp;
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
  } catch (error) {
    console.error("Error assigning permission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
