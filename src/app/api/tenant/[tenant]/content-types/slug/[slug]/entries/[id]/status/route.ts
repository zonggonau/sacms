import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { changeStatusSchema } from "@/lib/validations"
import { canTransition, canRoleTransition } from "@/lib/content-workflow"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import type { ContentStatus } from "@prisma/client"

/**
 * PATCH /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/status
 * Change the status of a content entry (workflow transition)
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
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate body
    const result = await validateBody(request, changeStatusSchema)
    if ("error" in result) return result.error

    const { status: newStatus, comment, scheduledAt } = result.data

    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await db.contentType.findFirst({
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

    // Get entry
    const entry = await db.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const currentStatus = entry.status as ContentStatus

    // Validate transition
    if (!canTransition(currentStatus, newStatus as ContentStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          allowedTransitions: (await import("@/lib/content-workflow")).allowedTransitions(currentStatus),
        },
        { status: 400 }
      )
    }

    // Check role permission for this transition
    if (!canRoleTransition(currentStatus, newStatus as ContentStatus, access.role)) {
      return NextResponse.json(
        { error: `Your role (${access.role}) cannot perform this transition` },
        { status: 403 }
      )
    }

    // Execute sync hooks for publish
    if (newStatus === "PUBLISHED") {
      const hookResult = await executeSyncHooks(
        access.tenantId,
        WebhookEvents.BEFORE_PUBLISH,
        { id: entry.id, contentType: slug }
      )
      if (!hookResult.allowed) {
        return NextResponse.json(
          { error: hookResult.rejectMessage || "Rejected by hook" },
          { status: 403 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedBy: session.user.id,
    }

    if (comment) updateData.reviewComment = comment

    if (newStatus === "PUBLISHED") {
      updateData.publishedAt = new Date()
    }
    if (newStatus === "ARCHIVED") {
      updateData.archivedAt = new Date()
    }
    if (newStatus === "SCHEDULED") {
      if (!scheduledAt) {
        return NextResponse.json(
          { error: "scheduledAt is required when setting status to SCHEDULED" },
          { status: 400 }
        )
      }
      updateData.scheduledAt = scheduledAt
    }

    // Update
    const updated = await db.contentEntry.update({
      where: { id },
      data: updateData,
    })

    // Create version for status change
    const lastVersion = await db.contentVersion.findFirst({
      where: { contentEntryId: id },
      orderBy: { version: "desc" },
    })

    await db.contentVersion.create({
      data: {
        contentEntryId: id,
        version: (lastVersion?.version || 0) + 1,
        data: updated.data,
        changeType: newStatus === "PUBLISHED" ? "published" : `status_${newStatus.toLowerCase()}`,
        changedBy: session.user.id,
        changeSummary: comment || `Status changed: ${currentStatus} → ${newStatus}`,
        publishedAt: newStatus === "PUBLISHED" ? new Date() : null,
      },
    })

    // Fire webhook
    if (newStatus === "PUBLISHED") {
      triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_PUBLISHED, {
        entry: { id, contentType: slug, status: newStatus },
      })
    }

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: newStatus === "PUBLISHED" ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: id,
      data: { contentType: slug, from: currentStatus, to: newStatus, comment },
    })

    return NextResponse.json({
      entry: updated,
      transition: { from: currentStatus, to: newStatus },
    })
  } catch (error) {
    console.error("Error changing status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
