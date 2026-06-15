"use server"

import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

const roleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
})

export async function getRolesAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const roles = await db.tenantRole.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })

    return { roles }
  } catch (error) {
    console.error("Error fetching roles:", error)
    return { error: "Internal server error" }
  }
}

export async function getRoleDetailsAction(tenantSlug: string, roleSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const role = await db.tenantRole.findUnique({
      where: { tenantId_slug: { tenantId: access.tenantId, slug: roleSlug } }
    })

    if (!role) return { error: "Role not found" }

    const permissions = await db.rolePermission.findMany({
      where: { tenantId: access.tenantId, roleId: roleSlug },
      include: { permission: true }
    })

    const permsMap: Record<string, boolean> = {}
    permissions.forEach(p => {
      permsMap[p.permission.name] = p.granted
    })

    return { role: { ...role, permissions: permsMap } }
  } catch (error) {
    console.error("Error fetching role details:", error)
    return { error: "Internal server error" }
  }
}

export async function saveRoleAction(
  tenantSlug: string,
  editingRole: string | null,
  data: {
    name: string
    slug: string
    description?: string
    permissions?: Record<string, boolean>
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner") {
      return { error: "Only admins and owners can manage roles" }
    }

    const parsed = roleSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.errors[0].message }
    
    const { name, slug, description, permissions } = parsed.data

    if (["admin", "owner", "editor", "viewer"].includes(slug)) {
      return { error: "Cannot use reserved role names" }
    }

    const role = await db.$transaction(async (tx) => {
      let updatedRole

      if (editingRole) {
        // Update
        const existingRole = await tx.tenantRole.findUnique({
          where: { tenantId_slug: { tenantId: access.tenantId, slug: editingRole } }
        })
        if (!existingRole) throw new Error("Role not found")
        
        updatedRole = await tx.tenantRole.update({
          where: { id: existingRole.id },
          data: { name, description }
        })
      } else {
        // Create
        const existingRole = await tx.tenantRole.findUnique({
          where: { tenantId_slug: { tenantId: access.tenantId, slug } }
        })
        if (existingRole) throw new Error("Role with this slug already exists")

        updatedRole = await tx.tenantRole.create({
          data: { tenantId: access.tenantId, name, slug, description }
        })
      }

      const roleSlugToUse = editingRole || slug

      // Assign permissions
      if (permissions) {
        const dbPerms = await tx.permission.findMany({
          where: { name: { in: Object.keys(permissions) } }
        })
        
        const permMap = new Map(dbPerms.map(p => [p.name, p.id]))

        if (editingRole) {
          for (const [permName, granted] of Object.entries(permissions)) {
            const permId = permMap.get(permName)
            if (permId) {
              await tx.rolePermission.upsert({
                where: {
                  tenantId_roleId_permissionId: {
                    tenantId: access.tenantId,
                    roleId: roleSlugToUse,
                    permissionId: permId
                  }
                },
                update: { granted },
                create: {
                  tenantId: access.tenantId,
                  roleId: roleSlugToUse,
                  permissionId: permId,
                  granted
                }
              })
            }
          }
        } else {
          const rolePermsData = []
          for (const [permName, granted] of Object.entries(permissions)) {
            const permId = permMap.get(permName)
            if (permId && granted) {
              rolePermsData.push({
                tenantId: access.tenantId,
                roleId: roleSlugToUse,
                permissionId: permId,
                granted: true
              })
            }
          }
          if (rolePermsData.length > 0) {
            await tx.rolePermission.createMany({ data: rolePermsData })
          }
        }
      }

      return updatedRole
    })

    revalidatePath(`/dashboard/${tenantSlug}/roles`)
    return { success: true, role }
  } catch (error: any) {
    console.error("Error saving role:", error)
    return { error: error.message || "Internal server error" }
  }
}

export async function deleteRoleAction(tenantSlug: string, roleSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner") {
      return { error: "Only admins and owners can manage roles" }
    }

    if (["admin", "owner", "editor", "viewer"].includes(roleSlug)) {
      return { error: "Cannot delete standard roles" }
    }

    const membersWithRole = await db.tenantMember.count({
      where: { tenantId: access.tenantId, role: roleSlug }
    })

    if (membersWithRole > 0) {
      return { error: `Cannot delete role. It is assigned to ${membersWithRole} members.` }
    }

    await db.tenantRole.delete({
      where: { tenantId_slug: { tenantId: access.tenantId, slug: roleSlug } }
    })

    await db.rolePermission.deleteMany({
      where: { tenantId: access.tenantId, roleId: roleSlug }
    })

    revalidatePath(`/dashboard/${tenantSlug}/roles`)
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting role:", error)
    return { error: "Internal server error" }
  }
}
