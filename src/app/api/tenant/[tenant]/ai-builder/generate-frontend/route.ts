import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { createV0Chat, getV0Preview } from "@/lib/v0-client"
import { deployToVercel } from "@/lib/vercel-client"
import { randomBytes, createHash } from "crypto"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { computeSchemaDiff, applySchemaPlan } from "@/lib/ai/schema-engine"

import { generateSystemSchema } from "@/lib/ai-schema-generator"
import type { SchemaPlan } from "@/lib/ai/schema-engine"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const { prompt, model = "v0-pro", apiBaseUrl = "http://localhost:3000", deployToVercelAfter = false } = await req.json()
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })

    const MODEL_CREDIT_MAP: Record<string, number> = {
      "v0-mini": 15,
      "v0-pro": 25,
      "v0-max": 35,
      "v0-max-fast": 40,
    }
    const creditCost = MODEL_CREDIT_MAP[model] || 25
    
    // Check user account AI credits
    const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
    const creditCheck = await enforceUserAiCredits(session.user.id, creditCost)
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.message }, { status: 429 })
    }

    const tenant = access.tenant
    const bridge = new McpClientBridge(tenant.id, tenant.slug, session.user.id)

    // 1. Inspect existing schema via MCP
    const currentSchema = await bridge.getFullSchema()

    // 2. Synthesize complete, intelligent multi-collection schema using SaCMS AI
    // generateSystemSchema has built-in 3-tier fallback: DeepSeek → OpenAI → Heuristic
    const generated = await generateSystemSchema(prompt, tenant.id, session.user.id)
    const schemaPlan: SchemaPlan = {
      summary: `Arsitektur Website: ${prompt.slice(0, 80)}`,
      contentTypes: (generated.contentTypes || []).map(ct => ({
        name: ct.name,
        slug: ct.slug,
        description: ct.description,
        fields: ct.fields,
        mockEntries: ct.dummyData || []
      })),
      singleTypes: (generated.singleTypes || []).map(st => ({
        name: st.name,
        slug: st.slug,
        description: st.description,
        fields: st.fields,
        initialData: st.dummyData?.[0] || {}
      })),
      components: (generated.components || []).map(c => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        category: "general",
        fields: c.fields
      }))
    }

    const schemaDiff = computeSchemaDiff(currentSchema, schemaPlan)

    let createdTypesCount = 0
    if (schemaDiff.creates.length > 0) {
      const applyResult = await applySchemaPlan(bridge, schemaPlan)
      createdTypesCount = applyResult.createdContentTypes.length + applyResult.createdSingleTypes.length
    }

    // 3. Fetch latest active schema and sample dataset from SaCMS
    const activeSchema = await bridge.getFullSchema()
    const tenantDb = await getTenantDb(tenant.id)

    const sampleCollections: Record<string, any[]> = {}
    for (const ct of activeSchema.contentTypes || []) {
      const entries = await tenantDb.contentEntry.findMany({
        where: { tenantId: tenant.id, contentType: { slug: ct.slug } },
        take: 10,
        orderBy: { createdAt: "desc" }
      })
      sampleCollections[ct.slug] = entries.map(e => ({ id: e.id, ...(e.data as any) }))
    }

    const sampleSingleTypes: Record<string, any> = {}
    for (const st of activeSchema.singleTypes || []) {
      const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
        where: { tenantId: tenant.id, singleType: { slug: st.slug } }
      })
      if (assignment?.data) {
        sampleSingleTypes[st.slug] = assignment.data
      }
    }

    // 4. Auto-generate API token
    const plainToken = `cf_${randomBytes(32).toString("hex")}`
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")
    
    await db.apiToken.create({
      data: {
        tenantId: tenant.id,
        name: `V0 Frontend Token - ${new Date().toLocaleDateString()}`,
        description: `Auto-generated for V0.dev frontend build`,
        token: hashedToken,
        type: "read-only",
        permissions: [],
        createdBy: session.user.id,
      },
    })

    // 5. Build super prompt with schema + initial data + API instructions
    const finalApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/public/${tenant.slug}`
    
    const superPrompt = `User Request: ${prompt}

HEADLESS CMS COMPLETE SCHEMA & DATA (from SaCMS):
Schema Definition (Collections, Single Types, and Components):
${JSON.stringify(activeSchema, null, 2)}

Active Dataset (Live Sample Records from Database):
${JSON.stringify({ collections: sampleCollections, singleTypes: sampleSingleTypes }, null, 2)}

API INTEGRATION:
- Base URL: ${finalApiUrl}
- Token: ${plainToken}
- Header: Authorization: Bearer ${plainToken}
- List Collection: GET ${finalApiUrl}/content/{collectionSlug}
- Single Type: GET ${finalApiUrl}/single/{singleTypeSlug}
- Filter: GET ${finalApiUrl}/content/{slug}?filters[fieldName][$eq]=value
- Populate: GET ${finalApiUrl}/content/{slug}?populate=relationField

CRITICAL ARCHITECTURE & UI REQUIREMENTS:
1. Multi-Collection UI: Carefully analyze ALL collections in the schema above (e.g., Rooms, Products, Facilities, Doctors, Services, Reviews, Categories, Bookings, etc.). Build responsive UI sections, cards, carousels, tables, and detail modals for EACH collection—do not just build a single generic article list!
2. Rich Field Type Rendering:
   - 'currency': Format prices properly (e.g., "Rp 1.250.000 / malam" or "Rp 350.000").
   - 'rating': Render visual star ratings (e.g., ⭐️⭐️⭐️⭐️⭐️ 4.9/5).
   - 'tags' / 'multiselect': Render as modern rounded badges/pills.
   - 'media' / 'mediaMultiple': Render responsive images with fallback Unsplash/Pexels imagery if empty.
   - 'boolean': Render clear status badges (e.g., "Tersedia / Booking", "Aktif", "Populer").
   - 'richText' / 'markdown': Render clean typography with headers, lists, and paragraphs.
   - 'date' / 'datetime' / 'dateRange': Render formatted localized dates (e.g., "17 Agustus 2026").
   - 'button': Render distinct Call-To-Action buttons with active onClick/href handlers.
3. Single Type Configuration: Use data from Single Types (e.g., store-info, hotel-settings, site-config) for Navbar branding, Hero title/subtitle, and Footer contact/social info.
4. Seamless Fallback & Live Connectivity:
   - Initialize all components with the provided 'Active Dataset' so the live sandbox preview renders rich data immediately with zero blank states.
   - Perform client-side/server-side fetch with Bearer token to keep data live-synced.
5. Tech Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide-React icons, responsive mobile-friendly layouts.`

    // 6. Generate frontend with AI Engine
    const v0Result = await createV0Chat(superPrompt, model)
    if (!v0Result?.chatId) throw new Error("Failed to generate frontend with AI Engine")

    // Deduct user credits after successful chat creation
    await deductUserAiCredits(session.user.id, creditCost, "generate_frontend", tenant.id, model)
    
    // 5. Save to settings
    await db.setting.upsert({ where: { key: `${tenant.id}_v0ChatId` }, update: { value: v0Result.chatId }, create: { tenantId: tenant.id, key: `${tenant.id}_v0ChatId`, value: v0Result.chatId } })
    await db.setting.upsert({ where: { key: `${tenant.id}_v0FrontendPrompt` }, update: { value: prompt }, create: { tenantId: tenant.id, key: `${tenant.id}_v0FrontendPrompt`, value: prompt } })
    await db.setting.upsert({ where: { key: `${tenant.id}_v0Model` }, update: { value: model }, create: { tenantId: tenant.id, key: `${tenant.id}_v0Model`, value: model } })

    // 6. Optionally deploy to Vercel immediately
    let deploymentUrl = ""
    let vercelProjectId = ""
    let previewUrl = ""
    
    if (deployToVercelAfter && v0Result.files && v0Result.files.length > 0) {
      try {
        const projectName = `sacms-${tenant.slug}-frontend`
        const deployment = await deployToVercel(projectName, v0Result.files)
        deploymentUrl = deployment.url
        vercelProjectId = deployment.projectId || ""
        
        if (deploymentUrl) {
          previewUrl = deploymentUrl
          await db.setting.upsert({ where: { key: `${tenant.id}_v0PreviewUrl` }, update: { value: deploymentUrl }, create: { tenantId: tenant.id, key: `${tenant.id}_v0PreviewUrl`, value: deploymentUrl } })
          if (vercelProjectId) {
            await db.setting.upsert({ where: { key: `${tenant.id}_vercelProjectId` }, update: { value: vercelProjectId }, create: { tenantId: tenant.id, key: `${tenant.id}_vercelProjectId`, value: vercelProjectId } })
          }
        }
      } catch (deployError: any) {
        console.error("Vercel deploy failed:", deployError.message)
      }
    }
    
    // If not deployed to Vercel, use our local proxy route to securely embed the V0 preview
    if (!previewUrl) {
      previewUrl = `/api/tenant/${tenant.slug}/ai-builder/preview/${v0Result.chatId}`
      await db.setting.upsert({ where: { key: `${tenant.id}_v0PreviewUrl` }, update: { value: previewUrl }, create: { tenantId: tenant.id, key: `${tenant.id}_v0PreviewUrl`, value: previewUrl } })
    }

    // Sync with Site & SiteFile database models
    try {
      let site = await db.site.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { updatedAt: "desc" }
      })
      if (!site) {
        site = await db.site.create({
          data: {
            tenantId: tenant.id,
            name: `${tenant.name} Website`,
            slug: `${tenant.slug}-web`,
            subdomain: `${tenant.slug}-web`,
            status: "published",
          }
        })
      }

      if (v0Result.files && v0Result.files.length > 0) {
        for (const vf of v0Result.files) {
          const filePath = vf.name.startsWith("app/") || vf.name.startsWith("components/") || vf.name.startsWith("lib/") ? vf.name : `app/${vf.name}`
          await db.siteFile.upsert({
            where: { siteId_path: { siteId: site.id, path: filePath } },
            create: { siteId: site.id, path: filePath, content: vf.content },
            update: { content: vf.content },
          })
        }
      }
    } catch (siteErr: any) {
      console.warn("Could not sync Site record:", siteErr.message)
    }

    return NextResponse.json({ 
      success: true, 
      v0ChatId: v0Result.chatId, 
      previewUrl,
      vercelProjectId,
      filesGenerated: v0Result.files?.length || 0
    })
  } catch (error: any) {
    console.error("Frontend generation failed:", error)
    return NextResponse.json({ error: error.message || "Failed to generate frontend" }, { status: 500 })
  }
}
