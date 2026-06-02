import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { invalidatePattern } from "@/lib/cache"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/bulk
 * Perform bulk actions (publish, unpublish, delete) on entries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, slug: contentTypeSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)

    if (!access) {
      return NextResponse.json({ error: "Tenant not found or access denied" }, { status: 404 })
    }

    const body = await request.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 })
    }

    // RBAC Check
    let permission = PERMISSIONS.CONTENT_UPDATE
    if (action === "delete") permission = PERMISSIONS.CONTENT_DELETE
    
    const rbac = await checkPermission(tenantSlug, permission)
    if (!rbac.allowed) return NextResponse.json({ error: `Forbidden: Missing ${permission} permission` }, { status: 403 })

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
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
            tenantId: access.tenantId,
            contentTypeId: contentType.id,
          },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            updatedBy: session.user.id,
          },
        })
        break

      case "unpublish":
        result = await tenantDb.contentEntry.updateMany({
          where: {
            id: { in: ids },
            tenantId: access.tenantId,
            contentTypeId: contentType.id,
          },
          data: {
            status: "DRAFT",
            publishedAt: null,
            updatedBy: session.user.id,
          },
        })
        break

      case "delete":
        // For delete, we might want to check if they are actually allowed to delete these specific items
        // but for now, we assume the bulk RBAC check is enough.
        result = await tenantDb.contentEntry.deleteMany({
          where: {
            id: { in: ids },
            tenantId: access.tenantId,
            contentTypeId: contentType.id,
          },
        })
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Fire async webhooks for each (optional, could be noisy)
    // For now, let's just invalidate cache
    invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})

    // Log Audit
    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: action === "delete" ? AuditAction.CONTENT_DELETED : AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      data: { count: result.count, ids, action, bulk: true },
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
