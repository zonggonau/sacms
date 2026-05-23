import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod/v4"

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(), // { "workflow.draft_to_review": true, ... }
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; roleSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, roleSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const role = await db.tenantRole.findUnique({
      where: { tenantId_slug: { tenantId: access.tenantId, slug: roleSlug } }
    })

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    // Fetch permissions for this role
    const permissions = await db.rolePermission.findMany({
      where: { tenantId: access.tenantId, roleId: roleSlug },
      include: { permission: true }
    })

    const permsMap: Record<string, boolean> = {}
    permissions.forEach(p => {
      permsMap[p.permission.name] = p.granted
    })

    return NextResponse.json({ role: { ...role, permissions: permsMap } })
  } catch (error) {
    console.error("Error fetching role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; roleSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, roleSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json({ error: "Only admins and owners can manage roles" }, { status: 403 })
    }

    const body = await request.json()
    const result = updateRoleSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 })
    
    const { name, description, permissions } = result.data

    const existingRole = await db.tenantRole.findUnique({
      where: { tenantId_slug: { tenantId: access.tenantId, slug: roleSlug } }
    })
    
    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const role = await db.$transaction(async (tx) => {
      // Update role basic info
      const updatedRole = await tx.tenantRole.update({
        where: { id: existingRole.id },
        data: {
          name: name !== undefined ? name : existingRole.name,
          description: description !== undefined ? description : existingRole.description,
        }
      })

      // Assign permissions if provided
      if (permissions) {
        // Fetch valid permission IDs
        const dbPerms = await tx.permission.findMany({
          where: { name: { in: Object.keys(permissions) } }
        })
        
        const permMap = new Map(dbPerms.map(p => [p.name, p.id]))

        for (const [permName, granted] of Object.entries(permissions)) {
          const permId = permMap.get(permName)
          if (permId) {
            await tx.rolePermission.upsert({
              where: {
                tenantId_roleId_permissionId: {
                  tenantId: access.tenantId,
                  roleId: roleSlug,
                  permissionId: permId
                }
              },
              update: { granted },
              create: {
                tenantId: access.tenantId,
                roleId: roleSlug,
                permissionId: permId,
                granted
              }
            })
          }
        }
      }

      return updatedRole
    })

    return NextResponse.json({ role })
  } catch (error) {
    console.error("Error updating role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; roleSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, roleSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json({ error: "Only admins and owners can manage roles" }, { status: 403 })
    }

    // Ensure we don't delete standard roles (they don't exist in TenantRole anyway, but just in case)
    if (["admin", "owner", "editor", "viewer"].includes(roleSlug)) {
      return NextResponse.json({ error: "Cannot delete standard roles" }, { status: 400 })
    }

    // Check if any member has this role
    const membersWithRole = await db.tenantMember.count({
      where: { tenantId: access.tenantId, role: roleSlug }
    })

    if (membersWithRole > 0) {
      return NextResponse.json({ error: `Cannot delete role. It is assigned to ${membersWithRole} members.` }, { status: 400 })
    }

    await db.tenantRole.delete({
      where: { tenantId_slug: { tenantId: access.tenantId, slug: roleSlug } }
    })

    // Also delete associated permissions
    await db.rolePermission.deleteMany({
      where: { tenantId: access.tenantId, roleId: roleSlug }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
