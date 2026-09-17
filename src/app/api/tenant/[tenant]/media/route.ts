import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { roleHasPermission, PERMISSIONS } from "@/lib/rbac/staff"
import { isAllowedMimeType, isAllowedFileSize, validateMagicBytes, MAX_FILE_SIZE } from "@/lib/validations"
import { uploadTenantMedia } from "@/lib/r2"
import type { Media } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"

// GET - list media for a workspace
export const GET = withStaffAuth(async (_request, context, { access }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_READ)) {
    return apiError("forbidden", { message: "Missing media.read permission" })
  }
  const { tenant: tenantSlug } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media
    .findMany({ where: { tenantId: access.tenantId }, orderBy: { createdAt: "desc" } })
    .catch(() => [])
  return NextResponse.json({ media })
})

// POST - upload media
export const POST = withStaffAuth(async (request, context, { access, session }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_UPLOAD)) {
    return apiError("forbidden", { message: "Missing media.upload permission" })
  }
  const { tenant: tenantSlug } = await context.params
  const tenantId = access.tenantId
  const userId = session.user.id

    const formData = await request.formData()
    const filesRaw = (formData.getAll("files") as File[]).concat(formData.getAll("file") as File[])
    const singleFile = formData.get("file") as File | null
    const files = filesRaw.filter((f) => f && typeof f === "object" && typeof f.arrayBuffer === "function")

    if (files.length === 0 && singleFile && typeof singleFile.arrayBuffer === "function") {
      files.push(singleFile)
    }

    if (!files || files.length === 0) return apiError("validation", { message: "No files provided" })

    const tenantDb = await getTenantDb(tenantSlug)
    const uploadedMedia: Media[] = []

    // Storage quota of this workspace, counted in bytes including the files being uploaded.
    // Applies to every uploader, super admins included.
    const { checkStorageUpload } = await import("@/lib/plan-enforcement")
    const newFilesSizeBytes = files.reduce((acc, file) => acc + file.size, 0)
    const storage = await checkStorageUpload(tenantId, newFilesSizeBytes)
    if (!storage.allowed) {
      return apiError("plan_limit", { message: storage.message })
    }

    for (const file of files) {
      let mimeType = file.type || "application/octet-stream"
      if (file.name.endsWith(".docx") && (mimeType === "application/octet-stream" || !mimeType)) {
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
      if (!isAllowedMimeType(mimeType)) return NextResponse.json({ error: `File type not allowed: ${mimeType}` }, { status: 400 })

      if (!isAllowedFileSize(file.size)) return NextResponse.json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      if (!validateMagicBytes(buffer, mimeType)) return NextResponse.json({ error: `Invalid file signature for type: ${mimeType}` }, { status: 400 })

      let url: string
      let storageKey: string | null = null
      let thumbnailUrl: string | null = null
      let mediumUrl: string | null = null
      let width: number | null = null
      let height: number | null = null
      let variantBytes = 0

      try {
        const tenantRow = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true } })
        const result = await uploadTenantMedia(tenantRow ?? { id: tenantId, slug: tenantSlug }, buffer, file.name, mimeType)
        url = result.url
        storageKey = result.storageKey
        thumbnailUrl = result.thumbnailUrl
        mediumUrl = result.mediumUrl
        width = result.width
        height = result.height
        variantBytes = result.variantBytes
      } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to upload file to storage" }, { status: 503 })
      }

      // Create record in the tenant-specific database
      const media = await tenantDb.media.create({
        data: {
          tenantId: tenantId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          originalName: file.name,
          mimeType,
          size: file.size,
          url,
          storageKey,
          thumbnailUrl,
          mediumUrl,
          width,
          height,
          variantBytes,
          uploadedBy: userId,
        },
      })

      uploadedMedia.push(media)

      triggerWebhooks(tenantId, WebhookEvents.MEDIA_UPLOADED, {
        media: { id: media.id, name: media.name, mimeType: media.mimeType, size: media.size, url: media.url },
      }).catch(() => {})
    }

    return NextResponse.json({
      media: uploadedMedia,
      url: uploadedMedia[0]?.url,
      file: uploadedMedia[0],
    })
})
