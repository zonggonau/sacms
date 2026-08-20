import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
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

    const tenantData = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { aiTokensUsed: true, aiCreditsExtra: true } as any
    })
    const planConfig = await (await import("@/lib/tenant-plan")).getTenantPlanConfig(tenantId)
    const baseAiTokens = planConfig.max_ai_tokens || 0
    const extraAiTokens = Number((tenantData as any)?.aiCreditsExtra || 0)
    const totalAiTokens = baseAiTokens + extraAiTokens

    const usageData = [
      {
        label: "Content Entries",
        current: entriesLimit.current,
        limit: entriesLimit.max,
        unit: "entries"
      },
      {
        label: "Media Storage",
        current: Number(mediaSizeVal),
        limit: Number(storageLimit.max),
        unit: "bytes"
      },
      {
        label: "Team Members",
        current: Number(membersLimit.current),
        limit: Number(membersLimit.max),
        unit: "users"
      },
      {
        label: "AI Generation Tokens",
        current: Number(tenantData?.aiTokensUsed || 0),
        limit: totalAiTokens,
        unit: "tokens"
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
