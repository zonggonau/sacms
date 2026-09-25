/**
 * SaCMS Agentic AI Website Builder — Multi-Phase Streaming Chat API Route
 *
 * Implements a 5-phase autonomous agent orchestration model:
 *   Phase 1: Planner (analyze prompt → produce ApplicationPlan)
 *   Phase 2: Schema Agent (provision Content Types / Single Types via MCP)
 *   Phase 3: Data Agent (seed realistic entries)
 *   Phase 4: Coding Agent (generate frontend files per framework)
 *   Phase 5: QA Agent (self-validate generated code)
 *
 * Each phase reports progress via `reportAgentPhase` tool so the chat UI
 * can render a real-time phase timeline with status indicators.
 *
 * Uses Vercel AI SDK as the orchestration layer and SaCMS MCP as the
 * execution/data layer.
 */

import { db, getTenantDb } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { resolveModel } from "@/lib/ai/model-resolver.server"
import { getModelConfig, getDefaultModel } from "@/lib/ai/model-registry"
import { streamText, tool, isStepCount } from "ai"
import { z } from "zod"
import { randomBytes, createHash } from "crypto"
import {
  extractFilesFromRawText,
  mergeProjectFiles,
  normalizeFilePath,
  type ExtractedFile,
} from "@/lib/ai/file-extractor"
import {
  type FrameworkId,
  type FrameworkConfig,
  getFrameworkConfig,
} from "@/lib/ai/framework-registry"

// ────────────────────────────────────────────────────────────────────────────
// Multi-Phase Agentic System Prompt
// ────────────────────────────────────────────────────────────────────────────

function buildAgenticSystemPrompt(
  fw: FrameworkConfig,
  tenantSlug: string,
  isIteration: boolean
): string {
  if (isIteration) {
    return buildIterationSystemPrompt(fw)
  }

  return `You are **SaCMS Autonomous Agentic AI Engineer** — a multi-phase AI agent that builds complete, production-ready websites.

CRITICAL TOOL-CALLING RULE: Call **exactly ONE tool per turn**. NEVER call multiple tools in the same response, even when several calls seem independent (e.g. creating several Content Types, or seeding several collections). Wait for each tool's result before deciding on and calling the next tool. Calling more than one tool at once will break the conversation.

You MUST follow the **5-Phase Agentic Protocol** below IN STRICT ORDER. At each phase transition, you MUST call the "reportAgentPhase" tool to report your progress. This is critical because the user sees a real-time phase timeline in the UI.

═══════════════════════════════════════════════════════════════
  PHASE 1: PERENCANAAN ARSITEKTUR (Planning)
═══════════════════════════════════════════════════════════════
1. Call reportAgentPhase with phaseId="planning", status="running".
2. Analyze the user's prompt to identify:
   - Domain/industry (e.g. travel, e-commerce, education, healthcare)
   - Required data entities → map to Content Types (collections)
   - Singleton pages → map to Single Types
   - Key pages and UI components needed
3. Call "submitApplicationPlan" with a structured JSON plan containing:
   - projectName, summary, domain
   - contentTypes (with fields: name, slug, type, required)
   - singleTypes (with fields)
   - pages (with component names)
   - designNotes (color palette, aesthetic direction)
4. Call reportAgentPhase with phaseId="planning", status="completed".

═══════════════════════════════════════════════════════════════
  PHASE 2: PROVISI SKEMA DATABASE (Schema Provisioning)
═══════════════════════════════════════════════════════════════
1. Call reportAgentPhase with phaseId="schema_provisioning", status="running".
2. Check the "WORKSPACE SCHEMA AVAILABLE" in context.
3. For each Content Type in your plan that does NOT already exist:
   - Call "createContentType" with the full field definitions.
4. For each Single Type in your plan that does NOT already exist:
   - Call "createSingleType" with the full field definitions.
5. Call reportAgentPhase with phaseId="schema_provisioning", status="completed".

═══════════════════════════════════════════════════════════════
  PHASE 3: INJEKSI DATA REALISTIS (Data Seeding)
═══════════════════════════════════════════════════════════════
1. Call reportAgentPhase with phaseId="data_seeding", status="running".
2. For each Content Type created (or existing but empty):
   - Call "seedContentEntries" with 3-5 realistic Indonesian data entries.
   - Use high-resolution Unsplash URLs for media fields.
   - Use realistic Indonesian names, prices (Rp format), descriptions.
3. Call reportAgentPhase with phaseId="data_seeding", status="completed".

═══════════════════════════════════════════════════════════════
  PHASE 4: KOMPILASI FRONTEND (Full-Page Multi-Section Mandate)
═══════════════════════════════════════════════════════════════
1. Call reportAgentPhase with phaseId="coding", status="running".
2. Generate the frontend project using the "writeFile" tool for each file:

   TARGET FRAMEWORK: ${fw.name} (${fw.category})
   - Main Entry: ${fw.mainEntryFile}
   - API Client: ${fw.apiClientPath} → fetch from SaCMS Public REST API
   - Types: ${fw.typesPath} → TypeScript interfaces matching schema fields
   - Vercel Deploy: ${fw.vercelSupport} (${fw.buildOutputDirectory}/)

   CRITICAL MANDATE — v0.dev / BOLT.NEW / LOVABLE FULL-PAGE STANDARD:
   NEVER generate a minimalist skeleton, stub, or placeholder landing page. Users expect a complete, rich, production-grade website with 10+ standard sections working right out of the box from top to bottom.
   
   The main entry file ("${fw.mainEntryFile}") MUST be a full, rich, interactive Client Component ("use client" at top, default export) containing the COMPLETE user journey from Navbar down to Footer (minimum 250-400 lines of rich React/Tailwind code with real state):

   CRITICAL — NEVER declare the component (or any component it renders) as \`async\`. "use client" components can NEVER be async functions — \`export default async function Page()\` crashes with "An unknown Component is an async Client Component". Fetch data the client way instead: \`useEffect\` + \`useState\` (call the API inside \`useEffect\`, store the result with \`useState\`, render the state), never top-level \`await\` in the component body.

   MANDATORY 12+ SECTIONS (ALL MUST BE BUILT INTO THE PAGE):
   1. STICKY FLOATING NAVBAR: Glassmorphism header (backdrop-blur-md) with brand logo, badge, navigation links (Beranda, Menu/Katalog, Cerita, Fasilitas, Testimoni, Kontak), search trigger, action CTA ("Pesan Sekarang" / "Hubungi Kami"), and mobile menu toggle.
   2. IMMERSIVE HERO SECTION: Eyebrow badge (e.g. "⭐ Terbaik di Nabire"), bold punchy headline, persuasive subheadline, dual action buttons (Primary CTA + Secondary Ghost CTA), customer rating badge with 5 stars, customer avatar stack (e.g. "500+ Pelanggan Puas Hari Ini"), and themed high-res visual showcase.
   3. SOCIAL PROOF / STATS BAR: 4 highlighted metrics with icons and numbers (e.g. "15+ Varian Kopi", "100% Organik", "4.9 Rating", "5.000+ Pesanan").
   4. VALUE PROPOSITION / KEUNGGULAN: 3-4 feature cards with Lucide icons explaining unique selling points.
   5. INTERACTIVE CATALOG / MENU / PRODUCT SHOWCASE:
      - Category filter tabs with active state switching (useState: "Semua", "Kopi", "Non-Kopi", "Makanan", "Camilan")
      - Live search input filter
      - 6 to 8 rich item cards with high-res Unsplash photos, title, price formatted in Indonesian Rupiah (e.g. "Rp 28.000"), description, tags ("Best Seller", "Favorit"), and "Pesan / Tambah" button.
   6. INTERACTIVE ORDER / DETAIL MODAL OR DRAWER:
      - Clicking any card or "Pesan" opens an interactive modal or drawer showing item details, quantity counter (+/-), total price, and "Konfirmasi Pesanan via WhatsApp" direct link.
   7. BRAND STORY / ABOUT US SECTION:
      - The authentic background story, artisan craftsmanship, mission, and high-res photo grid.
   8. FACILITY / AMBIENCE / GALLERY GRID:
      - Visual grid highlighting physical location, ambience, seating, Wi-Fi, atmosphere.
   9. CUSTOMER TESTIMONIALS / REVIEWS:
      - 3-4 authentic testimonials with user avatars, reviewer names, roles/locations, 5-star ratings, and compelling quotes.
   10. LOCATION, OPERATING HOURS & MAP CARD:
       - Full street address, opening hours (Senin - Minggu), phone/WhatsApp, and directions link.
   11. INTERACTIVE FAQ ACCORDION:
       - 4-5 accordion items with collapsible answers using React state.
   12. HIGH-CONVERTING CTA BANNER:
       - Prominent banner with special offer / invitation to visit and direct WhatsApp CTA.
   13. ENTERPRISE MULTI-COLUMN FOOTER:
       - Brand identity, about snippet, quick links, contact info, newsletter input or opening hours, social media links, and copyright notice.

   REQUIRED FILES TO WRITE (minimum):
   a. "${fw.typesPath}" — TypeScript interfaces matching the exact schema fields
   b. "${fw.apiClientPath}" — Typed API client with fetch + rich fallback data
   c. "${fw.mainEntryFile}" — The comprehensive full-page interactive application

   CODE QUALITY RULES:
   - Every file MUST be complete — NO "// TODO", NO placeholders, NO truncated code
   - Include rich inline fallback/mock data so Sandpack preview works offline immediately
   - CRITICAL: When a fetch to the SaCMS API fails or throws (catch block), SILENTLY set the state to the rich fallback/mock data — the exact same data the page would show offline. NEVER render an error message like "Gagal memuat data" / "Failed to load" to the visitor. A live preview sandbox has no network access to the API, so every fetch WILL fail there — the page must still look fully populated and complete, never broken or empty.
   - Use Tailwind CSS for styling, Lucide icons for icons
   - Modern aesthetics: glassmorphism, gradients, micro-animations, badges, ratings
   - Format currency as Indonesian Rupiah (e.g. "Rp 28.000")
   - Use high-res Unsplash URLs for all images, themed to the domain
   - Responsive design: mobile-first with tablet and desktop breakpoints

3. Call reportAgentPhase with phaseId="coding", status="completed".

═══════════════════════════════════════════════════════════════
  PHASE 5: VALIDASI & QA (Quality Assurance)
═══════════════════════════════════════════════════════════════
1. Call reportAgentPhase with phaseId="qa_validation", status="running".
2. Call "validateProject" to self-check:
   - All imports resolve to files that were written
   - Main entry file exists
   - API client file exists with correct base URL
   - Types file matches schema fields
   - No blank/empty components
   - All images have valid URLs
3. If validation issues are found, write corrected files.
4. Call reportAgentPhase with phaseId="qa_validation", status="completed".

═══════════════════════════════════════════════════════════════
  FINAL: COMPLETION
═══════════════════════════════════════════════════════════════
Call reportAgentPhase with phaseId="completed", status="completed".
Then provide a friendly, conversational summary in Indonesian explaining:
- Skema database yang dibuat
- Data contoh yang diinjeksi
- Arsitektur frontend yang dipilih
- Cara menggunakan dan memodifikasi website

IMPORTANT REMINDERS:
- ALWAYS call reportAgentPhase at the START and END of each phase.
- NEVER skip phases. Execute all 5 phases in order.
- If a phase has nothing to do (e.g. schema already exists), still report it as "completed" with a note.
- For the Sandpack in-browser preview to work, the main component MUST be a React component with "use client" at the top and a default export.`
}

function buildIterationSystemPrompt(fw: FrameworkConfig): string {
  return `You are SaCMS AI Assistant performing an iteration/revision on an existing website project.

CRITICAL TOOL-CALLING RULE: Call **exactly ONE tool per turn**. NEVER call multiple tools in the same response, even when writing several files. Wait for each tool's result before calling the next tool. Calling more than one tool at once will break the conversation.

TARGET FRAMEWORK: ${fw.name} (${fw.category})

CRITICAL MANDATE — v0.dev / BOLT.NEW / LOVABLE FULL-PAGE STANDARD:
- NEVER truncate the website or strip away sections when updating files.
- The website MUST remain a complete, production-grade, multi-section web application from Sticky Navbar down to Enterprise Footer (Navbar, Hero, Stats, Keunggulan, Interactive Catalog/Menu with category filter & search, Order Drawer/Modal, Story, Gallery, Testimonials, Location/Hours, FAQ, CTA Banner, and Multi-Column Footer).
- Every file must be complete, working code with NO abbreviations, NO placeholders, and NO "// rest of code remains unchanged" shortcuts.
- NEVER declare a "use client" component as \`async\`. \`export default async function Page()\` crashes with "An unknown Component is an async Client Component". Fetch data via \`useEffect\` + \`useState\`, never top-level \`await\` in the component body.
- When a fetch to the SaCMS API fails (catch block), SILENTLY fall back to the existing rich mock data — NEVER render a "Gagal memuat data" / "Failed to load" error message. The preview sandbox has no network access, so every fetch there WILL fail; the page must still look fully populated.

ITERATION PROTOCOL:
1. Call reportAgentPhase with phaseId="planning", status="running" then "completed" — briefly note what change is requested.
2. If the iteration requires new schema (new Content Types/fields), call reportAgentPhase for "schema_provisioning" and execute the MCP tools.
3. Call reportAgentPhase with phaseId="coding", status="running".
4. Use the "writeFile" tool for EVERY file that needs updating.
5. Also re-write unchanged files if the project structure requires it.
6. Call reportAgentPhase with phaseId="coding", status="completed".
7. Call reportAgentPhase with phaseId="completed", status="completed".
8. Provide a brief conversational summary in Indonesian.

RULES:
- Apply the requested changes precisely while maintaining full-page multi-section richness.
- Preserve existing functionality not asked to change.
- Keep Tailwind CSS, Lucide icons, and TypeScript types intact.
- Every file must be 100% complete and working.`
}

function extractTextFromMessage(m: any): string {
  if (!m) return ""
  if (typeof m.content === "string") return m.content
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p: any) => p && (p.type === "text" || !p.type) && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("")
  }
  return ""
}

export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    try {
      const rawBody = await req.json().catch(() => ({}))
      const body = rawBody?.body && typeof rawBody.body === "object" ? { ...rawBody, ...rawBody.body } : rawBody
      const messages: any[] = body?.messages || rawBody?.messages || []
      const modelId: string = body?.modelId || body?.model || rawBody?.modelId || "gpt-4o"
      const frameworkId: FrameworkId = (body?.framework as FrameworkId) || (rawBody?.framework as FrameworkId) || "nextjs"
      const fwConfig = getFrameworkConfig(frameworkId)
      const isIteration: boolean = body?.isIteration === true || rawBody?.isIteration === true
      const previousFiles: any[] = body?.previousFiles || rawBody?.previousFiles || []

      // Extract the user's actual prompt from the last user message or direct prompt field
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
      const prompt = (
        extractTextFromMessage(lastUserMessage) ||
        (typeof body?.prompt === "string" ? body.prompt : "") ||
        (typeof rawBody?.prompt === "string" ? rawBody.prompt : "")
      ).trim().slice(0, 8000)

      if (!prompt && messages.length === 0) {
        return apiError("validation", { message: "Prompt is required" })
      }

      const modelConfig = getModelConfig(modelId) || getDefaultModel()
      const creditCost = isIteration ? modelConfig.iterationCredits : modelConfig.credits

      // Credit enforcement
      const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
      const creditCheck = await enforceUserAiCredits(session.user.id, creditCost)
      if (!creditCheck.allowed) {
        return apiError("rate_limited", { message: creditCheck.message })
      }

      const tenant = access.tenant
      const bridge = new McpClientBridge(tenant.id, tenant.slug, session.user.id)
      const apiBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000"
      ).replace(/\/$/, "")

      // ── Build context for the AI ──
      let contextBlock = ""

      if (!isIteration) {
        // Full generation — consume SaCMS MCP Server schema and public endpoints
        const activeSchema = await bridge.getFullSchema().catch(() => ({
          workspace: { id: tenant.id, slug: tenant.slug },
          contentTypes: [],
          singleTypes: [],
          components: [],
        }))

        const capabilities = await bridge.inspectApiCapabilities().catch(() => ({
          mode: "full_access",
          permissions: ["read", "write", "delete", "schema"],
          canRead: true,
          canWrite: true,
        }))

        const tenantDb = await getTenantDb(tenant.id)

        const sampleCollections: Record<string, any[]> = {}
        for (const ct of activeSchema.contentTypes || []) {
          try {
            const entries = await tenantDb.contentEntry.findMany({
              where: { tenantId: tenant.id, contentType: { slug: ct.slug } },
              take: 5,
              orderBy: { createdAt: "desc" },
            })
            sampleCollections[ct.slug] = entries.map((e) => ({ id: e.id, ...(e.data as any) }))
          } catch {
            sampleCollections[ct.slug] = []
          }
        }

        const sampleSingleTypes: Record<string, any> = {}
        for (const st of activeSchema.singleTypes || []) {
          try {
            const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
              where: { tenantId: tenant.id, singleType: { slug: st.slug } },
            })
            if (assignment?.data) {
              sampleSingleTypes[st.slug] = assignment.data
            }
          } catch {
            // ignore
          }
        }

        // Auto-generate or retrieve an API token for public integration
        const plainToken = `cf_${randomBytes(24).toString("hex")}`
        const hashedToken = createHash("sha256").update(plainToken).digest("hex")
        try {
          await db.apiToken.create({
            data: {
              tenantId: tenant.id,
              name: `SaCMS AI Builder - ${new Date().toLocaleDateString()}`,
              description: "Auto-generated for SaCMS AI Website Builder",
              token: hashedToken,
              type: capabilities.canWrite ? "service" : "read-only",
              permissions: capabilities.permissions,
              createdBy: session.user.id,
            },
          })
        } catch {
          // Token creation is non-blocking
        }

        const finalApiUrl = `${apiBaseUrl}/api/public/${tenant.slug}`

        contextBlock = `
SaCMS HEADLESS CMS INTEGRATION:
- SaCMS Public REST API: ${finalApiUrl}
- Auth Header: Authorization: Bearer ${plainToken}
- API Capabilities: ${capabilities.mode} (canRead: ${capabilities.canRead}, canWrite: ${capabilities.canWrite})
- List Collection: GET ${finalApiUrl}/content/{collectionSlug}
- Single Type: GET ${finalApiUrl}/single/{singleTypeSlug}
- Filter: GET ${finalApiUrl}/content/{slug}?filters[fieldName][$eq]=value

WORKSPACE SCHEMA AVAILABLE:
${JSON.stringify(activeSchema, null, 2)}

SAMPLE DATA AVAILABLE:
${JSON.stringify({ collections: sampleCollections, singleTypes: sampleSingleTypes }, null, 2)}

REQUIREMENTS:
1. Follow the 5-Phase Agentic Protocol described in your system instructions.
2. Call reportAgentPhase at the start and end of every phase.
3. Use SaCMS MCP tools to provision schema and seed data BEFORE generating frontend code.
4. Build a complete, full-page ${fwConfig.name} website from Sticky Navbar to Enterprise Footer with all 12+ standard sections (Hero, Stats, Keunggulan, Catalog/Menu with interactive filter & search, Order Modal/Drawer, Story, Gallery, Testimonials, Location/Hours, FAQ, CTA, Footer).
5. Connect to SaCMS Public Content API dynamically.
6. Use Unsplash images for all media fields.
7. Initialize with rich fallback data and real interactive states (useState) — zero blank states, zero skeletal stubs.`
      } else if (previousFiles.length > 0) {
        // Iteration — include current files as context
        const filesContext = previousFiles
          .map((f: any) => `=== ${f.name} ===\n${f.content}`)
          .join("\n\n")

        contextBlock = `
CURRENT PROJECT FILES (apply changes to these):
${filesContext}

ITERATION RULES:
1. Follow the Iteration Protocol in your system instructions.
2. Call reportAgentPhase to indicate progress.
3. Return ALL files (modified AND unmodified) via writeFile tool.
4. Apply the requested changes precisely while maintaining the complete full-page multi-section structure from Navbar down to Footer.
5. Never strip away existing sections or truncate the page into a minimal stub.
6. Keep Tailwind CSS, Lucide icons, and TypeScript types intact.`
      }

      // ── Resolve model ──
      const model = await resolveModel(modelId)

      // ── Convert messages to clean CoreMessages for streamText ──
      // ModelMessage in AI SDK requires strict schema:
      // { role: "user" | "assistant", content: string }
      // where content is guaranteed to be a non-empty string.
      const rawList: Array<{ role: "user" | "assistant"; content: string }> = []
      if (Array.isArray(messages)) {
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i]
          if (!m || typeof m !== "object") continue
          const rawText = extractTextFromMessage(m)
          const text = (typeof rawText === "string" ? rawText : "").trim()
          if (!text) continue
          const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user"
          rawList.push({ role, content: text })
        }
      }

      // Determine the active user prompt for this turn
      const currentPrompt = (prompt || (rawList.length > 0 && rawList[rawList.length - 1].role === "user" ? rawList[rawList.length - 1].content : "Buatkan website lengkap")).trim()

      // Ensure the conversation ends with the user's latest instruction combined with the contextBlock
      if (rawList.length > 0 && rawList[rawList.length - 1].role === "user") {
        rawList[rawList.length - 1].content = contextBlock
          ? `${currentPrompt}\n\n${contextBlock}`
          : currentPrompt
      } else {
        rawList.push({
          role: "user",
          content: contextBlock ? `${currentPrompt}\n\n${contextBlock}` : currentPrompt,
        })
      }

      // Bound to last 8 messages to prevent context explosion while preserving conversation context
      const coreMessages = rawList.slice(-8)

      // Guarantee at least 1 valid user message
      if (coreMessages.length === 0) {
        coreMessages.push({
          role: "user",
          content: contextBlock ? `${currentPrompt}\n\n${contextBlock}` : currentPrompt,
        })
      }

      // Deduct credits
      await deductUserAiCredits(
        session.user.id,
        creditCost,
        isIteration ? "iterate_website" : "generate_frontend",
        tenant.id,
        modelId
      ).catch(() => null)

      // Ensure Site and SiteConversation exist for storing persistent chat history
      let activeSite = await db.site.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { updatedAt: "desc" },
      })
      if (!activeSite) {
        activeSite = await db.site.create({
          data: {
            tenantId: tenant.id,
            name: `${tenant.name || tenant.slug} Website`,
            slug: `${tenant.slug}-web`,
            subdomain: `${tenant.slug}-web`,
            status: "published",
          },
        })
      }

      let activeConv = await db.siteConversation.findFirst({
        where: { siteId: activeSite.id },
        orderBy: { updatedAt: "desc" },
      })
      if (!activeConv) {
        activeConv = await db.siteConversation.create({
          data: {
            siteId: activeSite.id,
            title: prompt.slice(0, 60) || "Website Assistant",
          },
        })
      }

      // Record the user prompt message in database
      if (prompt) {
        await db.siteMessage.create({
          data: {
            conversationId: activeConv.id,
            role: "user",
            content: prompt,
            status: "completed",
          },
        }).catch(() => null)
      }

      // Save session metadata
      if (!isIteration) {
        const chatId = `sacms_ai_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
        await db.setting.upsert({
          where: { key: `${tenant.id}_v0ChatId` },
          update: { value: chatId },
          create: { tenantId: tenant.id, key: `${tenant.id}_v0ChatId`, value: chatId },
        }).catch(() => null)

        await db.setting.upsert({
          where: { key: `${tenant.id}_v0FrontendPrompt` },
          update: { value: prompt },
          create: { tenantId: tenant.id, key: `${tenant.id}_v0FrontendPrompt`, value: prompt },
        }).catch(() => null)

        await db.setting.upsert({
          where: { key: `${tenant.id}_v0Model` },
          update: { value: modelId },
          create: { tenantId: tenant.id, key: `${tenant.id}_v0Model`, value: modelId },
        }).catch(() => null)
      }

      // ────────────────────────────────────────────────────────────────────────
      // Agentic Tool Definitions
      // ────────────────────────────────────────────────────────────────────────

      const tools = {
        // ── Phase Reporting Tool (UI Timeline) ──
        reportAgentPhase: tool({
          description:
            "Report the current agent phase status to the user's UI timeline. MUST be called at the START (status='running') and END (status='completed') of every phase. Phase IDs: planning, schema_provisioning, data_seeding, coding, qa_validation, completed.",
          inputSchema: z.object({
            phaseId: z.string().optional().default("planning").describe("Phase ID: planning, schema_provisioning, data_seeding, coding, qa_validation, completed"),
            phase: z.string().optional().describe("Alias for phaseId"),
            status: z.string().optional().default("running").describe("Status: running, completed, skipped, error"),
            message: z.string().optional().default("Sedang memproses...").describe("Human-readable status message in Indonesian"),
            details: z.string().optional().describe("Additional context or summary"),
            itemsProcessed: z.number().optional().describe("Number of items processed in this phase"),
          }) as any,
          execute: async (args: any) => {
            const phaseId = args?.phaseId || args?.phase || "planning"
            const status = args?.status || "running"
            const message = args?.message || "Sedang memproses..."
            const details = args?.details || ""
            const itemsProcessed = typeof args?.itemsProcessed === "number" ? args.itemsProcessed : undefined
            return {
              phaseId,
              status,
              message,
              details,
              itemsProcessed,
              timestamp: new Date().toISOString(),
            }
          },
        }),

        // ── Structured Application Plan (Planner Phase Output) ──
        submitApplicationPlan: tool({
          description:
            "Submit the structured Application Plan after analyzing the user's prompt. This documents what Content Types, Single Types, pages, and components will be created.",
          inputSchema: z.object({
            projectName: z.string().optional().default("Website Proyek").describe("Human-readable project name"),
            summary: z.string().optional().default("").describe("Summary of the project"),
            domain: z.string().optional().default("general").describe("Industry/domain"),
            framework: z.string().optional().default("nextjs").describe("Selected framework ID"),
            contentTypes: z.array(z.any()).optional().default([]).describe("Content Types to be created"),
            singleTypes: z.array(z.any()).optional().default([]).describe("Single Types to be created"),
            pages: z.array(z.any()).optional().default([]).describe("Frontend pages to generate"),
            designNotes: z.string().optional().default("").describe("Visual design direction"),
          }) as any,
          execute: async (plan: any) => {
            return {
              status: "plan_accepted",
              plan: {
                projectName: plan?.projectName || "Website Proyek",
                summary: plan?.summary || "",
                domain: plan?.domain || "general",
                framework: plan?.framework || "nextjs",
                contentTypes: Array.isArray(plan?.contentTypes) ? plan.contentTypes : [],
                singleTypes: Array.isArray(plan?.singleTypes) ? plan.singleTypes : [],
                pages: Array.isArray(plan?.pages) ? plan.pages : [],
                designNotes: plan?.designNotes || "",
              },
              message: `Application Plan "${plan?.projectName || "Website"}" diterima. Melanjutkan ke provisi skema...`,
            }
          },
        }),

        // ── QA Validation Tool (QA Phase) ──
        validateProject: tool({
          description:
            "Self-validate the generated project by checking file completeness, import consistency, and code quality. Call this in Phase 5 (QA).",
          inputSchema: z.object({
            filesWritten: z.array(z.string()).optional().default([]).describe("List of all file paths that were written via writeFile"),
            mainEntryFile: z.string().optional().default("app/page.tsx").describe("Path to the main entry file"),
            apiClientFile: z.string().optional().default("lib/sacms.ts").describe("Path to the API client file"),
            typesFile: z.string().optional().default("types/cms.ts").describe("Path to the TypeScript types file"),
            contentTypeSlugs: z.array(z.string()).optional().default([]).describe("Slugs of Content Types that should be referenced"),
          }) as any,
          execute: async ({ filesWritten = [], mainEntryFile = "app/page.tsx", apiClientFile = "lib/sacms.ts", typesFile = "types/cms.ts", contentTypeSlugs = [] }: any) => {
            const checks: Array<{ name: string; passed: boolean; detail?: string }> = []
            checks.push({
              name: "Main entry file exists",
              passed: filesWritten.some((f: string) => normalizeFilePath(f) === normalizeFilePath(mainEntryFile)),
              detail: mainEntryFile,
            })
            checks.push({
              name: "API client file exists",
              passed: filesWritten.some((f: string) => normalizeFilePath(f) === normalizeFilePath(apiClientFile)),
              detail: apiClientFile,
            })
            checks.push({
              name: "TypeScript types file exists",
              passed: filesWritten.some((f: string) => normalizeFilePath(f) === normalizeFilePath(typesFile)),
              detail: typesFile,
            })
            const allPassed = checks.every((c) => c.passed)
            return {
              passed: allPassed,
              checks,
              summary: allPassed
                ? "Semua pengecekan kualitas lolos. Proyek siap ditampilkan di sandbox."
                : "Validasi selesai dengan beberapa catatan penyesuaian.",
            }
          },
        }),

        // ── Schema Provisioning Tools (MCP Execution) ──
        createContentType: tool({
          description:
            "Create a new Content Type (collection) schema in SaCMS database for this tenant if not already present. Fields describe attributes such as title, slug, price, content, etc.",
          inputSchema: z.object({
            name: z.string().describe("Display name, e.g. 'Katalog Produk', 'Destinasi Wisata'"),
            slug: z.string().describe("URL/API collection slug in kebab-case, e.g. 'katalog-produk', 'destinasi'"),
            description: z.string().optional().describe("Brief description of this collection"),
            fields: z.array(
              z.object({
                name: z.string().describe("Field display name, e.g. 'Judul', 'Harga', 'Foto'"),
                slug: z.string().describe("Field key, e.g. 'title', 'price', 'featuredImage'"),
                type: z.enum(["string", "text", "richtext", "number", "boolean", "date", "media", "relation"]).optional().default("string"),
                required: z.boolean().optional().default(false),
                unique: z.boolean().optional().default(false),
                relationSlug: z.string().optional(),
              })
            ).optional().default([]),
          }) as any,
          execute: async ({ name, slug, description, fields = [] }: any) => {
            try {
              const res = await bridge.createContentType({
                name: name || slug,
                slug: slug || name?.toLowerCase().replace(/\s+/g, "-"),
                description: description || "",
                fields: Array.isArray(fields)
                  ? fields.map((f: any, i: number) => ({
                      name: f.name || f.slug,
                      slug: f.slug || f.name?.toLowerCase().replace(/\s+/g, "_"),
                      type: f.type || "string",
                      required: f.required ?? false,
                      unique: f.unique ?? false,
                      relationSlug: f.relationSlug,
                      order: i,
                    }))
                  : [],
              })
              return res
            } catch (err: any) {
              console.warn("[MCP_CREATE_CONTENT_TYPE_ERR]", err?.message)
              return { success: false, error: err?.message || "Gagal membuat Content Type" }
            }
          },
        }),

        createSingleType: tool({
          description:
            "Create a new Single Type (singleton/one-off page like Company Profile, About Us, Homepage Config) in SaCMS database for this tenant.",
          inputSchema: z.object({
            name: z.string().describe("Display name, e.g. 'Profil Perusahaan', 'Pengaturan Website'"),
            slug: z.string().describe("URL/API slug in kebab-case, e.g. 'profil-perusahaan'"),
            description: z.string().optional(),
            fields: z.array(
              z.object({
                name: z.string(),
                slug: z.string(),
                type: z.enum(["string", "text", "richtext", "number", "boolean", "date", "media", "relation"]).optional().default("string"),
                required: z.boolean().optional().default(false),
              })
            ).optional().default([]),
          }) as any,
          execute: async ({ name, slug, description, fields = [] }: any) => {
            try {
              const res = await bridge.createSingleType({
                name: name || slug,
                slug: slug || name?.toLowerCase().replace(/\s+/g, "-"),
                description: description || "",
                fields: Array.isArray(fields)
                  ? fields.map((f: any, i: number) => ({
                      name: f.name || f.slug,
                      slug: f.slug || f.name?.toLowerCase().replace(/\s+/g, "_"),
                      type: f.type || "string",
                      required: f.required ?? false,
                      order: i,
                    }))
                  : [],
              })
              return res
            } catch (err: any) {
              console.warn("[MCP_CREATE_SINGLE_TYPE_ERR]", err?.message)
              return { success: false, error: err?.message || "Gagal membuat Single Type" }
            }
          },
        }),

        // ── Data Seeding Tool ──
        seedContentEntries: tool({
          description:
            "Seed 3-5 realistic data entries into a Content Type in SaCMS so the public REST API (/api/public/[tenant]/content/[slug]) returns real data immediately.",
          inputSchema: z.object({
            contentTypeSlug: z.string().describe("The slug of the Content Type to seed data into"),
            entries: z.array(z.record(z.string(), z.any())).optional().default([]).describe("Array of 3-5 realistic mock objects matching the schema fields"),
          }) as any,
          execute: async ({ contentTypeSlug, entries = [] }: any) => {
            try {
              let count = 0
              if (Array.isArray(entries)) {
                for (const entryData of entries) {
                  try {
                    await bridge.createContentEntry({
                      contentTypeSlug,
                      data: entryData,
                      status: "PUBLISHED",
                    })
                    count++
                  } catch (err: any) {
                    console.warn(`[AI_BUILDER_SEED] Failed to seed entry for ${contentTypeSlug}:`, err.message)
                  }
                }
              }
              return {
                contentTypeSlug,
                seededCount: count,
                status: "success",
              }
            } catch (err: any) {
              return { contentTypeSlug, seededCount: 0, status: "error", error: err?.message }
            }
          },
        }),

        // ── Framework Selection Tool ──
        selectFramework: tool({
          description:
            "Confirm or recommend the frontend framework for the generated code (nextjs, vite, astro, remix, vue, svelte).",
          inputSchema: z.object({
            framework: z.string().optional().default("nextjs"),
            reason: z.string().optional().default("Framework optimal untuk proyek ini"),
          }) as any,
          execute: async ({ framework = "nextjs", reason = "" }: any) => {
            return {
              framework,
              reason,
              config: getFrameworkConfig(framework as any),
              status: "confirmed",
            }
          },
        }),

        // ── File Writing Tool (Code Generation) ──
        writeFile: tool({
          description:
            "Create, write, or update a project file in the chosen frontend framework. Path should be relative, e.g. 'app/page.tsx' (Next.js) or 'src/App.tsx' (Vite) or 'src/pages/index.astro' (Astro), 'lib/sacms.ts', 'types/cms.ts'.",
          inputSchema: z.object({
            path: z.string().default("app/page.tsx").describe("Relative file path (e.g. app/page.tsx, src/App.tsx, components/Hero.tsx)"),
            content: z.string().default("").describe("Full, complete source code for the file"),
            description: z.string().optional().describe("Brief description of this component or update"),
          }) as any,
          execute: async ({
            path,
            content,
            description,
          }: {
            path: string
            content: string
            description?: string
          }) => {
            return {
              path: normalizeFilePath(path || "app/page.tsx"),
              status: "written",
              description: description || "File written successfully",
            }
          },
        }),

        // ── File Deletion Tool ──
        deleteFile: tool({
          description: "Delete an obsolete or deleted file from the project.",
          inputSchema: z.object({
            path: z.string().describe("Relative file path to delete"),
          }) as any,
          execute: async ({ path }: { path: string }) => {
            return {
              path: normalizeFilePath(path || ""),
              status: "deleted",
            }
          },
        }),
      }

      // ────────────────────────────────────────────────────────────────────────
      // Stream with Multi-Step Tool Execution
      // ────────────────────────────────────────────────────────────────────────

      const result = streamText({
        model,
        system: buildAgenticSystemPrompt(fwConfig, tenant.slug, isIteration),
        messages: coreMessages,
        tools,
        // Without this, navigating away, deleting the project, or the client
        // simply disconnecting leaves the 60-step agent running to completion
        // on the server — onFinish then fires anyway and can resurrect a Site
        // that was just deleted (syncFilesToDb recreates it if missing).
        abortSignal: req.signal,
        // 5-phase protocol alone costs ~20 steps (10 reportAgentPhase + plan +
        // schema/seed calls per content type) before real coding starts — give
        // the coding/QA phases enough room to actually finish the full page.
        stopWhen: isStepCount(60),
        maxOutputTokens: Math.max(modelConfig.maxTokens || 8192, 4096),
        temperature: 0.3,
        // Disables parallel tool calls, but only for models actually served by
        // OpenAI — sending `providerOptions.openai` to a request destined for
        // a different provider (e.g. Google/Vertex, routed through the native
        // Gateway) gets rejected outright as "invalid argument". Google/Vertex
        // has no equivalent providerOptions knob anyway; for that path, the
        // "call one tool per turn" rule in the system prompt above is what
        // actually prevents the Vertex function-call/response pairing bug.
        ...(modelConfig.provider === "openai"
          ? { providerOptions: { openai: { parallelToolCalls: false } } }
          : {}),
        onError({ error }) {
          console.error("[STREAM_TEXT_RUNTIME_ERROR]", error)
        },
        async onFinish({ text, steps }) {
          try {
            // Collect files from ALL steps (multi-step tool execution)
            const toolFiles: ExtractedFile[] = []
            const deletedPaths: string[] = []

            if (Array.isArray(steps)) {
              for (const step of steps) {
                if (Array.isArray(step.toolCalls)) {
                  for (const tc of step.toolCalls) {
                    const tcInput = (tc as any).input || (tc as any).args
                    if (tc.toolName === "writeFile" && tcInput?.path && tcInput?.content) {
                      toolFiles.push({
                        name: normalizeFilePath(tcInput.path),
                        content: tcInput.content,
                        description: tcInput.description,
                      })
                    } else if (tc.toolName === "deleteFile" && tcInput?.path) {
                      deletedPaths.push(normalizeFilePath(tcInput.path))
                    }
                  }
                }
              }
            }

            // Also check text for JSON fallback
            const textFiles = extractFilesFromRawText(text)
            const combinedNewFiles = [...toolFiles]
            for (const tf of textFiles) {
              if (!combinedNewFiles.some((f) => f.name === tf.name)) {
                combinedNewFiles.push(tf)
              }
            }

            // If this is an iteration, merge with previous files to preserve unchanged code
            const finalFiles = isIteration
              ? mergeProjectFiles(previousFiles, combinedNewFiles, deletedPaths)
              : combinedNewFiles

            if (finalFiles.length > 0) {
              await syncFilesToDb(tenant.id, tenant.slug, finalFiles)
            }

            // Persist the assistant's answer and tool artifact in database
            if (activeConv) {
              await db.siteMessage.create({
                data: {
                  conversationId: activeConv.id,
                  role: "assistant",
                  content: text || "Komponen frontend telah berhasil disusun dan terhubung ke skema SaCMS.",
                  toolCalls: toolFiles.length > 0 ? (toolFiles as any) : undefined,
                  creditsUsed: creditCost,
                  status: "completed",
                },
              }).catch(() => null)
            }
          } catch (err: any) {
            console.warn("[AI_BUILDER_STREAM] onFinish file extraction warning:", err.message)
          }
        },
      })

      return result.toUIMessageStreamResponse({
        sendReasoning: true,
        onError: (err: any) => {
          const msg = err?.message || String(err) || "Terjadi kesalahan saat memproses streaming AI."
          console.error("[AI_BUILDER_STREAM_ON_ERROR]", err)
          return msg
        },
      })
    } catch (err: any) {
      console.error("[AI_BUILDER_CHAT_ROUTE_ERROR]", err)
      return apiError("internal", { message: err?.message || "Gagal membangun website via AI Engine." })
    }
  },
  { minRole: "admin" },
)

// ────────────────────────────────────────────────────────────────────────────
// Database Sync Helper
// ────────────────────────────────────────────────────────────────────────────

async function syncFilesToDb(
  tenantId: string,
  tenantSlug: string,
  files: Array<{ name: string; content: string }>
) {
  let site = await db.site.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" } })
  if (!site) {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    site = await db.site.create({
      data: {
        tenantId,
        name: `${tenant?.name || tenantSlug} Website`,
        slug: `${tenantSlug}-web`,
        subdomain: `${tenantSlug}-web`,
        status: "published",
      },
    })
  }
  for (const f of files) {
    const filePath =
      f.name.startsWith("app/") || f.name.startsWith("components/") || f.name.startsWith("lib/")
        ? f.name
        : `app/${f.name}`
    await db.siteFile.upsert({
      where: { siteId_path: { siteId: site.id, path: filePath } },
      create: { siteId: site.id, path: filePath, content: f.content },
      update: { content: f.content },
    })
  }
}


