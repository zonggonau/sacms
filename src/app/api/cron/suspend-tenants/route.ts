import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { authorizeCronRequest } from "@/lib/cron-auth"

/**
 * GET /api/cron/suspend-tenants
 * Cron job to suspend workspaces (tenants) whose subscription expired 
 * more than 30 days ago (1 month grace period).
 *
 * Requires CRON_SECRET header for security.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const expiredThreshold = new Date()
    // 30 days grace period
    expiredThreshold.setDate(expiredThreshold.getDate() - 30)

    // Find tenants that are active but have expired subscriptions
    const activeTenants = await db.tenant.findMany({
      where: {
        status: "active"
      },
      include: {
        subscriptions: {
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      }
    })

    let suspendedCount = 0
    const suspendedSlugs: string[] = []

    for (const tenant of activeTenants) {
      const latestSub = tenant.subscriptions[0]
      // If there is a subscription and it has a period end date
      if (latestSub && latestSub.currentPeriodEnd) {
        // If the period end is older than 30 days
        if (latestSub.currentPeriodEnd < expiredThreshold) {
          await db.tenant.update({
            where: { id: tenant.id },
            data: { status: "suspended" }
          })
          
          // Optionally, log this action
          await db.auditLog.create({
            data: {
              tenantId: tenant.id,
              action: "WORKSPACE_SUSPENDED",
              entity: "Tenant",
              entityId: tenant.id,
              data: {
                reason: "Subscription expired > 30 days",
                expiredAt: latestSub.currentPeriodEnd.toISOString()
              }
            }
          })
          
          suspendedCount++
          suspendedSlugs.push(tenant.slug)
        }
      }
    }

    return NextResponse.json({
      success: true,
      suspendedCount,
      suspendedTenants: suspendedSlugs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron suspend-tenants error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
