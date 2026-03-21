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
      return NextResponse.json({ error: "AI service not configured (GEMINI_API_KEY or AI_API_KEY missing)" }, { status: 500 })
    }

    const systemPrompt = `
      You are a SaCMS Schema Architect. Your job is to take a user description and turn it into a valid JSON schema for a Headless CMS.
      
      The output MUST be a JSON object with:
      - name: A human-readable name (e.g., "Blog Post")
      - slug: A URL-safe slug (e.g., "blog-post")
      - description: A short description
      - fields: An array of field objects, each with:
        - name: Field display name (e.g., "Main Image")
        - slug: Field slug (e.g., "main_image")
        - type: One of: "text", "textarea", "richText", "number", "boolean", "date", "media", "select"
        - required: boolean
        - unique: boolean (usually false unless it's a slug or ID)
        - options: null, or a comma-separated string for "select" type (e.g., "Draft, Published, Archived")

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    // Use model names confirmed available in your account
    const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-lite"]
    let lastError: any = null
    let responseText = ""
    let wasQuotaExceeded = false

    for (const modelName of modelsToTry) {
      try {
        console.log(`AI Attempting with model: ${modelName}`)
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(systemPrompt)
        responseText = result.response.text()
        if (responseText) break 
      } catch (error: any) {
        lastError = error
        console.warn(`Model ${modelName} failed:`, error.message)
        
        if (error.status === 429) {
          wasQuotaExceeded = true
          // Quota is usually per-key, so trying other models might not help, 
          // but we continue just in case some models have separate quotas.
          continue
        }
        if (error.status === 404) continue 
        throw error 
      }
    }

    if (!responseText) {
      const isQuota = wasQuotaExceeded || lastError?.status === 429 || lastError?.message?.includes("429")
      return NextResponse.json({ 
        error: isQuota 
          ? "AI Quota exceeded. Google restricts free tier usage. Please wait 1 minute and try again." 
          : `AI service error: ${lastError?.message || "Unknown error"}`
      }, { status: isQuota ? 429 : (lastError?.status || 500) })
    }

    console.log("AI Response:", responseText)
    
    let schema
    try {
      const cleaned = responseText.replace(/```json|```/g, "").trim()
      schema = JSON.parse(cleaned)
    } catch (e) {
      console.error("AI returned invalid JSON:", responseText)
      return NextResponse.json({ error: "AI returned invalid schema format. Please try again." }, { status: 500 })
    }

    const existing = await db.contentType.findUnique({
      where: { slug: schema.slug }
    })

    if (existing) {
      schema.slug = `${schema.slug}-${Math.random().toString(36).slice(2, 7)}`
    }

    const contentType = await db.contentType.create({
      data: {
        tenantId: access.tenantId,
        name: schema.name,
        slug: schema.slug,
        description: schema.description,
        isPublished: true,
        fields: {
          create: schema.fields.map((f: any, index: number) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: !!f.required,
            unique: !!f.unique,
            options: f.options ? (typeof f.options === 'string' ? f.options : JSON.stringify(f.options)) : null,
            order: index,
          }))
        },
        tenants: {
          create: {
            tenantId: access.tenantId,
          }
        }
      },
      include: {
        fields: true
      }
    })

    return NextResponse.json(contentType)
  } catch (error: any) {
    console.error("AI Schema Generation Error:", error)
    
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      return NextResponse.json({ 
        error: "AI Quota exceeded. Please wait a few seconds and try again." 
      }, { status: 429 })
    }

    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
