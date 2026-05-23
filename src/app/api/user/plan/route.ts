import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { USER_PLAN_LIMITS } from "@/lib/tenant-plan"
import { PLAN_HIERARCHY } from "@/lib/plan-enforcement"

/**
 * PUT /api/user/plan
 * Update the current user's plan.
 * 
 * Rules:
 * - Downgrade is always allowed (but may orphan excess workspaces)
 * - Upgrade requires an active paid subscription (unless super_admin)
 * - Super admins can set any plan without payment
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { plan } = await request.json()

    if (!plan || !USER_PLAN_LIMITS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Get canonical plan slug (handle legacy aliases)
    const canonicalSlug = USER_PLAN_LIMITS[plan].plan_slug

    // Get current user
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, role: true },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const currentLevel = PLAN_HIERARCHY.indexOf(
      (USER_PLAN_LIMITS[user.plan]?.plan_slug || "free") as any
    )
    const targetLevel = PLAN_HIERARCHY.indexOf(canonicalSlug as any)
    const isUpgrade = targetLevel > currentLevel

    // Super admins bypass payment requirement
    if (user.role === "super_admin") {
      const updatedUser = await db.user.update({
        where: { id: session.user.id },
        data: { plan: canonicalSlug },
      })

      return NextResponse.json({ 
        message: "Plan updated successfully (admin bypass)",
        plan: updatedUser.plan 
      })
    }

    // For upgrades, require active subscription/payment
    if (isUpgrade) {
      const activeSubscription = await db.subscription.findFirst({
        where: {
          userId: session.user.id,
          tenantId: null, // User-level subscription (not workspace)
          plan: canonicalSlug,
          status: { in: ["active", "trialing"] },
        },
      })

      if (!activeSubscription) {
        return NextResponse.json({ 
          error: `Cannot upgrade to "${canonicalSlug}" without an active subscription. Please complete payment first.`,
          requiresPayment: true,
          targetPlan: canonicalSlug,
        }, { status: 402 })
      }
    }

    // For downgrades, warn about potential workspace overflow
    if (!isUpgrade && targetLevel < currentLevel) {
      const targetConfig = USER_PLAN_LIMITS[canonicalSlug]
      const ownedWorkspaces = await db.tenantMember.count({
        where: {
          userId: session.user.id,
          role: "owner",
          tenant: { slug: { notIn: ["sacms-global"] } },
        },
      })

      if (ownedWorkspaces > targetConfig.max_workspaces) {
        return NextResponse.json({ 
          error: `Cannot downgrade to "${canonicalSlug}". You currently own ${ownedWorkspaces} workspaces but the plan allows max ${targetConfig.max_workspaces}. Please delete or transfer workspaces first.`,
          currentWorkspaces: ownedWorkspaces,
          maxAllowed: targetConfig.max_workspaces,
        }, { status: 400 })
      }
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { plan: canonicalSlug },
    })

    return NextResponse.json({ 
      message: "Plan updated successfully",
      plan: updatedUser.plan 
    })
  } catch (error) {
    console.error("Error updating user plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
