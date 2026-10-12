/**
 * POST /api/admin/infrastructure/vps/[instanceId]/actions
 * Power-control / add-on actions against SaCMS's own production VPS via the
 * Contabo API. Super admin only, audited. Deliberately limited to
 * start/restart/shutdown + the backup add-on — see lib/contabo.ts for why
 * "stop", reinstall, and cancel are excluded.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { runContaboInstanceAction, enableContaboBackupAddon } from "@/lib/contabo"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"

const ActionSchema = z.object({
  action: z.enum(["start", "restart", "shutdown", "enable-backup"]),
})

export const POST = withAdminAuth(async (request, context, { session }) => {
  const { instanceId: instanceIdParam } = await context.params
  const instanceId = Number(instanceIdParam)
  if (!Number.isFinite(instanceId)) {
    return apiError("validation", { message: "instanceId tidak valid" })
  }

  const body = await readJson(request, ActionSchema)
  if (!body.ok) return body.response
  const { action } = body.data

  const result =
    action === "enable-backup"
      ? await enableContaboBackupAddon(instanceId)
      : await runContaboInstanceAction(instanceId, action)

  if (!result.success) {
    return apiError("internal", { message: result.error })
  }

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "InfrastructureVpsAction",
    entityId: String(instanceId),
    data: { action },
  })

  return NextResponse.json({ success: true, status: result.data.status })
})
