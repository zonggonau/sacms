import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantPlanConfig } from "@/lib/tenant-plan"

type Context = { params: Promise<{ tenant: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
    
    // Resolve access and tenant ID from Master DB
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // 1. Get Plan Limits
    const planConfig = await getTenantPlanConfig(tenantId)

    // Resolve dynamic overrides/custom limits
    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const [ctLimit, storageLimit, apiLimit] = await Promise.all([
      enforcePlanLimit(tenantId, "content_types"),
      enforcePlanLimit(tenantId, "storage"),
      enforcePlanLimit(tenantId, "api_calls")
    ])

    const effectivePlanConfig = {
      ...planConfig,
      max_content_types: ctLimit.max,
      max_storage: storageLimit.max,
      max_api_calls: apiLimit.max,
    }

    // 2. Calculate API Calls (Last 30 days grouped by day)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const apiRequests = await db.apiRequest.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    })

    // Group API calls by Date (YYYY-MM-DD)
    const apiCallsByDate: Record<string, number> = {}
    
    // Pre-fill the last 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      apiCallsByDate[dateStr] = 0
    }

    let totalApiCalls = 0
    apiRequests.forEach(req => {
      const dateStr = req.createdAt.toISOString().split('T')[0]
      if (apiCallsByDate[dateStr] !== undefined) {
        apiCallsByDate[dateStr]++
      }
      totalApiCalls++
    })

    const apiUsageChart = Object.keys(apiCallsByDate).map(date => ({
      date,
      calls: apiCallsByDate[date]
    }))

    // 3. Calculate Storage
    const storageResult = await tenantDb.media.aggregate({
      where: { tenantId },
      _sum: { size: true },
    })
    
    // Storage in MB
    const totalStorageMB = Math.ceil((storageResult._sum.size || 0) / (1024 * 1024))

    // 4. Calculate Content Types & Entries
    const totalContentTypes = await tenantDb.contentType.count({
      where: { tenantId },
    })

    const totalContentEntries = await tenantDb.contentEntry.count({
      where: { tenantId },
    })

    return NextResponse.json({
      plan: effectivePlanConfig,
      usage: {
        apiCalls: totalApiCalls,
        storageMB: totalStorageMB,
        contentTypes: totalContentTypes,
        contentEntries: totalContentEntries,
      },
      charts: {
        apiUsage: apiUsageChart,
      }
    })

  } catch (error) {
    console.error("Error fetching usage stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
