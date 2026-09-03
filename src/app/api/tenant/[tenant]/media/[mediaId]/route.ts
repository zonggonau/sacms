import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { deleteFromStorage } from "@/lib/r2"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** PATCH — update media metadata. */
export const PATCH = withStaffAuth(async (request, context, { access }) => {
  const { tenant: tenantSlug, mediaId } = await context.params
  const { name, alt, caption } = await request.json()

  const tenantDb = await getTenantDb(tenantSlug)
  const existing = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!existing) return apiError("not_found", { message: "Media not found" })

  const updated = await tenantDb.media.update({
    where: { id: mediaId },
    data: {
      name: name !== undefined ? name : undefined,
      alt: alt !== undefined ? alt : undefined,
      caption: caption !== undefined ? caption : undefined,
    },
  })
  return NextResponse.json({ media: updated })
})

/** DELETE — remove a media asset and its stored file. */
export const DELETE = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, mediaId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!media) return apiError("not_found", { message: "Media not found" })

  if (media.storageKey) await deleteFromStorage(media.storageKey)
  await tenantDb.media.delete({ where: { id: mediaId } })
  return NextResponse.json({ success: true })
})

/** GET — single media asset. */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, mediaId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media.findFirst({ where: { id: mediaId, tenantId: access.tenantId } })
  if (!media) return apiError("not_found", { message: "Media not found" })
  return NextResponse.json({ media })
})
