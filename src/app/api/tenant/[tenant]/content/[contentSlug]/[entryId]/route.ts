import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateBody } from "@/lib/validate"
import { updateContentEntrySchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

type Params = {
  tenant: string
  contentSlug: string
  entryId: string
}

// GET single entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = await db.contentType.findUnique({ where: { slug: contentSlug } })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const entry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenant.id },
    })

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error fetching entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = await db.contentType.findUnique({ where: { slug: contentSlug } })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const existingEntry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenant.id },
    })
    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const result = await validateBody(request, updateContentEntrySchema)
    if ("error" in result) return result.error
    const { data, publish } = result.data

    // Determine change type
    let changeType = "updated"
    if (publish === true && !existingEntry.publishedAt) changeType = "published"
    else if (publish === false && existingEntry.publishedAt) changeType = "unpublished"

    const entry = await db.$transaction(async (tx) => {
      const updatedEntry = await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: JSON.stringify(data),
          publishedAt: publish === true ? new Date() : publish === false ? null : existingEntry.publishedAt,
          updatedBy: session.user.id,
        },
      })

      // Get latest version number
      const latestVersion = await tx.contentVersion.findFirst({
        where: { contentEntryId: entryId },
        orderBy: { version: "desc" },
        select: { version: true },
      })

      // Save new version
      await tx.contentVersion.create({
        data: {
          contentEntryId: entryId,
          version: (latestVersion?.version ?? 0) + 1,
          data: JSON.stringify(data),
          publishedAt: updatedEntry.publishedAt,
          changeType,
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })

    // Invalidate Public API Cache for this content type
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    
    // Clear Next.js cache for homepage
    revalidatePath("/")

    logAudit({
      tenantId: tenant.id,
      userId: session.user.id,
      action: changeType === "published" ? AuditAction.CONTENT_PUBLISHED
        : changeType === "unpublished" ? AuditAction.CONTENT_UNPUBLISHED
        : AuditAction.CONTENT_UPDATED,
      entity: "ContentEntry",
      entityId: entryId,
      data: { contentType: contentSlug, changeType },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error updating entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentType = await db.contentType.findUnique({ where: { slug: contentSlug } })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const entry = await db.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenant.id },
    })
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    await db.contentEntry.delete({ where: { id: entryId } })

    // Invalidate Public API Cache for this content type
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    
    // Clear Next.js cache for homepage
    revalidatePath("/")

    logAudit({
      tenantId: tenant.id,
      userId: session.user.id,
      action: AuditAction.CONTENT_DELETED,
      entity: "ContentEntry",
      entityId: entryId,
      data: { contentType: contentSlug },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
