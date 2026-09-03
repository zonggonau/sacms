import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { calculateLiveFinancialReports } from "@/lib/billing/financial-engine"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // System tenants are hidden from stats
    const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId()
    const SYSTEM_SLUGS = [globalId]
    const notSystemTenant = { slug: { notIn: SYSTEM_SLUGS } }

    const [
      financialReports,
      contentTypes,
      singleTypes,
      components,
      tenants,
      users,
      activeTenants,
      activeSubscriptions,
      totalRevenue,
      monthlyRevenue,
      recentTenants,
      apiTokenCount,
      mediaCount,
      mediaSizeAggregate,
      topTenants,
      apiRequests24h,
      dedicatedTenantsCount,
    ] = await Promise.all([
      calculateLiveFinancialReports().catch(() => null),
      db.contentType.count(),
      db.singleType.count(),
      db.component.count(),
      db.tenant.count({ where: notSystemTenant }),
      db.user.count(),
      db.tenant.count({ where: { status: "active", ...notSystemTenant } }),
      db.subscription.count({ where: { status: "active" } }),
      db.invoice.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
      db.invoice.aggregate({
        where: { status: "paid", paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      db.tenant.findMany({
        where: notSystemTenant,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.apiToken.count(),
      db.media.count(),
      db.media.aggregate({ _sum: { size: true } }),
      db.tenant.findMany({
        where: notSystemTenant,
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: {
              contentEntries: true,
              media: true,
            }
          }
        },
        orderBy: {
          contentEntries: {
            _count: "desc"
          }
        },
        take: 5
      }),
      db.apiRequest.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }).catch(() => 0),
      db.tenant.count({
        where: {
          ...notSystemTenant,
          OR: [
            { databaseUrl: { not: null } },
            { plan: { in: ["vps-4", "vps-6", "vps-8", "vps-12", "vps-16", "vps-18", "vps-plus-4", "vps-plus-6", "vps-plus-8", "vps-plus-12", "vps-plus-16", "vps-plus-18", "vps-storage-10", "vps-storage-20", "vps-storage-30", "vps-storage-40", "vps-storage-50", "vds-s", "vds-m", "vds-l", "vds-xl", "vds-xxl"] } }
          ]
        }
      }).catch(() => 0)
    ])

    const mrr = financialReports?.summary?.mrr || monthlyRevenue._sum.amount || 0
    const grossProfitMrr = financialReports?.summary?.grossProfit || 0
    const grossMarginPercent = financialReports?.summary?.grossMargin || 0

    return NextResponse.json({
      contentTypes,
      singleTypes,
      components,
      tenants,
      users,
      activeTenants,
      dedicatedTenantsCount,
      activeSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      mrr,
      grossProfitMrr,
      grossMarginPercent,
      apiTokenCount,
      mediaCount,
      totalMediaBytes: mediaSizeAggregate._sum.size || 0,
      apiRequests24h,
      recentTenants,
      topTenants,
    })
})

