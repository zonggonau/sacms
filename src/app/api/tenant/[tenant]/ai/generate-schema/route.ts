import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { safeGenerateContent } from "@/lib/ai"
import { isFeatureEnabled } from "@/lib/tenant-plan"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!await isFeatureEnabled(access.tenantId, "ENABLE_AI")) {
      return NextResponse.json({ error: "AI features are not enabled for this workspace" }, { status: 403 })
    }

    const { prompt } = await request.json()
    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 })

    const systemPrompt = `
      You are an elite SaCMS Developer Team from planning to maintenance, acting as an expert System Architect.
      Your job is to take a user description and design a FULL system schema for a Headless CMS. 
      You must think holistically and generate all necessary Components (e.g. SEO, blocks), Single Types (e.g. Settings, Header, Footer), and Content Types (e.g. Blog Post, Author, Category).
      
      The output MUST be a JSON object with three arrays: "components", "singleTypes", and "contentTypes".
      
      Schema for each entity in those arrays:
      - name: A human-readable name (e.g., "Blog Post")
      - slug: A URL-safe slug (e.g., "blog-post")
      - description: A short description
      - category: (ONLY FOR COMPONENTS) A category name like "Shared", "Sections", "Meta"
      - fields: An array of field objects, each with:
        - name: Field display name (e.g., "Main Image")
        - slug: Field slug (e.g., "main_image")
        - type: One of: "text", "textarea", "richText", "integer", "boolean", "date", "media", "select", "uid", "relation", "component"
        - required: boolean
        - unique: boolean (usually false unless it's a slug or ID)
        - options: null, or a JSON string for options
        - relationSlug: If type is "relation", provide the slug of the related content type.
        - componentSlug: If type is "component", provide the slug of the component to use.
        
      Important:
      - Do not include 'category' for singleTypes or contentTypes.
      - Ensure slugs are correctly referenced in 'relationSlug' and 'componentSlug'.

      User Request: "${prompt}"

      Respond ONLY with the JSON object containing "components", "singleTypes", and "contentTypes". No markdown, no explanation.
    `

    // Use the robust AI utility with model fallback and quota handling
    const aiResult = await safeGenerateContent(systemPrompt, `Generate a full CMS system architecture for: ${prompt}`, {
      responseFormat: "json_object"
    })

    console.log(`[AI System Schema] Generated using model: ${aiResult.model}`)
    
    let schema
    try {
      schema = JSON.parse(aiResult.text)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid schema format. Please try again." }, { status: 500 })
    }

    // Resolve the correct DB client
    const tenantDb = await getTenantDb(tenantSlug)
    
    // Helper to process fields
    const processFields = (fields: any[]) => {
      return fields.map((f: any, index: number) => {
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
    }

    const createdComponents = []
    const createdSingleTypes = []
    const createdContentTypes = []

    // 1. Create Components first (so they can be referenced by Single/Content Types)
    if (Array.isArray(schema.components)) {
      for (const comp of schema.components) {
        let slug = comp.slug
        const existing = await tenantDb.component.findUnique({ where: { tenantId_slug: { tenantId: access.tenantId, slug } } })
        if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`
        
        const created = await tenantDb.component.create({
          data: {
            tenantId: access.tenantId,
            name: comp.name,
            slug,
            description: comp.description,
            category: comp.category || "AI Generated",
            schemaFields: { create: processFields(comp.fields || []) },
            tenants: { create: { tenantId: access.tenantId } }
          }
        })
        createdComponents.push(created)
      }
    }

    // 2. Create Single Types
    if (Array.isArray(schema.singleTypes)) {
      for (const st of schema.singleTypes) {
        let slug = st.slug
        const existing = await tenantDb.singleType.findUnique({ where: { tenantId_slug: { tenantId: access.tenantId, slug } } })
        if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`
        
        const created = await tenantDb.singleType.create({
          data: {
            tenantId: access.tenantId,
            name: st.name,
            slug,
            description: st.description,
            isPublished: true,
            schemaFields: { create: processFields(st.fields || []) },
            tenants: { create: { tenantId: access.tenantId } }
          }
        })
        createdSingleTypes.push(created)
      }
    }

    // 3. Create Content Types
    if (Array.isArray(schema.contentTypes)) {
      for (const ct of schema.contentTypes) {
        let slug = ct.slug
        const existing = await tenantDb.contentType.findUnique({ where: { tenantId_slug: { tenantId: access.tenantId, slug } } })
        if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`
        
        const created = await tenantDb.contentType.create({
          data: {
            tenantId: access.tenantId,
            name: ct.name,
            slug,
            description: ct.description,
            isPublished: true,
            schemaFields: { create: processFields(ct.fields || []) },
            tenants: { create: { tenantId: access.tenantId } }
          }
        })
        createdContentTypes.push(created)
      }
    }

    return NextResponse.json({
      system: true,
      name: "Full System Architecture",
      components: createdComponents,
      singleTypes: createdSingleTypes,
      contentTypes: createdContentTypes
    })
  } catch (error: any) {
    console.error("AI System Generation Error:", error)
    
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      return NextResponse.json({ 
        error: "AI Quota exceeded. Please wait a few seconds and try again." 
      }, { status: 429 })
    }

    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
