import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** PATCH /api/tenant/[tenant]/subscription/plan — upgrade / downgrade (admin/owner). */
export const PATCH = withStaffAuth(
  async (request, _context, { access }) => {
    const { planId } = await request.json()
    if (!planId || !["free", "starter", "pro", "enterprise"].includes(planId)) {
      return apiError("validation", { message: "Invalid plan" })
    }

    const subscription = await db.subscription.findFirst({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })
    if (!subscription) return apiError("not_found", { message: "Subscription not found" })
    if (subscription.plan === planId) return apiError("validation", { message: "Already on this plan" })

    const { getDynamicWorkspacePrices } = await import("@/lib/midtrans")
    const dynamicPrices = await getDynamicWorkspacePrices()
    const currentPlanPrice = dynamicPrices[subscription.plan]?.monthly || 0
    const newPlanPrice = dynamicPrices[planId]?.monthly || 0

    if (newPlanPrice < currentPlanPrice) {
      // Same restriction the checkout flow enforces for an upgrade mid-
      // period — this route used to allow an immediate, free downgrade at
      // any time, bypassing that rule entirely: an admin could hit this
      // endpoint directly to instantly downgrade off a plan they just paid
      // for, forfeiting the remaining paid days with zero compensation, and
      // resetting currentPeriodEnd to null (which is also what
      // calculateProratedAmount reads as "no active period" — a free credit
      // vector on the next upgrade). Once the paid period has actually
      // lapsed, downgrading here is fine — nothing paid-for is being given up.
      const isActivePeriod = subscription.status === "active"
        && subscription.currentPeriodEnd
        && new Date(subscription.currentPeriodEnd) > new Date()
      if (isActivePeriod) {
        return apiError("validation", {
          message: "Downgrading an active subscription is not allowed. Please wait until your current billing period ends.",
        })
      }

      await db.subscription.update({
        where: { id: subscription.id },
        data: { plan: planId, currentPeriodEnd: null },
      })
      await db.tenant.update({ where: { id: access.tenantId }, data: { plan: planId } })
      return NextResponse.json({
        success: true,
        message: "Plan downgraded successfully",
        plan: planId,
        effectiveImmediately: true,
      })
    }

    return NextResponse.json({
      success: false,
      requiresPayment: true,
      message: "Payment required to upgrade plan",
      currentPlan: subscription.plan,
      newPlan: planId,
      upgradePrice: newPlanPrice,
    })
  },
  { minRole: "admin" },
)
