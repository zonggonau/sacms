"use server"

import { db, getTenantDb } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { checkPermission, hasPermission, PERMISSIONS } from "@/lib/rbac"
import { validateContentEntry } from "@/lib/content-validations"
import { processAutoSlugs } from "@/lib/slug"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { canUserTransition, assignReviewers, submitReview } from "@/lib/content-workflow"
import { ContentStatus } from "@prisma/client"
import { isWorkflowStatus, type WorkflowStatus } from "@/lib/content-workflow-rules"
import { parseSchemaFieldOptions, validateScheduledPublicationDate } from "./content-pipeline"
import {
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
  transitionContentEntryStatus,
  contentRevalidatePaths,
  type ContentActor,
  type EntryWriteContext,
} from "@/lib/content/entry-service"

/**
 * Build the service context + actor for a dashboard request.
 * `tenantSlug === "admin"` means super-admin global content (tenantId: null, `db`).
 */
async function resolveWriteContext(
  tenantSlug: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; ctx: EntryWriteContext; actor: ContentActor }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: "Unauthorized" }

  if (tenantSlug === "admin") {
    if (session.user.role !== "super_admin") return { ok: false, error: "Forbidden: Not Super Admin" }
    return {
      ok: true,
      ctx: { client: db, tenantId: null, tenantSlug: "admin", isGlobal: true },
      actor: { kind: "system", userId: session.user.id },
    }
  }

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) return { ok: false, error: "Forbidden" }

  const member = await db.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: access.tenantId, userId: session.user.id } },
    select: { role: true, customPermissions: true },
  })

  const tenantDb = await getTenantDb(tenantSlug)
  return {
    ok: true,
    ctx: {
      client: tenantDb,
      tenantId: access.tenantId,
      tenantSlug,
      isGlobal: access.isGlobal,
      enforcePlan: true,
    },
    actor: {
      kind: "staff",
      userId: session.user.id,
      role: member?.role ?? access.role,
      // Per-member workflow-transition overrides (workflow.* permission strings).
      customPermissions: Array.isArray(member?.customPermissions)
        ? (member.customPermissions as string[])
        : null,
    },
  }
}

const SERVICE_ERROR_LABEL: Record<string, string> = {
  not_found: "Content type or entry not found",
}

interface EntryActionResult {
  success?: boolean
  entry?: any
  error?: string
  details?: Record<string, string>
}

const actionError = (error: string, details?: Record<string, string>): EntryActionResult => ({ error, details })
const actionOk = (entry: any): EntryActionResult => ({ success: true, entry })

/**
 * Whether a staff caller holds at least one of the given permissions — used
 * at the action layer as a coarse "is this role capable of this kind of
 * write at all" gate. The real per-entry decision (can THIS actor touch
 * THIS entry) is made by entry-service.ts's ownership checks afterwards;
 * this just has to not reject "author"/"contributor" outright, since they
 * only ever hold the *_OWN variant of a permission, never the plain one.
 */
async function hasAnyPermission(tenantSlug: string, permissions: string[]): Promise<boolean> {
  for (const permission of permissions) {
    const rbac = await checkPermission(tenantSlug, permission)
    if (rbac.allowed) return true
  }
  return false
}

function serviceFailure(result: { code: string; message: string; details?: Record<string, string> }): EntryActionResult {
  return actionError(result.message || SERVICE_ERROR_LABEL[result.code] || "Request failed", result.details)
}

async function getWorkflowContext(
  tenantId: string,
  userId: string,
  fallbackRole: string
): Promise<{ role: string; customPermissions: string[] | null }> {
  const member = await db.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  })

  if (!member) {
    return { role: fallbackRole, customPermissions: null }
  }

  return { role: member.role, customPermissions: null }
}


/**
 * Get all entries for a content type with pagination and filtering
 */
// Whitelisted sortable columns only — these are real Prisma scalar columns,
// never a dynamic JSON field path, so there's no risk of sorting by
// unindexed/unbounded user-controlled data or (in the raw-SQL search
// branch below) interpolating an unsafe column identifier.
const SORTABLE_COLUMNS = new Set(["createdAt", "updatedAt", "status"])

// Same reasoning as SORTABLE_COLUMNS above — only ever interpolated into the
// raw-SQL branch after being checked against this whitelist.
const DATE_FILTER_COLUMNS = new Set(["createdAt", "publishedAt"])

export async function getEntriesAction(
  tenantSlug: string,
  contentTypeSlug: string,
  params: {
    page?: number
    pageSize?: number
    status?: string
    locale?: string
    search?: string
    sortBy?: string
    sortOrder?: "asc" | "desc"
    authorId?: string
    dateField?: string
    dateFrom?: string
    dateTo?: string
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.read permission" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentTypeRecord = await tenantDb.contentType.findFirst({
      where: {
        slug: contentTypeSlug,
        draftTemplateId: null,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: { schemaFields: { orderBy: { order: 'asc' } } },
    })

    if (!contentTypeRecord) {
      console.log(`[getEntriesAction] Content type not found! tenantSlug: ${tenantSlug}, access.tenantId: ${access.tenantId}, contentTypeSlug: ${contentTypeSlug}`)
      return { error: "Content type not found" }
    }

    const contentType = {
      ...contentTypeRecord,
      fields: parseSchemaFieldOptions(contentTypeRecord.schemaFields),
    }

    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25))
    const { status, locale, search, authorId } = params
    const sortBy = params.sortBy && SORTABLE_COLUMNS.has(params.sortBy) ? params.sortBy : "createdAt"
    const sortOrder: "asc" | "desc" = params.sortOrder === "asc" ? "asc" : "desc"
    const dateField = params.dateField && DATE_FILTER_COLUMNS.has(params.dateField) ? params.dateField : "createdAt"
    const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null
    const dateTo = params.dateTo ? new Date(params.dateTo) : null

    const where: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: access.tenantId,
    }
    if (status) where.status = status
    if (locale) where.locale = locale
    if (authorId) where.createdBy = authorId
    if (dateFrom || dateTo) {
      where[dateField] = {
        ...(dateFrom && !isNaN(dateFrom.getTime()) ? { gte: dateFrom } : {}),
        ...(dateTo && !isNaN(dateTo.getTime()) ? { lte: dateTo } : {}),
      }
    }

    let entries: any[]
    let total: number

    if (search) {
      const whereParts: string[] = [`"contentTypeId" = $1`, `"tenantId" = $2`]
      const queryParams: unknown[] = [contentType.id, access.tenantId]
      let paramIdx = 3

      if (status) {
        whereParts.push(`"status" = $${paramIdx}`)
        queryParams.push(status)
        paramIdx++
      }

      if (locale) {
        whereParts.push(`"locale" = $${paramIdx}`)
        queryParams.push(locale)
        paramIdx++
      }

      if (authorId) {
        whereParts.push(`"createdBy" = $${paramIdx}`)
        queryParams.push(authorId)
        paramIdx++
      }

      if (dateFrom && !isNaN(dateFrom.getTime())) {
        whereParts.push(`"${dateField}" >= $${paramIdx}`)
        queryParams.push(dateFrom)
        paramIdx++
      }

      if (dateTo && !isNaN(dateTo.getTime())) {
        whereParts.push(`"${dateField}" <= $${paramIdx}`)
        queryParams.push(dateTo)
        paramIdx++
      }

      const safeSearch = search.replace(/[&|!():*<>'"\\]/g, " ").trim().slice(0, 200)
      if (safeSearch) {
        whereParts.push(`("searchVector" @@ plainto_tsquery('simple', $${paramIdx}) OR "data"::text ILIKE $${paramIdx + 1})`)
        queryParams.push(safeSearch, `%${safeSearch}%`)
        paramIdx += 2
      }

      const whereClause = whereParts.join(" AND ")

      const countResult = await tenantDb.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "content_entries" WHERE ${whereClause}`,
        ...queryParams
      )
      total = Number(countResult[0].count)

      // sortBy is whitelist-checked against SORTABLE_COLUMNS above and
      // sortOrder is hard-narrowed to the "asc"/"desc" literal union — never
      // raw user input — so interpolating them directly as an identifier/
      // direction here (Postgres can't bind those as query parameters) is
      // safe, unlike the values above which all go through $N placeholders.
      entries = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "content_entries" WHERE ${whereClause} ORDER BY "${sortBy}" ${sortOrder.toUpperCase()} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...queryParams,
        pageSize,
        (page - 1) * pageSize
      )
    } else {
      const [rawEntries, count] = await Promise.all([
        tenantDb.contentEntry.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tenantDb.contentEntry.count({ where }),
      ])
      entries = rawEntries
      total = count
    }

    // Batch fetch human-readable relation labels
    const { batchFetchRelationLabels } = await import("@/lib/relation-labels")
    const relationLabels = await batchFetchRelationLabels(
      tenantDb,
      access.tenantId,
      entries,
      contentType.fields
    )

    return { 
      entries, 
      relationLabels,
      meta: { pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } 
    }
  } catch (error: any) {
    console.error("Error fetching entries:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Get a specific entry
 */
export async function getEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string, locale: string = "en") {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.read permission" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentTypeRecord = await tenantDb.contentType.findFirst({
      where: {
        slug: contentTypeSlug,
        draftTemplateId: null,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: { schemaFields: { orderBy: { order: 'asc' } } },
    })

    if (!contentTypeRecord) return { error: "Content type not found" }

    const contentType = {
      ...contentTypeRecord,
      fields: parseSchemaFieldOptions(contentTypeRecord.schemaFields),
    }

    // If no entryId provided (like for single types where we might search by content type)
    if (!entryId) {
      const entry = await tenantDb.contentEntry.findFirst({
        where: { 
          contentTypeId: contentType.id, 
          locale,
          OR: [
            { tenantId: access.tenantId },
            { tenantId: null }
          ]
        },
      })
      return { entry, contentType }
    }

    const baseEntry = await tenantDb.contentEntry.findFirst({
      where: { 
        id: entryId, 
        contentTypeId: contentType.id, 
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null }
        ]
      },
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    })

    if (!baseEntry) return { error: "Entry not found" }

    const documentId = baseEntry.documentId || baseEntry.id

    let entry: typeof baseEntry | null = null
    let isNewTranslation = false

    if (baseEntry.locale === locale) {
      entry = baseEntry
      isNewTranslation = false
    } else {
      entry = await tenantDb.contentEntry.findFirst({
        where: { 
          documentId, 
          locale, 
          OR: [
            { tenantId: access.tenantId },
            { tenantId: null }
          ]
        },
        include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
      })

      if (!entry) {
        entry = baseEntry
        isNewTranslation = true
      }
    }

    return { entry, isNewTranslation, documentId, contentType }
  } catch (error: any) {
    console.error("Error fetching entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Create a new entry
 */
export async function createEntryAction(tenantSlug: string, contentTypeSlug: string, payload: { data: any; status: string; locale: string; scheduledAt?: Date | null }) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    // Preserve the legacy content.* RBAC gate for staff callers.
    if (resolved.actor.kind === "staff") {
      const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_CREATE)
      if (!rbac.allowed) return actionError("Forbidden: Missing content.create permission")
    }

    const result = await createContentEntry(resolved.ctx, resolved.actor, {
      contentTypeSlug,
      data: payload.data,
      status: payload.status,
      locale: payload.locale,
      scheduledAt: payload.scheduledAt ?? null,
    })
    if (!result.ok) return serviceFailure(result)

    for (const path of contentRevalidatePaths(tenantSlug, contentTypeSlug)) revalidatePath(path)
    return actionOk(result.data)
  } catch (error: any) {
    console.error("Error creating entry:", error)
    return actionError(error.message || "Internal server error")
  }
}

/**
 * Duplicate an existing entry as a brand-new DRAFT with the same data.
 * Always lands as DRAFT regardless of the source's status — a clone of a
 * PUBLISHED/SCHEDULED entry should never silently go live on its own.
 * Slug-type fields are safe to copy verbatim: createContentEntry already
 * runs processAutoSlugs, which detects the collision against the source
 * entry and appends a disambiguating suffix automatically.
 */
export async function duplicateEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    if (resolved.actor.kind === "staff") {
      const canCreate = await hasAnyPermission(tenantSlug, [PERMISSIONS.CONTENT_CREATE])
      if (!canCreate) return actionError("Forbidden: Missing content.create permission")
    }

    const source = await resolved.ctx.client.contentEntry.findFirst({
      where: { id: entryId, tenantId: resolved.ctx.tenantId },
    })
    if (!source) return actionError("Entri sumber tidak ditemukan")

    let sourceData: any = source.data
    if (typeof sourceData === "string") {
      try { sourceData = JSON.parse(sourceData) } catch { sourceData = {} }
    }

    const result = await createContentEntry(resolved.ctx, resolved.actor, {
      contentTypeSlug,
      data: sourceData,
      status: "DRAFT",
      locale: source.locale,
      scheduledAt: null,
    })
    if (!result.ok) return serviceFailure(result)

    for (const path of contentRevalidatePaths(tenantSlug, contentTypeSlug)) revalidatePath(path)
    return actionOk(result.data)
  } catch (error: any) {
    console.error("Error duplicating entry:", error)
    return actionError(error.message || "Internal server error")
  }
}

/**
 * Update an entry (or create translation)
 */
export async function updateEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string, payload: { data: any; status?: string; locale: string; scheduledAt?: Date | null; expectedUpdatedAt?: Date | string | null }) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    if (resolved.actor.kind === "staff") {
      // CONTENT_UPDATE_OWN-only roles (author/contributor) must still pass
      // this gate — entry-service.ts's ownership check below is what
      // actually decides whether THIS entry is theirs to touch.
      const allowed = await hasAnyPermission(tenantSlug, [PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_UPDATE_OWN])
      if (!allowed) return actionError("Forbidden: Missing content.update permission")
    }

    const result = await updateContentEntry(resolved.ctx, resolved.actor, {
      contentTypeSlug,
      entryId,
      data: payload.data,
      status: payload.status,
      locale: payload.locale,
      scheduledAt: payload.scheduledAt ?? null,
      expectedUpdatedAt: payload.expectedUpdatedAt ?? null,
    })
    if (!result.ok) return serviceFailure(result)

    for (const path of contentRevalidatePaths(tenantSlug, contentTypeSlug)) revalidatePath(path)
    return actionOk(result.data)
  } catch (error: any) {
    console.error("Error updating entry:", error)
    return actionError(error.message || "Internal server error")
  }
}

/**
 * Delete an entry
 */
export async function deleteEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    const result = await deleteContentEntry(resolved.ctx, resolved.actor, { contentTypeSlug, entryId })
    if (!result.ok) return serviceFailure(result)

    for (const path of contentRevalidatePaths(tenantSlug, contentTypeSlug)) revalidatePath(path)
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting entry:", error)
    return actionError(error.message || "Internal server error")
  }
}
/**
 * Update an entry's status
 */
export async function updateContentEntryStatusAction(tenantSlug: string, contentTypeSlug: string, entryId: string, status: string) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    if (resolved.actor.kind === "staff") {
      const allowed = await hasAnyPermission(tenantSlug, [PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_UPDATE_OWN])
      if (!allowed) return actionError("Forbidden: Missing content.update permission")
    }

    const result = await transitionContentEntryStatus(resolved.ctx, resolved.actor, {
      contentTypeSlug,
      entryId,
      status,
    })
    if (!result.ok) return serviceFailure(result)

    for (const path of contentRevalidatePaths(tenantSlug, contentTypeSlug)) revalidatePath(path)
    return actionOk(result.data)
  } catch (error: any) {
    console.error("Error updating entry status:", error)
    return actionError(error.message || "Internal server error")
  }
}

/**
 * Perform bulk action on multiple entries. `fieldUpdate` is required when
 * action === "setField" — {slug, value} to write into every selected entry.
 */
export async function bulkContentAction(
  tenantSlug: string,
  contentTypeSlug: string,
  entryIds: string[],
  action: string,
  fieldUpdate?: { slug: string; value: unknown },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    if (tenantSlug === "admin") {
      if (session.user.role !== "super_admin") return { error: "Forbidden: Not Super Admin" }
      if (action === "delete") {
        await db.contentEntry.deleteMany({ where: { id: { in: entryIds }, tenantId: null } })
      } else if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(action)) {
        const updateData: any = { status: action }
        if (action === "PUBLISHED") updateData.publishedAt = new Date()
        else updateData.publishedAt = null
        await db.contentEntry.updateMany({ where: { id: { in: entryIds }, tenantId: null }, data: updateData })
      }
      revalidatePath(`/admin/content/${contentTypeSlug}`)
      return { success: true }
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    // Coarse "can this role do bulk writes at all" gate — per-entry
    // ownership (author/contributor touching only their own entries) is
    // enforced downstream by updateEntryAction/deleteEntryAction for each
    // entry individually, same as the single-entry actions.
    const allowed = await hasAnyPermission(tenantSlug, [
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.CONTENT_UPDATE_OWN,
      PERMISSIONS.CONTENT_DELETE,
      PERMISSIONS.CONTENT_DELETE_OWN,
    ])
    if (!allowed) return actionError("Forbidden: Missing content.update permission")

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: {
        slug: contentTypeSlug,
        draftTemplateId: null,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      }
    })

    if (!contentType) return { error: "Content type not found" }

    const entries = await tenantDb.contentEntry.findMany({
      where: { id: { in: entryIds }, contentTypeId: contentType.id, tenantId: access.tenantId }
    })

    if (entries.length === 0) return { error: "No entries found" }

    let successCount = 0
    const failures: Array<{ entryId: string; error: string }> = []

    if (action === "delete") {
      // Per-entry role/ownership (editor: any; author/contributor: own
      // only) is enforced inside deleteEntryAction → entry-service.ts,
      // matching the single-entry delete path exactly.
      for (const entry of entries) {
        const result = await deleteEntryAction(tenantSlug, contentTypeSlug, entry.id)
        if ("success" in result && result.success) successCount++
        else failures.push({ entryId: entry.id, error: ("error" in result && result.error) || "Delete failed" })
      }
    } else if (action === "publish" || action === "unpublish" || action === "draft") {
      // "draft" is the bulk toolbar's own action name for the same
      // publish->DRAFT transition "unpublish" already does — the client
      // (content-entries-manager.tsx) sends "draft", not "unpublish".
      const targetStatus = action === "publish" ? "PUBLISHED" : "DRAFT"
      for (const entry of entries) {
        if (entry.status !== targetStatus) {
           const result = await updateEntryAction(tenantSlug, contentTypeSlug, entry.id, {
             data: undefined,
             status: targetStatus,
             locale: entry.locale
           })
           if ("success" in result && result.success) successCount++
           else failures.push({ entryId: entry.id, error: ("error" in result && result.error) || `${action} failed` })
        }
      }
    } else if (action === "setField") {
      if (!fieldUpdate || !fieldUpdate.slug) return { error: "fieldUpdate.slug is required for setField" }
      const targetField = await tenantDb.schemaField.findFirst({ where: { contentTypeId: contentType.id, slug: fieldUpdate.slug } })
      if (!targetField) return { error: `Field '${fieldUpdate.slug}' not found on this content type` }
      // Relation/component/media/repeater values need real structural merging
      // per field type (arrays vs single ids, JSON shape) — mass-writing a
      // single scalar into them safely isn't well-defined here, so bulk
      // set is scoped to plain scalar field types for now.
      const SCALAR_BULK_TYPES = new Set([
        "text", "textarea", "richText", "markdown", "number", "currency", "percent",
        "date", "datetime", "time", "select", "boolean", "email", "url", "phone", "uid", "rating", "color",
      ])
      if (!SCALAR_BULK_TYPES.has(targetField.type)) {
        return { error: `Bulk edit belum didukung untuk tipe field '${targetField.type}'` }
      }
      for (const entry of entries) {
        const existingData = (typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data) || {}
        const result = await updateEntryAction(tenantSlug, contentTypeSlug, entry.id, {
          data: { ...existingData, [fieldUpdate.slug]: fieldUpdate.value },
          locale: entry.locale,
        })
        if ("success" in result && result.success) successCount++
        else failures.push({ entryId: entry.id, error: ("error" in result && result.error) || "setField failed" })
      }
    } else {
      return { error: "Invalid action" }
    }

    return {
      success: failures.length === 0,
      count: successCount,
      failed: failures.length,
      failures,
    }
  } catch (error: any) {
    console.error("Error performing bulk action:", error)
    return { error: error.message || "Internal server error" }
  }
}

export async function assignReviewersAction(tenantSlug: string, entryId: string, reviewers: Array<{ userId: string; name?: string }>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (!["owner", "admin"].includes(access.role)) {
      return { error: "Only workspace owners and admins can assign reviewers" }
    }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return actionError("Forbidden: Missing content.update permission")

    if (reviewers.length > 20 || reviewers.some((reviewer) => !reviewer.userId)) {
      return { error: "Invalid reviewer list" }
    }

    const normalizedReviewers = reviewers.map((reviewer) => ({
      userId: reviewer.userId,
      name: reviewer.name?.trim().slice(0, 200),
    }))

    const tenantDb = await getTenantDb(tenantSlug)
    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, tenantId: access.tenantId },
      select: { id: true, status: true },
    })
    if (!entry) return { error: "Entry not found" }
    if (!["DRAFT", "IN_REVIEW"].includes(entry.status)) {
      return { error: "Reviewers can only be changed while content is Draft or In Review" }
    }

    const reviewerIds = [...new Set(normalizedReviewers.map((reviewer) => reviewer.userId))]
    if (reviewerIds.length !== normalizedReviewers.length) {
      return { error: "A reviewer can only be assigned once" }
    }

    const validReviewerCount = await db.tenantMember.count({
      where: {
        tenantId: access.tenantId,
        userId: { in: reviewerIds },
        role: { not: "viewer" },
      },
    })
    if (validReviewerCount !== reviewerIds.length) {
      return { error: "Every reviewer must be an active, non-viewer member of this workspace" }
    }

    const reviewerAccess = await Promise.all(
      reviewerIds.map((userId) => hasPermission(userId, access.tenantId, PERMISSIONS.CONTENT_READ))
    )
    if (reviewerAccess.some((allowed) => !allowed)) {
      return { error: "Every reviewer must have content.read permission" }
    }

    await assignReviewers(entry.id, normalizedReviewers, session.user.id, tenantDb)
    revalidatePath(`/dashboard/${tenantSlug}/content`)
    return { success: true }
  } catch (error: any) {
    console.error("Error assigning reviewers:", error)
    return { error: error.message || "Internal server error" }
  }
}

export async function submitReviewAction(tenantSlug: string, entryId: string, decision: "approved" | "rejected", comment?: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    // Check if user is an allowed reviewer
    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.read permission" }

    const tenantDb = await getTenantDb(tenantSlug)
    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, tenantId: access.tenantId },
      select: { id: true, status: true, contentTypeId: true },
    })
    if (!entry) return { error: "Entry not found" }
    if (entry.status !== "IN_REVIEW") {
      return { error: "Review decisions are only accepted while content is In Review" }
    }

    const normalizedComment = comment?.trim().slice(0, 2000)
    const result = await submitReview(entry.id, session.user.id, decision, normalizedComment, tenantDb)

    // If all approved or rejected, update the entry status accordingly
    if (result.allApproved || result.rejected) {
      const status: ContentStatus = result.allApproved ? "APPROVED" : "REJECTED"
      
      const updated = await tenantDb.contentEntry.update({
        where: { id: entryId },
        data: { status, reviewComment: normalizedComment }
      })

      triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_UPDATED, { entry: updated })
      logAudit({
        tenantId: access.tenantId,
        userId: session.user.id,
        action: AuditAction.CONTENT_UPDATED,
        entity: "content_review",
        entityId: entry.id,
        data: { decision, status, comment: normalizedComment || null },
      })
    }

    revalidatePath(`/dashboard/${tenantSlug}/content`)
    return { success: true, ...result }
  } catch (error: any) {
    console.error("Error submitting review:", error)
    return { error: error.message || "Internal server error" }
  }
}
