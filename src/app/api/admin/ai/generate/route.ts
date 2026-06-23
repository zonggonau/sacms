import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateContent } from "@/lib/ai"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const generateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  contentType: z.string().optional(),
  fieldName: z.string().optional(),
  locale: z.string().optional(),
  maxTokens: z.number().int().min(50).max(4096).optional(),
  tone: z.enum(["formal", "casual", "professional", "creative", "technical"]).optional(),
  mode: z.enum(["generate", "correct"]).optional(),
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

    const result = await validateBody(request, generateSchema)
    if ("error" in result) return result.error

    const generated = await generateContent(result.data)

    return NextResponse.json(generated)
  } catch (error) {
    console.error("AI admin generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}
