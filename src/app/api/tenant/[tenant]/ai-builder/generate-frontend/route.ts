import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { createV0Chat, getV0Preview } from "@/lib/v0-client"
import { deployToVercel } from "@/lib/vercel-client"
import { randomBytes, createHash } from "crypto"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"

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

    // 1. Inspect existing workspace schema via MCP
    const activeSchema = await bridge.getFullSchema()
    const tenantDb = await getTenantDb(tenant.id)

    // 2. Fetch existing sample records from database (if available)
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

    // 3. Auto-generate API token for v0.dev integration
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

    // 4. Build prompt directly for v0.dev with SaCMS MCP & API instructions
    const finalApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/public/${tenant.slug}`
    const mcpServerUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/mcp`
    
    const superPrompt = `User Request: ${prompt}

SaCMS HEADLESS CMS & MCP SERVER INTEGRATION:
- SaCMS Public REST API: ${finalApiUrl}
- SaCMS MCP Server: ${mcpServerUrl}
- Auth Header: Authorization: Bearer ${plainToken}
- List Collection: GET ${finalApiUrl}/content/{collectionSlug}
- Single Type: GET ${finalApiUrl}/single/{singleTypeSlug}
- Filter: GET ${finalApiUrl}/content/{slug}?filters[fieldName][$eq]=value
- Populate: GET ${finalApiUrl}/content/{slug}?populate=relationField

EXISTING WORKSPACE SCHEMA (from SaCMS MCP):
${JSON.stringify(activeSchema, null, 2)}

EXISTING DATASET (Live Records from Database):
${JSON.stringify({ collections: sampleCollections, singleTypes: sampleSingleTypes }, null, 2)}

CRITICAL ARCHITECTURE & UI REQUIREMENTS:
1. Requirements Analysis: Analyze the user request thoroughly and design a comprehensive Next.js 16 App Router website with modern UI components, interactive states, and responsive layouts.
2. Dynamic Data & CMS Connectivity:
   - Connect components to the SaCMS Public Content API and MCP Server.
   - If collections exist in the schema, query and display them dynamically.
   - If new collections/fields are needed for the user's request, define typed TypeScript interfaces and sample datasets so the website renders complete, pixel-perfect UI.
3. Multi-Section Layouts: Include Navbar branding, Hero section, Feature/Catalog cards, detail modals/views, reviews/testimonials, and Footer with contact information.
4. Rich Field Rendering: Format currency (e.g. "Rp 1.500.000"), ratings (stars), badges, dates, and action buttons cleanly.
5. Tech Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide-React icons.

Initialize all components with rich fallback sample data so the live sandbox preview renders instantly with zero blank states.`

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
