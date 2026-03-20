import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { generateContent } from "@/lib/ai"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { logAudit, AuditAction } from "@/lib/audit-log"

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  contentType: z.string().optional(),
  fieldName: z.string().optional(),
  locale: z.string().optional(),
  maxTokens: z.number().int().min(50).max(4096).optional(),
  tone: z.enum(["formal", "casual", "professional", "creative", "technical"]).optional(),
})

/**
 * POST /api/tenant/[tenant]/ai/generate
 * Generate content using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
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

    const result = await validateBody(request, generateSchema)
    if ("error" in result) return result.error

    const generated = await generateContent(result.data)

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_CREATED,
      entity: "ai_generation",
      data: {
        prompt: result.data.prompt.slice(0, 100),
        tokens: generated.usage.totalTokens,
      },
    })

    return NextResponse.json(generated)
  } catch (error) {
    console.error("AI generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}
