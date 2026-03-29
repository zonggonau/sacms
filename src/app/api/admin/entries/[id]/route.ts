import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDbById } from "@/lib/database"

/**
 * GET /api/admin/entries/[id]
 * Get a single entry by ID (super admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // 1. Resolve tenant DB
    const masterEntry = await db.contentEntry.findUnique({
      where: { id },
      select: { tenantId: true }
    })
    if (!masterEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    
    const tenantDb = await getTenantDbById(masterEntry.tenantId)

    const entry = await tenantDb.contentEntry.findUnique({
      where: { id },
      include: {
        contentType: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error("Error fetching entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/entries/[id]
 * Update an entry (super admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { data, status: entryStatus, locale, publish } = body

    // 1. Resolve tenant DB
    const masterEntry = await db.contentEntry.findUnique({
      where: { id },
      select: { tenantId: true }
    })
    if (!masterEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    
    const tenantDb = await getTenantDbById(masterEntry.tenantId)

    // Check if entry exists in the correct DB
    const existingEntry = await tenantDb.contentEntry.findUnique({
      where: { id },
    })

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Determine status and publication date
    let finalStatus = entryStatus || existingEntry.status
    let publishedAt = existingEntry.publishedAt

    if (publish) {
      finalStatus = "PUBLISHED"
      publishedAt = new Date()
    } else if (entryStatus === "DRAFT") {
      publishedAt = null
    }

    const updatedEntry = await tenantDb.contentEntry.update({
      where: { id },
      data: {
        ...(data && { data: typeof data === 'string' ? data : JSON.stringify(data) }),
        ...(finalStatus && { status: finalStatus }),
        ...(locale && { locale }),
        publishedAt,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json(updatedEntry)
  } catch (error) {
    console.error("Error updating entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/entries/[id]
 * Delete an entry (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // 1. Resolve tenant DB
    const masterEntry = await db.contentEntry.findUnique({
      where: { id },
      select: { tenantId: true }
    })
    if (!masterEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    
    const tenantDb = await getTenantDbById(masterEntry.tenantId)

    await tenantDb.contentEntry.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
