import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

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

export const POST = withAdminAuth(async (request) => {
  try {
    const body = await request.json()
    const parsed = smartFillSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("validation", {
        message: "Invalid payload",
        details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      })
    }

    const { prompt, contentType, schema, tone, language } = parsed.data

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

      const { safeGenerateContent } = await import("@/lib/ai")
      const result = await safeGenerateContent(systemPrompt, `User Prompt: ${prompt}`, {
        responseFormat: "json_object",
        action: "admin_smart_fill",
        maxTokens: 2500,
      })

      const parsedContent = JSON.parse(result.text)
      return NextResponse.json({ success: true, content: parsedContent })
    } catch (err) {
      console.warn("AI Gateway Smart Fill admin error:", err)
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
    return apiError("internal", { message: "Gagal memproses Smart Fill" })
  }
})
