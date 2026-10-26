import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** Resolve the workspace's owning account — see createTenantAction/
 *  api/tenants POST for why this is the same `freeWorkspaceUsed` lifetime
 *  flag, not derived from the tenant's current plan. */
async function getFreeWorkspaceUsedOwnerId(tenantId: string): Promise<string | null> {
  const owner = await db.tenantMember.findFirst({
    where: { tenantId, role: "owner" },
    select: { userId: true },
  })
  return owner?.userId ?? null
}

/** POST /api/tenant/[tenant]/subscription/cancel — cancel a paid subscription (admin/owner). */
export const POST = withStaffAuth(
  async (request, _context, { access }) => {
    const { cancelAtPeriodEnd = true } = await request.json()

    const subscription = await db.subscription.findFirst({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })
    if (!subscription) return apiError("not_found", { message: "Subscription not found" })

    if (subscription.status === "canceled" || subscription.cancelAtPeriodEnd) {
      return apiError("validation", { message: "Subscription already cancelled" })
    }
    if (subscription.plan === "free") {
      return apiError("validation", { message: "Cannot cancel free plan" })
    }

    // One free WORKSPACE per account, ever (see User.freeWorkspaceUsed) —
    // applies here too, not just at creation: cancelling a paid plan
    // "downgrades to free" the same way a brand-new workspace would start
    // on free, so it must be blocked once the account has already used
    // its one allowance on some other workspace.
    const ownerId = await getFreeWorkspaceUsedOwnerId(access.tenantId)
    if (ownerId) {
      const owner = await db.user.findUnique({ where: { id: ownerId }, select: { freeWorkspaceUsed: true } })
      if (owner?.freeWorkspaceUsed) {
        return apiError("validation", {
          message: "Akun Anda sudah pernah menggunakan paket Workspace Gratis. Pilih paket berbayar lain, atau hubungi dukungan untuk menutup workspace ini.",
        })
      }
    }

    if (cancelAtPeriodEnd) {
      await db.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true } })
      return NextResponse.json({
        success: true,
        message: "Subscription will be cancelled at end of billing period",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
    }

    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: null, plan: "free" },
    })
    await db.tenant.update({ where: { id: access.tenantId }, data: { plan: "free" } })
    if (ownerId) {
      await db.user.update({ where: { id: ownerId }, data: { freeWorkspaceUsed: true } })
    }

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled immediately",
      cancelAtPeriodEnd: false,
      plan: "free",
    })
  },
  { minRole: "admin" },
)

/** GET /api/tenant/[tenant]/subscription/cancel — cancellation options. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const subscription = await db.subscription.findFirst({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
  })
  if (!subscription) return apiError("not_found", { message: "Subscription not found" })

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
})
