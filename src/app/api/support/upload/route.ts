import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isObjectStorageConfigured, uploadToSharedStorage, uploadToLocal } from "@/lib/r2"
import { isAllowedFileSize, validateMagicBytes, sniffMimeTypeFromBuffer, MAX_FILE_SIZE } from "@/lib/validations/media"

export const dynamic = "force-dynamic"

// Support attachments are narrower than the general media library's
// whitelist (no video/zip/docx here) — screenshots plus small text-based
// error logs, matching the input's own accept="image/*,.pdf,.txt,.log,.json".
const IMAGE_AND_PDF_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "application/pdf"])
const PLAIN_TEXT_EXTENSIONS = [".txt", ".log", ".json"]

/** Plain text has no magic-byte signature — reject anything that isn't printable UTF-8 text. */
function looksLikePlainText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192)
  for (const byte of sample) {
    // Allow tab/LF/CR plus printable ASCII and UTF-8 continuation bytes;
    // reject NUL and other control bytes that indicate real binary content.
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue
    if (byte >= 0x20) continue
    return false
  }
  return true
}

// POST /api/support/upload - Upload screenshots / error logs for support chat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 })
    }

    if (!isAllowedFileSize(file.size)) {
      return NextResponse.json({ error: `Ukuran file maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name || `support-attachment-${Date.now()}`
    const lowerName = filename.toLowerCase()
    let mimeType = file.type || "application/octet-stream"

    if (IMAGE_AND_PDF_TYPES.has(mimeType)) {
      if (!validateMagicBytes(buffer, mimeType)) {
        return NextResponse.json({ error: `Signature file tidak valid untuk tipe: ${mimeType}` }, { status: 400 })
      }
    } else if (
      mimeType === "text/plain" ||
      mimeType === "application/json" ||
      mimeType === "application/octet-stream" ||
      PLAIN_TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    ) {
      // A browser labels .log files "application/octet-stream" or leaves
      // the type blank — sniff for a real signature first (catches someone
      // renaming an image/PDF to .log), then fall back to a plain-text check.
      const sniffed = sniffMimeTypeFromBuffer(buffer)
      if (sniffed) {
        mimeType = sniffed
      } else if (looksLikePlainText(buffer)) {
        mimeType = mimeType === "application/json" ? "application/json" : "text/plain"
      } else {
        return NextResponse.json({ error: "Tidak bisa memverifikasi konten file — format tidak dikenali atau rusak." }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: `Tipe file tidak diizinkan: ${mimeType}` }, { status: 400 })
    }

    const tenantSlug = "global"

    let fileUrl = ""
    if (isObjectStorageConfigured()) {
      const uploadRes = await uploadToSharedStorage(tenantSlug, buffer, filename, mimeType)
      fileUrl = uploadRes.url
    } else {
      const localRes = await uploadToLocal(tenantSlug, buffer, filename, mimeType)
      fileUrl = localRes.url
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error: any) {
    console.error("[Support Attachment Upload Error]:", error)
    return NextResponse.json({ error: error.message || "Gagal mengunggah berkas" }, { status: 500 })
  }
}
