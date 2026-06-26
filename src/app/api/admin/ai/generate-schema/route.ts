import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { safeGenerateContent } from "@/lib/ai"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { prompt } = await request.json()
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 })

    const systemPrompt = `
      You are a SaCMS Schema Architect. Your job is to take a user description and turn it into a valid JSON schema for a Headless CMS Content Type.
      
      The output MUST be a JSON object with:
      - name: A human-readable name (e.g., "Blog Post")
      - slug: A URL-safe slug (e.g., "blog-post")
      - description: A short description
      - fields: An array of field objects, each with:
        - name: Field display name (e.g., "Main Image")
        - slug: Field slug (e.g., "main_image")
        - type: One of: "text", "textarea", "richText", "integer", "boolean", "date", "media", "select", "uid", "relation", "component"
        - required: boolean
        - unique: boolean (usually false unless it's a slug or ID)
        - options: null, or a JSON string for options
        - relationSlug: If type is "relation", provide the slug of the related content type (e.g., "categories").
        - componentSlug: If type is "component", provide the slug of the component to use (e.g., "seo-metadata").

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    const aiResult = await safeGenerateContent(systemPrompt, `Generate a CMS schema for: ${prompt}`, {
      responseFormat: "json_object"
    })

    console.log(`[AI Schema Admin] Generated using model: ${aiResult.model}`)
    
    let schema
    try {
      schema = JSON.parse(aiResult.text)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid schema format. Please try again." }, { status: 500 })
    }

    // Check for existing slug globally (tenantId: null)
    const existing = await db.contentType.findFirst({
      where: { 
        tenantId: null,
        slug: schema.slug
      }
    })

    if (existing) {
      schema.slug = `${schema.slug}-${Math.random().toString(36).slice(2, 7)}`
    }

    // Create the global content type (tenantId: null)
    const contentType = await db.contentType.create({
      data: {
        tenantId: null, // explicitly null for global templates
        name: schema.name,
        slug: schema.slug,
        description: schema.description,
        isPublished: true,
        schemaFields: { create: schema.fields.map((f: any, index: number) => {
            const fieldOptions = f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : {}
            if (f.type === 'component' && f.componentSlug) {
              fieldOptions.componentSlug = f.componentSlug
            }
            
            return {
              name: f.name,
              slug: f.slug,
              type: f.type === 'number' ? 'integer' : f.type,
              required: !!f.required,
              unique: !!f.unique,
              options: Object.keys(fieldOptions).length > 0 ? fieldOptions : null,
              relationSlug: f.relationSlug || null,
              order: index,
            }
          })
        },
      },
      include: { schemaFields: true }
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
