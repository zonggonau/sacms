import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getDynamicWorkspacePrices, getDynamicAccountPrices, getSubscriptionCatalogPrice } from "@/lib/midtrans"
import { loadLegacyBillingTerms, resolveSubscriptionTerms } from "@/lib/billing/subscription-terms"
import { secureEquals } from "@/lib/secure-compare"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices"

/**
 * POST /api/admin/billing/generate-invoices
 * Generate monthly invoices for active subscriptions.
 *
 * Two legitimate callers, two auth paths:
 * - The production cron (docker/cron/crontab) sends `Authorization: Bearer
 *   <CRON_SECRET>` and never has a browser session.
 * - The admin UI's "Jalankan Siklus Tagihan" button has a real admin
 *   session but has no business knowing CRON_SECRET (shipping it to the
 *   client would leak the same secret the cron relies on) — it never sent
 *   any Authorization header, which used to always fail the cron-only
 *   check below and make the button non-functional. Falls through to a
 *   normal super_admin/admin session check instead.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    const isCronCall = !!cronSecret && secureEquals(authHeader, `Bearer ${cronSecret}`)

    if (!isCronCall) {
      const session = await getServerSession(authOptions)
      if (!session?.user || !["super_admin", "finance"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    return NextResponse.json(await generateMonthlyInvoices())
  } catch (error) {
    console.error("Error generating invoices:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/billing/generate-invoices
 * Preview what invoices will be generated (for testing)
 */
// allowRoles: ["finance"] — matches every other admin billing page/route.
export const GET = withAdminAuth(async () => {
    // Get all active subscriptions
    const activeSubscriptions = await db.subscription.findMany({
      where: {
        status: "active",
        tenantSlugSnapshot: null,
        OR: [{ userId: { not: null } }, { tenantId: { not: null } }],
        NOT: {
          cancelAtPeriodEnd: true,
        },
      },
      include: {
        tenant: true,
        user: true,
      },
    })

    const now = new Date()

    const [dynamicWorkspacePrices, dynamicAccountPrices, checkoutTerms] = await Promise.all([
      getDynamicWorkspacePrices({ includeInactive: true }),
      getDynamicAccountPrices({ includeInactive: true }),
      loadLegacyBillingTerms(activeSubscriptions),
    ])

    const preview = activeSubscriptions.map((sub) => {
      const isAccountPlan = !sub.tenantId
      const catalog = getSubscriptionCatalogPrice(sub.plan, isAccountPlan, dynamicWorkspacePrices, dynamicAccountPrices)
      const { amount, interval } = resolveSubscriptionTerms(sub, catalog, checkoutTerms)

      return {
      subscriptionId: sub.id,
      tenantName: sub.tenant?.name || 'Account Plan',
      tenantSlug: sub.tenant?.slug || 'account-plan',
      plan: sub.plan,
      currentPeriodEnd: sub.currentPeriodEnd,
      planPrice: amount,
      interval,
      needsBilling:
        amount > 0 && !!sub.currentPeriodEnd && sub.currentPeriodEnd <= now &&
        now.getTime() - sub.currentPeriodEnd.getTime() < 31 * 86_400_000,
      daysOverdue:
        sub.currentPeriodEnd
          ? Math.floor(
              (now.getTime() - new Date(sub.currentPeriodEnd).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0,
    }})

    const totalPendingInvoices = preview.filter((p) => p.needsBilling).length
    const totalRevenue = preview
      .filter((p) => p.needsBilling)
      .reduce((sum, p) => sum + p.planPrice, 0)

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(price)
    }

    return NextResponse.json({
      totalActiveSubscriptions: activeSubscriptions.length,
      totalPendingInvoices,
      totalRevenue,
      totalRevenueFormatted: formatPrice(totalRevenue),
      preview,
      timestamp: now.toISOString(),
    })
}, { allowRoles: ["finance"] })
