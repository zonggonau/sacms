import { db } from "@/lib/database"
import { getDynamicWorkspacePrices, getDynamicAccountPrices, resolveSubscriptionMonthlyPrice } from "@/lib/midtrans"

export interface PlanEconomics {
  slug: string
  name: string
  category: "cloud" | "account"
  monthlyPrice: number
  yearlyPrice: number
  estimatedMonthlyCogsEur: number
  estimatedMonthlyCogsIdr: number
  monthlyGrossProfitIdr: number
  yearlyGrossProfitIdr: number
  grossProfitMarginPercent: number
  gatewayFeeEstimateIdr: number
  netProfitMarginPercent: number
}

// Exchange rate default estimation: 1 EUR = ~Rp 17.500
export const DEFAULT_EUR_IDR_RATE = 17500

/**
 * Midtrans Variable Fees:
 * - QRIS: 0.7%
 * - Virtual Account: Rp 4.000 / tx
 * - Credit Card: 2.9% + Rp 2.000
 * Weighted average approx 1.5%
 */
export function calculateMidtransFee(amount: number): number {
  return Math.round(amount * 0.015)
}

// COGS is deliberately an ESTIMATE, not a measurement — this codebase has
// no per-tenant AI/storage/compute usage cost telemetry wired into billing
// yet. ~14-15% of monthly price was the ratio implied by this file's
// previous hardcoded per-plan cogsIdr values (e.g. 35000/249000 ≈ 14%) —
// kept at the same scale of estimate, but now applied to each plan's REAL
// live price instead of a stale guess, and generalized to any plan slug
// instead of only the 3 that used to be hardcoded here.
const ESTIMATED_COGS_PERCENT = 0.15
// Flat estimated infra floor for a zero-revenue free-tier workspace — 15%
// of Rp 0 is Rp 0, which understates the real (small but nonzero) hosting
// cost of a free workspace.
const FREE_PLAN_COGS_IDR = 5000

function estimateMonthlyCogs(monthlyPrice: number): number {
  return monthlyPrice > 0 ? Math.round(monthlyPrice * ESTIMATED_COGS_PERCENT) : FREE_PLAN_COGS_IDR
}

function titleCaseSlug(slug: string): string {
  return slug.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function buildPlanEconomics(slug: string, category: "cloud" | "account", prices: { monthly: number; yearly: number }): PlanEconomics {
  const cogsIdr = estimateMonthlyCogs(prices.monthly)
  const monthlyGrossProfit = prices.monthly - cogsIdr
  const yearlyGrossProfit = prices.yearly - cogsIdr * 12
  const grossMargin = prices.monthly > 0 ? Math.round((monthlyGrossProfit / prices.monthly) * 1000) / 10 : 0
  const gatewayFee = calculateMidtransFee(prices.monthly)
  const netProfit = monthlyGrossProfit - gatewayFee
  const netMargin = prices.monthly > 0 ? Math.round((netProfit / prices.monthly) * 1000) / 10 : 0

  return {
    slug,
    name: `${titleCaseSlug(slug)}${category === "account" ? " (Account)" : ""}`,
    category,
    monthlyPrice: prices.monthly,
    yearlyPrice: prices.yearly,
    estimatedMonthlyCogsEur: cogsIdr / DEFAULT_EUR_IDR_RATE,
    estimatedMonthlyCogsIdr: cogsIdr,
    monthlyGrossProfitIdr: monthlyGrossProfit,
    yearlyGrossProfitIdr: yearlyGrossProfit,
    grossProfitMarginPercent: grossMargin,
    gatewayFeeEstimateIdr: gatewayFee,
    netProfitMarginPercent: netMargin,
  }
}

/**
 * Get comprehensive Unit Economics catalog for all plans — driven by the
 * SAME live pricing (CMS-configured, falling back to PLAN_PRICES) that
 * actually bills tenants (generate-invoices), instead of a separate
 * hardcoded price list that could silently drift from what's really
 * charged. Workspace ("cloud") and account plans are priced from two
 * independently admin-edited tables that can share a slug at a different
 * price, so they're listed — and later looked up — as separate catalog
 * entries, never merged into one slug-keyed map.
 */
export async function getPlansUnitEconomics(): Promise<PlanEconomics[]> {
  const [dynamicWorkspacePrices, dynamicAccountPrices] = await Promise.all([
    getDynamicWorkspacePrices(),
    getDynamicAccountPrices(),
  ])

  const results: PlanEconomics[] = []
  for (const [slug, prices] of Object.entries(dynamicWorkspacePrices)) {
    results.push(buildPlanEconomics(slug, "cloud", prices))
  }
  for (const [slug, prices] of Object.entries(dynamicAccountPrices)) {
    results.push(buildPlanEconomics(slug, "account", prices))
  }
  return results
}

/**
 * Calculate live Financial Metrics from DB invoices and subscriptions
 */
export async function calculateLiveFinancialReports() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // 1. All Paid Invoices
  const allPaidInvoices = await db.invoice.findMany({
    where: { status: "paid" },
    include: {
      subscription: {
        include: {
          tenant: true,
          user: { select: { id: true, name: true, email: true } },
        }
      }
    },
    orderBy: { paidAt: "desc" }
  })

  // 2. All Payment Transactions
  const allTransactions = await db.paymentTransaction.findMany({
    where: { status: { in: ["success", "settlement", "capture"] } },
    orderBy: { createdAt: "desc" }
  })

  // 3. Active Subscriptions
  const activeSubs = await db.subscription.findMany({
    where: { status: "active" },
    include: {
      tenant: true,
      user: { select: { id: true, name: true, email: true } }
    }
  })

  const [dynamicWorkspacePrices, dynamicAccountPrices] = await Promise.all([
    getDynamicWorkspacePrices(),
    getDynamicAccountPrices(),
  ])
  const unitEconomics = await getPlansUnitEconomics()
  // Keyed by `${category}:${slug}` — workspace and account tables can
  // share a slug ("pro") at a different price, so a single slug-keyed map
  // would let one category's entry silently shadow the other's.
  const economicsMap = new Map(unitEconomics.map(u => [`${u.category}:${u.slug}`, u]))

  // Total Lifetime Revenue
  const totalLifetimeRevenue = allPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // This Month Revenue
  const thisMonthInvoices = allPaidInvoices.filter(inv => inv.paidAt && inv.paidAt >= startOfMonth)
  const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Last Month Revenue
  const lastMonthInvoices = allPaidInvoices.filter(inv => inv.paidAt && inv.paidAt >= lastMonth && inv.paidAt < startOfMonth)
  const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // MRR & Estimated Monthly COGS — each active subscription's revenue is
  // resolved from the SAME live pricing generate-invoices actually bills
  // with (resolveSubscriptionMonthlyPrice), never a separate guess, so
  // this can no longer drift from what tenants are really charged.
  let liveMrr = 0
  let liveMonthlyCogs = 0
  let liveMonthlyGatewayFees = 0

  const tenantBreakdown: any[] = []

  for (const sub of activeSubs) {
    const isAccountPlan = !sub.tenantId
    const category: "cloud" | "account" = isAccountPlan ? "account" : "cloud"
    const subMonthlyRevenue = resolveSubscriptionMonthlyPrice(sub.plan, isAccountPlan, dynamicWorkspacePrices, dynamicAccountPrices)

    // Reuse the catalog entry for this exact (category, slug) if one
    // exists (keeps COGS/gateway-fee math identical to the catalog), else
    // build one on the fly for a plan slug that isn't in the live pricing
    // tables at all (e.g. a legacy slug only present in PLAN_PRICES).
    const econ = economicsMap.get(`${category}:${sub.plan}`)
      || buildPlanEconomics(sub.plan, category, { monthly: subMonthlyRevenue, yearly: subMonthlyRevenue * 10 })

    const subMonthlyCogs = estimateMonthlyCogs(subMonthlyRevenue)
    const subMonthlyGateway = calculateMidtransFee(subMonthlyRevenue)

    liveMrr += subMonthlyRevenue
    liveMonthlyCogs += subMonthlyCogs
    liveMonthlyGatewayFees += subMonthlyGateway

    const monthlyGrossProfit = subMonthlyRevenue - subMonthlyCogs
    tenantBreakdown.push({
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: sub.tenant?.name || "Workspace",
      tenantSlug: sub.tenant?.slug || "-",
      userName: sub.user?.name || "Owner",
      userEmail: sub.user?.email || "-",
      planSlug: sub.plan,
      planName: econ.name,
      category,
      monthlyRevenue: subMonthlyRevenue,
      monthlyCogs: subMonthlyCogs,
      monthlyGrossProfit,
      monthlyNetProfit: monthlyGrossProfit - subMonthlyGateway,
      marginPercent: subMonthlyRevenue > 0 ? Math.round((monthlyGrossProfit / subMonthlyRevenue) * 1000) / 10 : 0,
      currentPeriodEnd: sub.currentPeriodEnd,
      status: sub.status,
    })
  }

  const liveMonthlyGrossProfit = liveMrr - liveMonthlyCogs
  const liveMonthlyNetProfit = liveMonthlyGrossProfit - liveMonthlyGatewayFees
  const overallGrossMargin = liveMrr > 0 ? Math.round((liveMonthlyGrossProfit / liveMrr) * 1000) / 10 : 0
  const overallNetMargin = liveMrr > 0 ? Math.round((liveMonthlyNetProfit / liveMrr) * 1000) / 10 : 0

  // Category Aggregations — "account" included alongside "cloud" so a
  // personal/account-level subscription's revenue is tracked here rather
  // than silently dropped (the previous version only ever had a "cloud"
  // key, so anything else failed the `if (categoryStats[cat])` guard
  // closed with no error). Not yet surfaced in the admin UI, which still
  // only reads categoryStats.cloud — a separate follow-up.
  const categoryStats: Record<"cloud" | "account", { count: number; mrr: number; cogs: number; profit: number }> = {
    cloud: { count: 0, mrr: 0, cogs: 0, profit: 0 },
    account: { count: 0, mrr: 0, cogs: 0, profit: 0 },
  }

  for (const tb of tenantBreakdown) {
    const cat: "cloud" | "account" = tb.category === "account" ? "account" : "cloud"
    categoryStats[cat].count += 1
    categoryStats[cat].mrr += tb.monthlyRevenue
    categoryStats[cat].cogs += tb.monthlyCogs
    categoryStats[cat].profit += tb.monthlyGrossProfit
  }

  return {
    summary: {
      totalLifetimeRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      revenueGrowthPercent: lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10 : 0,
      mrr: liveMrr,
      arr: liveMrr * 12,
      estimatedMonthlyCogs: liveMonthlyCogs,
      estimatedYearlyCogs: liveMonthlyCogs * 12,
      monthlyGrossProfit: liveMonthlyGrossProfit,
      yearlyGrossProfit: liveMonthlyGrossProfit * 12,
      monthlyNetProfit: liveMonthlyNetProfit,
      yearlyNetProfit: liveMonthlyNetProfit * 12,
      grossMarginPercent: overallGrossMargin,
      netMarginPercent: overallNetMargin,
      activeSubCount: activeSubs.length,
      eurExchangeRate: DEFAULT_EUR_IDR_RATE,
    },
    categoryStats,
    unitEconomicsCatalog: unitEconomics,
    tenantBreakdown,
    recentInvoices: allPaidInvoices.slice(0, 10),
  }
}
