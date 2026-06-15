import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { safeGenerateContent } from "@/lib/ai"
import { getTenantAccess } from "@/lib/tenant-access"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { prompt, schema, contentType } = await request.json()

    if (!prompt || !schema) {
      return NextResponse.json({ error: "Missing prompt or schema" }, { status: 400 })
    }

    const systemPrompt = `You are an expert content creator for a Headless CMS. 
    Analyze the user input and fill the form fields provided in the schema.
    The content type is "${contentType}".
    
    ### DATA TYPE RULES:
    - relation: Provide a URL-friendly slug or ID that represents the related item (e.g., "tech-news").
    - component: Provide a JSON object matching the nested component's fields.
    - media: Provide a realistic image URL (e.g., from Unsplash).
    - richText: Provide clean HTML.
    - date: Provide ISO 8601 string.

    Return ONLY a valid JSON object where keys are field slugs and values are the generated content.
    Do not include any other text or markdown formatting.
    Fields in schema: ${JSON.stringify(schema)}`

    const userPrompt = `Input text to analyze:
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
