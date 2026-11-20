import { NextResponse } from "next/server"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit } from "@/lib/audit-log"
import { db } from "@/lib/database"
import { paymentStatusForCheckout } from "@/lib/billing/payment-success"
import { syncPaymentStatus } from "@/lib/billing/sync-payment"

export const POST = withAdminAuth(async (_request, context, { session }) => {
  const { orderId } = await context.params
  const payment = await db.paymentTransaction.findUnique({
    where: { orderId },
    select: { id: true, orderId: true, status: true, fulfillmentStatus: true },
  })
  if (!payment) return apiError("not_found", { message: "Transaksi tidak ditemukan." })

  await syncPaymentStatus(payment)
  const updated = await db.paymentTransaction.findUniqueOrThrow({
    where: { orderId },
    select: { status: true, fulfillmentStatus: true },
  })
  logAudit({
    userId: session.user.id,
    action: "billing.transaction_synced",
    entity: "PaymentTransaction",
    entityId: payment.id,
    data: { orderId, previousStatus: payment.status, status: updated.status, fulfillmentStatus: updated.fulfillmentStatus },
  })
  return NextResponse.json({
    status: paymentStatusForCheckout(updated),
    paymentStatus: updated.status,
    fulfillmentStatus: updated.fulfillmentStatus,
  })
}, { allowRoles: ["finance"] })
