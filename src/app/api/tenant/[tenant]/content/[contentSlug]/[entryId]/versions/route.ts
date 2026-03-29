import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

type Params = {
  tenant: string
  contentSlug: string
  entryId: string
}

// GET /api/tenant/[tenant]/content/[contentSlug]/[entryId]/versions - Get version history
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
        OR: [{ tenantId: tenantId }, { tenantId: null }]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const versions = await tenantDb.contentVersion.findMany({
      where: { contentEntryId: entryId },
      orderBy: { version: "desc" },
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error("Error fetching versions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/content/[contentSlug]/[entryId]/versions - Restore a version
export async function POST(
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
        OR: [{ tenantId: tenantId }, { tenantId: null }]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const existingEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })
    if (!existingEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const body = await request.json()
    const { versionId } = body

    if (!versionId) return NextResponse.json({ error: "versionId is required" }, { status: 400 })

    // Find the version to restore in the tenant-specific DB
    const targetVersion = await tenantDb.contentVersion.findFirst({
      where: { id: versionId, contentEntryId: entryId },
    })
    if (!targetVersion) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    // Restore and create a new version record
    const entry = await tenantDb.$transaction(async (tx) => {
      const updatedEntry = await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: targetVersion.data as any,
          publishedAt: existingEntry.publishedAt,
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
          data: targetVersion.data as any,
          publishedAt: existingEntry.publishedAt,
          changeType: "updated",
          changedBy: session.user.id,
          changeSummary: `Restored from version ${targetVersion.version}`,
        },
      })

      return updatedEntry
    })

    return NextResponse.json({ entry, restoredFromVersion: targetVersion.version })
  } catch (error) {
    console.error("Error restoring version:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
