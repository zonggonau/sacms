import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { deleteFromStorage } from "@/lib/r2"

// PATCH /api/tenant/[tenant]/media/[mediaId] - Update metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; mediaId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, mediaId } = await params
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { name, alt, caption } = body

    const updated = await db.media.update({
      where: { id: mediaId, tenantId: tenant.id },
      data: {
        name: name !== undefined ? name : undefined,
        alt: alt !== undefined ? alt : undefined,
        caption: caption !== undefined ? caption : undefined,
      },
    })

    return NextResponse.json({ media: updated })
  } catch (error) {
    console.error("Error updating media:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/tenant/[tenant]/media/[mediaId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; mediaId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, mediaId } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if media exists and belongs to tenant
    const media = await db.media.findFirst({
      where: {
        id: mediaId,
        tenantId: tenant.id,
      },
    })

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    // Delete from R2 or Local Storage
    if (media.storageKey) {
      await deleteFromStorage(media.storageKey)
    }

    await db.media.delete({
      where: { id: mediaId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting media:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/tenant/[tenant]/media/[mediaId] - Get single media
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; mediaId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, mediaId } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get media
    const media = await db.media.findFirst({
      where: {
        id: mediaId,
        tenantId: tenant.id,
      },
    })

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    return NextResponse.json({ media })
  } catch (error) {
    console.error("Error fetching media:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
