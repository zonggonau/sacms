import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // System tenants are hidden from stats
    const SYSTEM_SLUGS = ["sacms-global"]
    const notSystemTenant = { slug: { notIn: SYSTEM_SLUGS } }

    const [
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
      topTenants,
    ] = await Promise.all([
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
      })
    ])

    return NextResponse.json({
      contentTypes,
      singleTypes,
      components,
      tenants,
      users,
      activeTenants,
      activeSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      apiTokenCount,
      mediaCount,
      recentTenants,
      topTenants,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
