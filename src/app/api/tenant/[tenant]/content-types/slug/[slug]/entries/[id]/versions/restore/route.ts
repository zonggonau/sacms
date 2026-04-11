import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/versions/restore
 * Restore a specific version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, slug, id } = await params
    const { versionId } = await request.json()

    if (!versionId) {
      return NextResponse.json({ error: "Version ID is required" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Resolve tenant DB
    const tenantDb = await getTenantDb(tenantSlug)

    // Get the version data (Versions are usually in the same DB as the entry)
    const version = await tenantDb.contentVersion.findFirst({
      where: {
        id: versionId,
        contentEntryId: id,
      }
    })

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // Update the entry with version data
    const updatedEntry = await tenantDb.contentEntry.update({
      where: { id },
      data: {
        data: version.data as any,
        updatedBy: session.user.id,
      }
    })

    // Create a new version record for this restore action
    const lastVersionNum = await tenantDb.contentVersion.findFirst({
      where: { contentEntryId: id },
      orderBy: { version: "desc" },
    })

    await tenantDb.contentVersion.create({
      data: {
        contentEntryId: id,
        version: (lastVersionNum?.version || 0) + 1,
        data: updatedEntry.data as any,
        changeType: "restored",
        changeSummary: `Restored from version ${version.version}`,
        changedBy: session.user.id,
      }
    })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: id,
      data: { contentType: slug, action: "restore", fromVersion: version.version },
    })

    return NextResponse.json({ entry: updatedEntry })
  } catch (error) {
    console.error("Error restoring version:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
