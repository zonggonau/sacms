import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import BillingClient from "./billing-client"
import { getTransactionHistoryAction } from "@/actions/billing"
import { formatRupiahPlain as formatRupiah } from "@/lib/plan-pricing"
import { isEnterpriseTenant } from "@/lib/license"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // 1. Fetch Account Plans from the dedicated AccountPlan table
  let accountPlans: any[] = []
  try {
    const { getAccountPlans } = await import("@/lib/pricing")
    const plans = await getAccountPlans()

    if (plans.length > 0) {
      accountPlans = plans.map(p => {
        const monthlyPrice = p.price
        const yearlyPrice = p.yearlyPrice ?? monthlyPrice * 10
        const displayYearlyPrice = formatRupiah(yearlyPrice)
        const displayMonthlyPrice = formatRupiah(monthlyPrice)

        return {
          id: p.slug,
          name: p.name || "Unnamed Plan",
          description: p.description || "",
          workspaces: p.maxWorkspaces || "Unlimited",
          price: displayYearlyPrice,
          priceAmount: yearlyPrice,
          monthlyPrice: displayMonthlyPrice,
          monthlyPriceAmount: monthlyPrice,
          yearlyPrice: displayYearlyPrice,
          yearlyPriceAmount: yearlyPrice,
          features: Array.isArray(p.features) ? p.features : [],
          popular: p.isPopular === true || p.slug === "pro"
        }
      })
    }

    // Default canonical account plans if none in database
    const canonicalPlans = [
      {
        id: "free",
        name: "Akun Gratis",
        description: "Mulai tanpa biaya untuk eksplorasi dan pengembangan sandbox.",
        workspaces: "1",
        price: "Rp 0",
        priceAmount: 0,
        monthlyPrice: "Rp 0",
        monthlyPriceAmount: 0,
        yearlyPrice: "Rp 0",
        yearlyPriceAmount: 0,
        features: ["1 Workspace Mandiri", "Akses Penuh CMS Editor & API", "Dukungan Komunitas"],
        popular: false
      },
      {
        id: "starter",
        name: "Akun Standar",
        description: "Sangat ekonomis untuk solo developer, freelance & UMKM.",
        workspaces: "3",
        price: "Rp 390.000",
        priceAmount: 390000,
        monthlyPrice: "Rp 49.000",
        monthlyPriceAmount: 49000,
        yearlyPrice: "Rp 390.000",
        yearlyPriceAmount: 390000,
        features: ["Hingga 3 Workspace Aktif", "Multi-Project Management UMKM", "Akses REST & GraphQL API", "Dukungan Email Prioritas"],
        popular: false
      },
      {
        id: "pro",
        name: "Akun Profesional",
        description: "Paling diminati untuk agensi digital, startup & tim produk.",
        workspaces: "5",
        price: "Rp 990.000",
        priceAmount: 990000,
        monthlyPrice: "Rp 129.000",
        monthlyPriceAmount: 129000,
        yearlyPrice: "Rp 990.000",
        yearlyPriceAmount: 990000,
        features: ["Hingga 5 Workspace Aktif", "Kolaborasi Multi-Tim & RBAC", "Custom Domain Routing", "Audit Log & Security Center", "Dukungan Prioritas 24/7"],
        popular: true
      },
      {
        id: "enterprise",
        name: "Akun Bisnis & Agensi",
        description: "Kapasitas besar untuk software house & agensi berskala.",
        workspaces: "10",
        price: "Rp 2.490.000",
        priceAmount: 2490000,
        monthlyPrice: "Rp 299.000",
        monthlyPriceAmount: 299000,
        yearlyPrice: "Rp 2.490.000",
        yearlyPriceAmount: 2490000,
        features: ["Hingga 10 Workspace Aktif", "Multi-Tenant Enterprise Hub", "Dedicated White-Label Branding", "Custom Role & Fine-Grained Permissions", "Dedicated Account Manager & SLA 99.9%"],
        popular: false
      }
    ]

    // Only fall back to the fully hardcoded set when the AccountPlan table
    // is genuinely empty — same rule getDynamicAccountPrices() in
    // midtrans.ts uses, and both now read the same table, so this and
    // checkout can no longer disagree about which plans exist.
    if (accountPlans.length === 0) {
      accountPlans = canonicalPlans
    }

    const PLAN_ORDER: Record<string, number> = { free: 1, starter: 2, pro: 3, enterprise: 4 }
    accountPlans.sort((a, b) => (PLAN_ORDER[a.id] || 99) - (PLAN_ORDER[b.id] || 99) || (a.priceAmount || 0) - (b.priceAmount || 0))
  } catch (err) {
    console.error("Failed to fetch account plans:", err)
  }

  // 1b. Account-level Enterprise License status — when active, the yearly
  // account-plan grid below is hidden entirely (see BillingClient): a
  // licensed account already has unlimited workspaces and a pooled storage
  // grant, so "buy more workspace quota" plans don't apply to it.
  const isAccountEnterpriseLicensed = await isEnterpriseTenant(session.user.id).catch(() => false)

  // 2. Fetch Active Workspaces Count & Usage & AI Credits
  let activeWorkspacesCount = 0
  let usage: any = null
  let aiCreditUsage: any = null
  try {
    const { enforceUserPlanLimit, enforceUserAiCredits } = await import("@/lib/plan-enforcement")
    const [workspaceEnforcement, aiCreditEnforcement] = await Promise.all([
      enforceUserPlanLimit(session.user.id, "workspaces"),
      enforceUserAiCredits(session.user.id, 0)
    ])
    
    usage = {
      current: workspaceEnforcement.current,
      max: workspaceEnforcement.max,
      allowed: workspaceEnforcement.allowed,
      plan: workspaceEnforcement.planSlug
    }
    activeWorkspacesCount = workspaceEnforcement.current

    aiCreditUsage = {
      used: aiCreditEnforcement.current,
      total: aiCreditEnforcement.max,
      remaining: aiCreditEnforcement.remaining,
      isUnlimited: aiCreditEnforcement.max >= 900000
    }
  } catch (err) {
    console.error("Failed to fetch usage:", err)
  }

  // 3. Fetch Transaction History (first page — the client paginates further)
  let transactions: any[] = []
  let transactionsTotalPages = 1
  try {
    const tx = await getTransactionHistoryAction(1, 50)
    if (tx) {
      transactions = tx.transactions
      transactionsTotalPages = tx.totalPages
    }
  } catch (err) {
    console.error("Failed to fetch transactions:", err)
  }

  return (
    <BillingClient
      initialAccountPlans={accountPlans}
      initialActiveWorkspacesCount={activeWorkspacesCount}
      initialUsage={usage}
      initialAiCreditUsage={aiCreditUsage}
      initialTransactions={transactions}
      initialTransactionsTotalPages={transactionsTotalPages}
      isAccountEnterpriseLicensed={isAccountEnterpriseLicensed}
    />
  )
}
