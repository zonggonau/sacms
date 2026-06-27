import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { safeGenerateContent } from "@/lib/ai"
import { getTenantAccess } from "@/lib/tenant-access"
import { isFeatureEnabled } from "@/lib/tenant-plan"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const smartFillSchema = z.object({
  prompt: z.string().min(1).max(4000),
  schema: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  contentType: z.string().min(1).max(100),
  tone: z.string().optional(),
  language: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!await isFeatureEnabled(access.tenantId, "ENABLE_AI")) {
      return NextResponse.json({ error: "AI features are not enabled for this workspace" }, { status: 403 })
    }

    const parsed = await validateBody(request, smartFillSchema)
    if ("error" in parsed) return parsed.error
    const { prompt, schema, contentType, tone, language } = parsed.data

    const systemPrompt = `You are an expert content creator, copywriter, and SEO specialist for a Headless CMS. 
    Your task is to take the user's brief prompt and WRITE robust, full-length content that fills the provided schema fields.
    The content type is "${contentType}".
    ${tone ? `Target Tone: ${tone}\n` : ""}${language ? `Target Language: ${language}\n` : ""}
    
    ### CONTENT CREATION RULES:
    - EXPAND on the user's prompt. Do not just repeat it. If they ask for a blog post, write the actual blog post paragraphs.
    - SEO Meta: If the schema has fields for SEO (e.g. metaTitle, metaDescription), automatically generate optimal SEO-friendly values based on the content. Meta descriptions should be ~150 characters.
    - Slug: If there is a slug field, generate a clean, URL-friendly string.

    ### DATA TYPE RULES:
    - relation: Provide a URL-friendly slug or ID that represents the related item (e.g., "tech-news").
    - component: Provide a JSON object matching the nested component's fields.
    - media: Generate a highly relevant Unsplash image URL using this exact format: "https://source.unsplash.com/1600x900/?keyword1,keyword2" based on the article's topic. Do NOT just output a generic image URL.
    - richText: Provide comprehensive content with clean HTML formatting (<h1>, <p>, <ul>, <strong>, etc.).
    - date: Provide ISO 8601 string.

    Return ONLY a valid JSON object where keys are field slugs and values are the generated content.
    Do not include any other text or markdown formatting.
    Fields in schema: ${JSON.stringify(schema)}`

    const userPrompt = `Input text/topic to write about:
    "${prompt}"`

    const result = await safeGenerateContent(systemPrompt, userPrompt, {
      responseFormat: "json_object"
    })

    try {
      // Clean result.text if it contains markdown code blocks
      let cleanText = result.text.trim()
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7, cleanText.length - 3)
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.substring(3, cleanText.length - 3)
      }
      
      const content = JSON.parse(cleanText)
      return NextResponse.json({ content })
    } catch (parseError) {
      console.error("AI returned invalid JSON:", result.text)
      return NextResponse.json({ error: "AI failed to generate valid JSON data", raw: result.text }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Smart Fill Error:", error)
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 })
  }
}
