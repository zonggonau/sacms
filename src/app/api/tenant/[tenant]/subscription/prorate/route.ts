import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { calculateProratedAmount } from "@/lib/midtrans"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/subscription/prorate — current subscription + active addons. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const [tenant, subscription] = await Promise.all([
    db.tenant.findUnique({ where: { id: access.tenantId }, select: { plan: true } }),
    db.subscription.findFirst({ where: { tenantId: access.tenantId }, orderBy: { createdAt: "desc" } }),
  ])

  const planSubscription = tenant
    ? await db.subscription.findFirst({
        where: { tenantId: access.tenantId, plan: tenant.plan },
        orderBy: { createdAt: "desc" },
      })
    : subscription

  const addonTransactions = await db.paymentTransaction.findMany({
    where: {
      orderId: { startsWith: "ADD-" },
      status: "success",
      subscription: { tenantId: access.tenantId },
    },
  })
  const activeAddons = Array.from(
    new Set(addonTransactions.map((t) => (t.rawResponse as any)?.addonId).filter(Boolean)),
  )

  return NextResponse.json({
    subscription: planSubscription || { plan: "free", status: "active", currentPeriodEnd: null },
    activeAddons,
  })
})

/** POST /api/tenant/[tenant]/subscription/prorate — prorated cost for an upgrade. */
export const POST = withStaffAuth(async (request, _context, { access }) => {
  const { newPlan } = await request.json()
  // Validated against the real, admin-editable WorkspacePlan table (see
  // src/lib/pricing.ts) instead of a hardcoded slug list — the previous
  // list ("free"/"starter"/"pro"/"enterprise") was stale account-plan
  // naming bleeding into workspace-plan validation: it rejected the real
  // "business" workspace plan outright, silently dropping proration credit
  // for anyone upgrading to it (checkout ignores a failed prorate call and
  // proceeds at full price instead of blocking).
  const { getWorkspacePlans } = await import("@/lib/pricing")
  const validSlugs = (await getWorkspacePlans({ includeInactive: true })).map((p) => p.slug)
  if (!newPlan || !validSlugs.includes(newPlan)) {
    return apiError("validation", { message: "Invalid plan" })
  }

  const subscription = await db.subscription.findFirst({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
  })
  if (!subscription) return apiError("not_found", { message: "No active subscription found" })

  const proration = await calculateProratedAmount(
    subscription.plan,
    newPlan,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd,
  )

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price)

  const { getDynamicWorkspacePrices } = await import("@/lib/midtrans")
  const dynamicPrices = await getDynamicWorkspacePrices()

  return NextResponse.json({
    currentPlan: subscription.plan,
    newPlan,
    canUpgrade: proration.amountDue > 0,
    fullPrice: proration.fullPrice,
    fullPriceFormatted: formatPrice(proration.fullPrice),
    proratedPrice: proration.proratedPrice,
    proratedPriceFormatted: formatPrice(proration.proratedPrice),
    daysRemaining: proration.daysRemaining,
    totalDays: proration.totalDays,
    percentageUsed: Math.round(proration.percentageUsed * 100),
    credit: proration.credit,
    creditFormatted: formatPrice(proration.credit),
    amountDue: proration.amountDue,
    amountDueFormatted: formatPrice(proration.amountDue),
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    isUpgrade: proration.fullPrice > (dynamicPrices[subscription.plan]?.monthly || 0),
    isDowngrade: proration.isDowngrade,
    isActive: subscription.status === "active",
    message:
      proration.amountDue === 0
        ? "No payment required - credit covers the upgrade"
        : proration.amountDue < proration.fullPrice
          ? `You'll only pay ${formatPrice(proration.amountDue)} (credit applied: ${formatPrice(proration.credit)})`
          : `Upgrade to ${newPlan} for ${formatPrice(proration.fullPrice)}`,
  })
})
