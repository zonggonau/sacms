import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { calculateProratedAmount, PLAN_PRICES } from "@/lib/midtrans"

/**
 * POST /api/tenant/[tenant]/subscription/prorate
 * Calculate prorated amount for plan upgrade
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const body = await request.json()
    const { newPlan } = body

    // Validate plan
    if (!newPlan || !["free", "starter", "pro", "enterprise"].includes(newPlan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Find tenant
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
      include: {
        members: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check if user is a member
    const membership = tenant.members.find((m) => m.userId === session.user.id)
    const isSuperAdmin = session.user.role === "super_admin"

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get existing subscription
    const subscription = await db.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    // Calculate proration
    const proration = calculateProratedAmount(
      subscription.plan,
      newPlan,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    )

    // Format response
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(price)
    }

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
      isUpgrade: proration.fullPrice > PLAN_PRICES[subscription.plan],
      message:
        proration.amountDue === 0
          ? "No payment required - credit covers the upgrade"
          : proration.amountDue < proration.fullPrice
          ? `You'll only pay ${formatPrice(
              proration.amountDue
            )} (credit applied: ${formatPrice(proration.credit)})`
          : `Upgrade to ${newPlan} for ${formatPrice(proration.fullPrice)}`,
    })
  } catch (error) {
    console.error("Error calculating proration:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}