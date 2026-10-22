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

    return NextResponse.json({ status: updated.status, ipAddress: updated.ipAddress })
  } catch (err) {
    console.error(`[VPS] Status refresh failed for instance ${instance.id}:`, err)
    return apiError("internal", { message: "Gagal mengambil status terbaru dari Biznet Gio. Coba lagi beberapa saat lagi." })
  }
}
