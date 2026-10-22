/**
 * POST /api/user/vps-instances/[id]/refresh
 * Account-scoped equivalent of /api/tenant/[tenant]/vps-instances/[id]/refresh.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { apiError } from "@/lib/api/route-helpers"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const { id } = await context.params
  const instance = await db.vpsInstance.findFirst({ where: { id, ownerId: session.user.id, tenantId: null } })
  if (!instance) return apiError("not_found", { message: "VPS tidak ditemukan" })

  if (!instance.biznetAccountId) {
    return NextResponse.json({ status: instance.status, failureReason: instance.failureReason })
  }

  try {
    const { getAccountDetails } = await import("@/lib/biznetgio")
    const account = await getAccountDetails(instance.biznetAccountId)
    const ipAddress = (account.extra_details?.address as string | undefined)?.split("/")[0] || null
    const nextStatus = ipAddress ? "active" : instance.status

    const updated = await db.vpsInstance.update({
      where: { id: instance.id },
      data: { status: nextStatus, ipAddress: ipAddress ?? instance.ipAddress },
    })

    // First time this instance has a real IP — kick off the automatic
    // PostgreSQL + MinIO install in the background (see vps-db-storage.ts).
    // Not awaited: it takes a few minutes, so this request returns right
    // away and the owner clicks Refresh again later to see it land.
    if (updated.ipAddress && updated.dbStorageStatus === "pending") {
      await db.vpsInstance.update({ where: { id: updated.id }, data: { dbStorageStatus: "connecting" } })
      import("@/lib/vps-db-storage")
        .then(({ provisionVpsDbAndStorageTask }) => provisionVpsDbAndStorageTask(updated.id))
        .catch((e) => console.error(`[VPS] Failed to start DB/Storage bootstrap for ${updated.id}:`, e))
    }

    return NextResponse.json({ status: updated.status, ipAddress: updated.ipAddress, dbStorageStatus: updated.dbStorageStatus })
  } catch (err) {
    console.error(`[VPS] Status refresh failed for instance ${instance.id}:`, err)
    return apiError("internal", { message: "Gagal mengambil status terbaru dari Biznet Gio. Coba lagi beberapa saat lagi." })
  }
}
