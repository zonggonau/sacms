import { NextResponse } from "next/server"
import { db, getTenantDbById } from "@/lib/database"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { TRASH_RESTORE_WINDOW_DAYS } from "@/lib/content/entry-service"

/**
 * GET /api/cron/purge-trash
 *
 * Hard-deletes content entries that have sat in the trash (deletedAt set)
 * past TRASH_RESTORE_WINDOW_DAYS. "Hapus Entri" soft-deletes (entry-service.ts's
 * deleteContentEntry) so entries stay recoverable for a window — this is
 * what actually makes that window end, same iterate-every-tenant-DB pattern
 * as cron/publish since trashed entries live in each tenant's own DB.
 *
 * Requires CRON_SECRET header for security.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - TRASH_RESTORE_WINDOW_DAYS)

    const tenants = await db.tenant.findMany({ select: { id: true, slug: true } })

    let totalPurged = 0
    const results: Record<string, number> = {}

    for (const tenant of tenants) {
      try {
        const tenantDb = await getTenantDbById(tenant.id)
        const result = await tenantDb.contentEntry.deleteMany({
          where: { tenantId: tenant.id, deletedAt: { lt: threshold } },
        })
        if (result.count > 0) {
          totalPurged += result.count
          results[tenant.slug] = result.count
        }
      } catch (err) {
        console.error(`Cron purge-trash: failed for tenant ${tenant.slug}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      purged: totalPurged,
      details: results,
      restoreWindowDays: TRASH_RESTORE_WINDOW_DAYS,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron purge-trash error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
