import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { safeGenerateContent } from "@/lib/ai"
import { revalidatePath } from "next/cache"

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
      You are a SaCMS System Analyst and Quality Engineer. Your job is to take a user description (e.g. "News Website", "E-commerce") and design a comprehensive CMS architecture.
      
      You must architect a full system consisting of:
      1. components (Reusable field groups like SEO metadata, links, blocks)
      2. singleTypes (Single configuration pages like Homepage, Global Settings, Navbar, Footer)
      3. contentTypes (Collections like Articles, Authors, Categories, Products)

      The output MUST be a JSON object with this exact structure:
      {
        "name": "Template Name (e.g. News Portal)",
        "description": "Short description of the template",
        "icon": "Lucide icon name (e.g. Newspaper, Store, GraduationCap)",
        "template_id": "unique-slug-id",
        "schema_template": {
          "components": [
            {
              "name": "Component Name",
              "slug": "component-slug",
              "fields": [
                {
                  "name": "Field Display Name",
                  "slug": "field_slug",
                  "type": "text | textarea | richText | integer | boolean | date | media | select | relation | component",
                  "required": true/false,
                  "order": 0,
                  "options": {} // optional config, e.g. {"componentSlug": "another-component", "repeatable": true}
                }
              ]
            }
          ],
          "singleTypes": [
             // Same structure as components (name, slug, fields)
          ],
          "contentTypes": [
             // Same structure as components (name, slug, description, fields)
          ]
        }
      }

      CRITICAL: Ensure that if a field uses type "component", its options.componentSlug matches the slug of a component you defined in the "components" array.
      
      User Request: "${prompt}"

      Respond ONLY with the JSON object. No markdown, no explanation.
    `

    const aiResult = await safeGenerateContent(systemPrompt, `Analyze and architect a CMS system for: ${prompt}`, {
      responseFormat: "json_object"
    })

    console.log(`[AI System Admin] Generated using model: ${aiResult.model}`)
    
    let generatedData
    try {
      generatedData = JSON.parse(aiResult.text)
    } catch (e) {
      console.error("AI returned invalid JSON:", aiResult.text)
      return NextResponse.json({ error: "AI returned invalid schema format. Please try again." }, { status: 500 })
    }

    // Insert the generated system as an entry in the global 'templates' Content Type.
    const templatesContentType = await db.contentType.findFirst({
      where: { slug: "templates", tenantId: null }
    })

    if (!templatesContentType) {
      return NextResponse.json({ error: "The 'templates' Content Type does not exist. Please run setup-templates script first." }, { status: 400 })
    }

    // The systemTenant is required to attach the content entry to the global system space.
    // In setup-templates.ts, it uses slug 'sacms-global' or 'system'
    const systemTenant = await db.tenant.findFirst({
      where: { OR: [{ slug: "sacms-global" }, { slug: "system" }] }
    })

    if (!systemTenant) {
      return NextResponse.json({ error: "System tenant not found." }, { status: 400 })
    }

    const newTemplateEntry = await db.contentEntry.create({
      data: {
        contentTypeId: templatesContentType.id,
        tenantId: null,
        status: "PUBLISHED",
        data: {
          name: generatedData.name,
          description: generatedData.description,
          icon: generatedData.icon,
          template_id: generatedData.template_id,
          schema_template: generatedData.schema_template
        }
      }
    })

    revalidatePath("/admin/schema-builder")
    return NextResponse.json(newTemplateEntry)
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
