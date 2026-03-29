import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
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
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })

    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

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
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const existingEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })
    if (!existingEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const result = await validateBody(request, updateContentEntrySchema)
    if ("error" in result) return result.error
    const { data, publish } = result.data

    let changeType = "updated"
    if (publish === true && !existingEntry.publishedAt) changeType = "published"
    else if (publish === false && existingEntry.publishedAt) changeType = "unpublished"

    const entry = await tenantDb.$transaction(async (tx) => {
      const updatedEntry = await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: JSON.stringify(data),
          publishedAt: publish === true ? new Date() : publish === false ? null : existingEntry.publishedAt,
          updatedBy: session.user.id,
        },
      })

      const latestVersion = await tx.contentVersion.findFirst({
        where: { contentEntryId: entryId },
        orderBy: { version: "desc" },
        select: { version: true },
      })

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

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    revalidatePath("/")

    logAudit({
      tenantId: tenantId,
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
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    await tenantDb.contentEntry.delete({ where: { id: entryId } })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    revalidatePath("/")

    logAudit({
      tenantId: tenantId,
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
