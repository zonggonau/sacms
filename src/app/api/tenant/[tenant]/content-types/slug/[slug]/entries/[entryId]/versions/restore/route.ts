import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; entryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, entryId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { versionId } = body
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required" }, { status: 400 })
    }

    const tenantDb = await getTenantDb(tenantSlug)

    const targetVersion = await tenantDb.contentVersion.findUnique({
      where: { id: versionId },
    })

    if (!targetVersion || targetVersion.contentEntryId !== entryId) {
      return NextResponse.json({ error: "Target version not found" }, { status: 404 })
    }

    const lastVersion = await tenantDb.contentVersion.findFirst({
      where: { contentEntryId: entryId },
      orderBy: { version: "desc" },
    })

    const newVersionNumber = (lastVersion?.version || 0) + 1

    const updatedEntry = await tenantDb.$transaction(async (tx) => {
      const entry = await tx.contentEntry.update({
        where: { id: entryId },
        data: {
          data: targetVersion.data as any,
          updatedBy: session.user.id,
        },
      })

      await tx.contentVersion.create({
        data: {
          contentEntryId: entryId,
          version: newVersionNumber,
          data: targetVersion.data as any,
          publishedAt: entry.status === "PUBLISHED" ? new Date() : null,
          changeType: "restored",
          changedBy: session.user.id,
          changeSummary: `Restored from version ${targetVersion.version}`,
        },
      })

      return entry
    })

    logAudit({
      action: AuditAction.CONTENT_UPDATED,
      userId: session.user.id,
      entity: "ContentEntry",
      entityId: entryId,
      data: { action: "restore_version", restoredFromVersion: targetVersion.version },
    })

    return NextResponse.json({ success: true, entry: updatedEntry })
  } catch (error: any) {
    console.error("Error restoring version:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
