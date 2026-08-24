import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod/v4"

const smartFillSchema = z.object({
  prompt: z.string().min(1),
  contentType: z.string(),
  schema: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      options: z.any().optional(),
    })
  ),
  tone: z.string().optional().default("Professional"),
  language: z.string().optional().default("Indonesian"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = smartFillSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { prompt, contentType, schema, tone, language } = parsed.data
    const apiKey = process.env.OPENAI_API_KEY

    if (apiKey) {
      try {
        const schemaDescription = schema
          .map(
            (f) =>
              `- "${f.slug}" (${f.name}, type: ${f.type}${f.required ? ", required" : ""})`
          )
          .join("\n")

        const systemPrompt = `You are an expert Headless CMS Content Creator.
You will receive a user draft prompt and a schema of fields for a content type named "${contentType}".
Generate a strictly valid JSON object where keys match the exact field slugs provided.
Follow the tone "${tone}" and output language "${language}".
Do NOT wrap the output in markdown codeblocks (no \`\`\`json). Output pure raw JSON only.

Fields in Schema:
${schemaDescription}`

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `User Prompt: ${prompt}` },
            ],
            temperature: 0.7,
            max_tokens: 2500,
          }),
        })

        if (res.ok) {
          const aiData = await res.json()
          const rawContent = aiData.choices?.[0]?.message?.content?.trim() || "{}"
          const parsedContent = JSON.parse(rawContent)
          return NextResponse.json({ success: true, content: parsedContent })
        }
      } catch (openAiErr) {
        console.warn("OpenAI Smart Fill admin error:", openAiErr)
      }
    }

    // Fallback Mock Generator
    const isIndonesian = language.toLowerCase().includes("indonesia") || language.toLowerCase() === "id"
    const fallbackContent: Record<string, any> = {}
    for (const field of schema) {
      if (field.type === "slug") {
        fallbackContent[field.slug] = prompt.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50)
      } else {
        fallbackContent[field.slug] = isIndonesian ? `Konten terisi otomatis untuk ${field.name}` : `Smart filled content for ${field.name}`
      }
    }

    return NextResponse.json({ success: true, content: fallbackContent })
  } catch (error: any) {
    console.error("Admin Smart Fill API Error:", error)
    return NextResponse.json({ error: "Gagal memproses Smart Fill" }, { status: 500 })
  }
}
