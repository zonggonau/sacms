import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { enforceUserAiCredits } from "@/lib/plan-enforcement"
import { getUserPlanConfig } from "@/lib/tenant-plan"

/**
 * GET /api/ai/account-credits
 * Returns the current authenticated user's AI credits status and recent ledger.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        aiCreditsUsed: true,
        aiCreditsExtra: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const creditStatus = await enforceUserAiCredits(userId, 0)
    const planConfig = await getUserPlanConfig(userId)

    const recentLedger = await db.aiQuotaLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        tenant: {
          select: { name: true, slug: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      plan: user.plan,
      planName: planConfig.plan_slug,
      creditsUsed: user.aiCreditsUsed || 0,
      creditsTotal: creditStatus.max,
      creditsRemaining: creditStatus.remaining,
      creditsExtra: user.aiCreditsExtra || 0,
      isUnlimited: creditStatus.max >= 900000,
      recentLedger: recentLedger.map(l => ({
        id: l.id,
        action: l.action,
        credits: l.credits || 1,
        tokens: l.tokens,
        model: l.model,
        workspaceName: l.tenant?.name || "Global / Account Studio",
        workspaceSlug: l.tenant?.slug || null,
        createdAt: l.createdAt.toISOString()
      }))
    })
  } catch (error: any) {
    console.error("[Account Credits API Error]", error)
    return NextResponse.json({ error: error.message || "Failed to fetch credit info" }, { status: 500 })
  }
}
