import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getPaymentProvider } from "@/lib/payment"
import { PLAN_PRICES, PlanType, calculatePeriodEndDate } from "@/lib/midtrans"
import { validateBody } from "@/lib/validate"
import { checkoutSchema } from "@/lib/validations"

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
    const { planId, tenantId, interval } = result.data

    // Get tenant and verify access
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { members: true },
    })

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

    // Get plan details from database (platform-pricing content type)
    const pricingContentType = await db.contentType.findUnique({
      where: { slug: "platform-pricing" }
    })

    let amount = 0
    let planName = planId
    let isAddon = false

    if (pricingContentType) {
      const planEntries = await db.contentEntry.findMany({
        where: { contentTypeId: pricingContentType.id, status: "PUBLISHED" }
      })
      
      const planEntry = planEntries.find(e => {
        let d = e.data
        if (typeof d === 'string') {
          try {
            d = JSON.parse(d)
          } catch (e) {
            d = {}
          }
        }
        return (d as any).id === planId || e.id === planId || (d as any).name?.toLowerCase() === planId.toLowerCase()
      })

      if (planEntry) {
        let d = planEntry.data
        if (typeof d === 'string') {
          try {
            d = JSON.parse(d)
          } catch (e) {
            d = {}
          }
        }
        const data = d as any
        const monthlyPrice = Number(data.price) || 0
        amount = interval === 'year' ? monthlyPrice * 12 : monthlyPrice
        planName = data.name || planId
        isAddon = data.type === "addons"
      } else {
        // Fallback to old hardcoded prices if not found in DB
        const monthlyPrice = PLAN_PRICES[planId as PlanType] || 0
        amount = interval === 'year' ? monthlyPrice * 12 : monthlyPrice
      }
    } else {
      const monthlyPrice = PLAN_PRICES[planId as PlanType] || 0
      amount = interval === 'year' ? monthlyPrice * 12 : monthlyPrice
    }

    const orderId = `${isAddon ? 'ADD' : 'SUB'}-${tenantId}-${Date.now()}`

    // Calculate PPN (11%)
    const vatAmount = Math.round(amount * 0.11)
    const totalAmount = amount + vatAmount

    // Get or create subscription
    let subscription = await db.subscription.findFirst({
      where: { tenantId },
    })

    if (!subscription) {
      subscription = await db.subscription.create({
        data: {
          userId: session.user.id,
          tenantId,
          plan: isAddon ? "free" : planId, // Default to free if buying addon first
          status: 'pending',
          currentPeriodStart: new Date(),
          currentPeriodEnd: calculatePeriodEndDate(planId as PlanType, interval as any),
        },
      })
    } else {
      // Only update main plan if it's NOT an addon
      if (!isAddon) {
        subscription = await db.subscription.update({
          where: { id: subscription.id },
          data: {
            plan: planId,
            currentPeriodEnd: calculatePeriodEndDate(planId as PlanType, interval as any),
          },
        })
      }
    }

    // Create payment transaction record
    const transaction = await db.paymentTransaction.create({
      data: {
        orderId,
        amount: totalAmount,
        status: 'pending',
        subscriptionId: subscription.id,
        // Store addon info in rawResponse for later processing in webhook
        rawResponse: isAddon ? JSON.stringify({ isAddon, addonId: planId }) : null
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
          price: amount,
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}