import { NextResponse } from "next/server"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { getWorkspacePlan } from "@/lib/pricing"

/** PATCH /api/tenant/[tenant]/subscription/plan — upgrade / downgrade (admin/owner). */
export const PATCH = withStaffAuth(
  async (request, _context, { access }) => {
    const { planId } = await request.json()
    if (typeof planId !== "string" || !planId) {
      return apiError("validation", { message: "Invalid plan" })
    }
    if (access.tenant.plan === planId) return apiError("validation", { message: "Already on this plan" })
    if (planId === "free") {
      return apiError("validation", { message: "Gunakan pembatalan langganan untuk beralih ke paket Gratis." })
    }

    const plan = await getWorkspacePlan(planId)
    if (!plan?.isActive) return apiError("validation", { message: "Invalid plan" })

    return NextResponse.json({
      success: false,
      requiresPayment: true,
      message: "Payment required to change plan",
      currentPlan: access.tenant.plan,
      newPlan: planId,
      upgradePrice: plan.price,
    })
  },
  { minRole: "admin" },
)
