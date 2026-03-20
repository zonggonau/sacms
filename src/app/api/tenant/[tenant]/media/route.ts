import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { isAllowedMimeType, isAllowedFileSize, validateMagicBytes, MAX_FILE_SIZE } from "@/lib/validations"
import { isR2Configured, uploadToR2, uploadToLocal } from "@/lib/r2"
import type { Media } from "@prisma/client"

// GET - List all media for tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    
    // RBAC Check
    const { allowed, tenantId } = await checkPermission(tenantSlug, PERMISSIONS.MEDIA_READ)
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get media
    const media = await db.media.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error("Error fetching media:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST - Upload media
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params

    // RBAC Check
    const { allowed, tenantId, userId } = await checkPermission(tenantSlug, PERMISSIONS.MEDIA_UPLOAD)
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const uploadedMedia: Media[] = []

    for (const file of files) {
      // Validate MIME type
      const mimeType = file.type || "application/octet-stream"
      if (!isAllowedMimeType(mimeType)) {
        return NextResponse.json(
          { error: `File type not allowed: ${mimeType}` },
          { status: 400 }
        )
      }

      // Validate file size
      if (!isAllowedFileSize(file.size)) {
        return NextResponse.json(
          { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        )
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Validate magic bytes (signature)
      if (!validateMagicBytes(buffer, mimeType)) {
        return NextResponse.json(
          { error: `Invalid file signature for type: ${mimeType}` },
          { status: 400 }
        )
      }

      let url: string
      let storageKey: string | null = null
      let thumbnailUrl: string | null = null
      let mediumUrl: string | null = null
      let width: number | null = null
      let height: number | null = null

      try {
        if (isR2Configured()) {
          // Upload to R2 cloud storage
          const result = await uploadToR2(tenantSlug, buffer, file.name, mimeType)
          url = result.url
          storageKey = result.storageKey
          thumbnailUrl = result.thumbnailUrl
          mediumUrl = result.mediumUrl
          width = result.width
          height = result.height
        } else {
          // Fallback: Store on local disk instead of base64
          const result = await uploadToLocal(tenantSlug, buffer, file.name, mimeType)
          url = result.url
          storageKey = result.storageKey
          thumbnailUrl = result.thumbnailUrl
          width = result.width
          height = result.height
        }
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || "Failed to upload file to storage" },
          { status: 503 }
        )
      }

      const media = await db.media.create({
        data: {
          tenantId: tenantId!,
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
          uploadedBy: userId,
        },
      })

      uploadedMedia.push(media)
    }

    return NextResponse.json({ media: uploadedMedia })
  } catch (error) {
    console.error("Error uploading media:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
