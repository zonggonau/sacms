/**
 * Unified AI Website Builder — Streaming Chat API Route
 *
 * Direct Vercel AI SDK streaming endpoint supporting all 26 models via
 * Vercel AI Gateway (and direct fallback keys). Consumes live SaCMS MCP Server
 * context (collections, single types, capabilities, REST API) and streams the
 * Next.js 16 App Router application directly.
 */

import { db, getTenantDb } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { resolveModel } from "@/lib/ai/model-resolver.server"
import { getModelConfig, getDefaultModel } from "@/lib/ai/model-registry"
import { streamText } from "ai"
import { randomBytes, createHash } from "crypto"

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
      const body = await req.json().catch(() => ({}))
      const messages: any[] = body?.messages || []
      const modelId: string = body?.modelId || body?.model || "gemini-2.5-flash"
      const isIteration: boolean = body?.isIteration === true
      const previousFiles: any[] = body?.previousFiles || []

      // Extract the user's actual prompt from the last user message or direct prompt field
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
      const prompt = (
        extractTextFromMessage(lastUserMessage) ||
        (typeof body?.prompt === "string" ? body.prompt : "")
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
      const apiBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000"
      ).replace(/\/$/, "")

      // ── Build context for the AI ──
      let contextBlock = ""

      if (!isIteration) {
        // Full generation — consume SaCMS MCP Server schema and public endpoints
        const bridge = new McpClientBridge(tenant.id, tenant.slug, session.user.id)
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
1. Build a comprehensive Next.js 16 App Router website with modern UI.
2. Connect to SaCMS Public Content API dynamically.
3. Use Unsplash images for all media fields.
4. Include Navbar, Hero, Feature cards, detail views, and Footer.
5. Format currency as Indonesian Rupiah, use star ratings, badges.
6. Tech: Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide-React.
7. Initialize with rich fallback data — zero blank states.`
      } else if (previousFiles.length > 0) {
        // Iteration — include current files as context
        const filesContext = previousFiles
          .map((f: any) => `=== ${f.name} ===\n${f.content}`)
          .join("\n\n")

        contextBlock = `
CURRENT PROJECT FILES (apply changes to these):
${filesContext}

ITERATION RULES:
1. Return ALL files (modified AND unmodified) in the JSON format.
2. Apply the requested changes precisely.
3. Preserve existing functionality not asked to change.
4. Keep Tailwind CSS, Lucide icons, and TypeScript types intact.`
      }

      // ── Resolve model ──
      const model = await resolveModel(modelId)

      // Convert messages to clean CoreMessages for streamText
      const coreMessages: Array<{ role: "user" | "assistant"; content: string }> = []
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        const text = extractTextFromMessage(m)
        if (!text) continue
        const role = m.role === "assistant" ? "assistant" : "user"

        if (i === messages.length - 1 && role === "user" && contextBlock) {
          coreMessages.push({ role, content: `${text}\n\n${contextBlock}` })
        } else {
          coreMessages.push({ role, content: text })
        }
      }

      // Fallback if coreMessages is empty
      if (coreMessages.length === 0 && prompt) {
        coreMessages.push({
          role: "user",
          content: contextBlock ? `${prompt}\n\n${contextBlock}` : prompt,
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

      const result = streamText({
        model,
        system: buildSystemPrompt(),
        messages: coreMessages,
        maxOutputTokens: Math.max(modelConfig.maxTokens || 8192, 4096),
        temperature: 0.3,
        async onFinish({ text }) {
          try {
            const files = parseFilesFromText(text)
            if (files.length > 0) {
              await syncFilesToDb(tenant.id, tenant.slug, files)
            }
          } catch (err: any) {
            console.warn("[AI_BUILDER_STREAM] parseFilesFromText warning:", err.message)
          }
        },
      })

      return result.toUIMessageStreamResponse()
    } catch (err: any) {
      console.error("[AI_BUILDER_CHAT_ROUTE_ERROR]", err)
      return apiError("internal", { message: err?.message || "Gagal membangun website via AI Engine." })
    }
  },
  { minRole: "admin" },
)

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseFilesFromText(rawText: string): Array<{ name: string; content: string }> {
  let text = rawText.trim()
  if (text.startsWith("```json")) text = text.replace(/^```json/, "").replace(/```\s*$/, "").trim()
  else if (text.startsWith("```")) text = text.replace(/^```/, "").replace(/```\s*$/, "").trim()

  const jsonStart = text.indexOf("{")
  const jsonEnd = text.lastIndexOf("}")
  if (jsonStart >= 0 && jsonEnd > jsonStart) text = text.substring(jsonStart, jsonEnd + 1)

  try {
    const parsed = JSON.parse(text)
    const rawFiles = Array.isArray(parsed?.files) ? parsed.files : []
    return rawFiles
      .filter((f: any) => f && typeof f.name === "string" && typeof f.content === "string")
      .map((f: any) => ({ name: f.name, content: f.content }))
  } catch {
    return []
  }
}

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
