import { CONTABO_PLANS } from "@/lib/infrastructure/contabo"
import { db } from "@/lib/database"

export interface PlanEconomics {
  slug: string
  name: string
  category: "vps" | "vds" | "storage" | "cloud" | "account" | "addon"
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

/**
 * Get comprehensive Unit Economics catalog for all plans
 */
export function getPlansUnitEconomics(): PlanEconomics[] {
  const eurRate = DEFAULT_EUR_IDR_RATE
  const results: PlanEconomics[] = []

  // 1. VPS & Storage & VDS Plans
  for (const [slug, plan] of Object.entries(CONTABO_PLANS)) {
    const isVds = plan.type === "VDS"
    const isStorage = plan.type === "Storage"
    const isVps = plan.type === "VPS"
    const category = isVds ? "vds" : isStorage ? "storage" : "vps"

    const monthlyPrice = plan.monthlyPriceIdr
    const yearlyPrice = monthlyPrice * 10
    const monthlyCogsIdr = Math.round(plan.monthlyPriceEur * eurRate)
    const yearlyCogsIdr = monthlyCogsIdr * 12

    const monthlyGrossProfit = monthlyPrice - monthlyCogsIdr
    const yearlyGrossProfit = yearlyPrice - yearlyCogsIdr
    const grossMargin = monthlyPrice > 0 ? Math.round((monthlyGrossProfit / monthlyPrice) * 1000) / 10 : 0
    const gatewayFee = calculateMidtransFee(monthlyPrice)
    const netProfit = monthlyGrossProfit - gatewayFee
    const netMargin = monthlyPrice > 0 ? Math.round((netProfit / monthlyPrice) * 1000) / 10 : 0

    results.push({
      slug,
      name: plan.name,
      category,
      monthlyPrice,
      yearlyPrice,
      estimatedMonthlyCogsEur: plan.monthlyPriceEur,
      estimatedMonthlyCogsIdr: monthlyCogsIdr,
      monthlyGrossProfitIdr: monthlyGrossProfit,
      yearlyGrossProfitIdr: yearlyGrossProfit,
      grossProfitMarginPercent: grossMargin,
      gatewayFeeEstimateIdr: gatewayFee,
      netProfitMarginPercent: netMargin,
    })
  }

  // 2. Shared Cloud SaaS Plans
  const cloudPlans = [
    { slug: "free", name: "SaCMS Free Forever", monthlyPrice: 0, yearlyPrice: 0, cogsIdr: 5000 },
    { slug: "pro", name: "SaCMS Cloud Pro", monthlyPrice: 249000, yearlyPrice: 1490000, cogsIdr: 35000 },
    { slug: "business", name: "SaCMS Cloud Business", monthlyPrice: 490000, yearlyPrice: 2900000, cogsIdr: 75000 },
  ]

  for (const cp of cloudPlans) {
    const monthlyGrossProfit = cp.monthlyPrice - cp.cogsIdr
    const yearlyGrossProfit = cp.yearlyPrice - (cp.cogsIdr * 12)
    const grossMargin = cp.monthlyPrice > 0 ? Math.round((monthlyGrossProfit / cp.monthlyPrice) * 1000) / 10 : 0
    const gatewayFee = calculateMidtransFee(cp.monthlyPrice)
    const netProfit = monthlyGrossProfit - gatewayFee
    const netMargin = cp.monthlyPrice > 0 ? Math.round((netProfit / cp.monthlyPrice) * 1000) / 10 : 0

    results.push({
      slug: cp.slug,
      name: cp.name,
      category: "cloud",
      monthlyPrice: cp.monthlyPrice,
      yearlyPrice: cp.yearlyPrice,
      estimatedMonthlyCogsEur: cp.cogsIdr / eurRate,
      estimatedMonthlyCogsIdr: cp.cogsIdr,
      monthlyGrossProfitIdr: monthlyGrossProfit,
      yearlyGrossProfitIdr: yearlyGrossProfit,
      grossProfitMarginPercent: grossMargin,
      gatewayFeeEstimateIdr: gatewayFee,
      netProfitMarginPercent: netMargin,
    })
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

  const unitEconomics = getPlansUnitEconomics()
  const economicsMap = new Map(unitEconomics.map(u => [u.slug, u]))

  // Total Lifetime Revenue
  const totalLifetimeRevenue = allPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // This Month Revenue
  const thisMonthInvoices = allPaidInvoices.filter(inv => inv.paidAt && inv.paidAt >= startOfMonth)
  const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Last Month Revenue
  const lastMonthInvoices = allPaidInvoices.filter(inv => inv.paidAt && inv.paidAt >= lastMonth && inv.paidAt < startOfMonth)
  const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // MRR & Estimated Monthly COGS
  let liveMrr = 0
  let liveMonthlyCogs = 0
  let liveMonthlyGatewayFees = 0

  const tenantBreakdown: any[] = []

  for (const sub of activeSubs) {
    const econ = economicsMap.get(sub.plan) || {
      slug: sub.plan,
      name: sub.plan,
      category: "cloud" as const,
      monthlyPrice: 0,
      yearlyPrice: 0,
      estimatedMonthlyCogsEur: 0,
      estimatedMonthlyCogsIdr: 0,
      monthlyGrossProfitIdr: 0,
      yearlyGrossProfitIdr: 0,
      grossProfitMarginPercent: 0,
      gatewayFeeEstimateIdr: 0,
      netProfitMarginPercent: 0,
    }

    const subMonthlyRevenue = econ.monthlyPrice
    const subMonthlyCogs = econ.estimatedMonthlyCogsIdr
    const subMonthlyGateway = econ.gatewayFeeEstimateIdr

    liveMrr += subMonthlyRevenue
    liveMonthlyCogs += subMonthlyCogs
    liveMonthlyGatewayFees += subMonthlyGateway

    tenantBreakdown.push({
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: sub.tenant?.name || "Workspace",
      tenantSlug: sub.tenant?.slug || "-",
      userName: sub.user?.name || "Owner",
      userEmail: sub.user?.email || "-",
      planSlug: sub.plan,
      planName: econ.name,
      category: econ.category,
      monthlyRevenue: subMonthlyRevenue,
      monthlyCogs: subMonthlyCogs,
      monthlyGrossProfit: subMonthlyRevenue - subMonthlyCogs,
      marginPercent: econ.grossProfitMarginPercent,
      currentPeriodEnd: sub.currentPeriodEnd,
      status: sub.status,
    })
  }

  const liveMonthlyGrossProfit = liveMrr - liveMonthlyCogs
  const liveMonthlyNetProfit = liveMonthlyGrossProfit - liveMonthlyGatewayFees
  const overallGrossMargin = liveMrr > 0 ? Math.round((liveMonthlyGrossProfit / liveMrr) * 1000) / 10 : 0
  const overallNetMargin = liveMrr > 0 ? Math.round((liveMonthlyNetProfit / liveMrr) * 1000) / 10 : 0

  // Category Aggregations
  const categoryStats = {
    vps: { count: 0, mrr: 0, cogs: 0, profit: 0 },
    vds: { count: 0, mrr: 0, cogs: 0, profit: 0 },
    storage: { count: 0, mrr: 0, cogs: 0, profit: 0 },
    cloud: { count: 0, mrr: 0, cogs: 0, profit: 0 },
  }

  for (const tb of tenantBreakdown) {
    const cat = (tb.category as "vps" | "vds" | "storage" | "cloud") || "cloud"
    if (categoryStats[cat]) {
      categoryStats[cat].count += 1
      categoryStats[cat].mrr += tb.monthlyRevenue
      categoryStats[cat].cogs += tb.monthlyCogs
      categoryStats[cat].profit += tb.monthlyGrossProfit
    }
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
