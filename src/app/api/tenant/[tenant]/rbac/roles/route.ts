import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod/v4"
import { validateBody } from "@/lib/validate"

const createRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric and hyphens only"),
  displayName: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
})

// POST /api/tenant/[tenant]/rbac/roles - Create custom role
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

    const result = await validateBody(request, createRoleSchema)
    if ("error" in result) return result.error
    const { name, displayName, description } = result.data

    // Check if role name is reserved or already exists
    const reservedNames = ['owner', 'admin', 'editor', 'viewer', 'super_admin']
    if (reservedNames.includes(name.toLowerCase())) {
      return NextResponse.json({ error: "Role name is reserved" }, { status: 400 })
    }

    const existing = await db.role.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: name.toLowerCase()
        }
      }
    })

    if (existing) {
      return NextResponse.json({ error: "Role already exists" }, { status: 400 })
    }

    const role = await db.role.create({
      data: {
        tenantId: tenant.id,
        name: name.toLowerCase(),
        displayName,
        description,
        isSystem: false
      }
    })

    return NextResponse.json({ role })
  } catch (error) {
    console.error("Error creating tenant role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
