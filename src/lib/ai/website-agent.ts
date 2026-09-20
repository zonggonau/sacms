/**
 * SaCMS Unified AI Website Builder Agent
 *
 * Replaces the old dual-path architecture (v0 SDK for v0 models + Claude REST
 * for Anthropic models) with a single AI SDK-based agent pipeline that works
 * with ANY provider (OpenAI, Anthropic, Google) through the same interface.
 *
 * Architecture:
 *   User Prompt
 *     → AI SDK Agent (streamText/generateText)
 *       → Multi-Provider Model (via model-registry.ts)
 *         → Generated Files (Next.js App Router project)
 *           → Sandpack Preview (client-side) / Vercel Sandbox (future)
 *
 * The agent receives a "super prompt" that includes the SaCMS workspace schema,
 * sample data, and API connection details — then generates a complete Next.js
 * project as a JSON array of files. No v0 SDK, no V0Transport, no separate
 * Claude builder — just one unified pipeline.
 */

import { generateText, streamText, type ModelMessage } from "ai"
import { resolveModel } from "./model-resolver.server"
import { getModelConfig, getDefaultModel } from "./model-registry"
import { db, getTenantDb } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { randomBytes, createHash } from "crypto"

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  name: string
  content: string
}

export interface AgentGenerateResult {
  chatId: string
  files: GeneratedFile[]
  previewUrl: string
  model: string
  generating: boolean
  error?: string
}

export interface AgentIterateResult {
  files: GeneratedFile[]
  model: string
  error?: string
}

export interface AgentStreamCallbacks {
  onStepUpdate?: (step: string) => void
  onFilesGenerated?: (files: GeneratedFile[]) => void
  onError?: (error: string) => void
}

// ────────────────────────────────────────────────────────────────────────────
// System Prompt Templates
// ────────────────────────────────────────────────────────────────────────────

const FILE_SCHEMA_INSTRUCTION = `You must respond with ONLY a raw JSON object of this exact shape, with no markdown fences and no commentary:
{
  "files": [
    { "name": "app/page.tsx", "content": "...full file source..." },
    { "name": "app/layout.tsx", "content": "...full file source..." },
    { "name": "components/Navbar.tsx", "content": "...full file source..." }
  ]
}
Every "content" value must be the complete, valid file source as a single string (use \\n for newlines). Do not truncate files. Do not include package.json, tsconfig.json, or any config file — only app/ and components/ and lib/ source files.`

function buildSystemPrompt(): string {
  return `You are an expert Next.js 16 App Router developer. You build production-quality websites with TypeScript, Tailwind CSS, and Lucide-React icons.

CRITICAL RULES:
1. Generate COMPLETE, WORKING files. Never truncate, abbreviate, or use "..." placeholders.
2. Use "use client" directive only when the component needs React hooks, event handlers, or browser APIs.
3. Use Server Components by default for data fetching.
4. Always use proper TypeScript interfaces for all data types.
5. Initialize all components with rich, realistic fallback sample data so the preview renders instantly with zero blank states.
6. For images, always use valid Unsplash URLs (e.g. 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80') tailored to the domain.
7. Never leave <img src=""> empty or with broken placeholders.
8. Use modern UI patterns: glassmorphism, subtle gradients, micro-animations, responsive layouts.
9. Format currency as Indonesian Rupiah (e.g. "Rp 1.500.000"), use star ratings, badges, dates cleanly.

${FILE_SCHEMA_INSTRUCTION}`
}

function buildContextPrompt(params: {
  prompt: string
  tenantSlug: string
  apiBaseUrl: string
  apiToken: string
  activeSchema: any
  sampleCollections: Record<string, any[]>
  sampleSingleTypes: Record<string, any>
  capabilities: any
}): string {
  const { prompt, tenantSlug, apiBaseUrl, apiToken, activeSchema, sampleCollections, sampleSingleTypes, capabilities } = params

  const finalApiUrl = `${apiBaseUrl}/api/public/${tenantSlug}`

  return `User Request: ${prompt}

SaCMS HEADLESS CMS & MCP SERVER INTEGRATION:
- SaCMS Public REST API: ${finalApiUrl}
- Auth Header: Authorization: Bearer ${apiToken}
- API Capabilities: ${capabilities.mode} (canRead: ${capabilities.canRead}, canWrite: ${capabilities.canWrite}, canDelete: ${capabilities.canDelete})
- Mode Guidance: ${capabilities.canWrite ? "Build full interactive workflows (forms, mutations, booking, reviews, cart)" : "Build high-performance consumer view (catalogs, article feeds, portfolios)"}
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
   - Connect components to the SaCMS Public Content API.
   - Query collections and single types dynamically from the endpoints above.
   - Always define strict TypeScript interfaces for all CMS responses.
3. High-Quality Media & Mock Images:
   - For all image/media fields, always use valid, high-resolution Unsplash URLs tailored to the domain.
   - Never leave <img src=""> empty or with broken placeholders.
4. Multi-Section Layouts: Include Navbar branding, Hero section, Feature/Catalog cards, detail modals/views, reviews/testimonials, and Footer with contact information.
5. Rich Field Rendering: Format currency (e.g. "Rp 1.500.000"), ratings (stars), badges, dates, and action buttons cleanly.
6. Tech Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide-React icons.

Initialize all components with rich fallback sample data so the live sandbox preview renders instantly with zero blank states.`
}

// ────────────────────────────────────────────────────────────────────────────
// File Parser
// ────────────────────────────────────────────────────────────────────────────

function parseFilesFromResponse(rawText: string): GeneratedFile[] {
  let text = rawText.trim()

  // Strip markdown code fences if present
  if (text.startsWith("```json")) {
    text = text.replace(/^```json/, "").replace(/```\s*$/, "").trim()
  } else if (text.startsWith("```")) {
    text = text.replace(/^```/, "").replace(/```\s*$/, "").trim()
  }

  // Try to find JSON object in the text
  const jsonStart = text.indexOf("{")
  const jsonEnd = text.lastIndexOf("}")
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    text = text.substring(jsonStart, jsonEnd + 1)
  }

  const parsed = JSON.parse(text)
  const rawFiles = Array.isArray(parsed?.files) ? parsed.files : []
  const files: GeneratedFile[] = rawFiles
    .filter((f: any) => f && typeof f.name === "string" && typeof f.content === "string")
    .map((f: any) => ({ name: f.name, content: f.content }))

  if (files.length === 0) {
    throw new Error("AI response did not contain any valid files")
  }
  return files
}

// ────────────────────────────────────────────────────────────────────────────
// Schema & Data Preparation (shared between generate & iterate)
// ────────────────────────────────────────────────────────────────────────────

async function prepareWorkspaceContext(tenantId: string, tenantSlug: string, userId: string, prompt: string, plannedSchema?: any) {
  const bridge = new McpClientBridge(tenantId, tenantSlug, userId)

  // Inspect / generate schema via SaCMS MCP Bridge
  let activeSchema = await bridge.getFullSchema()
  const existingContentTypes = activeSchema.contentTypes || []
  const existingSlugs = new Set(existingContentTypes.map((ct: any) => ct.slug?.toLowerCase()))
  const isOnlyDefaultBoilerplate = existingContentTypes.length > 0 && existingContentTypes.every((ct: any) =>
    ct.slug === "services" || ct.slug === "articles"
  )

  const promptLower = prompt.toLowerCase()
  const domainKeywords = [
    "hotel", "room", "kamar", "villa", "produk", "product", "shop", "toko", 
    "resto", "makanan", "menu", "kuliner", "klinik", "dokter", "portfolio", 
    "course", "kursus", "event", "wisata", "tour", "booking", "fashion", "baju",
    "properti", "property", "berita", "news", "pesanan", "order"
  ]
  const mentionsNewDomain = domainKeywords.some(kw => promptLower.includes(kw) && !existingSlugs.has(kw) && !existingSlugs.has(kw + "s"))
  const needsNewSchema = existingContentTypes.length === 0 || isOnlyDefaultBoilerplate || mentionsNewDomain

  try {
    if (plannedSchema && (plannedSchema.contentTypes?.length || plannedSchema.singleTypes?.length)) {
      await bridge.applyGeneratedSchema(plannedSchema)
      activeSchema = await bridge.getFullSchema()
    } else if (needsNewSchema) {
      console.log(`[AI Builder Agent] Generating new custom schema via MCP for prompt: "${prompt.slice(0, 80)}..."`)
      const { generateSystemSchema } = await import("@/lib/ai-schema-generator")
      const generatedSchema = await generateSystemSchema(prompt, tenantId, userId)
      if (generatedSchema && (generatedSchema.contentTypes?.length || generatedSchema.singleTypes?.length)) {
        await bridge.applyGeneratedSchema(generatedSchema)
        activeSchema = await bridge.getFullSchema()
      }
    }
  } catch (schemaErr: any) {
    console.warn("[AI_BUILDER_AGENT_SCHEMA_WARNING]: Could not auto-apply schema via MCP:", schemaErr.message)
  }

  const capabilities = await bridge.inspectApiCapabilities()
  const tenantDb = await getTenantDb(tenantId)

  // Fetch sample records
  const sampleCollections: Record<string, any[]> = {}
  for (const ct of activeSchema.contentTypes || []) {
    const entries = await tenantDb.contentEntry.findMany({
      where: { tenantId, contentType: { slug: ct.slug } },
      take: 10,
      orderBy: { createdAt: "desc" },
    })
    sampleCollections[ct.slug] = entries.map(e => ({ id: e.id, ...(e.data as any) }))
  }

  const sampleSingleTypes: Record<string, any> = {}
  for (const st of activeSchema.singleTypes || []) {
    const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
      where: { tenantId, singleType: { slug: st.slug } },
    })
    if (assignment?.data) {
      sampleSingleTypes[st.slug] = assignment.data
    }
  }

  // Auto-generate API token
  const plainToken = `cf_${randomBytes(32).toString("hex")}`
  const hashedToken = createHash("sha256").update(plainToken).digest("hex")

  await db.apiToken.create({
    data: {
      tenantId,
      name: `SaCMS Frontend Token - ${new Date().toLocaleDateString()}`,
      description: `Auto-generated for SaCMS AI Website Builder`,
      token: hashedToken,
      type: capabilities.canWrite ? "service" : "read-only",
      permissions: capabilities.permissions,
      createdBy: userId,
    },
  })

  const apiBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")

  return {
    activeSchema,
    capabilities,
    sampleCollections,
    sampleSingleTypes,
    apiToken: plainToken,
    apiBaseUrl,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main Agent Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new website from scratch using the AI SDK.
 * This is the unified replacement for both createV0Chat() and createClaudeChat().
 */
export async function generateWebsite(params: {
  tenantId: string
  tenantSlug: string
  userId: string
  prompt: string
  modelId: string
  plannedSchema?: any
}): Promise<AgentGenerateResult> {
  const { tenantId, tenantSlug, userId, prompt, modelId, plannedSchema } = params

  const modelConfig = getModelConfig(modelId) || getDefaultModel()
  const chatId = `sacms_ai_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`

  try {
    // 1. Prepare workspace context (schema, data, API token)
    const context = await prepareWorkspaceContext(tenantId, tenantSlug, userId, prompt, plannedSchema)

    // 2. Build the prompt
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildContextPrompt({
      prompt,
      tenantSlug,
      apiBaseUrl: context.apiBaseUrl,
      apiToken: context.apiToken,
      activeSchema: context.activeSchema,
      sampleCollections: context.sampleCollections,
      sampleSingleTypes: context.sampleSingleTypes,
      capabilities: context.capabilities,
    })

    // 3. Resolve AI SDK model
    const model = await resolveModel(modelId)

    // 4. Generate with AI SDK
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: modelConfig.maxTokens,
      temperature: 0.3,
    })

    // 5. Parse generated files
    const files = parseFilesFromResponse(result.text)

    // 6. Save to Site & SiteFile
    await syncFilesToDatabase(tenantId, tenantSlug, files)

    // 7. Save settings
    await saveBuilderSettings(tenantId, chatId, prompt, modelId)

    return {
      chatId,
      files,
      previewUrl: "", // Sandpack preview rendered client-side
      model: modelId,
      generating: false,
    }
  } catch (error: any) {
    console.error("[AI Builder Agent] Generation failed:", error.message)
    return {
      chatId,
      files: [],
      previewUrl: "",
      model: modelId,
      generating: false,
      error: error.message,
    }
  }
}

/**
 * Stream a website generation for real-time UI updates.
 * Returns an AI SDK stream response that can be piped directly to the client.
 */
export async function streamGenerateWebsite(params: {
  tenantId: string
  tenantSlug: string
  userId: string
  prompt: string
  modelId: string
  plannedSchema?: any
}): Promise<ReturnType<typeof streamText>> {
  const { tenantId, tenantSlug, userId, prompt, modelId, plannedSchema } = params

  const modelConfig = getModelConfig(modelId) || getDefaultModel()

  // Prepare workspace context
  const context = await prepareWorkspaceContext(tenantId, tenantSlug, userId, prompt, plannedSchema)

  // Build prompts
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildContextPrompt({
    prompt,
    tenantSlug,
    apiBaseUrl: context.apiBaseUrl,
    apiToken: context.apiToken,
    activeSchema: context.activeSchema,
    sampleCollections: context.sampleCollections,
    sampleSingleTypes: context.sampleSingleTypes,
    capabilities: context.capabilities,
  })

  // Resolve AI SDK model
  const model = await resolveModel(modelId)

  // Stream with AI SDK
  return streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: modelConfig.maxTokens,
    temperature: 0.3,
  })
}

/**
 * Iterate on an existing website build with a follow-up instruction.
 * Replaces both the v0 SDK iteration and the Claude REST iteration.
 */
export async function iterateWebsite(params: {
  tenantId: string
  tenantSlug: string
  userId: string
  chatId: string
  prompt: string
  modelId: string
  previousFiles: GeneratedFile[]
}): Promise<AgentIterateResult> {
  const { tenantId, tenantSlug, userId, prompt, modelId, previousFiles } = params

  const modelConfig = getModelConfig(modelId) || getDefaultModel()

  try {
    const model = await resolveModel(modelId)

    const currentFilesContext = previousFiles
      .map(f => `=== ${f.name} ===\n${f.content}`)
      .join("\n\n")

    const messages: ModelMessage[] = [
      {
        role: "system",
        content: `${buildSystemPrompt()}

You are iterating on an existing Next.js 16 App Router website. The user wants specific changes applied to the current codebase.

CURRENT PROJECT FILES:
${currentFilesContext}

RULES FOR ITERATION:
1. Return ALL files (modified AND unmodified) in the same JSON format.
2. Apply the user's requested changes precisely.
3. Preserve all existing functionality that wasn't asked to change.
4. Keep all Tailwind CSS classes, Lucide icons, and TypeScript types intact.
5. Maintain the same SaCMS API connection patterns.`,
      },
      {
        role: "user",
        content: `Apply this change to the website: ${prompt}`,
      },
    ]

    const result = await generateText({
      model,
      messages,
      maxOutputTokens: modelConfig.maxTokens,
      temperature: 0.3,
    })

    const files = parseFilesFromResponse(result.text)

    // Sync updated files to database
    await syncFilesToDatabase(tenantId, tenantSlug, files)

    return {
      files,
      model: modelId,
    }
  } catch (error: any) {
    console.error("[AI Builder Agent] Iteration failed:", error.message)
    return {
      files: previousFiles, // Return original files on failure
      model: modelId,
      error: error.message,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Database Helpers
// ────────────────────────────────────────────────────────────────────────────

async function syncFilesToDatabase(tenantId: string, tenantSlug: string, files: GeneratedFile[]) {
  try {
    let site = await db.site.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    })

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
      const filePath = f.name.startsWith("app/") || f.name.startsWith("components/") || f.name.startsWith("lib/")
        ? f.name
        : `app/${f.name}`
      await db.siteFile.upsert({
        where: { siteId_path: { siteId: site.id, path: filePath } },
        create: { siteId: site.id, path: filePath, content: f.content },
        update: { content: f.content },
      })
    }
  } catch (err: any) {
    console.warn("[AI Builder Agent] Could not sync Site record:", err.message)
  }
}

async function saveBuilderSettings(tenantId: string, chatId: string, prompt: string, model: string) {
  const settings = [
    { key: `${tenantId}_v0ChatId`, value: chatId },
    { key: `${tenantId}_v0FrontendPrompt`, value: prompt },
    { key: `${tenantId}_v0Model`, value: model },
    { key: `${tenantId}_v0Status`, value: "draft" },
  ]

  for (const { key, value } of settings) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { tenantId, key, value },
    })
  }
}
