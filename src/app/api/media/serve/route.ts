import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import fs from "fs"
import path from "path"

/**
 * GET /api/media/serve?key=...
 * Serves private media files after permission check.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")
    if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 })

    // 1. Identify tenant from key (Format: upload/tenant-slug/...)
    const parts = key.split("/")
    const tenantSlug = parts[1]
    if (!tenantSlug) return NextResponse.json({ error: "Invalid key format" }, { status: 400 })

    // 2. Check if user belongs to this tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true }
    })

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id }
    })

    if (!membership && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 3. Serve the file from local storage
    const fullPath = path.join(process.cwd(), "public", key)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(fullPath)
    
    // Determine content type (basic)
    const ext = path.extname(fullPath).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4"
    }
    const contentType = contentTypeMap[ext] || "application/octet-stream"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600"
      }
    })
  } catch (error) {
    console.error("Error serving private media:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
