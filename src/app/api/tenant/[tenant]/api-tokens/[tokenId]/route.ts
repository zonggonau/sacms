import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"

/** DELETE — remove an API token (admin/owner only). */
export const DELETE = withStaffAuth(
  async (_request, context, { access, session }) => {
    const { tokenId } = await context.params
    const token = await db.apiToken.findFirst({ where: { id: tokenId, tenantId: access.tenantId } })
    if (!token) return apiError("not_found", { message: "Token not found" })

    await db.apiToken.delete({ where: { id: tokenId } })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.TOKEN_DELETED,
      entity: "ApiToken",
      entityId: tokenId,
      data: { name: token.name, type: token.type },
    })

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)

/** GET — single API token metadata (value never returned). */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tokenId } = await context.params
  const token = await db.apiToken.findFirst({
    where: { id: tokenId, tenantId: access.tenantId },
    select: {
      id: true, name: true, description: true, type: true, permissions: true,
      lastUsedAt: true, expiresAt: true, createdAt: true, updatedAt: true,
    },
  })
  if (!token) return apiError("not_found", { message: "Token not found" })
  return NextResponse.json({ token })
})
