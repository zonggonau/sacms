import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { roleHasPermission, PERMISSIONS } from "@/lib/rbac/staff"
import { isAllowedMimeType, isAllowedFileSize, validateMagicBytes, sniffMimeTypeFromBuffer, MAX_FILE_SIZE } from "@/lib/validations"
import { deleteFromStorage, uploadTenantMedia, type UploadResult } from "@/lib/r2"
import type { Media } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"

// GET - list media for a workspace
export const GET = withStaffAuth(async (_request, context, { access }) => {
  if (!roleHasPermission(access.role, PERMISSIONS.MEDIA_READ)) {
    return apiError("forbidden", { message: "Missing media.read permission" })
  }
  const { tenant: tenantSlug } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const media = await tenantDb.media.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({
    media,
    permissions: {
      upload: roleHasPermission(access.role, PERMISSIONS.MEDIA_UPLOAD),
      delete: roleHasPermission(access.role, PERMISSIONS.MEDIA_DELETE),
    },
  })
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
  const files = [...formData.getAll("files"), ...formData.getAll("file")]
    .filter((value): value is File => typeof value !== "string")

  if (files.length === 0) return apiError("validation", { message: "No files provided" })

  const { checkStorageUpload } = await import("@/lib/plan-enforcement")
  const storage = await checkStorageUpload(tenantId, files.reduce((sum, file) => sum + file.size, 0))
  if (!storage.allowed) return apiError("plan_limit", { message: storage.message })

  // Validate the entire request before touching storage or creating any records.
  const validatedFiles: Array<{ file: File; buffer: Buffer; mimeType: string }> = []
  for (const file of files) {
    if (!isAllowedFileSize(file.size)) {
      return apiError("validation", { message: `${file.name}: file size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024} MB` })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    let mimeType = file.type || "application/octet-stream"
    if (mimeType === "application/octet-stream") {
      mimeType = file.name.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : sniffMimeTypeFromBuffer(buffer) ?? ""
    }
    if (!mimeType) {
      return apiError("validation", { message: `${file.name}: unrecognized or corrupted file` })
    }
    if (!isAllowedMimeType(mimeType) || !validateMagicBytes(buffer, mimeType)) {
      return apiError("validation", { message: `${file.name}: unsupported file type or invalid file signature (${mimeType})` })
    }
    validatedFiles.push({ file, buffer, mimeType })
  }

  const tenantDb = await getTenantDb(tenantSlug)
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true } })
  const uploadedMedia: Media[] = []
  const failures: Array<{ name: string; error: string }> = []

  for (const { file, buffer, mimeType } of validatedFiles) {
    let upload: UploadResult
    try {
      upload = await uploadTenantMedia(tenant ?? { id: tenantId, slug: tenantSlug }, buffer, file.name, mimeType)
    } catch (error) {
      console.error("[media POST] Failed to write object:", error)
      failures.push({ name: file.name, error: "Failed to upload file to storage" })
      continue
    }

    let media: Media | null
    try {
      media = await tenantDb.media.create({
        data: {
          tenantId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          originalName: file.name,
          mimeType,
          size: file.size,
          ...upload,
          uploadedBy: userId,
        },
      })
    } catch (error) {
      console.error("[media POST] Failed to record uploaded media:", error)
      media = null
      try {
        media = await tenantDb.media.findFirst({ where: { tenantId, storageKey: upload.storageKey } })
        if (!media) await deleteFromStorage(upload.storageKey, tenantId)
      } catch (cleanupError) {
        console.error("[media POST] Failed to reconcile uploaded object:", cleanupError)
      }
      if (!media) {
        failures.push({ name: file.name, error: "Failed to save media record" })
        continue
      }
    }

    uploadedMedia.push(media)
    triggerWebhooks(tenantId, WebhookEvents.MEDIA_UPLOADED, {
      media: { id: media.id, name: media.name, mimeType: media.mimeType, size: media.size, url: media.url },
    }).catch(() => {})
    logAudit({
      tenantId,
      userId,
      action: AuditAction.MEDIA_UPLOADED,
      entity: "Media",
      entityId: media.id,
      data: { name: media.name, mimeType: media.mimeType, size: media.size },
    })
  }

  return NextResponse.json({
    media: uploadedMedia,
    url: uploadedMedia[0]?.url,
    file: uploadedMedia[0],
    failures,
    error: uploadedMedia.length === 0 ? failures[0]?.error : undefined,
  }, { status: uploadedMedia.length > 0 ? 200 : 503 })
})
