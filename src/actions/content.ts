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

  if (Array.isArray(member.customPermissions)) {
    return {
      role: member.role,
      customPermissions: member.customPermissions as string[],
    }
  }

  if (!["owner", "admin", "editor", "viewer", "member"].includes(member.role)) {
    const permissions = await db.rolePermission.findMany({
      where: { tenantId, roleId: member.role, granted: true },
      include: { permission: true },
    })
    return {
      role: member.role,
      customPermissions: permissions.map((item) => item.permission.name),
    }
  }

  return { role: member.role, customPermissions: null }
}

function validateScheduledDate(status: WorkflowStatus, scheduledAt?: Date | null) {
  if (status !== "SCHEDULED") return null
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return "A valid scheduled publication date is required"
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return "Scheduled publication date must be in the future"
  }
  return null
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
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
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

    const contentTypeRecord = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
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

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "Content data must be an object" }
    }
    if (!isWorkflowStatus(status)) return { error: "Invalid content status" }

    const normalizedScheduledAt = scheduledAt instanceof Date
      ? scheduledAt
      : scheduledAt
        ? new Date(scheduledAt as unknown as string)
        : null
    const targetLocale = locale || "en"

    const configuredLocales = await tenantDb.tenantLocale.findMany({
      where: { tenantId, isEnabled: true },
      select: { locale: true },
    })
    if (
      configuredLocales.length > 0 &&
      !configuredLocales.some((item) => item.locale === targetLocale)
    ) {
      return { error: `Locale '${targetLocale}' is not enabled for this workspace` }
    }

    const workflow = await getWorkflowContext(tenantId, session.user.id, access.role)
    if (
      status !== "DRAFT" &&
      !canUserTransition("DRAFT", status, workflow.role, workflow.customPermissions)
    ) {
      return { error: `You do not have permission to create content as ${status}` }
    }

    const scheduleError = validateScheduledDate(status, normalizedScheduledAt)
    if (scheduleError) return { error: scheduleError }

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId },
          { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
        ]
      },
      include: { schemaFields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const mappedContentType = {
      ...contentType,
      fields: contentType.schemaFields.map(f => {
        let parsedOptions = f.options
        if (typeof f.options === 'string') {
          try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
        }
        return { ...f, options: parsedOptions || {} }
      })
    }

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "content_entries", session.user.id)
    if (!enforcement.allowed) return { error: enforcement.message }

    const schemaValidation = await validateContentEntry(
      mappedContentType.fields as any,
      data,
      { enforceRequired: status !== "DRAFT" }
    )
    if (!schemaValidation.success) {
      return { error: "Validation failed", details: schemaValidation.errors }
    }
    Object.assign(data, schemaValidation.data || {})

    const { validateDynamicContent } = await import("@/lib/validations/dynamic-validator")
    const dynamicValidation = await validateDynamicContent(
      contentType.id,
      tenantId,
      data,
      undefined,
      { enforceRequired: status !== "DRAFT", client: tenantDb }
    )
    if (!dynamicValidation.success) return { error: "Validation failed", details: dynamicValidation.errors }

    const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, mappedContentType.fields, data as Record<string, any>, undefined, 'content', tenantDb)

    const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, dataWithSlugs as Record<string, unknown>)
    if (!hookResult.allowed) return { error: hookResult.rejectMessage || "Rejected by hook" }

    let finalData = hookResult.modifiedData || dataWithSlugs
    if (status === "PUBLISHED") {
      const publishHook = await executeSyncHooks(
        tenantId,
        WebhookEvents.BEFORE_PUBLISH,
        finalData as Record<string, unknown>
      )
      if (!publishHook.allowed) return { error: publishHook.rejectMessage || "Rejected by publish hook" }
      finalData = publishHook.modifiedData || finalData
    }

    const entry = await tenantDb.$transaction(async (tx) => {
      const newEntry = await tx.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId,
          locale: targetLocale,
          data: finalData as any,
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
          data: finalData as any,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          changeType: "created",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, { entry: { id: entry.id, contentType: contentTypeSlug, status: entry.status } })
    if (entry.status === "PUBLISHED") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_PUBLISHED, { entry: { id: entry.id, contentType: contentTypeSlug, status: entry.status } })
    }
    
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
    const targetLocale = locale || "en"

    if (data !== undefined && (!data || typeof data !== "object" || Array.isArray(data))) {
      return { error: "Content data must be an object" }
    }

    const configuredLocales = await tenantDb.tenantLocale.findMany({
      where: { tenantId, isEnabled: true },
      select: { locale: true },
    })
    if (
      configuredLocales.length > 0 &&
      !configuredLocales.some((item) => item.locale === targetLocale)
    ) {
      return { error: `Locale '${targetLocale}' is not enabled for this workspace` }
    }

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId },
          { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
        ]
      },
      include: { schemaFields: true },
    })

    if (!contentType) return { error: "Content type not found" }

    const mappedContentType = {
      ...contentType,
      fields: contentType.schemaFields.map(f => {
        let parsedOptions = f.options
        if (typeof f.options === 'string') {
          try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
        }
        return { ...f, options: parsedOptions || {} }
      })
    }

    const baseEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId },
    })
    if (!baseEntry) return { error: "Entry not found" }

    const documentId = baseEntry.documentId || baseEntry.id
    const existingLocaleEntry = await tenantDb.contentEntry.findFirst({ where: { documentId, locale: targetLocale, tenantId } })

    const targetStatus = status || existingLocaleEntry?.status || "DRAFT"
    if (!isWorkflowStatus(targetStatus)) return { error: "Invalid content status" }

    const workflow = await getWorkflowContext(tenantId, session.user.id, access.role)
    if (
      !existingLocaleEntry &&
      targetStatus !== "DRAFT" &&
      !canUserTransition("DRAFT", targetStatus, workflow.role, workflow.customPermissions)
    ) {
      return { error: `You do not have permission to create a translation as ${targetStatus}` }
    }

    const normalizedScheduledAt = scheduledAt instanceof Date
      ? scheduledAt
      : scheduledAt
        ? new Date(scheduledAt as unknown as string)
        : null
    const effectiveScheduledAt = normalizedScheduledAt || existingLocaleEntry?.scheduledAt || null
    const scheduleError = validateScheduledDate(targetStatus, effectiveScheduledAt)
    if (scheduleError) return { error: scheduleError }

    if (data) {
      const existingData = existingLocaleEntry?.data && typeof existingLocaleEntry.data === "object"
        ? (existingLocaleEntry.data as Record<string, unknown>)
        : {}
      const candidateData = { ...existingData, ...data }
      const validation = await validateContentEntry(
        mappedContentType.fields as any,
        candidateData,
        { enforceRequired: targetStatus !== "DRAFT" }
      )
      if (!validation.success) return { error: "Validation failed", details: validation.errors }
      Object.assign(data, validation.data || {})

      const { validateDynamicContent } = await import("@/lib/validations/dynamic-validator")
      const dynamicValidation = await validateDynamicContent(
        contentType.id,
        tenantId,
        candidateData,
        existingLocaleEntry?.id,
        { enforceRequired: targetStatus !== "DRAFT", client: tenantDb }
      )
      if (!dynamicValidation.success) {
        return { error: "Validation failed", details: dynamicValidation.errors }
      }
    }

    if (existingLocaleEntry && status && status !== existingLocaleEntry.status) {
      const canTransition = canUserTransition(
        existingLocaleEntry.status,
        status as ContentStatus,
        workflow.role,
        workflow.customPermissions
      )
      if (!canTransition) return { error: `You do not have permission to change status from ${existingLocaleEntry.status} to ${status}` }
    }

    const entry = await tenantDb.$transaction(async (tx) => {
      let targetEntryId = existingLocaleEntry?.id

      if (existingLocaleEntry) {
        let finalData = data
        if (data) {
          const fullData = { ...(existingLocaleEntry.data as any), ...data }
          const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, mappedContentType.fields, fullData, existingLocaleEntry.id, 'content', tx as any)

          const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_UPDATE, dataWithSlugs as Record<string, unknown>)
          if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
          finalData = hookResult.modifiedData || dataWithSlugs
        }

        if (status === "PUBLISHED" && status !== existingLocaleEntry.status) {
          const publishHook = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_PUBLISH, {
            id: existingLocaleEntry.id,
            data: (finalData || existingLocaleEntry.data) as Record<string, unknown>,
            currentStatus: existingLocaleEntry.status,
          })
          if (!publishHook.allowed) throw new Error(publishHook.rejectMessage || "Rejected by publish hook")
          finalData = publishHook.modifiedData || finalData
        }

        const updateData: any = { updatedBy: session.user.id }
        if (finalData) updateData.data = finalData
        if (status) {
          updateData.status = status
          if (status !== existingLocaleEntry.status) {
            updateData.publishedAt = status === "PUBLISHED" ? new Date() : (status === "DRAFT" ? null : existingLocaleEntry.publishedAt)
            updateData.scheduledAt = status === "SCHEDULED" ? effectiveScheduledAt : null
            updateData.archivedAt = status === "ARCHIVED" ? new Date() : null
          } else if (status === "SCHEDULED" && normalizedScheduledAt) {
            updateData.scheduledAt = normalizedScheduledAt
          }
        }

        await tx.contentEntry.update({ where: { id: existingLocaleEntry.id }, data: updateData })
      } else {
        // Translation flow
        if (!data) throw new Error("Data required for new translation")
        const dataWithSlugs = await processAutoSlugs(tenantId, contentType.id, mappedContentType.schemaFields, data as Record<string, any>, undefined, 'content', tx as any)
        
        const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, dataWithSlugs as Record<string, unknown>)
        if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
        let finalData = hookResult.modifiedData || dataWithSlugs

        if (status === "PUBLISHED") {
          const publishHook = await executeSyncHooks(
            tenantId,
            WebhookEvents.BEFORE_PUBLISH,
            finalData as Record<string, unknown>
          )
          if (!publishHook.allowed) throw new Error(publishHook.rejectMessage || "Rejected by publish hook")
          finalData = publishHook.modifiedData || finalData
        }

        const newEntry = await tx.contentEntry.create({
          data: {
            documentId,
            contentTypeId: baseEntry.contentTypeId,
            tenantId,
            locale: targetLocale,
            data: finalData as any,
            status: status as any || "DRAFT",
            publishedAt: status === "PUBLISHED" ? new Date() : null,
            scheduledAt: status === "SCHEDULED" ? effectiveScheduledAt : null,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }
        })
        targetEntryId = newEntry.id
      }

      // Sync Shared Fields
      if (data) {
        const sharedFields = mappedContentType.fields.filter(f => !f.localizable)
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

    const previousStatus = existingLocaleEntry?.status
    triggerWebhooks(tenantId, existingLocaleEntry ? WebhookEvents.CONTENT_UPDATED : WebhookEvents.CONTENT_CREATED, { entry: { id: entry?.id, contentType: contentTypeSlug, status: entry?.status } })
    if (entry?.status === "PUBLISHED" && previousStatus !== "PUBLISHED") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_PUBLISHED, { entry: { id: entry.id, contentType: contentTypeSlug, status: entry.status } })
    } else if (previousStatus === "PUBLISHED" && entry?.status === "DRAFT") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_UNPUBLISHED, { entry: { id: entry.id, contentType: contentTypeSlug, status: entry.status } })
    }
    
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({ tenantId, userId: session.user.id, action: existingLocaleEntry ? AuditAction.CONTENT_UPDATED : AuditAction.CONTENT_CREATED, entity: "content_entry", entityId: entry?.id || entryId, data: { contentType: contentTypeSlug, status: entry?.status, locale: targetLocale } })

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
    const failures: Array<{ entryId: string; error: string }> = []

    if (action === "delete") {
      if (access.role !== "admin" && access.role !== "owner") {
        return { error: "Only admins and owners can delete entries" }
      }
      for (const entry of entries) {
        const result = await deleteEntryAction(tenantSlug, contentTypeSlug, entry.id)
        if (result.success) successCount++
        else failures.push({ entryId: entry.id, error: result.error || "Delete failed" })
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
           if (result.success) successCount++
           else failures.push({ entryId: entry.id, error: result.error || `${action} failed` })
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
    if (!rbac.allowed) return { error: "Forbidden: Missing content.update permission" }

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
