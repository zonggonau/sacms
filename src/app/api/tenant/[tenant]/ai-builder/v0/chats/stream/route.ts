import { v0 } from "v0"
import { db, getTenantDb } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { resolveFrontendEnv } from "@/lib/infrastructure/frontend-env"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/**
 * V0Transport's "create" URL — the first message of a new AI Website Builder
 * chat. Mirrors the context-building steps of `ai-builder/generate-frontend`
 * (MCP schema inspection/generation, sample-data injection, the mega-prompt
 * template) but calls `v0.chats.createStream()` instead of
 * `createV0Chat()`'s create-then-poll pattern, and returns the live SSE
 * response straight through via `.toResponse()` so `@v0-sdk/react`'s
 * `useChat` can render the build as it streams — the same way v0.app itself
 * streams a new chat.
 *
 * The generated app is instructed to read its SaCMS connection from
 * `.env.local` (via `resolveFrontendEnv` — the same env set the Hosting
 * panel's Deploy button and the developer codegen prompt already use)
 * instead of hardcoding it, so the exact same values carry straight through
 * to Vercel when `finalize/route.ts` deploys — see the env vars section
 * there.
 *
 * Only v0 models reach this route. Claude-model builds stay on the older
 * `generate-frontend`/`iterate` routes (see website-builder-client.tsx) —
 * there is no Claude equivalent of the v0 streaming SDK to migrate to.
 */
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const body = await req.json().catch(() => ({}))
    const prompt = typeof body?.message === "string" ? body.message.slice(0, 8000) : ""
    const modelId: string = body?.modelConfiguration?.modelId || "v0-pro"
    const plannedSchema = body?.plannedSchema ?? null

    if (!prompt) return apiError("validation", { message: "Prompt is required" })

    const apiBaseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "")

    const MODEL_CREDIT_MAP: Record<string, number> = {
      "v0-mini": 15,
      "v0-pro": 25,
      "v0-max": 35,
      "v0-max-fast": 40,
    }
    const creditCost = MODEL_CREDIT_MAP[modelId] || 25

    const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
    const creditCheck = await enforceUserAiCredits(session.user.id, creditCost)
    if (!creditCheck.allowed) return apiError("rate_limited", { message: creditCheck.message })

    const tenant = access.tenant
    const bridge = new McpClientBridge(tenant.id, tenant.slug, session.user.id)

    // ── Inspect / generate schema via SaCMS MCP Bridge (same as generate-frontend) ──
    let activeSchema = await bridge.getFullSchema()
    const existingContentTypes = activeSchema.contentTypes || []
    const isOnlyDefaultBoilerplate = existingContentTypes.length > 0 && existingContentTypes.every((ct: any) =>
      ct.slug === "services" || ct.slug === "articles"
    )
    const needsNewSchema = existingContentTypes.length === 0 || isOnlyDefaultBoilerplate

    try {
      if (plannedSchema && (plannedSchema.contentTypes?.length || plannedSchema.singleTypes?.length)) {
        await bridge.applyGeneratedSchema(plannedSchema)
        activeSchema = await bridge.getFullSchema()
      } else if (needsNewSchema) {
        const { generateSystemSchema } = await import("@/lib/ai-schema-generator")
        const generatedSchema = await generateSystemSchema(prompt, tenant.id, session.user.id)
        if (generatedSchema && (generatedSchema.contentTypes?.length || generatedSchema.singleTypes?.length)) {
          await bridge.applyGeneratedSchema(generatedSchema)
          activeSchema = await bridge.getFullSchema()
        }
      }
    } catch (schemaErr: any) {
      console.warn("[AI_BUILDER_MCP_SCHEMA_WARNING]: Could not auto-apply schema via MCP:", schemaErr.message)
    }

    const capabilities = await bridge.inspectApiCapabilities()
    const tenantDb = await getTenantDb(tenant.id)

    const sampleCollections: Record<string, any[]> = {}
    for (const ct of activeSchema.contentTypes || []) {
      const entries = await tenantDb.contentEntry.findMany({
        where: { tenantId: tenant.id, contentType: { slug: ct.slug } },
        take: 10,
        orderBy: { createdAt: "desc" },
      })
      sampleCollections[ct.slug] = entries.map((e) => ({ id: e.id, ...(e.data as any) }))
    }

    const sampleSingleTypes: Record<string, any> = {}
    for (const st of activeSchema.singleTypes || []) {
      const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
        where: { tenantId: tenant.id, singleType: { slug: st.slug } },
      })
      if (assignment?.data) {
        sampleSingleTypes[st.slug] = assignment.data
      }
    }

    // Same env set the Hosting panel's "Deploy" button and the codegen
    // prompt for Cursor/Claude Code (developer/ai-prompt) already use — one
    // token per tenant (reused, not re-minted every generation), so this
    // matches whatever the workspace's Vercel deployment is already
    // configured with instead of drifting from it.
    const envVars = await resolveFrontendEnv(tenant.id, tenant.slug, apiBaseUrl)
    await db.setting.upsert({
      where: { key: `${tenant.id}_v0EnvVars` },
      update: { value: JSON.stringify(envVars) },
      create: { tenantId: tenant.id, key: `${tenant.id}_v0EnvVars`, value: JSON.stringify(envVars) },
    })

    const finalApiUrl = `${apiBaseUrl}/api/public/${tenant.slug}`
    const mcpServerUrl = `${apiBaseUrl}/api/mcp`

    const superPrompt = `User Request: ${prompt}

SaCMS HEADLESS CMS & MCP SERVER INTEGRATION:
- Create a ".env.local" file at the project root with exactly these three lines (real values, not placeholders):
  NEXT_PUBLIC_SACMS_API_URL=${envVars.NEXT_PUBLIC_SACMS_API_URL}
  NEXT_PUBLIC_SACMS_TENANT=${envVars.NEXT_PUBLIC_SACMS_TENANT}
  SACMS_API_KEY=${envVars.SACMS_API_KEY}
- NEVER hardcode the API URL, tenant slug, or key as a literal string anywhere else in the code — always read them from process.env. Build the REST base as \`\${process.env.NEXT_PUBLIC_SACMS_API_URL}/api/public/\${process.env.NEXT_PUBLIC_SACMS_TENANT}\`.
- SACMS_API_KEY is a SERVER secret: read it only inside Server Components, Route Handlers, or Server Actions (never a file starting with "use client", and never rename it to a NEXT_PUBLIC_-prefixed var). Fetch CMS data on the server and pass the result down as props — client components must never see the key.
- SaCMS MCP Server: ${mcpServerUrl}
- API Capabilities: ${capabilities.mode} (canRead: ${capabilities.canRead}, canWrite: ${capabilities.canWrite}, canDelete: ${capabilities.canDelete})
- Mode Guidance: ${capabilities.canWrite ? "Build full interactive workflows (forms, mutations, booking, reviews, cart)" : "Build high-performance consumer view (catalogs, article feeds, portfolios)"}
- List Collection: GET {REST base}/content/{collectionSlug}
- Single Type: GET {REST base}/single/{singleTypeSlug}
- Filter: GET {REST base}/content/{slug}?filters[fieldName][$eq]=value
- Populate: GET {REST base}/content/{slug}?populate=relationField

EXISTING WORKSPACE SCHEMA (from SaCMS MCP):
${JSON.stringify(activeSchema, null, 2)}

EXISTING DATASET (Live Records from Database):
${JSON.stringify({ collections: sampleCollections, singleTypes: sampleSingleTypes }, null, 2)}

CRITICAL ARCHITECTURE & UI REQUIREMENTS:
1. Requirements Analysis: Analyze the user request thoroughly and design a comprehensive Next.js 16 App Router website with modern UI components, interactive states, and responsive layouts.
2. Dynamic Data & CMS Connectivity:
   - Connect components to the SaCMS Public Content API and MCP Server.
   - Query collections and single types dynamically from the endpoints above.
   - Always define strict TypeScript interfaces for all CMS responses.
3. High-Quality Media & Mock Images:
   - For all image/media fields, always use valid, high-resolution Unsplash URLs (e.g. 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80') tailored to the domain.
   - Never leave <img src=""> empty or with broken placeholders.
4. Multi-Section Layouts: Include Navbar branding, Hero section, Feature/Catalog cards, detail modals/views, reviews/testimonials, and Footer with contact information.
5. Rich Field Rendering: Format currency (e.g. "Rp 1.500.000"), ratings (stars), badges, dates, and action buttons cleanly.
6. Tech Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide-React icons.

Initialize all components with rich fallback sample data so the live sandbox preview renders instantly with zero blank states.`

    let stream: Awaited<ReturnType<typeof v0.chats.createStream>>
    try {
      stream = await v0.chats.createStream({
        message: superPrompt,
        modelConfiguration: { modelId: modelId as any, imageGenerations: false },
      })
    } catch (err: any) {
      console.error("[v0/chats/stream] createStream failed:", err?.message)
      return apiError("internal", { message: err?.message || "Gagal memulai sesi AI Engine" })
    }

    // Creation succeeded (the stream is live) — charge credits now, matching
    // the old create-then-poll route's "deduct only after a real chat exists".
    await deductUserAiCredits(session.user.id, creditCost, "generate_frontend", tenant.id, modelId)
    await db.setting.upsert({ where: { key: `${tenant.id}_v0FrontendPrompt` }, update: { value: prompt }, create: { tenantId: tenant.id, key: `${tenant.id}_v0FrontendPrompt`, value: prompt } })
    await db.setting.upsert({ where: { key: `${tenant.id}_v0Model` }, update: { value: modelId }, create: { tenantId: tenant.id, key: `${tenant.id}_v0Model`, value: modelId } })

    return stream.toResponse()
  },
  { minRole: "admin" },
)
