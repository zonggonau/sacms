import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { summarizeContent } from "@/lib/ai"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const summarizeSchema = z.object({
  text: z.string().min(1).max(10000),
  maxLength: z.number().int().min(50).max(1000).optional(),
  locale: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "AI features are not configured" },
        { status: 503 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await validateBody(request, summarizeSchema)
    if ("error" in result) return result.error

    const summary = await summarizeContent(result.data)

    return NextResponse.json(summary)
  } catch (error) {
    console.error("AI admin summarize error:", error)
    return NextResponse.json(
      { error: "Failed to summarize content" },
      { status: 500 }
    )
  }
}
