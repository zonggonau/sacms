import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { safeGenerateContent } from "@/lib/ai"

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

    const systemPrompt = `
      You are a SaCMS Ecosystem Architect. Your job is to take a user description and turn it into a valid JSON architecture consisting of a Single Type and any necessary reusable Components.
      
      The output MUST be a JSON object with:
      - name: Human-readable name for the Single Type (e.g., "Homepage")
      - slug: URL-safe slug for the Single Type (e.g., "homepage")
      - description: Short description
      - nestedComponents: An array of objects for reusable sections identified in the prompt (e.g., Hero, Features, Carousel). Each component object has:
        - name: Component name (e.g., "Hero Section")
        - slug: Component slug (e.g., "hero-section")
        - category: Category name (default: "sections")
        - fields: Array of field objects (name, slug, type, required)
      - fields: An array of field objects for the Single Type. 
        - IMPORTANT: To reference a nested component, use type: "component" and set options to an object like {"componentSlug": "hero-section", "repeatable": true/false}.
        - Standard fields: name, slug, type (text, textarea, richText, integer, boolean, date, media, select), required.

      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    const aiResult = await safeGenerateContent(systemPrompt, `Generate a CMS single-type schema for: ${prompt}`)
    
    console.log(`[AI SingleType] Generated using model: ${aiResult.model}`)

    let schema
    try {
      const cleaned = aiResult.text.replace(/```json|```/g, "").trim()
      schema = JSON.parse(cleaned)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid format." }, { status: 500 })
    }

    const tenantDb = await getTenantDb(tenant)

    // Use a transaction to create components and the single type
    const result = await db.$transaction(async (tx) => {
      // 1. Create Nested Components First
      const createdComponentSlugs = new Set()
      if (schema.nestedComponents && Array.isArray(schema.nestedComponents)) {
        for (const comp of schema.nestedComponents) {
          // Check if component slug exists
          const existingComp = await tx.component.findFirst({
            where: { 
              slug: comp.slug,
              OR: [
                { tenantId: access.tenantId },
                { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
              ]
            }
          })
          const finalCompSlug = existingComp ? `${comp.slug}-${Math.random().toString(36).slice(2, 5)}` : comp.slug
          
          await tx.component.create({
            data: {
              name: comp.name,
              slug: finalCompSlug,
              category: comp.category || "sections",
              fields: {
                create: comp.fields.map((f: any, idx: number) => ({
                  name: f.name,
                  slug: f.slug,
                  type: f.type,
                  required: !!f.required,
                  order: idx
                }))
              },
              tenants: {
                create: { tenantId: access.tenantId }
              }
            }
          })
          createdComponentSlugs.add(finalCompSlug)
          
          // Update the reference in the SingleType fields if necessary
          if (schema.fields) {
            schema.fields.forEach((f: any) => {
              if (f.type === "component" && f.options?.componentSlug === comp.slug) {
                f.options.componentSlug = finalCompSlug
              }
            })
          }
        }
      }

      // 2. Check Single Type slug
      const existingST = await tx.singleType.findFirst({
        where: { 
          slug: schema.slug,
          OR: [
            { tenantId: access.tenantId },
            { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
          ]
        }
      })
      const finalSTSlug = existingST ? `${schema.slug}-${Math.random().toString(36).slice(2, 5)}` : schema.slug

      // 3. Create the Single Type
      return await tx.singleType.create({
        data: {
          name: schema.name,
          slug: finalSTSlug,
          description: schema.description,
          isPublished: true,
          fields: {
            create: schema.fields.map((f: any, index: number) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: !!f.required,
              // Convert options to string for DB if it's an object (for component relation)
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
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("AI Single Type Ecosystem Generation Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
