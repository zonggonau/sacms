import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { updateEntrySchema } from "@/lib/validations"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateContentEntry } from "@/lib/content-validations"
import { invalidatePattern } from "@/lib/cache"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]
 * Get a specific entry with versions
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

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get content type by slug
    const contentType = await db.contentType.findUnique({
      where: { slug },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Get entry
    const entry = await db.contentEntry.findFirst({
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

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error fetching entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
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

    // Get content type by slug
    const contentType = await db.contentType.findUnique({
      where: { slug },
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

    // Check entry exists and belongs to this tenant
    const existing = await db.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
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
    if (data) updateData.data = JSON.stringify(data)
    if (status) updateData.status = status
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt

    // Update entry
    const entry = await db.contentEntry.update({
      where: { id },
      data: updateData,
    })

    // Create version
    const lastVersion = await db.contentVersion.findFirst({
      where: { contentEntryId: id },
      orderBy: { version: "desc" },
    })

    await db.contentVersion.create({
      data: {
        contentEntryId: id,
        version: (lastVersion?.version || 0) + 1,
        data: entry.data,
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
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: entry.id,
      data: { contentType: slug, status: entry.status },
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

    // Get content type by slug to verify it exists
    const contentType = await db.contentType.findUnique({
      where: { slug },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Check if entry exists and belongs to this tenant
    const entry = await db.contentEntry.findFirst({
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

    // Delete the entry
    await db.contentEntry.delete({ where: { id } })

    // Fire async webhook
    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_DELETED, {
      entry: { id, contentType: slug },
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