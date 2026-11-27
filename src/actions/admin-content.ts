"use server"

import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { validateContentEntry } from "@/lib/content-validations"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { isWorkflowStatus, type WorkflowStatus } from "@/lib/content-workflow-rules"
import { parseSchemaFieldOptions, validateScheduledPublicationDate } from "./content-pipeline"

// Every `where` clause below filters on `tenantId: null` to scope strictly to
// global (sacms-global) content — NOT `tenantId: undefined`, which Prisma
// treats as "no filter on this field at all" rather than "field is null".
// With `undefined` these lookups could match (and deleteAdminEntryAction
// could then delete) a real tenant's row on an id/slug collision, even
// though every action here is super_admin-only. `tenantId: undefined` inside
// a `create()`/`logAudit()` call is unrelated and fine as-is — there it just
// means "omit this field", which already resolves to null.

/**
 * Get all entries for a global content type with pagination and filtering
 */
export async function getAdminEntriesAction(
  contentTypeSlug: string,
  params: { page?: number; pageSize?: number; status?: string; search?: string }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentTypeRecord = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null },
      include: { schemaFields: { orderBy: { order: 'asc' } } },
    })

    if (!contentTypeRecord) return { error: "Content type not found" }

    const contentType = {
      ...contentTypeRecord,
      fields: contentTypeRecord.schemaFields.map(f => {
        let parsedOptions = f.options
        if (typeof f.options === 'string') {
          try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
        }
        return { ...f, options: parsedOptions || {} }
      })
    }

    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25))
    const { status, search } = params

    const where: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: null,
    }
    if (status) where.status = status

    let entries: any[]
    let total: number

    if (search) {
      const safeSearch = search.replace(/[&|!():*<>'\"\\]/g, " ").trim().slice(0, 200)
      if (safeSearch) {
        // Fallback to basic DB queries for simplicity in admin without tsvector setup complexities on null tenant
        const rawEntries = await db.contentEntry.findMany({
          where: {
            ...where,
            data: { path: [], string_contains: safeSearch } as any, // Simple JSON filter
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        })
        const count = await db.contentEntry.count({
          where: {
            ...where,
            data: { path: [], string_contains: safeSearch } as any,
          }
        })
        entries = rawEntries
        total = count
      } else {
        const [rawEntries, count] = await Promise.all([
          db.contentEntry.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          db.contentEntry.count({ where }),
        ])
        entries = rawEntries
        total = count
      }
    } else {
      const [rawEntries, count] = await Promise.all([
        db.contentEntry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.contentEntry.count({ where }),
      ])
      entries = rawEntries
      total = count
    }

    return { entries, meta: { pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } }
  } catch (error: any) {
    console.error("Error fetching admin entries:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Get a specific global entry
 */
export async function getAdminEntryAction(contentTypeSlug: string, entryId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentTypeRecord = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null },
      include: { schemaFields: { orderBy: { order: 'asc' } } },
    })

    if (!contentTypeRecord) return { error: "Content type not found" }

    const contentType = {
      ...contentTypeRecord,
      fields: contentTypeRecord.schemaFields.map(f => {
        let parsedOptions = f.options
        if (typeof f.options === 'string') {
          try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
        }
        return { ...f, options: parsedOptions || {} }
      })
    }

    if (!entryId) {
      const entry = await db.contentEntry.findFirst({
        where: { contentTypeId: contentType.id, tenantId: null },
      })
      return { entry, contentType }
    }

    const baseEntry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: null },
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    })

    if (!baseEntry) return { error: "Entry not found" }

    return { entry: baseEntry, contentType }
  } catch (error: any) {
    console.error("Error fetching admin entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Create a new global entry
 */
export async function createAdminEntryAction(contentTypeSlug: string, payload: { data: any; status: string; scheduledAt?: Date | null }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const { data, status, scheduledAt } = payload

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "Content data must be an object" }
    }
    if (!isWorkflowStatus(status)) return { error: "Invalid content status" }

    const normalizedScheduledAt = scheduledAt instanceof Date ? scheduledAt : scheduledAt ? new Date(scheduledAt as unknown as string) : null

    const scheduleError = validateScheduledPublicationDate(status, normalizedScheduledAt)
    if (scheduleError) return { error: scheduleError }

    const contentType = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null },
      include: { schemaFields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const mappedContentType = {
      ...contentType,
      fields: parseSchemaFieldOptions(contentType.schemaFields),
    }

    const schemaValidation = await validateContentEntry(
      mappedContentType.fields as any,
      data,
      { enforceRequired: status !== "DRAFT" }
    )
    if (!schemaValidation.success) {
      return { error: "Validation failed", details: schemaValidation.errors }
    }
    Object.assign(data, schemaValidation.data || {})

    // We skip auto-slug generation and webhooks for global content by default unless explicitly needed

    const entry = await db.$transaction(async (tx) => {
      const newEntry = await tx.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId: null,
          data: data as any,
          status: status as any,
          scheduledAt: status === "SCHEDULED" ? normalizedScheduledAt : null,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        },
      })

      const updatedEntry = await tx.contentEntry.update({
        where: { id: newEntry.id },
        data: { documentId: newEntry.id }
      })

      await tx.contentVersion.create({
        data: {
          contentEntryId: newEntry.id,
          version: 1,
          data: data as any,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          changeType: "created",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:global:${contentTypeSlug}:*`)

    logAudit({ tenantId: undefined, userId: session.user.id, action: AuditAction.CONTENT_CREATED, entity: "content_entry", entityId: entry.id, data: { contentType: contentTypeSlug, status } })

    revalidatePath(`/admin/content/${contentTypeSlug}`)
    revalidatePath(`/admin/single-types/${contentTypeSlug}`)
    
    return { success: true, entry }
  } catch (error: any) {
    console.error("Error creating admin entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Update a global entry
 */
export async function updateAdminEntryAction(contentTypeSlug: string, entryId: string, payload: { data: any; status?: string; scheduledAt?: Date | null }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const { data, status, scheduledAt } = payload

    if (data !== undefined && (!data || typeof data !== "object" || Array.isArray(data))) {
      return { error: "Content data must be an object" }
    }

    const contentType = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null },
      include: { schemaFields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const mappedContentType = {
      ...contentType,
      fields: parseSchemaFieldOptions(contentType.schemaFields),
    }

    const baseEntry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: null },
    })
    if (!baseEntry) return { error: "Entry not found" }

    const existingEntry: typeof baseEntry = baseEntry

    const targetStatus = status || existingEntry?.status || "DRAFT"
    if (!isWorkflowStatus(targetStatus)) return { error: "Invalid content status" }

    const normalizedScheduledAt = scheduledAt instanceof Date ? scheduledAt : scheduledAt ? new Date(scheduledAt as unknown as string) : null
    const effectiveScheduledAt = normalizedScheduledAt || existingEntry?.scheduledAt || null
    const scheduleError = validateScheduledPublicationDate(targetStatus, effectiveScheduledAt)
    if (scheduleError) return { error: scheduleError }

    if (data) {
      const existingData = existingEntry?.data && typeof existingEntry.data === "object" ? (existingEntry.data as Record<string, unknown>) : {}
      const candidateData = { ...existingData, ...data }
      const validation = await validateContentEntry(
        mappedContentType.fields as any,
        candidateData,
        { enforceRequired: targetStatus !== "DRAFT" }
      )
      if (!validation.success) return { error: "Validation failed", details: validation.errors }
      Object.assign(data, validation.data || {})
    }

    const entry = await db.$transaction(async (tx) => {
      const targetEntryId = existingEntry.id

      {
        let finalData = data

        const updateData: any = { updatedBy: session.user.id }
        if (finalData) updateData.data = finalData
        if (status) {
          updateData.status = status
          if (status !== existingEntry.status) {
            updateData.publishedAt = status === "PUBLISHED" ? new Date() : (status === "DRAFT" ? null : existingEntry.publishedAt)
            updateData.scheduledAt = status === "SCHEDULED" ? effectiveScheduledAt : null
            updateData.archivedAt = status === "ARCHIVED" ? new Date() : null
          } else if (status === "SCHEDULED" && normalizedScheduledAt) {
            updateData.scheduledAt = normalizedScheduledAt
          }
        }

        await tx.contentEntry.update({ where: { id: existingEntry.id }, data: updateData })
      }

      const updatedEntry = await tx.contentEntry.findUnique({ where: { id: targetEntryId } })
      const lastVersion = await tx.contentVersion.findFirst({ where: { contentEntryId: targetEntryId }, orderBy: { version: "desc" } })

      await tx.contentVersion.create({
        data: {
          contentEntryId: targetEntryId,
          version: (lastVersion?.version || 0) + 1,
          data: updatedEntry?.data as any,
          changeType: "updated",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:global:${contentTypeSlug}:*`)

    logAudit({ tenantId: undefined, userId: session.user.id, action: AuditAction.CONTENT_UPDATED, entity: "content_entry", entityId: entry?.id || entryId, data: { contentType: contentTypeSlug, status: entry?.status } })

    revalidatePath(`/admin/content/${contentTypeSlug}`)
    revalidatePath(`/admin/single-types/${contentTypeSlug}`)

    return { success: true, entry }
  } catch (error: any) {
    console.error("Error updating admin entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Delete a global entry
 */
export async function deleteAdminEntryAction(contentTypeSlug: string, entryId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentType = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null }
    })

    if (!contentType) return { error: "Content type not found" }

    const entry = await db.contentEntry.findFirst({ where: { id: entryId, contentTypeId: contentType.id, tenantId: null } })
    if (!entry) return { error: "Entry not found" }

    await db.contentEntry.delete({ where: { id: entryId } })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:global:${contentTypeSlug}:*`)

    logAudit({ tenantId: undefined, userId: session.user.id, action: AuditAction.CONTENT_DELETED, entity: "content_entry", entityId: entryId, data: { contentType: contentTypeSlug } })

    revalidatePath(`/admin/content/${contentTypeSlug}`)
    revalidatePath(`/admin/single-types/${contentTypeSlug}`)

    return { success: true }
  } catch (error: any) {
    console.error("Error deleting admin entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Update a global entry's status
 */
export async function updateAdminContentEntryStatusAction(contentTypeSlug: string, entryId: string, status: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentType = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: null }
    })

    if (!contentType) return { error: "Content type not found" }

    const existingEntry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: null }
    })

    if (!existingEntry) return { error: "Entry not found" }
    
    return await updateAdminEntryAction(contentTypeSlug, entryId, { 
      data: undefined, 
      status, 
    })
  } catch (error: any) {
    console.error("Error updating admin entry status:", error)
    return { error: error.message || "Internal server error" }
  }
}
