"use server"

import { db, getTenantDb } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { validateContentEntry } from "@/lib/content-validations"
import { processAutoSlugs } from "@/lib/slug"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { canUserTransition, assignReviewers, submitReview } from "@/lib/content-workflow"
import { ContentStatus } from "@prisma/client"

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

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) return { error: "Content type not found" }

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

    return { entries, meta: { pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } }
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

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    // If no entryId provided (like for single types where we might search by content type)
    if (!entryId) {
      const entry = await tenantDb.contentEntry.findFirst({
        where: { contentTypeId: contentType.id, tenantId: access.tenantId, locale },
      })
      return { entry, contentType }
    }

    const baseEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: access.tenantId },
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    })

    if (!baseEntry) return { error: "Entry not found" }

    const documentId = baseEntry.documentId || baseEntry.id

    let entry = await tenantDb.contentEntry.findFirst({
      where: { documentId, locale, tenantId: access.tenantId },
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    })

    let isNewTranslation = false
    if (!entry) {
      entry = baseEntry
      isNewTranslation = true
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
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_CREATE)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.create permission" }

    const { data, status, locale, scheduledAt } = payload
    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId },
          { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "content_entries")
    if (!enforcement.allowed) return { error: enforcement.message }

    const { validateDynamicContent } = await import("@/lib/validations/dynamic-validator")
    const dynamicValidation = await validateDynamicContent(contentType.id, tenantId, data)
    if (!dynamicValidation.success) return { error: "Validation failed", details: dynamicValidation.errors }

    const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, contentType.fields, data as Record<string, any>, undefined, 'content', tenantDb)

    const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, dataWithSlugs as Record<string, unknown>)
    if (!hookResult.allowed) return { error: hookResult.rejectMessage || "Rejected by hook" }

    const finalData = hookResult.modifiedData || dataWithSlugs

    const entry = await tenantDb.$transaction(async (tx) => {
      const newEntry = await tx.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId,
          locale: locale || "en",
          data: finalData as any,
          status: status as any,
          scheduledAt: status === "SCHEDULED" ? scheduledAt : null,
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
          data: finalData as any,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          changeType: "created",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, { entry: { id: entry.id, contentType: contentTypeSlug, status: entry.status } })
    
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({ tenantId, userId: session.user.id, action: AuditAction.CONTENT_CREATED, entity: "content_entry", entityId: entry.id, data: { contentType: contentTypeSlug, status } })

    revalidatePath(`/dashboard/${tenantSlug}/content-types/${contentTypeSlug}`)
    revalidatePath(`/dashboard/${tenantSlug}/single-types/${contentTypeSlug}`)
    
    return { success: true, entry }
  } catch (error: any) {
    console.error("Error creating entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Update an entry (or create translation)
 */
export async function updateEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string, payload: { data: any; status?: string; locale: string; scheduledAt?: Date | null }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.update permission" }

    const { data, status, locale, scheduledAt } = payload
    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId },
          { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const baseEntry = await tenantDb.contentEntry.findUnique({ where: { id: entryId } })
    if (!baseEntry) return { error: "Entry not found" }

    const documentId = baseEntry.documentId || baseEntry.id
    const existingLocaleEntry = await tenantDb.contentEntry.findFirst({ where: { documentId, locale, tenantId } })

    if (data) {
      const validation = await validateContentEntry(contentType.fields as any, data)
      if (!validation.success) return { error: "Validation failed", details: validation.errors }
      Object.assign(data, validation.data)
    }

    if (existingLocaleEntry && status && status !== existingLocaleEntry.status) {
      const member = await db.tenantMember.findUnique({ where: { tenantId_userId: { tenantId, userId: session.user.id } } })
      if (!member) return { error: "Unauthorized" }

      let roleCustomPerms: string[] | null = null
      if (member.customPermissions && Array.isArray(member.customPermissions)) {
        roleCustomPerms = member.customPermissions as string[]
      } else {
        const isStandardRole = ["admin", "owner", "editor", "viewer"].includes(member.role)
        if (!isStandardRole) {
          const perms = await db.rolePermission.findMany({ where: { tenantId, roleId: member.role, granted: true }, include: { permission: true } })
          roleCustomPerms = perms.map(p => p.permission.name)
        }
      }

      const canTransition = canUserTransition(existingLocaleEntry.status as any, status as any, member.role, roleCustomPerms)
      if (!canTransition) return { error: `You do not have permission to change status from ${existingLocaleEntry.status} to ${status}` }
    }

    const entry = await tenantDb.$transaction(async (tx) => {
      let targetEntryId = existingLocaleEntry?.id

      if (existingLocaleEntry) {
        let finalData = data
        if (data) {
          const fullData = { ...(existingLocaleEntry.data as any), ...data }
          const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, contentType.fields, fullData, existingLocaleEntry.id, 'content', tx as any)

          const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_UPDATE, dataWithSlugs as Record<string, unknown>)
          if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
          finalData = hookResult.modifiedData || dataWithSlugs
        }

        const updateData: any = { updatedBy: session.user.id }
        if (finalData) updateData.data = finalData
        if (status) {
          updateData.status = status
          updateData.publishedAt = status === "PUBLISHED" ? new Date() : (status === "DRAFT" ? null : existingLocaleEntry.publishedAt)
          updateData.scheduledAt = status === "SCHEDULED" ? scheduledAt : (status ? null : existingLocaleEntry.scheduledAt)
        }

        await tx.contentEntry.update({ where: { id: existingLocaleEntry.id }, data: updateData })
      } else {
        // Translation flow
        if (!data) throw new Error("Data required for new translation")
        const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, contentType.fields, data as Record<string, any>, undefined, 'content', tx as any)
        
        const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, dataWithSlugs as Record<string, unknown>)
        if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
        const finalData = hookResult.modifiedData || dataWithSlugs

        const newEntry = await tx.contentEntry.create({
          data: {
            documentId,
            contentTypeId: baseEntry.contentTypeId,
            tenantId,
            locale,
            data: finalData as any,
            status: status as any || "DRAFT",
            publishedAt: status === "PUBLISHED" ? new Date() : null,
            scheduledAt: status === "SCHEDULED" ? scheduledAt : null,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }
        })
        targetEntryId = newEntry.id
      }

      // Sync Shared Fields
      if (data) {
        const sharedFields = contentType.fields.filter(f => !f.localizable)
        if (sharedFields.length > 0) {
          const translations = await tx.contentEntry.findMany({ where: { documentId, NOT: { id: targetEntryId! } } })
          for (const trans of translations) {
            let transData = typeof trans.data === 'string' ? JSON.parse(trans.data) : trans.data
            let updated = false
            for (const field of sharedFields) {
              if (data[field.slug] !== transData[field.slug]) {
                transData[field.slug] = data[field.slug]
                updated = true
              }
            }
            if (updated) await tx.contentEntry.update({ where: { id: trans.id }, data: { data: transData as any } })
          }
        }
      }

      const updatedEntry = await tx.contentEntry.findUnique({ where: { id: targetEntryId! } })
      const lastVersion = await tx.contentVersion.findFirst({ where: { contentEntryId: targetEntryId! }, orderBy: { version: "desc" } })

      await tx.contentVersion.create({
        data: {
          contentEntryId: targetEntryId!,
          version: (lastVersion?.version || 0) + 1,
          data: updatedEntry?.data as any,
          changeType: existingLocaleEntry ? "updated" : "created",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    triggerWebhooks(tenantId, existingLocaleEntry ? WebhookEvents.CONTENT_UPDATED : WebhookEvents.CONTENT_CREATED, { entry: { id: entry?.id, contentType: contentTypeSlug, status: entry?.status } })
    
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({ tenantId, userId: session.user.id, action: existingLocaleEntry ? AuditAction.CONTENT_UPDATED : AuditAction.CONTENT_CREATED, entity: "content_entry", entityId: entry?.id || entryId, data: { contentType: contentTypeSlug, status: entry?.status, locale } })

    revalidatePath(`/dashboard/${tenantSlug}/content-types/${contentTypeSlug}`)
    revalidatePath(`/dashboard/${tenantSlug}/single-types/${contentTypeSlug}`)

    return { success: true, entry }
  } catch (error: any) {
    console.error("Error updating entry:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Delete an entry
 */
export async function deleteEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner") return { error: "Only admins and owners can delete entries" }

    const tenantDb = await getTenantDb(tenantSlug)
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [{ tenantId: access.tenantId }, { tenantId: null }]
      }
    })

    if (!contentType) return { error: "Content type not found" }

    const entry = await tenantDb.contentEntry.findFirst({ where: { id: entryId, contentTypeId: contentType.id, tenantId: access.tenantId } })
    if (!entry) return { error: "Entry not found" }

    const hookResult = await executeSyncHooks(access.tenantId, WebhookEvents.BEFORE_DELETE, { id: entry.id, contentType: contentTypeSlug })
    if (!hookResult.allowed) return { error: hookResult.rejectMessage || "Rejected by hook" }

    await tenantDb.contentEntry.delete({ where: { id: entryId } })

    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_DELETED, { entry: { id: entry.id, contentType: contentTypeSlug } })
    
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({ tenantId: access.tenantId, userId: session.user.id, action: AuditAction.CONTENT_DELETED, entity: "content_entry", entityId: entryId, data: { contentType: contentTypeSlug } })

    revalidatePath(`/dashboard/${tenantSlug}/content-types/${contentTypeSlug}`)
    revalidatePath(`/dashboard/${tenantSlug}/single-types/${contentTypeSlug}`)

    return { success: true }
  } catch (error: any) {
    console.error("Error deleting entry:", error)
    return { error: error.message || "Internal server error" }
  }
}
/**
 * Update an entry's status
 */
export async function updateContentEntryStatusAction(tenantSlug: string, contentTypeSlug: string, entryId: string, status: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.update permission" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })

    if (!contentType) return { error: "Content type not found" }

    const existingEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: access.tenantId }
    })

    if (!existingEntry) return { error: "Entry not found" }
    
    // Delegate to updateEntryAction which already has the status transition logic and webhooks
    return await updateEntryAction(tenantSlug, contentTypeSlug, entryId, { 
      data: undefined, // undefined to skip data update 
      status, 
      locale: existingEntry.locale 
    })
  } catch (error: any) {
    console.error("Error updating entry status:", error)
    return { error: error.message || "Internal server error" }
  }
}

/**
 * Perform bulk action on multiple entries
 */
export async function bulkContentAction(tenantSlug: string, contentTypeSlug: string, entryIds: string[], action: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.update permission" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })

    if (!contentType) return { error: "Content type not found" }

    const entries = await tenantDb.contentEntry.findMany({
      where: { id: { in: entryIds }, contentTypeId: contentType.id, tenantId: access.tenantId }
    })

    if (entries.length === 0) return { error: "No entries found" }

    let successCount = 0

    if (action === "delete") {
      if (access.role !== "admin" && access.role !== "owner") {
        return { error: "Only admins and owners can delete entries" }
      }
      for (const entry of entries) {
        await deleteEntryAction(tenantSlug, contentTypeSlug, entry.id)
        successCount++
      }
    } else if (action === "publish" || action === "unpublish") {
      const targetStatus = action === "publish" ? "PUBLISHED" : "DRAFT"
      for (const entry of entries) {
        if (entry.status !== targetStatus) {
           await updateEntryAction(tenantSlug, contentTypeSlug, entry.id, {
             data: undefined,
             status: targetStatus,
             locale: entry.locale
           })
           successCount++
        }
      }
    } else {
      return { error: "Invalid action" }
    }

    return { success: true, count: successCount }
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

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden: Missing content.update permission" }

    await assignReviewers(entryId, reviewers, session.user.id)
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

    const result = await submitReview(entryId, session.user.id, decision, comment)

    // If all approved or rejected, update the entry status accordingly
    if (result.allApproved || result.rejected) {
      const tenantDb = await getTenantDb(tenantSlug)
      const status: ContentStatus = result.allApproved ? "APPROVED" : "REJECTED"
      
      const updated = await tenantDb.contentEntry.update({
        where: { id: entryId },
        data: { status, reviewComment: comment }
      })

      triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_UPDATED, { entry: updated })
    }

    revalidatePath(`/dashboard/${tenantSlug}/content`)
    return { success: true, ...result }
  } catch (error: any) {
    console.error("Error submitting review:", error)
    return { error: error.message || "Internal server error" }
  }
}
