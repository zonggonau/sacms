import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { safeGenerateContent } from "@/lib/ai"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access || !["owner", "admin"].includes(access.role)) {
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
        - type: One of: "text", "textarea", "richText", "integer", "boolean", "date", "media", "select", "uid", "relation"
        - required: boolean
        - unique: boolean (usually false unless it's a slug or ID)
        - options: null, or a JSON string for options

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    // Use the robust AI utility with model fallback and quota handling
    const aiResult = await safeGenerateContent(systemPrompt, `Generate a CMS schema for: ${prompt}`)

    console.log(`[AI Schema] Generated using model: ${aiResult.model}`)
    
    let schema
    try {
      schema = JSON.parse(aiResult.text)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid schema format. Please try again." }, { status: 500 })
    }

    // Resolve the correct DB client (Shared or Isolated)
    const tenantDb = await getTenantDb(tenantSlug)

    // Check for existing slug within this tenant's scope
    const existing = await tenantDb.contentType.findUnique({
      where: { 
        tenantId_slug: {
          tenantId: access.tenantId,
          slug: schema.slug
        }
      }
    })

    if (existing) {
      schema.slug = `${schema.slug}-${Math.random().toString(36).slice(2, 7)}`
    }

    // Create the content type in the correct database
    const contentType = await tenantDb.contentType.create({
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
            type: f.type === 'number' ? 'integer' : f.type, // Map 'number' to 'integer'
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
