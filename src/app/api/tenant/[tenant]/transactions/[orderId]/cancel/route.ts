import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { cancelTransaction, getTransactionStatus } from "@/lib/midtrans"

const PAID_MIDTRANS_STATUSES = new Set(["settlement", "capture"])

/**
 * POST /api/tenant/[tenant]/transactions/[orderId]/cancel
 * Cancels a payment the workspace started but has not paid. Only pending orders
 * can be cancelled, and not once Midtrans reports the money as received.
 *
 * If a payment still lands after this, the payment webhook fulfils it anyway:
 * `cancelled` is not a terminal status (see applyPaymentOutcome), so money that
 * was actually received is never refused.
 */
export const POST = withStaffAuth(
  async (_req, context, { access }) => {
    const { orderId } = await context.params
    const tenantId = access.tenantId

    const transaction = await db.paymentTransaction.findUnique({
      where: { orderId },
      select: { id: true, status: true, subscriptionId: true, rawResponse: true },
    })
    if (!transaction) return apiError("not_found", { message: "Transaksi tidak ditemukan." })

    const subscriptions = await db.subscription.findMany({ where: { tenantId }, select: { id: true } })
    const raw = transaction.rawResponse as { tenantId?: string } | null
    const belongsToTenant =
      raw?.tenantId === tenantId || (!!transaction.subscriptionId && subscriptions.some((s) => s.id === transaction.subscriptionId))
    if (!belongsToTenant) return apiError("not_found", { message: "Transaksi tidak ditemukan." })

    if (transaction.status !== "pending") {
      const reason: Record<string, string> = { success: "dibayar", cancelled: "dibatalkan", expired: "kedaluwarsa", failed: "gagal" }
      return apiError("conflict", { message: `Transaksi ini sudah ${reason[transaction.status] ?? "tidak aktif"}, tidak bisa dibatalkan.` })
    }

    // Money may already be on its way. If Midtrans says it is paid, do not cancel.
    // If the lookup itself fails, cancelling stays safe: a late payment is still fulfilled.
    let midtransStatus: string | null = null
    try {
      midtransStatus = (await getTransactionStatus(orderId))?.transaction_status ?? null
    } catch {
      midtransStatus = null
    }
    if (midtransStatus && PAID_MIDTRANS_STATUSES.has(midtransStatus)) {
      return apiError("conflict", { message: "Pembayaran ini sudah diterima dan sedang diproses, jadi tidak bisa dibatalkan." })
    }

    // Best effort: stop the Snap page from accepting payment. Midtrans may refuse
    // (for example, an order it already expired); the local cancel still applies.
    try {
      await cancelTransaction(orderId)
    } catch (err) {
      console.warn(`[transactions/cancel] Midtrans cancel failed for ${orderId}:`, err)
    }

    const updated = await db.paymentTransaction.updateMany({
      where: { id: transaction.id, status: "pending" },
      data: { status: "cancelled" },
    })
    if (updated.count === 0) {
      return apiError("conflict", { message: "Status transaksi sudah berubah. Muat ulang halaman lalu coba lagi." })
    }

    return NextResponse.json({ success: true, orderId, status: "cancelled" })
  },
  { minRole: "admin" },
)
