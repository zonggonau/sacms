import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { PLAN_PRICES } from "@/lib/midtrans"

/**
 * PATCH /api/tenant/[tenant]/subscription/plan
 * Upgrade or downgrade subscription plan
 */
export async function PATCH(
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
    const { planId } = body

    // Validate plan
    if (!planId || !["free", "starter", "pro", "enterprise"].includes(planId)) {
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

    // Check if user is owner or admin
    const membership = tenant.members.find((m) => m.userId === session.user.id)
    const isSuperAdmin = session.user.role === "super_admin"

    if (
      !membership ||
      !["owner", "admin"].includes(membership.role)
    ) {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get existing subscription
    const subscription = await db.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    // Check if same plan
    if (subscription.plan === planId) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 })
    }

    const { getDynamicWorkspacePrices } = await import("@/lib/midtrans")
    const dynamicPrices = await getDynamicWorkspacePrices()

    const currentPlanPrice = dynamicPrices[subscription.plan]?.monthly || 0
    const newPlanPrice = dynamicPrices[planId]?.monthly || 0

    // Check for downgrade - can downgrade anytime
    const isDowngrade = newPlanPrice < currentPlanPrice

    if (isDowngrade) {
      // Handle downgrade
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: planId,
          currentPeriodEnd: null, // Downgrade effective immediately
        },
      })

      // Update tenant plan
      await db.tenant.update({
        where: { id: tenant.id },
        data: { plan: planId },
      })

      return NextResponse.json({
        success: true,
        message: "Plan downgraded successfully",
        plan: planId,
        effectiveImmediately: true,
      })
    }

    // For upgrades, user needs to pay the difference
    // Calculate prorated amount (simplified - full price for now)
    const upgradePrice = newPlanPrice

    return NextResponse.json({
      success: false,
      requiresPayment: true,
      message: "Payment required to upgrade plan",
      currentPlan: subscription.plan,
      newPlan: planId,
      upgradePrice,
    })
  } catch (error) {
    console.error("Error updating plan:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}