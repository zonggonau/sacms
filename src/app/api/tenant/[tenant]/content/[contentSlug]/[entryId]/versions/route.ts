import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

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

    const versions = await db.contentVersion.findMany({
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

    const body = await request.json()
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json({ error: "versionId is required" }, { status: 400 })
    }

    // Find the version to restore
    const targetVersion = await db.contentVersion.findFirst({
      where: { id: versionId, contentEntryId: entryId },
    })
    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // Restore and create a new version record
    const entry = await db.$transaction(async (tx) => {
      const updatedEntry = await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: targetVersion.data,
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
          data: targetVersion.data,
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
