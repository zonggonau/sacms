import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { resolvePurchaseLabel } from "@/lib/billing/purchase-label"

export type BillingItemType = "plan" | "addon" | "ai_credits" | "template"

// What a transaction is for, so the history can say it plainly.
function itemTypeOf(orderId: string, raw: any): BillingItemType {
  if (raw?.type === "WEBSITE_TEMPLATE_PURCHASE" || orderId.startsWith("TPL-")) return "template"
  if (raw?.type === "ai_credits" || orderId.startsWith("AIC-")) return "ai_credits"
  if (raw?.isAddon) return "addon"
  return "plan"
}

export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const subscriptions = await db.subscription.findMany({ where: { tenantId: access.tenantId } })
  const subscriptionIds = subscriptions.map((s) => s.id)
  const currentPlanFor = (id?: string | null) => subscriptions.find((s) => s.id === id)?.plan || "unknown"

  // Transactions are matched by tenant too: a template purchase has no subscription
  // link, so a subscription-only filter would hide its pending and cancelled orders.
  const [invoices, transactions] = await Promise.all([
    subscriptionIds.length > 0
      ? db.invoice.findMany({ where: { subscriptionId: { in: subscriptionIds } }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    db.paymentTransaction.findMany({
      where: {
        status: { in: ["pending", "cancelled", "failed"] },
        OR: [
          { subscriptionId: { in: subscriptionIds } },
          { rawResponse: { path: ["tenantId"], equals: access.tenantId } },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  // A paid Invoice row only stores subscriptionId, never what was actually
  // bought — join back to the PaymentTransaction that created it (same
  // orderId, see payment-success.ts) to read its rawResponse via
  // resolvePurchaseLabel(). Without this, every invoice tied to a tenant's
  // one subscription row showed whatever plan that subscription CURRENTLY
  // happens to be on, even for an addon/storage purchase that never
  // touches Subscription.plan at all.
  const paidOrderIds = invoices.map((inv) => inv.midtransInvoiceId).filter((id): id is string => !!id)
  const matchingTransactions = paidOrderIds.length > 0
    ? await db.paymentTransaction.findMany({ where: { orderId: { in: paidOrderIds } } })
    : []
  const rawResponseByOrderId = new Map(matchingTransactions.map((t) => [t.orderId, t.rawResponse]))

  // `plan`: the real id that was actually checked out (an addon id, or the
  // plan slug being switched TO) — used by the UI to resume a pending
  // payment at the right product. Previously this was always the
  // subscription's CURRENT plan, which also silently broke "Bayar Sekarang"
  // for any pending addon (resumed as if buying the base plan) and for a
  // pending plan upgrade (resumed at the OLD plan instead of the new one).
  // `planLabel`: human-readable name for display.
  // `payUrl`: the Midtrans payment page, when the order stored one (template purchases).
  const combinedHistory = await Promise.all([
    ...invoices.map(async (inv) => {
      const orderId = inv.midtransInvoiceId || ""
      const raw = orderId ? rawResponseByOrderId.get(orderId) : null
      const { purchasedId, purchasedLabel } = await resolvePurchaseLabel({
        orderId,
        rawResponse: raw,
        fallbackPlanSlug: currentPlanFor(inv.subscriptionId),
      })
      return {
        id: inv.id,
        orderId: orderId || null,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        midtransInvoiceId: inv.midtransInvoiceId,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        isTransaction: false,
        itemType: itemTypeOf(orderId, raw),
        payUrl: null,
        plan: purchasedId,
        planLabel: purchasedLabel,
      }
    }),
    ...transactions.map(async (t) => {
      const raw = t.rawResponse as any
      const { purchasedId, purchasedLabel } = await resolvePurchaseLabel({
        orderId: t.orderId,
        rawResponse: t.rawResponse,
        fallbackPlanSlug: currentPlanFor(t.subscriptionId),
      })
      return {
        id: t.id,
        orderId: t.orderId,
        amount: t.amount,
        currency: "IDR",
        status: t.status,
        midtransInvoiceId: t.orderId,
        paidAt: null,
        createdAt: t.createdAt,
        isTransaction: true,
        itemType: itemTypeOf(t.orderId, raw),
        payUrl: t.status === "pending" && typeof raw?.redirectUrl === "string" ? raw.redirectUrl : null,
        plan: purchasedId,
        planLabel: purchasedLabel,
      }
    }),
  ])
  combinedHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ invoices: combinedHistory })
})
