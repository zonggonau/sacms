import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { MANAGED_INFRA_SETUP_ID, MANAGED_INFRA_MONTHLY_ID } from "@/lib/billing/managed-infra"

// Addon ids sold as flat top-ups with no row in the Addon table (mirrors
// BUILTIN_TOPUPS in checkout/route.ts) — kept here too so invoice history
// still shows a real name instead of the raw id for these.
const BUILTIN_TOPUP_NAMES: Record<string, string> = {
  topup_ai_500k: "AI Booster (500K Tokens)",
  topup_ai_2m: "AI Power Pack (2M Tokens)",
  topup_api_500k: "Extra API Quota (500K Calls)",
  [MANAGED_INFRA_SETUP_ID]: "Database & Storage Sendiri — Setup",
  [MANAGED_INFRA_MONTHLY_ID]: "Database & Storage Sendiri — Perpanjangan 1 Bulan",
}

export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const subscriptions = await db.subscription.findMany({ where: { tenantId: access.tenantId } })
  if (subscriptions.length === 0) return NextResponse.json({ invoices: [] })

  const subscriptionIds = subscriptions.map((s) => s.id)
  const currentPlanFor = (id?: string | null) => subscriptions.find((s) => s.id === id)?.plan || "unknown"

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

  // A paid Invoice row only stores subscriptionId, never what was actually
  // bought — join back to the PaymentTransaction that created it (same
  // orderId, see payment-success.ts) to read its rawResponse. Without this,
  // every invoice tied to a tenant's one subscription row showed whatever
  // plan that subscription CURRENTLY happens to be on, even for an
  // addon/storage purchase that never touches Subscription.plan at all.
  const paidOrderIds = invoices.map((inv) => inv.midtransInvoiceId).filter((id): id is string => !!id)
  const matchingTransactions = paidOrderIds.length > 0
    ? await db.paymentTransaction.findMany({ where: { orderId: { in: paidOrderIds } } })
    : []
  const rawResponseByOrderId = new Map(matchingTransactions.map((t) => [t.orderId, t.rawResponse as any]))

  const { getWorkspacePlan, getAddon } = await import("@/lib/pricing")
  const planNameCache = new Map<string, string>()
  const resolvePlanName = async (slug: string) => {
    if (!planNameCache.has(slug)) {
      const plan = await getWorkspacePlan(slug)
      planNameCache.set(slug, plan?.name || slug)
    }
    return planNameCache.get(slug)!
  }
  const addonNameCache = new Map<string, string>()
  const resolveAddonName = async (addonId: string) => {
    if (!addonNameCache.has(addonId)) {
      const addon = await getAddon(addonId)
      addonNameCache.set(addonId, addon?.name || BUILTIN_TOPUP_NAMES[addonId] || addonId)
    }
    return addonNameCache.get(addonId)!
  }

  // `plan`: the real id that was actually checked out (an addon id, or the
  // plan slug being switched TO) — used by the UI to resume a pending
  // payment at the right product. Previously this was always the
  // subscription's CURRENT plan, which also silently broke "Bayar Sekarang"
  // for any pending addon (resumed as if buying the base plan) and for a
  // pending plan upgrade (resumed at the OLD plan instead of the new one).
  // `planLabel`: human-readable name for display.
  const describe = async (raw: any, fallbackSlug: string): Promise<{ plan: string; planLabel: string }> => {
    if (raw?.isAddon && raw.addonId) {
      return { plan: raw.addonId, planLabel: await resolveAddonName(raw.addonId) }
    }
    if (raw?.intendedPlan) {
      return { plan: raw.intendedPlan, planLabel: await resolvePlanName(raw.intendedPlan) }
    }
    return { plan: fallbackSlug, planLabel: await resolvePlanName(fallbackSlug) }
  }

  const combinedHistory = await Promise.all([
    ...invoices.map(async (inv) => {
      const raw = inv.midtransInvoiceId ? rawResponseByOrderId.get(inv.midtransInvoiceId) : null
      const { plan, planLabel } = await describe(raw, currentPlanFor(inv.subscriptionId))
      return {
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        midtransInvoiceId: inv.midtransInvoiceId,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        isTransaction: false,
        plan,
        planLabel,
      }
    }),
    ...pendingTransactions.map(async (t) => {
      const { plan, planLabel } = await describe(t.rawResponse as any, currentPlanFor(t.subscriptionId))
      return {
        id: t.id,
        amount: t.amount,
        currency: "IDR",
        status: t.status,
        midtransInvoiceId: t.orderId,
        paidAt: null,
        createdAt: t.createdAt,
        isTransaction: true,
        plan,
        planLabel,
      }
    }),
  ])
  combinedHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ invoices: combinedHistory })
})
