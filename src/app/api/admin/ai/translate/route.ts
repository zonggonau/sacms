import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { translateContent } from "@/lib/ai"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const translateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLocale: z.string().min(2).max(10),
  sourceLocale: z.string().min(2).max(10).optional(),
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

    const result = await validateBody(request, translateSchema)
    if ("error" in result) return result.error

    const translated = await translateContent(result.data)

    return NextResponse.json(translated)
  } catch (error) {
    console.error("AI admin translate error:", error)
    return NextResponse.json(
      { error: "Failed to translate content" },
      { status: 500 }
    )
  }
}
