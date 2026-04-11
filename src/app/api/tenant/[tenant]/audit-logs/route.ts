import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/tenant/[tenant]/audit-logs - Get audit logs for a tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Only admins and owners can view audit logs
    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!isSuperAdmin && (!membership || !["owner", "admin"].includes(membership.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const action = searchParams.get("action")
    const entity = searchParams.get("entity")
    const userId = searchParams.get("userId")

    const where: Record<string, unknown> = { tenantId: tenant.id }
    if (action) where.action = action
    if (entity) where.entity = entity
    if (userId) {
      where.userId = userId
    } else {
      // Exclude Super Admin actions from tenant logs
      const superAdmins = await db.user.findMany({
        where: { role: "super_admin" },
        select: { id: true }
      })
      const superAdminIds = superAdmins.map(u => u.id)
      
      where.userId = { notIn: superAdminIds }
    }

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
