import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { invalidatePattern } from "@/lib/cache"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/bulk
 * Bulk publish / unpublish / delete of entries.
 */
export const POST = withStaffAuth(async (request, context, { access, session }) => {
  const { tenant: tenantSlug, slug: contentTypeSlug } = await context.params
  const body = await request.json()
  const { ids, action } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return apiError("validation", { message: "No IDs provided" })
  }

  // Content-level RBAC (frozen map — Phase 3 will replace this).
  const permission = action === "delete" ? PERMISSIONS.CONTENT_DELETE : PERMISSIONS.CONTENT_UPDATE
  const rbac = await checkPermission(tenantSlug, permission)
  if (!rbac.allowed) return apiError("forbidden", { message: `Missing ${permission} permission` })

  const tenantDb = await getTenantDb(tenantSlug)
  const contentType = await tenantDb.contentType.findFirst({
    where: {
      slug: contentTypeSlug,
      OR: [
        { tenantId: access.tenantId },
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
      ],
    },
  })
  if (!contentType) return apiError("not_found", { message: "Content type not found" })

  const where = { id: { in: ids }, tenantId: access.tenantId, contentTypeId: contentType.id }
  let result: { count: number }

  switch (action) {
    case "publish":
      result = await tenantDb.contentEntry.updateMany({
        where,
        data: { status: "PUBLISHED", publishedAt: new Date(), updatedBy: session.user.id },
      })
      break
    case "unpublish":
      result = await tenantDb.contentEntry.updateMany({
        where,
        data: { status: "DRAFT", publishedAt: null, updatedBy: session.user.id },
      })
      break
    case "delete":
      result = await tenantDb.contentEntry.deleteMany({ where })
      break
    default:
      return apiError("validation", { message: "Invalid action" })
  }

  invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
  logAudit({
    tenantId: access.tenantId,
    userId: session.user.id,
    action: action === "delete" ? AuditAction.CONTENT_DELETED : AuditAction.CONTENT_UPDATED,
    entity: "content_entry",
    data: { count: result.count, ids, action, bulk: true },
  })

  return NextResponse.json({ success: true, count: result.count })
})
