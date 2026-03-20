import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const { tenant: tenantSlug, contentSlug } = await params
    const { tenant, user, isSuperAdmin } = await getTenantAccess(tenantSlug)

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const body = await request.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 })
    }

    const contentType = await db.contentType.findUnique({
      where: { slug: contentSlug },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    let result
    const now = new Date()

    switch (action) {
      case "publish":
        result = await db.contentEntry.updateMany({
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
        result = await db.contentEntry.updateMany({
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
        result = await db.contentEntry.deleteMany({
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
    await logAudit({
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
