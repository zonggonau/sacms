import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"

export const GET = withStaffAuth(async (_request, _context, { access }) => {
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
    }).catch(() => ({ _sum: { size: 0 } }))
    const mediaSizeVal = Number((mediaSizeSum as any)?._sum?.size || 0)

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
})
