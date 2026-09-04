import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { deleteFromStorage } from "@/lib/r2"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { roleHasPermission, PERMISSIONS } from "@/lib/rbac/staff"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"

/** PATCH — update media metadata (needs media.upload). */
export const PATCH = withStaffAuth(async (request, context, { access }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_UPLOAD)) {
    return apiError("forbidden", { message: "Missing media.upload permission" })
  }
  const { tenant: tenantSlug, mediaId } = await context.params
  const body = await request.json().catch(() => ({}))
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : undefined)
  const name = str(body.name)
  const alt = str(body.alt)
  const caption = str(body.caption)

  const tenantDb = await getTenantDb(tenantSlug)
  const existing = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!existing) return apiError("not_found", { message: "Media not found" })

  const updated = await tenantDb.media.update({
    where: { id: mediaId },
    data: { name, alt, caption },
  })
  return NextResponse.json({ media: updated })
})

/** DELETE — remove a media asset and its stored file (needs media.delete). */
export const DELETE = withStaffAuth(async (_request, context, { access }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_DELETE)) {
    return apiError("forbidden", { message: "Missing media.delete permission" })
  }
  const { tenant: tenantSlug, mediaId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!media) return apiError("not_found", { message: "Media not found" })

  if (media.storageKey) {
    try {
      await deleteFromStorage(media.storageKey)
    } catch (err) {
      console.error("[media DELETE] storage delete failed:", err)
    }
  }
  await tenantDb.media.delete({ where: { id: mediaId } })

  triggerWebhooks(access.tenantId, WebhookEvents.MEDIA_DELETED, {
    media: { id: media.id, name: media.name },
  }).catch(() => {})

  return NextResponse.json({ success: true })
})

/** GET — single media asset (needs media.read). */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_READ)) {
    return apiError("forbidden", { message: "Missing media.read permission" })
  }
  const { tenant: tenantSlug, mediaId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!media) return apiError("not_found", { message: "Media not found" })
  return NextResponse.json({ media })
})
