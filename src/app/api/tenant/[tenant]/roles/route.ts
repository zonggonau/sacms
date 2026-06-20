import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod/v4"

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric and hyphens only"),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(), // { "workflow.draft_to_review": true, ... }
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const roles = await db.tenantRole.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ roles })
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json({ error: "Only admins and owners can manage roles" }, { status: 403 })
    }

    const body = await request.json()
    const result = createRoleSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Validation failed" }, { status: 400 })
    
    const { name, slug, description, permissions } = result.data

    // Check if slug already exists
    const existingRole = await db.tenantRole.findUnique({
      where: { tenantId_slug: { tenantId: access.tenantId, slug } }
    })
    
    if (existingRole) {
      return NextResponse.json({ error: "Role with this slug already exists" }, { status: 400 })
    }

    // Standard roles check
    if (["admin", "owner", "editor", "member", "viewer", "super_admin"].includes(slug)) {
      return NextResponse.json({ error: "Cannot use reserved role names" }, { status: 400 })
    }

    const role = await db.$transaction(async (tx) => {
      // Create role
      const newRole = await tx.tenantRole.create({
        data: {
          tenantId: access.tenantId,
          name,
          slug,
          description,
        }
      })

      // Assign permissions if provided
      if (permissions) {
        // Fetch valid permission IDs
        const dbPerms = await tx.permission.findMany({
          where: { name: { in: Object.keys(permissions) } }
        })
        
        const permMap = new Map(dbPerms.map(p => [p.name, p.id]))

        const rolePermsData = []
        for (const [permName, granted] of Object.entries(permissions)) {
          const permId = permMap.get(permName)
          if (permId && granted) {
            rolePermsData.push({
              tenantId: access.tenantId,
              roleId: slug,
              permissionId: permId,
              granted: true
            })
          }
        }

        if (rolePermsData.length > 0) {
          await tx.rolePermission.createMany({
            data: rolePermsData
          })
        }
      }

      return newRole
    })

    return NextResponse.json({ role })
  } catch (error) {
    console.error("Error creating role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
