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
        - type: One of: "text", "textarea", "richText", "integer", "boolean", "date", "media", "select"
        - required: boolean
        - unique: boolean (usually false)
        - options: null, or a JSON string for options

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    // Use robust model rotation and error handling
    const aiResult = await safeGenerateContent(systemPrompt, `Generate a CMS component for: ${prompt}`, {
      responseMimeType: "application/json"
    })

    console.log(`[AI Component] Generated using model: ${aiResult.model}`)

    let schema
    try {
      schema = JSON.parse(aiResult.text)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid component format. Please try again." }, { status: 500 })
    }

    // Resolve the correct DB client (Shared or Isolated)
    const tenantDb = await getTenantDb(tenantSlug)

    // Check for existing slug within this tenant's scope (Fixed unique constraint)
    const existing = await tenantDb.component.findUnique({
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

    // Create the Component in the correct database
    const component = await tenantDb.component.create({
      data: {
        tenantId: access.tenantId,
        name: schema.name,
        slug: schema.slug,
        description: schema.description,
        category: schema.category || "General",
        fields: {
          create: schema.fields.map((f: any, index: number) => ({
            name: f.name,
            slug: f.slug,
            type: f.type === 'number' ? 'integer' : f.type,
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
    
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      return NextResponse.json({ 
        error: "AI Quota exceeded. Please wait a few seconds and try again." 
      }, { status: 429 })
    }

    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
