import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { isR2Configured, uploadToR2, uploadToLocal, deleteFromStorage } from "@/lib/r2"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif"
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, WEBP, or GIF image." },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image file is too large. Maximum allowed size is 5MB." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `avatar_${session.user.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

    let uploadResult
    if (await isR2Configured()) {
      uploadResult = await uploadToR2("avatars", buffer, filename, file.type)
    } else {
      uploadResult = await uploadToLocal("avatars", buffer, filename, file.type)
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { image: uploadResult.url },
      select: { id: true, name: true, email: true, image: true, role: true }
    })

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      user: updatedUser
    })
  } catch (error: any) {
    console.error("Error uploading avatar:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to upload profile picture" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { image: null },
      select: { id: true, name: true, email: true, image: true, role: true }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (error: any) {
    console.error("Error deleting avatar:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to remove profile picture" },
      { status: 500 }
    )
  }
}
