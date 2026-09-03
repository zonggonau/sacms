import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const subscriptions = await db.subscription.findMany({ where: { tenantId: access.tenantId } })
  if (subscriptions.length === 0) return NextResponse.json({ invoices: [] })

  const subscriptionIds = subscriptions.map((s) => s.id)
  const planFor = (id?: string | null) => subscriptions.find((s) => s.id === id)?.plan || "unknown"

  const [invoices, pendingTransactions] = await Promise.all([
    db.invoice.findMany({
      where: { subscriptionId: { in: subscriptionIds } },
      orderBy: { createdAt: "desc" },
    }),
    db.paymentTransaction.findMany({
      where: { subscriptionId: { in: subscriptionIds }, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const combinedHistory = [
    ...invoices.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      midtransInvoiceId: inv.midtransInvoiceId,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      isTransaction: false,
      plan: planFor(inv.subscriptionId),
    })),
    ...pendingTransactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: "IDR",
      status: t.status,
      midtransInvoiceId: t.orderId,
      paidAt: null,
      createdAt: t.createdAt,
      isTransaction: true,
      plan: planFor(t.subscriptionId),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ invoices: combinedHistory })
})
