import { getPaymentProvider } from "@/lib/payment"
import { applyPaymentOutcome, isPaymentAwaitingFulfillment } from "./payment-success"

/** Caller must authorize access to this payment before reconciliation. */
export async function syncPaymentStatus(payment: { orderId: string; status: string; fulfillmentStatus: string | null }) {
  if (isPaymentAwaitingFulfillment(payment)) {
    await applyPaymentOutcome(payment.orderId, "success")
    return
  }
  if (payment.status !== "pending") return

  const result = await getPaymentProvider().getTransactionStatus(payment.orderId)
  const raw = result.raw && typeof result.raw === "object" ? result.raw as Record<string, unknown> : {}
  if (raw.transaction_status === "capture" && raw.fraud_status !== "accept") return
  if (result.status === "success" || ["failed", "cancelled", "expired"].includes(result.status)) {
    const paymentTime = typeof raw.transaction_time === "string" ? new Date(raw.transaction_time) : null
    await applyPaymentOutcome(payment.orderId, result.status === "success" ? "success" : "failed", {
      rawProviderPayload: result.raw,
      paymentType: result.paymentType,
      transactionId: result.transactionId,
      transactionTime: paymentTime && Number.isFinite(paymentTime.getTime()) ? paymentTime : undefined,
      fraudStatus: typeof raw.fraud_status === "string" ? raw.fraud_status : undefined,
    })
  }
}
