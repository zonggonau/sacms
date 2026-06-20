import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { isFeatureEnabled } from "@/lib/tenant-plan"
import { safeGenerateContent } from "@/lib/ai"

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
      You are a SaCMS Ecosystem Architect. Your job is to take a user description and turn it into a valid JSON architecture consisting of a Single Type and any necessary reusable Components.
      
      The output MUST be a JSON object with:
      - name: Human-readable name for the Single Type (e.g., "Homepage")
      - slug: URL-safe slug for the Single Type (e.g., "homepage")
      - description: Short description
      - nestedComponents: An array of objects for reusable sections identified in the prompt. Each component object has:
        - name: Component name (e.g., "Hero Section")
        - slug: Component slug (e.g., "hero-section")
        - category: Category name (default: "sections")
        - fields: Array of field objects (name, slug, type, required, options, relationSlug, componentSlug)
      - fields: An array of field objects for the Single Type. 
        - Standard fields: name, slug, type (text, textarea, richText, number, boolean, date, media, select, relation, component), required.
        - relationSlug: If type is "relation", provide the slug of the related content type.
        - componentSlug: If type is "component", provide the slug of the component.

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    const aiResult = await safeGenerateContent(systemPrompt, `Generate an ecosystem for: ${prompt}`, {
      responseFormat: "json_object"
    })

    let schema
    try {
      schema = JSON.parse(aiResult.text)
    } catch (e) {
      return NextResponse.json({ error: "AI returned invalid JSON format." }, { status: 500 })
    }

    const tenantDb = await getTenantDb(tenantSlug)

    // Use a transaction to create components and the single type in the tenant DB
    const result = await tenantDb.$transaction(async (tx) => {
      // 1. Create Nested Components First
      if (schema.nestedComponents && Array.isArray(schema.nestedComponents)) {
        for (const comp of schema.nestedComponents) {
          const existingComp = await tx.component.findUnique({
            where: { tenantId_slug: { tenantId: access.tenantId, slug: comp.slug } }
          })
          const finalCompSlug = existingComp ? `${comp.slug}-${Math.random().toString(36).slice(2, 5)}` : comp.slug
          
          await tx.component.create({
            data: {
              tenantId: access.tenantId,
              name: comp.name,
              slug: finalCompSlug,
              category: comp.category || "sections",
              schemaFields: { create: comp.fields.map((f: any, idx: number) => {
                  const fOptions = f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : {}
                  if (f.type === 'component' && f.componentSlug) fOptions.componentSlug = f.componentSlug

                  return {
                    name: f.name,
                    slug: f.slug,
                    type: f.type,
                    required: !!f.required,
                    options: Object.keys(fOptions).length > 0 ? fOptions : null,
                    relationSlug: f.relationSlug || null,
                    order: idx
                  }
                })
              },
              tenants: {
                create: { tenantId: access.tenantId }
              }
            }
          })
          
          // Update references in SingleType fields
          if (schema.fields) {
            schema.fields.forEach((f: any) => {
              if (f.type === "component" && (f.componentSlug === comp.slug || f.options?.componentSlug === comp.slug)) {
                f.componentSlug = finalCompSlug
              }
            })
          }
        }
      }

      // 2. Check Single Type slug
      const existingST = await tx.singleType.findUnique({
        where: { tenantId_slug: { tenantId: access.tenantId, slug: schema.slug } }
      })
      const finalSTSlug = existingST ? `${schema.slug}-${Math.random().toString(36).slice(2, 5)}` : schema.slug

      // 3. Create the Single Type
      return await tx.singleType.create({
        data: {
          tenantId: access.tenantId,
          name: schema.name,
          slug: finalSTSlug,
          description: schema.description,
          isPublished: true,
          schemaFields: { create: schema.fields.map((f: any, index: number) => {
              const fOptions = f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : {}
              if (f.type === 'component' && f.componentSlug) fOptions.componentSlug = f.componentSlug

              return {
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: !!f.required,
                options: Object.keys(fOptions).length > 0 ? fOptions : null,
                relationSlug: f.relationSlug || null,
                order: index,
              }
            })
          },
          tenants: {
            create: {
              tenantId: access.tenantId,
            }
          }
        }
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("AI Single Type Ecosystem Generation Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
