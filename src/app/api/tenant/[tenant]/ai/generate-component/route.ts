import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || ""
const genAI = new GoogleGenerativeAI(apiKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { prompt } = await request.json()
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 })

    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const systemPrompt = `
      You are a SaCMS Component Architect. Your job is to take a user description and turn it into a valid JSON component definition.
      Components are reusable field groups used in Headless CMS.
      
      The output MUST be a JSON object with:
      - name: A human-readable name (e.g., "SEO Metadata")
      - slug: A URL-safe slug (e.g., "seo-metadata")
      - description: A short description of what this component is for
      - category: A short category name (e.g., "shared", "sections", "meta")
      - fields: An array of field objects, each with:
        - name: Field display name (e.g., "Meta Description")
        - slug: Field slug (e.g., "meta_description")
        - type: One of: "text", "textarea", "richText", "number", "boolean", "date", "media", "select"
        - required: boolean
        - options: null, or a comma-separated string for "select" type

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    // Try multiple models
    const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"]
    let lastError: any = null
    let responseText = ""

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(systemPrompt)
        responseText = result.response.text()
        if (responseText) break
      } catch (error: any) {
        lastError = error
        if (error.status === 429 || error.status === 404) continue
        throw error
      }
    }

    if (!responseText) {
      const isQuota = lastError?.status === 429 || lastError?.message?.includes("429")
      return NextResponse.json({ 
        error: isQuota 
          ? "AI Quota exceeded. Please wait 1 minute and try again." 
          : "AI service unavailable." 
      }, { status: isQuota ? 429 : 500 })
    }

    let schema
    try {
      const cleaned = responseText.replace(/```json|```/g, "").trim()
      schema = JSON.parse(cleaned)
    } catch (e) {
      return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 500 })
    }

    // 1. Check if slug already exists
    const existing = await db.component.findUnique({
      where: { slug: schema.slug }
    })

    if (existing) {
      schema.slug = `${schema.slug}-${Math.random().toString(36).slice(2, 7)}`
    }

    // 2. Create the Component
    const component = await db.component.create({
      data: {
        name: schema.name,
        slug: schema.slug,
        description: schema.description,
        category: schema.category,
        fields: {
          create: schema.fields.map((f: any, index: number) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: !!f.required,
            options: f.options ? (typeof f.options === 'string' ? f.options : JSON.stringify(f.options)) : null,
            order: index,
          }))
        },
        tenants: {
          create: {
            tenantId: access.tenantId,
          }
        }
      }
    })

    return NextResponse.json(component)
  } catch (error: any) {
    console.error("AI Component Generation Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
