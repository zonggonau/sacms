import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

/**
 * GET /api/admin/billing/stats
 * Get billing statistics for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get current date for calculations
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Get total revenue
    const totalRevenue = await db.invoice.aggregate({
      where: { status: "paid" },
      _sum: {
        amount: true,
      },
    })

    // Get MRR (Monthly Recurring Revenue)
    const activeSubscriptions = await db.subscription.findMany({
      where: { status: "active" },
    })

    const mrr = activeSubscriptions.reduce((total, sub) => {
      const planPrice = {
        free: 0,
        starter: 9000,
        pro: 29000,
        enterprise: 199000 / 12, // Annual plan divided by 12
      }[sub.plan] || 0
      return total + planPrice
    }, 0)

    // Get ARR (Annual Recurring Revenue)
    const arr = mrr * 12

    // Get monthly revenue (this month)
    const monthlyRevenue = await db.invoice.aggregate({
      where: {
        status: "paid",
        paidAt: {
          gte: startOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    })

    // Get yearly revenue (this year)
    const yearlyRevenue = await db.invoice.aggregate({
      where: {
        status: "paid",
        paidAt: {
          gte: startOfYear,
        },
      },
      _sum: {
        amount: true,
      },
    })

    // Get subscription counts by plan
    const subscriptionCounts = await db.subscription.groupBy({
      by: ["plan", "status"],
      _count: {
        id: true,
      },
    })

    // Format subscription counts
    const planStats: Record<string, { active: number; total: number }> = {
      free: { active: 0, total: 0 },
      starter: { active: 0, total: 0 },
      pro: { active: 0, total: 0 },
      enterprise: { active: 0, total: 0 },
    }

    subscriptionCounts.forEach((stat) => {
      if (!planStats[stat.plan]) {
        planStats[stat.plan] = { active: 0, total: 0 }
      }
      planStats[stat.plan].total += stat._count.id
      if (stat.status === "active") {
        planStats[stat.plan].active += stat._count.id
      }
    })

    // Get new subscriptions this month
    const newSubscriptionsThisMonth = await db.subscription.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    })

    // Get churned subscriptions this month
    const churnedSubscriptionsThisMonth = await db.subscription.count({
      where: {
        status: "canceled",
        updatedAt: {
          gte: startOfMonth,
        },
      },
    })

    // Calculate churn rate
    const totalSubscriptionsStart = newSubscriptionsThisMonth + churnedSubscriptionsThisMonth
    const churnRate =
      totalSubscriptionsStart > 0
        ? (churnedSubscriptionsThisMonth / totalSubscriptionsStart) * 100
        : 0

    // Get payment success rate
    const paymentTransactions = await db.paymentTransaction.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    })

    const successfulPayments = paymentTransactions.filter(
      (t) => t.status === "success"
    ).length
    const paymentSuccessRate =
      paymentTransactions.length > 0
        ? (successfulPayments / paymentTransactions.length) * 100
        : 0

    // Get average revenue per user (ARPU)
    const totalUsers = await db.user.count()
    const arpu = totalUsers > 0 ? mrr / totalUsers : 0

    // Get growth metrics
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthRevenue = await db.invoice.aggregate({
      where: {
        status: "paid",
        paidAt: {
          gte: lastMonth,
          lt: startOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    })

    const revenueGrowth =
      (lastMonthRevenue._sum.amount || 0) > 0
        ? ((monthlyRevenue._sum.amount || 0) -
            (lastMonthRevenue._sum.amount || 0)) /
            (lastMonthRevenue._sum.amount || 1) *
          100
        : 0

    // Format helper
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(price)
    }

    // Get recent transactions
    const recentTransactions = await db.paymentTransaction.findMany({
      include: {
        subscription: {
          include: {
            tenant: {
              select: { name: true, slug: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    return NextResponse.json({
      overview: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalRevenueFormatted: formatPrice(totalRevenue._sum.amount || 0),
        mrr,
        mrrFormatted: formatPrice(mrr),
        arr,
        arrFormatted: formatPrice(arr),
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        monthlyRevenueFormatted: formatPrice(
          monthlyRevenue._sum.amount || 0
        ),
        yearlyRevenue: yearlyRevenue._sum.amount || 0,
        yearlyRevenueFormatted: formatPrice(yearlyRevenue._sum.amount || 0),
        arpu,
        arpuFormatted: formatPrice(arpu),
      },
      subscriptions: {
        total: subscriptionCounts.reduce((sum, s) => sum + s._count.id, 0),
        active: activeSubscriptions.length,
        newThisMonth: newSubscriptionsThisMonth,
        churnedThisMonth: churnedSubscriptionsThisMonth,
        churnRate: Math.round(churnRate * 10) / 10, // Round to 1 decimal
        byPlan: planStats,
      },
      payments: {
        totalThisMonth: paymentTransactions.length,
        successfulThisMonth: successfulPayments,
        successRate: Math.round(paymentSuccessRate * 10) / 10,
        recent: recentTransactions,
      },
      growth: {
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        revenueGrowthFormatted: `${Math.round(revenueGrowth * 10) / 10}%`,
      },
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Error fetching billing stats:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}