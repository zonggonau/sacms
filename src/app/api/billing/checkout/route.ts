import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getPaymentProvider } from "@/lib/payment"
import { getDynamicAccountPrices, getDynamicWorkspacePrices } from "@/lib/midtrans"
import { validateBody } from "@/lib/validate"
import { checkoutSchema } from "@/lib/validations"
import { USER_PLAN_LIMITS } from "@/lib/constants/tenant-limits"
import { STORAGE_ADDON_ID, STORAGE_ADDON_PRICE_IDR, storageAddonRenewalRefusal } from "@/lib/billing/storage-addon"
import {
  MANAGED_INFRA_MONTHLY_FEE_IDR,
  MANAGED_INFRA_MONTHLY_ID,
  MANAGED_INFRA_SETUP_FEE_IDR,
  MANAGED_INFRA_SETUP_ID,
  isManagedInfraProduct,
  managedInfraOrderRefusal,
} from "@/lib/billing/managed-infra"

/**
 * POST /api/checkout
 * Create a checkout session for subscription payment.
 * Uses the configured payment provider (PAYMENT_PROVIDER env var).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await validateBody(request, checkoutSchema)
    if ("error" in result) return result.error
    const { planId, tenantId, interval, type, renewsAddonId } = result.data

    const isAiCreditPack = type === "ai_credits" || planId.startsWith("ai_pack_")
    const isAccountPlan = !isAiCreditPack && (type === "account" || !tenantId)

    let amount = 0
    let planName = planId
    let isAddon = false
    let creditAmount = 0
    let targetId = tenantId || session.user.id

    let dbTenant: any = null;

    if (isAiCreditPack) {
      // Prefer the admin-editable CMS pricing table (sacms-ai-pricing) over
      // the hardcoded AI_CREDIT_PACKS fallback, mirroring how plan pricing
      // below already prefers its CMS table — otherwise a pack added only
      // in the CMS 400s here, and a pack whose price/credits an admin
      // changed in the CMS still gets charged/granted at the old hardcoded
      // amount since the UI shows the CMS value but checkout never read it.
      let packFound = false
      try {
        const aiPricingType = await db.contentType.findFirst({ where: { slug: "sacms-ai-pricing" } })
        if (aiPricingType) {
          const entries = await db.contentEntry.findMany({
            where: { contentTypeId: aiPricingType.id, status: "PUBLISHED" },
          })
          const match = entries.find((e) => {
            let d = e.data
            if (typeof d === "string") {
              try { d = JSON.parse(d) } catch { d = {} }
            }
            const data = d as any
            return (data.pack_slug || e.id) === planId
          })
          if (match) {
            let d = match.data
            if (typeof d === "string") {
              try { d = JSON.parse(d) } catch { d = {} }
            }
            const data = d as any
            amount = Number(data.price) || 0
            planName = data.name || "AI Credits"
            creditAmount = Number(data.credits) || 0
            packFound = true
          }
        }
      } catch (e) {
        console.error("Error fetching dynamic AI credit pack price:", e)
      }

      if (!packFound) {
        const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
        const pack = AI_CREDIT_PACKS.find(p => p.id === planId)
        if (!pack) {
          return NextResponse.json({ error: "Invalid AI credit pack" }, { status: 400 })
        }
        amount = pack.price_idr
        planName = pack.name
        creditAmount = pack.credits
      }

      if (!amount || !creditAmount) {
        return NextResponse.json({ error: "Invalid AI credit pack" }, { status: 400 })
      }
      isAddon = true
    } else if (isAccountPlan) {
      // Logic for account plan pricing
      const dynamicPrices = await getDynamicAccountPrices()
      const prices = dynamicPrices[planId] || { monthly: 0, yearly: 0 }
      amount = interval === 'year' ? prices.yearly : prices.monthly
      planName = planId.charAt(0).toUpperCase() + planId.slice(1)
    } else {
      // Get tenant and verify access
      const tenant = await db.tenant.findFirst({
        where: { 
          OR: [{ id: tenantId }, { slug: tenantId }]
        },
        include: { members: true },
      })
      dbTenant = tenant

      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
      }

      // Check if user is a member of this tenant or super admin
      const membership = tenant.members.find(m => m.userId === session.user.id)
      const isSuperAdmin = session.user.role === "super_admin"

      if (!membership && !isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Only owner or admin can upgrade plan
      if (membership && membership.role !== "owner" && membership.role !== "admin") {
        return NextResponse.json(
          { error: "Only owner or admin can manage subscription" },
          { status: 403 }
        )
      }

      const BUILTIN_TOPUPS: Record<string, { name: string; price: number; quotaType: string; amountUnits: number }> = {
        topup_ai_500k: { name: "AI Booster (500K Tokens)", price: 25000, quotaType: "ai_tokens", amountUnits: 500000 },
        topup_ai_2m: { name: "AI Power Pack (2M Tokens)", price: 75000, quotaType: "ai_tokens", amountUnits: 2000000 },
        [STORAGE_ADDON_ID]: { name: "Extra Storage (10 GB / bulan)", price: STORAGE_ADDON_PRICE_IDR, quotaType: "storage", amountUnits: 10 * 1024 * 1024 * 1024 },
        [MANAGED_INFRA_SETUP_ID]: { name: "Database & Storage Sendiri — Setup + Bulan Pertama", price: MANAGED_INFRA_SETUP_FEE_IDR + MANAGED_INFRA_MONTHLY_FEE_IDR, quotaType: "managed_infra", amountUnits: 1 },
        [MANAGED_INFRA_MONTHLY_ID]: { name: "Database & Storage Sendiri — Perpanjangan 1 Bulan", price: MANAGED_INFRA_MONTHLY_FEE_IDR, quotaType: "managed_infra", amountUnits: 1 },
        topup_api_500k: { name: "Extra API Quota (500K Calls)", price: 30000, quotaType: "api_calls", amountUnits: 500000 },
        hosting_annual_1yr: { name: "Cloud Edge Hosting (1 Tahun)", price: 650000, quotaType: "hosting_annual", amountUnits: 1 },
        hosting_bundle_domain_1yr: { name: "Cloud Edge Hosting + Domain .com (1 Tahun)", price: 850000, quotaType: "hosting_bundle", amountUnits: 1 },
      }

      if (isManagedInfraProduct(planId)) {
        const refusal = await managedInfraOrderRefusal(tenant.id, planId)
        if (refusal) return NextResponse.json({ error: refusal }, { status: 409 })
      }
      if (renewsAddonId) {
        const refusal = planId === STORAGE_ADDON_ID
          ? await storageAddonRenewalRefusal(tenant.id, renewsAddonId)
          : "Hanya add-on storage yang bisa diperpanjang."
        if (refusal) return NextResponse.json({ error: refusal }, { status: 409 })
      }

      if (BUILTIN_TOPUPS[planId]) {
        const topup = BUILTIN_TOPUPS[planId]
        amount = topup.price
        planName = topup.name
        isAddon = true
      } else {
        const pricingContentTypes = await db.contentType.findMany({
          where: { slug: { in: ["sacms-workspace-pricing", "platform-pricing", "sacms-addons"] } }
        })

        if (pricingContentTypes.length > 0) {
          const contentTypeIds = pricingContentTypes.map(ct => ct.id)
          const planEntries = await db.contentEntry.findMany({
            where: { contentTypeId: { in: contentTypeIds }, status: "PUBLISHED" }
          })
          
          const planEntry = planEntries.find(e => {
            let d = e.data
            if (typeof d === 'string') {
              try { d = JSON.parse(d) } catch (e) { d = {} }
            }
            const data = d as any
            return data.plan_slug === planId || data.id === planId || e.id === planId || data.name?.toLowerCase() === planId.toLowerCase()
          })

          if (planEntry) {
            let d = planEntry.data
            if (typeof d === 'string') {
              try { d = JSON.parse(d) } catch (e) { d = {} }
            }
            const data = d as any
            
            let rawPrice = data.price || "0"
            let monthlyPrice = 0
            let yearlyPrice = 0
            if (typeof rawPrice === 'string') {
              monthlyPrice = parseInt(rawPrice.replace(/[^\d]/g, ''), 10) || 0
            } else {
              monthlyPrice = Number(rawPrice) || 0
            }
            
            if (data.yearly_price !== undefined) {
              yearlyPrice = Number(data.yearly_price)
            } else {
              yearlyPrice = monthlyPrice * 10
            }

            amount = interval === 'year' ? yearlyPrice : monthlyPrice
            planName = data.name || planId
            const addonContentType = pricingContentTypes.find(ct => ct.slug === "sacms-addons")
            isAddon = addonContentType?.id === planEntry.contentTypeId
          } else {
            const dynamicPrices = await getDynamicWorkspacePrices()
            const prices = dynamicPrices[planId] || { monthly: 0, yearly: 0 }
            amount = interval === 'year' ? prices.yearly : prices.monthly
            // Fallback to hardcoded PLAN_PRICES if dynamic returns 0
            if (!amount) {
              const { PLAN_PRICES } = await import('@/lib/midtrans')
              const base = PLAN_PRICES[planId] ?? 0
              amount = interval === 'year' ? base * 10 : base
            }
          }
        } else {
          const dynamicPrices = await getDynamicWorkspacePrices()
          const prices = dynamicPrices[planId] || { monthly: 0, yearly: 0 }
          amount = interval === 'year' ? prices.yearly : prices.monthly
          // Fallback to hardcoded PLAN_PRICES if dynamic returns 0
          if (!amount) {
            const { PLAN_PRICES } = await import('@/lib/midtrans')
            const base = PLAN_PRICES[planId] ?? 0
            amount = interval === 'year' ? base * 10 : base
          }
        }
      }
    }

    // Independent of the price-based isDowngrade check below (which only
    // fires while subscription.status === 'active' and can misfire if the
    // account/workspace CMS price tables diverge — see calculateProratedAmount),
    // block an account-plan downgrade that would leave the user owning more
    // workspaces than the target plan allows, mirroring the same guard in
    // PUT /api/auth/user/plan.
    if (isAccountPlan) {
      const targetConfig = USER_PLAN_LIMITS[planId]
      if (targetConfig) {
        const currentUser = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } })
        const currentConfig = USER_PLAN_LIMITS[currentUser?.plan || "free"]
        if ((currentConfig?.max_workspaces ?? 0) > targetConfig.max_workspaces) {
          const { getGlobalWorkspaceId } = await import("@/lib/settings")
          const ownedWorkspaces = await db.tenantMember.count({
            where: {
              userId: session.user.id,
              role: "owner",
              tenantId: { notIn: [await getGlobalWorkspaceId()] },
            },
          })
          if (ownedWorkspaces > targetConfig.max_workspaces) {
            return NextResponse.json(
              {
                error: `Cannot downgrade to "${planId}". You currently own ${ownedWorkspaces} workspaces but the plan allows max ${targetConfig.max_workspaces}. Please delete or transfer workspaces first.`,
                currentWorkspaces: ownedWorkspaces,
                maxAllowed: targetConfig.max_workspaces,
              },
              { status: 400 },
            )
          }
        }
      }
    }

    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getFullYear()}`;

    // A random suffix, not just a sequential counter — sequential order ids
    // (SUB-ddmmyyyy1001, 1002, ...) are trivially enumerable by any
    // authenticated user, which matters because PaymentTransaction lookups
    // by orderId are a real access boundary elsewhere (status route).
    const { randomBytes } = await import("crypto")
    const randomSuffix = randomBytes(4).toString("hex");
    const prefix = isAiCreditPack ? 'AIC' : (isAccountPlan ? 'ACC' : (isAddon ? 'ADD' : 'SUB'));
    const orderId = `${prefix}-${formattedDate}-${randomSuffix}`;

    // Get or create subscription
    let subscription = await db.subscription.findFirst({
      where: isAccountPlan || isAiCreditPack
        ? { userId: session.user.id, tenantId: { equals: null } as any } 
        : { tenantId: dbTenant.id },
    })

    let credit = 0;
    if (subscription && !isAddon && subscription.status !== 'canceled') {
      const { calculateProratedAmount } = await import("@/lib/midtrans")
      const proration = await calculateProratedAmount(
        subscription.plan,
        planId,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        isAccountPlan
      )
      if (proration.isDowngrade && subscription.status === 'active') {
        return NextResponse.json(
          { error: "Downgrading an active subscription is not allowed. Please wait until your current billing period ends." }, 
          { status: 403 }
        )
      }
      credit = proration.credit || 0
    }

    const subtotal = Math.max(0, amount - credit)

    // Guard: Midtrans requires amount >= 1
    if (subtotal <= 0 || amount <= 0) {
      return NextResponse.json(
        { 
          error: "Harga paket ini belum dikonfigurasi. Silakan hubungi admin untuk mengatur harga paket terlebih dahulu.",
          code: "PRICE_NOT_CONFIGURED"
        },
        { status: 400 }
      )
    }

    // Calculate PPN (11%) on subtotal
    const vatAmount = Math.round(subtotal * 0.11)
    const totalAmount = subtotal + vatAmount

    if (!subscription) {
      subscription = await db.subscription.create({
        data: {
          userId: session.user.id,
          tenantId: (isAccountPlan || isAiCreditPack) ? null : dbTenant.id,
          // Always start at the unpaid baseline — never the plan being
          // checked out. Writing the intended plan/period here (the old
          // behavior) meant an abandoned, never-paid checkout permanently
          // changed what the NEXT checkout's calculateProratedAmount() reads
          // as "currently active", letting a tenant collect proration credit
          // against a plan they never actually bought. The intended plan is
          // only applied once payment is confirmed — see applyPaymentOutcome
          // in src/lib/billing/payment-success.ts, which reads it back from
          // this transaction's rawResponse.intendedPlan below.
          plan: "free",
          status: 'pending',
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      })
    }
    // else: never write plan/currentPeriodEnd here for any order type —
    // see the comment above. The existing subscription row is left exactly
    // as the last successful payment set it.

    // Store what was actually checked out — addon/AI-credit metadata, or
    // (for a plain plan upgrade/downgrade) the intended plan + interval —
    // for applyPaymentOutcome to apply once payment is confirmed. Never
    // write the field as literal `null`; Prisma rejects that for a Json
    // column, so the addon/non-addon shapes just differ in which keys they carry.
    const rawResponse = isAiCreditPack
      ? { isAddon: true, addonId: planId, credits: creditAmount, type: "ai_credits" }
      : isAddon
        ? { isAddon, addonId: planId, ...(renewsAddonId && planId === STORAGE_ADDON_ID ? { renewsAddonId } : {}) }
        : { intendedPlan: planId, intendedInterval: interval }

    // Create payment transaction record
    const transaction = await db.paymentTransaction.create({
      data: {
        orderId,
        amount: totalAmount,
        status: 'pending',
        subscriptionId: subscription.id,
        ...(rawResponse ? { rawResponse: rawResponse as any } : {}),
      },
    })

    // Create payment via the abstracted provider
    const provider = getPaymentProvider()
    const paymentResult = await provider.createPayment({
      orderId,
      amount: totalAmount,
      customer: {
        email: session.user.email,
        firstName: session.user.name || 'User',
      },
      items: [
        {
          id: planId,
          name: isAddon ? `${planName} Add-on` : `${planName} Plan (${interval === 'year' ? 'Yearly' : 'Monthly'})`,
          price: subtotal,
          quantity: 1,
        },
        {
          id: 'VAT-11',
          name: 'PPN (11%)',
          price: vatAmount,
          quantity: 1,
        }
      ],
    })

    return NextResponse.json({
      token: paymentResult.token,
      redirect_url: paymentResult.redirectUrl,
      provider: provider.name,
      orderId,
      subscriptionId: subscription.id,
      transactionId: transaction.id,
    })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Gagal memproses transaksi checkout. Silakan coba lagi atau hubungi admin."
            : `Checkout error: ${message}`,
      },
      { status: 500 },
    )
  }
}