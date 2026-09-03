import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { z } from "zod"

const RestoreSchema = z.object({ versionId: z.string().min(1) })

export const POST = withStaffAuth(
  async (request, context, { session }) => {
    const { tenant: tenantSlug, entryId } = await context.params
    const body = await readJson(request, RestoreSchema)
    if (!body.ok) return body.response

    const tenantDb = await getTenantDb(tenantSlug)

    const targetVersion = await tenantDb.contentVersion.findUnique({ where: { id: body.data.versionId } })
    if (!targetVersion || targetVersion.contentEntryId !== entryId) {
      return apiError("not_found", { message: "Target version not found" })
    }

    const lastVersion = await tenantDb.contentVersion.findFirst({
      where: { contentEntryId: entryId },
      orderBy: { version: "desc" },
    })
    const newVersionNumber = (lastVersion?.version || 0) + 1

    const updatedEntry = await tenantDb.$transaction(async (tx) => {
      const entry = await tx.contentEntry.update({
        where: { id: entryId },
        data: { data: targetVersion.data as any, updatedBy: session.user.id },
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
  },
  { minRole: "editor" },
)
