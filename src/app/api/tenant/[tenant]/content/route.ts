import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { z } from "zod/v4"
import { validateBody } from "@/lib/validate"

const purgeContentSchema = z.object({
  confirm: z.string().optional(),
})

/**
 * DELETE /api/tenant/[tenant]/content
 * Purges all content entries for the tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden - Owner or Admin role required" }, { status: 403 })
    }

    const tenantDb = await getTenantDb(access.tenantId)

    // Delete all content entries for this tenant
    const deleteResult = await tenantDb.contentEntry.deleteMany({
      where: { tenantId: access.tenantId },
    })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "tenant_content_purge",
      entityId: access.tenantId,
      data: { action: "purge_all_content", deletedCount: deleteResult.count },
    })

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      message: `${deleteResult.count} entri konten berhasil dikosongkan.`,
    })
  } catch (error) {
    console.error("Error purging tenant content:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
