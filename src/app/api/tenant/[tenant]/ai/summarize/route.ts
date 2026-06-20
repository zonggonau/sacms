import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { summarizeContent } from "@/lib/ai"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { isFeatureEnabled } from "@/lib/tenant-plan"

const summarizeSchema = z.object({
  text: z.string().min(1).max(10000),
  maxLength: z.number().int().min(50).max(1000).optional(),
  locale: z.string().optional(),
})

/**
 * POST /api/tenant/[tenant]/ai/summarize
 * Summarize existing content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "AI features are not configured" },
        { status: 503 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!await isFeatureEnabled(access.tenantId, "ENABLE_AI")) {
      return NextResponse.json({ error: "AI features are not enabled for this workspace" }, { status: 403 })
    }

    const result = await validateBody(request, summarizeSchema)
    if ("error" in result) return result.error

    const summary = await summarizeContent(result.data)

    return NextResponse.json(summary)
  } catch (error) {
    console.error("AI summarize error:", error)
    return NextResponse.json(
      { error: "Failed to summarize content" },
      { status: 500 }
    )
  }
}
