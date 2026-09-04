import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/export
 *
 * Exports every entry of a content type as a single JSON document. Distinct
 * from ai-builder/export-schema, which exports the schema (field
 * definitions) — this exports the actual data rows, so tenants can back up,
 * migrate, or bulk-seed a workspace's real content, not just its structure.
 *
 * JSON only (not CSV) — several field types (relation, component, repeater,
 * media, json) hold structured values that would lose fidelity or require
 * lossy flattening in a flat CSV, and the import side needs the exact same
 * shape back to round-trip safely.
 */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, slug: contentTypeSlug } = await context.params

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
  if (!rbac.allowed) return apiError("forbidden", { message: "Missing content.read permission" })

  const tenantDb = await getTenantDb(tenantSlug)
  const contentType = await tenantDb.contentType.findFirst({
    where: {
      slug: contentTypeSlug,
      OR: [
        { tenantId: access.tenantId },
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
      ],
    },
    include: { schemaFields: { orderBy: { order: "asc" } } },
  })
  if (!contentType) return apiError("not_found", { message: "Content type not found" })

  const entries = await tenantDb.contentEntry.findMany({
    where: { contentTypeId: contentType.id, tenantId: access.tenantId },
    orderBy: { createdAt: "asc" },
  })

  const exportedEntries = entries.map((e) => ({
    // documentId/id are export-only metadata for traceability — import
    // always creates fresh rows rather than trying to overwrite by id, so a
    // re-import never collides with the source tenant's own data.
    sourceId: e.id,
    documentId: e.documentId,
    locale: e.locale,
    status: e.status,
    data: typeof e.data === "string" ? JSON.parse(e.data) : e.data,
    publishedAt: e.publishedAt,
    createdAt: e.createdAt,
  }))

  return NextResponse.json({
    contentType: {
      slug: contentType.slug,
      name: contentType.name,
      fields: contentType.schemaFields.map((f) => ({ slug: f.slug, name: f.name, type: f.type })),
    },
    exportedAt: new Date().toISOString(),
    count: exportedEntries.length,
    entries: exportedEntries,
  })
})
