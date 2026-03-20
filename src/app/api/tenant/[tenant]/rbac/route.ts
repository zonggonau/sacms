import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { assignRolePermissionSchema } from "@/lib/validations"

// GET /api/tenant/[tenant]/rbac - List all roles with tenant-specific permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check if user is owner or admin of this tenant
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all roles for this tenant + global system roles
    const allRoles = await db.role.findMany({
      where: {
        OR: [
          { tenantId: tenant.id },
          { tenantId: null }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })

    // Deduplicate by name - prioritize tenant roles over global
    const roleMap = new Map<string, any>()
    allRoles.forEach(role => {
      // If we already have a tenant-specific role, don't overwrite it with global
      if (roleMap.has(role.name) && !role.tenantId) return
      roleMap.set(role.name, role)
    })
    const roles = Array.from(roleMap.values())

    // Get all permissions definitions
    const allPermissions = await db.permission.findMany()

    // Get all role-permission assignments (global + tenant specific)
    const rolePermissions = await db.rolePermission.findMany({
      where: {
        OR: [
          { tenantId: tenant.id },
          { tenantId: null }
        ]
      },
      include: { permission: true },
    })

    // Map permissions to roles
    const rolesWithPermissions = roles.map((role) => {
      // For each permission, check if there's a tenant override for this role, otherwise use global for this role
      const perms = allPermissions.map((perm) => {
        // Find if this role has an assignment in THIS tenant
        const tenantAssignment = rolePermissions.find(
          (rp) => rp.tenantId === tenant.id && rp.roleId === role.name && rp.permissionId === perm.id
        )
        
        // Find if this role has a global assignment
        const globalAssignment = rolePermissions.find(
          (rp) => rp.tenantId === null && rp.roleId === role.name && rp.permissionId === perm.id
        )

        // If it's a system role in this tenant, we prioritize tenantAssignment, then global
        // If it's a custom role (only in this tenant), only tenantAssignment matters
        const granted = tenantAssignment ? tenantAssignment.granted : (globalAssignment ? globalAssignment.granted : false)
        const isOverride = !!tenantAssignment

        return {
          id: perm.id,
          name: perm.name,
          displayName: perm.displayName,
          category: perm.category,
          granted,
          isOverride,
        }
      })

      return {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isSystem: role.isSystem,
        permissions: perms,
        permissionCount: perms.filter(p => p.granted).length,
      }
    })

    return NextResponse.json({ 
      roles: rolesWithPermissions,
      allPermissions
    })
  } catch (error) {
    console.error("Error fetching tenant RBAC:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/rbac - Assign tenant-specific permission to role
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check if user is owner or admin of this tenant
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, assignRolePermissionSchema)
    if ("error" in result) return result.error
    const { roleId, permissionId, granted } = result.data

    // Owners cannot have their permissions modified
    if (roleId === "owner") {
      return NextResponse.json({ error: "Cannot modify Owner role permissions" }, { status: 400 })
    }

    // Upsert tenant-specific role-permission assignment
    const rp = await db.rolePermission.upsert({
      where: {
        tenantId_roleId_permissionId: { 
          tenantId: tenant.id, 
          roleId, 
          permissionId 
        },
      },
      update: { granted: granted !== false },
      create: {
        tenantId: tenant.id,
        roleId,
        permissionId,
        granted: granted !== false,
      },
    })

    return NextResponse.json({ rolePermission: rp })
  } catch (error) {
    console.error("Error assigning tenant permission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
