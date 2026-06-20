import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"

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

    const tenantId = access.tenantId
    const [entriesLimit, storageLimit, membersLimit] = await Promise.all([
      enforcePlanLimit(tenantId, "content_entries"),
      enforcePlanLimit(tenantId, "storage"),
      enforcePlanLimit(tenantId, "team_members")
    ])

    const tenantDb = await getTenantDb(access.tenant.slug)
    const mediaSizeSum = await tenantDb.media.aggregate({
      where: { tenantId },
      _sum: { size: true }
    })
    const mediaSizeVal = Number(mediaSizeSum._sum?.size || 0)

    const usageData = [
      {
        label: "Content Entries",
        current: entriesLimit.current,
        limit: entriesLimit.max,
        unit: "entries"
      },
      {
        label: "Media Storage",
        current: mediaSizeVal,
        limit: storageLimit.max * 1024 * 1024,
        unit: "bytes"
      },
      {
        label: "Team Members",
        current: membersLimit.current,
        limit: membersLimit.max,
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
