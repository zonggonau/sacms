/**
 * POST /api/tenant/[tenant]/vps-instances/[id]/refresh
 * On-demand status check against the live Biznet Gio API — no background
 * polling/cron in v1 (see the VPS feature plan), since real provisioning
 * timing was never observed with a live create call while building this.
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(async (_request, context, { access }) => {
  const { id } = await context.params as { id: string }

  const instance = await db.vpsInstance.findFirst({ where: { id, tenantId: access.tenantId } })
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
      data: {
        status: nextStatus,
        ipAddress: ipAddress ?? instance.ipAddress,
      },
    })

    return NextResponse.json({ status: updated.status, ipAddress: updated.ipAddress })
  } catch (err) {
    console.error(`[VPS] Status refresh failed for instance ${instance.id}:`, err)
    return apiError("internal", { message: "Gagal mengambil status terbaru dari Biznet Gio. Coba lagi beberapa saat lagi." })
  }
})
