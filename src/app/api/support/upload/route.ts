import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isR2Configured, uploadToR2, uploadToLocal } from "@/lib/r2"
import { isAllowedMimeType, isAllowedFileSize, validateMagicBytes, MAX_FILE_SIZE } from "@/lib/validations"

export const dynamic = "force-dynamic"

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

    // Size validation: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file maksimal 10MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name || `support-attachment-${Date.now()}`
    const mimeType = file.type || "application/octet-stream"
    const tenantSlug = "global"

    let fileUrl = ""
    if (isR2Configured()) {
      const r2Res = await uploadToR2(tenantSlug, buffer, filename, mimeType)
      fileUrl = r2Res.url
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
