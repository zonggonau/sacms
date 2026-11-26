import { db } from "@/lib/database"
import { PAYMENT_WINDOW_MS } from "@/lib/billing/payment-window"

type PaymentWhere = NonNullable<Parameters<typeof db.paymentTransaction.updateMany>[0]>["where"]

/**
 * Marks unpaid orders past their payment window as `expired`. Runs when a
 * billing list is read, so no cron is needed. `scope` limits it to the caller's
 * own orders. Money that arrives later is still fulfilled: `expired` is not
 * terminal (see applyPaymentOutcome).
 */
export async function expireStalePendingPayments(scope: PaymentWhere = {}): Promise<number> {
  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MS)
  const result = await db.paymentTransaction.updateMany({
    where: { AND: [scope, { status: "pending", createdAt: { lt: cutoff } }] },
    data: { status: "expired" },
  })
  return result.count
}
