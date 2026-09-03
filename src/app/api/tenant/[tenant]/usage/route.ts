import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { getTenantPlanConfig } from "@/lib/tenant-plan"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, context, { access }) => {
    const { tenant: tenantSlug } = await context.params
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
    }).catch(() => [])

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

    // 3. Calculate Storage (Safe fallback if media table not yet created on isolated/custom DB)
    const storageResult = await tenantDb.media.aggregate({
      where: { tenantId },
      _sum: { size: true },
    }).catch(() => ({ _sum: { size: 0 } }))
    
    // Storage in MB
    const totalStorageMB = Math.ceil(((storageResult as any)?._sum?.size || 0) / (1024 * 1024))

    // 4. Calculate Content Types & Entries (Safe fallback)
    const totalContentTypes = await tenantDb.contentType.count({
      where: { tenantId },
    }).catch(() => 0)

    const totalContentEntries = await tenantDb.contentEntry.count({
      where: { tenantId },
    }).catch(() => 0)

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
})
