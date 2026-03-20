import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

/**
 * POST /api/tenant/[tenant]/subscription/cancel
 * Cancel subscription
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
    const { cancelAtPeriodEnd = true } = body

    // Find tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
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

    // Check if already cancelled
    if (subscription.status === "canceled" || subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Subscription already cancelled" },
        { status: 400 }
      )
    }

    // Can't cancel free plan
    if (subscription.plan === "free") {
      return NextResponse.json(
        { error: "Cannot cancel free plan" },
        { status: 400 }
      )
    }

    if (cancelAtPeriodEnd) {
      // Cancel at end of billing period
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Subscription will be cancelled at end of billing period",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
    } else {
      // Cancel immediately
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        },
      })

      // Downgrade to free plan
      await db.subscription.update({
        where: { id: subscription.id },
        data: { plan: "free" },
      })

      // Update tenant plan
      await db.tenant.update({
        where: { id: tenant.id },
        data: { plan: "free" },
      })

      return NextResponse.json({
        success: true,
        message: "Subscription cancelled immediately",
        cancelAtPeriodEnd: false,
        plan: "free",
      })
    }
  } catch (error) {
    console.error("Error cancelling subscription:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tenant/[tenant]/subscription/cancel
 * Get cancellation options
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    // Find tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
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
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    return NextResponse.json({
      plan: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canCancel: subscription.plan !== "free",
      cancelOptions: {
        cancelAtPeriodEnd: {
          description: "Cancel at end of billing period",
          effectiveDate: subscription.currentPeriodEnd,
          willDowngrade: true,
        },
        cancelImmediately: {
          description: "Cancel immediately and downgrade to free plan",
          effectiveDate: new Date(),
          willDowngrade: true,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching cancel options:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}