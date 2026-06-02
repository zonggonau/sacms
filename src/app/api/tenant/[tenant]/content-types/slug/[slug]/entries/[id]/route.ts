import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { updateEntrySchema } from "@/lib/validations"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateContentEntry } from "@/lib/content-validations"
import { invalidatePattern } from "@/lib/cache"
import { processAutoSlugs } from "@/lib/slug"
import { canUserTransition } from "@/lib/content-workflow"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]
 * Get a specific entry with versions and i18n support
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || "en"

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const rbac = await checkPermission(tenant, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden: Missing content.read permission" }, { status: 403 })

    // Use dynamic DB client (shared or dedicated)
    const tenantDb = await getTenantDb(tenant)

    // Get content type by slug from tenant database
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Find the requested entry first to get its documentId
    const baseEntry = await tenantDb.contentEntry.findFirst({
      where: {
        id,
        contentTypeId: contentType.id,
        tenantId: access.tenantId,
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    })

    if (!baseEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const documentId = baseEntry.documentId || baseEntry.id

    // Now find the entry with the requested locale
    let entry = await tenantDb.contentEntry.findFirst({
      where: { documentId, locale, tenantId: access.tenantId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { version: true },
        },
      },
    })

    // If not found, we return the base entry but mark it as a new translation template
    let isNewTranslation = false
    if (!entry) {
      entry = baseEntry
      isNewTranslation = true
    }

    return NextResponse.json({ entry, isNewTranslation, documentId })
  } catch (error) {
    console.error("Error fetching entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]
 * Upsert a translation for an entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, slug: contentTypeSlug, id: entryId } = await params
    
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden: Missing content.update permission" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const result = await validateBody(request, updateEntrySchema)
    if ("error" in result) return result.error
    
    const { data, status: requestedStatus, locale: rawLocale, scheduledAt } = result.data
    const locale = rawLocale || "en"

    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    // Find base entry to get documentId
    const baseEntry = await tenantDb.contentEntry.findUnique({
      where: { id: entryId }
    })
    if (!baseEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const documentId = baseEntry.documentId || baseEntry.id

    // Check if this locale version already exists
    const existingLocaleEntry = await tenantDb.contentEntry.findFirst({
      where: { documentId, locale, tenantId }
    })

    if (!existingLocaleEntry) {
      // Enforce content entry limit based on workspace plan for new translation
      const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
      const enforcement = await enforcePlanLimit(tenantId, "content_entries")
      if (!enforcement.allowed) {
        return NextResponse.json({ 
          error: enforcement.message,
          current: enforcement.current,
          max: enforcement.max,
          plan: enforcement.planSlug,
        }, { status: 403 })
      }
    }

    // --- Dynamic Schema Validation ---
    if (data) {
      const validation = await validateContentEntry(contentType.fields as any, data)
      if (!validation.success) {
        return NextResponse.json({ 
          error: "Validation failed", 
          details: validation.errors 
        }, { status: 400 })
      }
      Object.assign(data, validation.data)
    }

    // Upsert the entry for this specific locale
    const entry = await tenantDb.$transaction(async (tx) => {
      let targetEntryId = existingLocaleEntry?.id

      if (existingLocaleEntry) {
        // Process auto-slugs
        const fullData = { ...(existingLocaleEntry.data as any), ...data }
        const dataWithSlugs = await processAutoSlugs(
          tenantId,
          contentType.id,
          contentType.fields,
          fullData,
          existingLocaleEntry.id,
          'content',
          tx as any
        )

        // Execute sync hooks (beforeUpdate)
        const hookResult = await executeSyncHooks(
          tenantId,
          WebhookEvents.BEFORE_UPDATE,
          dataWithSlugs as Record<string, unknown>
        )
        if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
        const finalData = hookResult.modifiedData || dataWithSlugs

        // Update existing
        await tx.contentEntry.update({
          where: { id: existingLocaleEntry.id },
          data: {
            data: finalData as any,
            status: requestedStatus as any || existingLocaleEntry.status,
            publishedAt: requestedStatus === "PUBLISHED" ? new Date() : (requestedStatus === "DRAFT" ? null : existingLocaleEntry.publishedAt),
            scheduledAt: requestedStatus === "SCHEDULED" ? scheduledAt : (requestedStatus ? null : existingLocaleEntry.scheduledAt),
            updatedBy: session.user.id,
          },
        })
      } else {
        // Process auto-slugs for new translation
        const dataWithSlugs = await processAutoSlugs(
          tenantId,
          contentType.id,
          contentType.fields,
          data as Record<string, any>,
          undefined,
          'content',
          tx as any
        )

        // Execute sync hooks (beforeCreate)
        const hookResult = await executeSyncHooks(
          tenantId,
          WebhookEvents.BEFORE_CREATE,
          dataWithSlugs as Record<string, unknown>
        )
        if (!hookResult.allowed) throw new Error(hookResult.rejectMessage || "Rejected by hook")
        const finalData = hookResult.modifiedData || dataWithSlugs

        // Create new translation
        const newEntry = await tx.contentEntry.create({
          data: {
            documentId,
            contentTypeId: baseEntry.contentTypeId,
            tenantId,
            locale,
            data: finalData as any,
            status: requestedStatus as any || "DRAFT",
            publishedAt: requestedStatus === "PUBLISHED" ? new Date() : null,
            scheduledAt: requestedStatus === "SCHEDULED" ? scheduledAt : null,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          }
        })
        targetEntryId = newEntry.id
      }

      // Sync Shared Fields (localizable: false) across all translations of this document
      if (data) {
        const sharedFields = contentType.fields.filter(f => !f.localizable)
        if (sharedFields.length > 0) {
          const translations = await tx.contentEntry.findMany({
            where: { documentId, NOT: { id: targetEntryId! } }
          })

          for (const trans of translations) {
            let transData = typeof trans.data === 'string' ? JSON.parse(trans.data) : trans.data
            let updated = false
            for (const field of sharedFields) {
              if (data[field.slug] !== transData[field.slug]) {
                transData[field.slug] = data[field.slug]
                updated = true
              }
            }
            if (updated) {
              await tx.contentEntry.update({
                where: { id: trans.id },
                data: { data: transData as any }
              })
            }
          }
        }
      }

      // Create version
      const updatedEntry = await tx.contentEntry.findUnique({ where: { id: targetEntryId! } })
      const lastVersion = await tx.contentVersion.findFirst({
        where: { contentEntryId: targetEntryId! },
        orderBy: { version: "desc" },
      })

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

    triggerWebhooks(tenantId, existingLocaleEntry ? WebhookEvents.CONTENT_UPDATED : WebhookEvents.CONTENT_CREATED, {
      entry: { id: entry?.id, contentType: contentTypeSlug, status: entry?.status },
    })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)
    
    // Audit log
    const auditData: Record<string, any> = { contentType: contentTypeSlug, status: entry?.status, locale }
    if (requestedStatus && requestedStatus !== baseEntry.status) {
      auditData.transition = {
        from: baseEntry.status,
        to: requestedStatus,
        comment: result.data.comment || null
      }
    }

    logAudit({
      tenantId: tenantId,
      userId: session.user.id,
      action: existingLocaleEntry ? AuditAction.CONTENT_UPDATED : AuditAction.CONTENT_CREATED,
      entity: "content_entry",
      entityId: entry?.id || entryId,
      data: auditData,
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error updating/translating entry:", error)
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]
 * Update a specific entry with validation and versioning
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Validate body
    const result = await validateBody(request, updateEntrySchema)
    if ("error" in result) return result.error

    const { data, status, scheduledAt } = result.data

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Get content type by slug from tenant database
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // --- Dynamic Schema Validation ---
    if (data) {
      const validation = await validateContentEntry(contentType.fields as any, data)
      if (!validation.success) {
        return NextResponse.json({ 
          error: "Validation failed", 
          details: validation.errors 
        }, { status: 400 })
      }
      // Replace data with validated/cleaned data
      Object.assign(data, validation.data)
    }
    // --------------------------------

    // Check entry exists and belongs to this tenant in tenant database
    const existing = await tenantDb.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Enforce workflow state machine if status is changing
    if (status && status !== existing.status) {
      const member = await db.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId: access.tenantId, userId: session.user.id } }
      })

      if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

      // Fetch custom permissions for the custom role if it's not a standard one
      let roleCustomPerms: string[] | null = null
      if (member.customPermissions && Array.isArray(member.customPermissions)) {
        roleCustomPerms = member.customPermissions as string[]
      } else {
        const isStandardRole = ["admin", "owner", "editor", "viewer"].includes(member.role)
        if (!isStandardRole) {
          const perms = await db.rolePermission.findMany({
            where: { tenantId: access.tenantId, roleId: member.role, granted: true },
            include: { permission: true }
          })
          roleCustomPerms = perms.map(p => p.permission.name)
        }
      }

      const canTransition = canUserTransition(existing.status as any, status as any, member.role, roleCustomPerms)
      if (!canTransition) {
        return NextResponse.json({ error: `You do not have permission to change status from ${existing.status} to ${status}` }, { status: 403 })
      }
    }

    // Process auto-generated slugs
    if (data) {
      const fullData = { ...(existing.data as any), ...data }
      const dataWithSlugs = await processAutoSlugs(
        access.tenantId,
        contentType.id,
        contentType.fields,
        fullData,
        id,
        'content',
        tenantDb
      )
      // Only update fields that were in the original data or were auto-generated slugs
      for (const field of contentType.fields) {
        if (dataWithSlugs[field.slug] !== (existing.data as any)[field.slug]) {
          data[field.slug] = dataWithSlugs[field.slug]
        }
      }
    }

    // Execute sync hooks (beforeUpdate)
    if (data) {
      const hookResult = await executeSyncHooks(
        access.tenantId,
        WebhookEvents.BEFORE_UPDATE,
        data as Record<string, unknown>
      )
      if (!hookResult.allowed) {
        return NextResponse.json(
          { error: hookResult.rejectMessage || "Rejected by hook" },
          { status: 403 }
        )
      }
      if (hookResult.modifiedData) {
        Object.assign(data, hookResult.modifiedData)
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedBy: session.user.id,
    }
    if (data) updateData.data = data as any
    if (status) updateData.status = status
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt

    // Update entry in tenant database
    const entry = await tenantDb.contentEntry.update({
      where: { id },
      data: updateData,
    })

    // Create version in tenant database
    const lastVersion = await tenantDb.contentVersion.findFirst({
      where: { contentEntryId: id },
      orderBy: { version: "desc" },
    })

    await tenantDb.contentVersion.create({
      data: {
        contentEntryId: id,
        version: (lastVersion?.version || 0) + 1,
        data: entry.data as any,
        changeType: "updated",
        changedBy: session.user.id,
      },
    })

    // Fire async webhook
    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_UPDATED, {
      entry: { id, contentType: slug, status: entry.status },
    })

    // Invalidate public API cache for this content type
    invalidatePattern(`public_api:${tenant}:${slug}:*`).catch(() => {})

    // Audit log
    const auditData: Record<string, any> = { contentType: slug, status: entry.status }
    if (status && status !== existing.status) {
      auditData.transition = {
        from: existing.status,
        to: status,
        comment: result.data.comment || null
      }
    }

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: entry.id,
      data: auditData,
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error updating entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]
 * Delete a specific entry with sync hook support
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can delete entries" },
        { status: 403 }
      )
    }

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Get content type by slug from tenant database
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Check if entry exists and belongs to this tenant in tenant database
    const entry = await tenantDb.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Execute sync hooks (beforeDelete)
    const hookResult = await executeSyncHooks(
      access.tenantId,
      WebhookEvents.BEFORE_DELETE,
      { id: entry.id, contentType: slug }
    )
    if (!hookResult.allowed) {
      return NextResponse.json(
        { error: hookResult.rejectMessage || "Rejected by hook" },
        { status: 403 }
      )
    }

    // Delete the entry in tenant database
    await tenantDb.contentEntry.delete({ where: { id } })

    // Fire async webhook
    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_DELETED, {
      entry: { id: entry.id, contentType: slug },
    })

    // Invalidate public API cache for this content type
    invalidatePattern(`public_api:${tenant}:${slug}:*`).catch(() => {})

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_DELETED,
      entity: "content_entry",
      entityId: id,
      data: { contentType: slug },
    })

    return NextResponse.json({ message: "Entry deleted successfully" })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}