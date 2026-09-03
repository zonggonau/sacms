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
export async function getEntriesAction(
  tenantSlug: string,
  contentTypeSlug: string,
  params: { page?: number; pageSize?: number; status?: string; locale?: string; search?: string }
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
    const { status, locale, search } = params

    const where: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: access.tenantId,
    }
    if (status) where.status = status
    if (locale) where.locale = locale

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

      entries = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "content_entries" WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...queryParams,
        pageSize,
        (page - 1) * pageSize
      )
    } else {
      const [rawEntries, count] = await Promise.all([
        tenantDb.contentEntry.findMany({
          where,
          orderBy: { createdAt: "desc" },
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
 * Update an entry (or create translation)
 */
export async function updateEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string, payload: { data: any; status?: string; locale: string; scheduledAt?: Date | null }) {
  try {
    const resolved = await resolveWriteContext(tenantSlug)
    if (!resolved.ok) return actionError(resolved.error)

    if (resolved.actor.kind === "staff") {
      const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
      if (!rbac.allowed) return actionError("Forbidden: Missing content.update permission")
    }

    const result = await updateContentEntry(resolved.ctx, resolved.actor, {
      contentTypeSlug,
      entryId,
      data: payload.data,
      status: payload.status,
      locale: payload.locale,
      scheduledAt: payload.scheduledAt ?? null,
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
      const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
      if (!rbac.allowed) return actionError("Forbidden: Missing content.update permission")
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
 * Perform bulk action on multiple entries
 */
export async function bulkContentAction(tenantSlug: string, contentTypeSlug: string, entryIds: string[], action: string) {
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

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return actionError("Forbidden: Missing content.update permission")

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
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
      if (access.role !== "admin" && access.role !== "owner") {
        return { error: "Only admins and owners can delete entries" }
      }
      for (const entry of entries) {
        const result = await deleteEntryAction(tenantSlug, contentTypeSlug, entry.id)
        if ("success" in result && result.success) successCount++
        else failures.push({ entryId: entry.id, error: ("error" in result && result.error) || "Delete failed" })
      }
    } else if (action === "publish" || action === "unpublish") {
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
