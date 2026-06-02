"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { invalidatePattern } from "@/lib/cache"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"

export async function bulkContentAction(tenantSlug: string, contentTypeSlug: string, ids: string[], action: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

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

    let updatedCount = 0

    if (action === "publish" || action === "unpublish") {
      const newStatus = action === "publish" ? "PUBLISHED" : "DRAFT"
      const res = await tenantDb.contentEntry.updateMany({
        where: { id: { in: ids }, tenantId: access.tenantId, contentTypeId: contentType.id },
        data: { status: newStatus, publishedAt: newStatus === "PUBLISHED" ? new Date() : null, updatedBy: session.user.id }
      })
      updatedCount = res.count
    } else if (action === "delete") {
      const res = await tenantDb.contentEntry.deleteMany({
        where: { id: { in: ids }, tenantId: access.tenantId, contentTypeId: contentType.id }
      })
      updatedCount = res.count
    }

    if (updatedCount > 0) {
      invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
      
      logAudit({
        tenantId: access.tenantId,
        userId: session.user.id,
        action: action === "delete" ? AuditAction.CONTENT_DELETED : AuditAction.CONTENT_UPDATED,
        entity: "content_entry",
        entityId: "bulk",
        data: { count: updatedCount, action, contentType: contentTypeSlug },
      })
    }

    revalidatePath(`/cms/${tenantSlug}/content/${contentTypeSlug}`)
    return { success: true, count: updatedCount }
  } catch (error) {
    console.error("Bulk action error:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteContentEntryAction(tenantSlug: string, contentTypeSlug: string, entryId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    await tenantDb.contentEntry.delete({
      where: { id: entryId, tenantId: access.tenantId }
    })

    invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
    
    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_DELETED,
      entity: "content_entry",
      entityId: entryId,
      data: { contentType: contentTypeSlug },
    })

    revalidatePath(`/cms/${tenantSlug}/content/${contentTypeSlug}`)
    return { success: true }
  } catch (error) {
    console.error("Delete entry error:", error)
    return { error: "Internal server error" }
  }
}

export async function updateContentEntryStatusAction(tenantSlug: string, contentTypeSlug: string, entryId: string, newStatus: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const isPublished = newStatus === "PUBLISHED"

    const updated = await tenantDb.contentEntry.update({
      where: { id: entryId, tenantId: access.tenantId },
      data: {
        status: newStatus as any,
        publishedAt: isPublished ? new Date() : null,
        updatedBy: session.user.id
      }
    })

    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_UPDATED, {
      entry: { id: updated.id, contentType: contentTypeSlug, status: updated.status },
    })

    invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
    
    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: entryId,
      data: { contentType: contentTypeSlug, newStatus },
    })

    revalidatePath(`/cms/${tenantSlug}/content/${contentTypeSlug}`)
    return { success: true }
  } catch (error) {
    console.error("Update status error:", error)
    return { error: "Internal server error" }
  }
}
