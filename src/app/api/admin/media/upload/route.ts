import { NextResponse } from "next/server"
import { uploadGlobalMedia } from "@/lib/r2"
import { isAllowedMimeType, isAllowedFileSize, validateMagicBytes, sniffMimeTypeFromBuffer, MAX_FILE_SIZE } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"

/**
 * POST /api/admin/media/upload — super-admin-only image upload for
 * platform-wide content (e.g. blog cover images and other "image" fields
 * on /admin/cms). No Media DB row is created (Media.tenantId has no
 * tenantId:null support, and there's no tenant left to anchor it to since
 * "SaCMS Global" was retired) — this just uploads the file and hands back
 * its URL, same shape every other "From URL" pick already produces.
 */
export const POST = withAdminAuth(async (request, context, { session }) => {
  const formData = await request.formData()
  const file = [...formData.getAll("files"), ...formData.getAll("file")]
    .find((value): value is File => typeof value !== "string")

  if (!file) return apiError("validation", { message: "No file provided" })

  if (!isAllowedFileSize(file.size)) {
    return apiError("validation", { message: `File size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024} MB` })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let mimeType = file.type || "application/octet-stream"
  if (mimeType === "application/octet-stream") {
    mimeType = sniffMimeTypeFromBuffer(buffer) ?? ""
  }
  if (!mimeType) {
    return apiError("validation", { message: "Unrecognized or corrupted file" })
  }
  if (!isAllowedMimeType(mimeType) || !validateMagicBytes(buffer, mimeType)) {
    return apiError("validation", { message: `Unsupported file type or invalid file signature (${mimeType})` })
  }

  try {
    const upload = await uploadGlobalMedia(buffer, file.name, mimeType)

    logAudit({
      userId: session.user.id,
      action: AuditAction.MEDIA_UPLOADED,
      entity: "GlobalMedia",
      data: { name: file.name, mimeType, size: file.size },
    })

    return NextResponse.json({
      url: upload.url,
      name: file.name.replace(/\.[^/.]+$/, ""),
      originalName: file.name,
      mimeType,
      size: file.size,
    })
  } catch (error) {
    console.error("[admin/media/upload] Failed to upload:", error)
    return apiError("internal", { message: "Failed to upload file to storage" })
  }
})
