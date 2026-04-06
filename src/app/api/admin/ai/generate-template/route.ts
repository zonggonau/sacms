import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { generateAISchema, generateAIEntries } from "@/lib/ai-schema-generator"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { prompt, isTemplate, contentType } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (isTemplate) {
      const schema = await generateAISchema(prompt)
      return NextResponse.json({ schema })
    } else {
      if (!contentType) {
        return NextResponse.json({ error: "ContentType context is required for entry generation" }, { status: 400 })
      }
      const entries = await generateAIEntries(prompt, contentType)
      return NextResponse.json({ entries })
    }
  } catch (error: any) {
    console.error("[AI Generator API] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate AI data" }, { status: 500 })
  }
}
