import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // 1. Get Current Counts with individual try-catch or safe handling
    let entryCount = 0
    let mediaCount = 0
    let mediaSizeVal = 0
    let userCount = 0

    try {
      const counts = await Promise.allSettled([
        db.contentEntry.count({ where: { tenantId: access.tenantId } }),
        db.media.count({ where: { tenantId: access.tenantId } }),
        db.media.aggregate({
          where: { tenantId: access.tenantId },
          _sum: { size: true }
        }),
        db.tenantMember.count({ where: { tenantId: access.tenantId } })
      ])

      if (counts[0].status === 'fulfilled') entryCount = counts[0].value
      if (counts[1].status === 'fulfilled') mediaCount = counts[1].value
      if (counts[2].status === 'fulfilled') mediaSizeVal = Number(counts[2].value._sum?.size || 0)
      if (counts[3].status === 'fulfilled') userCount = counts[3].value
    } catch (dbErr) {
      console.error("[Usage API] Database count error:", dbErr)
    }

    // 2. Define Limits based on Plan
    const rawPlan = access.tenant.plan || "free"
    const plan = rawPlan.toLowerCase()
    
    const LIMITS: Record<string, any> = {
      free: { entries: 100, mediaSize: 100 * 1024 * 1024, users: 3 },
      starter: { entries: 1000, mediaSize: 1 * 1024 * 1024 * 1024, users: 5 },
      pro: { entries: 10000, mediaSize: 10 * 1024 * 1024 * 1024, users: 20 },
      business: { entries: 50000, mediaSize: 50 * 1024 * 1024 * 1024, users: 50 },
      enterprise: { entries: 1000000, mediaSize: 1000 * 1024 * 1024 * 1024, users: 100 }
    }

    const currentLimits = LIMITS[plan] || LIMITS.free

    const usageData = [
      {
        label: "Content Entries",
        current: entryCount,
        limit: currentLimits.entries,
        unit: "entries"
      },
      {
        label: "Media Storage",
        current: mediaSizeVal,
        limit: currentLimits.mediaSize,
        unit: "bytes"
      },
      {
        label: "Team Members",
        current: userCount,
        limit: currentLimits.users,
        unit: "users"
      }
    ]

    return NextResponse.json({ usage: usageData })
  } catch (error: any) {
    console.error("Usage API error:", error)
    return NextResponse.json({ 
      error: "Internal server error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
