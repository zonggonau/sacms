import { NextResponse } from "next/server"
import { withAdminAuth, handleRouteError } from "@/lib/api/route-helpers"
import { biznetGio, BiznetGioError } from "@/lib/biznetgio"
import { logAudit, AuditAction } from "@/lib/audit-log"

// GET /api/admin/biznet-gio/vms/[accountId] — VM details (read-only, no cost).
export const GET = withAdminAuth(async (_request, context) => {
  const { accountId } = await context.params
  try {
    const details = await biznetGio.getVmDetails(accountId)
    return NextResponse.json({ details })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/vms/[accountId]", method: "GET" })
  }
})

// DELETE /api/admin/biznet-gio/vms/[accountId] — permanently terminates the
// VM on SaCMS's Biznet Gio account. Irreversible.
export const DELETE = withAdminAuth(async (_request, context, { session }) => {
  const { accountId } = await context.params
  try {
    const result = await biznetGio.deleteVm(accountId)
    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "BiznetGioVmDeleted",
      entityId: String(accountId),
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/vms/[accountId]", method: "DELETE" })
  }
})
