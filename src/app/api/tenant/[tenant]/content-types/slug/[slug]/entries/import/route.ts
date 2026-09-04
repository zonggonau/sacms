import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { createContentEntry, type EntryWriteContext, type ContentActor } from "@/lib/content/entry-service"

const MAX_IMPORT_ENTRIES = 500

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/import
 *
 * Imports entries from the JSON shape produced by the sibling `export`
 * route (`{ entries: [{ data, status, locale }, ...] }`). Every entry is
 * created fresh via createContentEntry — the same write path every other
 * entry mutation in the app goes through — so schema validation, auto-slug,
 * webhooks, versioning, and audit logging all run exactly as they would for
 * a normal create. Rows are never matched/overwritten by id: importing
 * always adds new entries, so re-running an import (or importing into a
 * different tenant) can't silently clobber existing data.
 */
export const POST = withStaffAuth(async (request, context, { access, session }) => {
  const { tenant: tenantSlug, slug: contentTypeSlug } = await context.params

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_CREATE)
  if (!rbac.allowed) return apiError("forbidden", { message: "Missing content.create permission" })

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.entries)) {
    return apiError("validation", { message: "Body must be { entries: [...] } — the shape produced by the export endpoint" })
  }
  if (body.entries.length === 0) {
    return apiError("validation", { message: "No entries to import" })
  }
  if (body.entries.length > MAX_IMPORT_ENTRIES) {
    return apiError("validation", { message: `Cannot import more than ${MAX_IMPORT_ENTRIES} entries at once` })
  }

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

  const ctx: EntryWriteContext = {
    client: tenantDb,
    tenantId: access.tenantId,
    tenantSlug,
    enforcePlan: true,
  }
  const actor: ContentActor = { kind: "staff", userId: session.user.id, role: access.role }

  let imported = 0
  const failures: Array<{ index: number; error: string }> = []

  for (let i = 0; i < body.entries.length; i++) {
    const row = body.entries[i]
    if (!row || typeof row !== "object" || !row.data || typeof row.data !== "object") {
      failures.push({ index: i, error: "Missing or invalid 'data' object" })
      continue
    }

    // Imported content always lands as DRAFT regardless of the source's
    // recorded status — an imported row hasn't been reviewed in this
    // workspace, so it shouldn't silently appear as published.
    const result = await createContentEntry(ctx, actor, {
      contentTypeSlug,
      data: row.data,
      status: "DRAFT",
      locale: typeof row.locale === "string" ? row.locale : undefined,
    })

    if (result.ok) imported++
    else failures.push({ index: i, error: result.message })
  }

  return NextResponse.json({
    success: failures.length === 0,
    imported,
    failed: failures.length,
    failures: failures.slice(0, 50), // cap payload size on large failed batches
  })
})
