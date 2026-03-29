import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)

    if (!access || !access.tenant) {
      return NextResponse.json({ error: "Tenant not found or access denied" }, { status: 404 })
    }

    const { tenant } = access
    const user = session.user
    const tenantDb = await getTenantDb(tenantSlug)

    const body = await request.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 })
    }

    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentSlug,
        OR: [
          { tenantId: tenant.id },
          { tenantId: null }
        ]
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    let result
    const now = new Date()

    switch (action) {
      case "publish":
        result = await tenantDb.contentEntry.updateMany({
          where: {
            id: { in: ids },
            tenantId: tenant.id,
            contentTypeId: contentType.id,
          },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            updatedAt: now,
          },
        })
        break

      case "unpublish":
        result = await tenantDb.contentEntry.updateMany({
          where: {
            id: { in: ids },
            tenantId: tenant.id,
            contentTypeId: contentType.id,
          },
          data: {
            status: "DRAFT",
            publishedAt: null,
            updatedAt: now,
          },
        })
        break

      case "delete":
        result = await tenantDb.contentEntry.deleteMany({
          where: {
            id: { in: ids },
            tenantId: tenant.id,
            contentTypeId: contentType.id,
          },
        })
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Log Audit
    logAudit({
      tenantId: tenant.id,
      userId: user?.id,
      action: `content.bulk_${action}`,
      entity: "ContentEntry",
      data: { count: ids.length, ids },
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error("Bulk action error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
