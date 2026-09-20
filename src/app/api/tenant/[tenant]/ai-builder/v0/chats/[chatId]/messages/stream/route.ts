import { v0 } from "v0"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

/**
 * V0Transport's "send" URL — a follow-up message on an existing AI Website
 * Builder chat. Thin passthrough to `v0.messages.sendStream()`; unlike the
 * first message, follow-ups don't need the MCP schema/mega-prompt treatment
 * (mirrors the old `ai-builder/iterate` route, which also sent the raw
 * follow-up prompt unwrapped).
 */
export const POST = withStaffAuth(
  async (req, context, { access, session }) => {
    const params = await context.params
    const chatId = params.chatId as string
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    const body = await req.json().catch(() => ({}))
    const message = typeof body?.message === "string" ? body.message.slice(0, 5000) : ""
    const modelId: string = body?.modelConfiguration?.modelId || "v0-pro"
    if (!message) return apiError("validation", { message: "Message is required" })

    // Personal AI credits: 5 per follow-up, same cost as the old iterate route.
    const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
    const creditCheck = await enforceUserAiCredits(session.user.id, 5)
    if (!creditCheck.allowed) return apiError("rate_limited", { message: creditCheck.message })

    let messageToSend = message
    const isApiOrDataQuery = /api|live|real|data|schema|skema|database|konten|koleksi|endpoint|hubungkan|tampil/i.test(message)

    if (isApiOrDataQuery) {
      try {
        const { McpClientBridge } = await import("@/lib/mcp/mcp-client-bridge")
        const { getTenantDb } = await import("@/lib/database")
        const bridge = new McpClientBridge(access.tenant.id, access.tenant.slug, session.user.id)
        const activeSchema = await bridge.getFullSchema()
        const tenantDb = await getTenantDb(access.tenant.id)

        const sampleCollections: Record<string, any[]> = {}
        for (const ct of activeSchema.contentTypes || []) {
          const entries = await tenantDb.contentEntry.findMany({
            where: { tenantId: access.tenant.id, contentType: { slug: ct.slug } },
            take: 10,
            orderBy: { createdAt: "desc" },
          })
          sampleCollections[ct.slug] = entries.map((e) => ({ id: e.id, ...(e.data as any) }))
        }

        const sampleSingleTypes: Record<string, any> = {}
        for (const st of activeSchema.singleTypes || []) {
          const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
            where: { tenantId: access.tenant.id, singleType: { slug: st.slug } },
          })
          if (assignment?.data) {
            sampleSingleTypes[st.slug] = assignment.data
          }
        }

        const apiBaseUrl = (
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXTAUTH_URL ||
          "http://localhost:3000"
        ).replace(/\/$/, "")

        messageToSend = `${message}

SaCMS LIVE SCHEMA & REAL DATA CONTEXT:
API Base URL: ${apiBaseUrl}/api/public/${access.tenant.slug}
Available Endpoints:
${(activeSchema.contentTypes || []).map((ct: any) => `- Collection "${ct.name}": GET /api/public/${access.tenant.slug}/content/${ct.slug}`).join("\n")}
${(activeSchema.singleTypes || []).map((st: any) => `- Single Type "${st.name}": GET /api/public/${access.tenant.slug}/single/${st.slug}`).join("\n")}

REAL DATA FROM DATABASE:
${JSON.stringify({ collections: sampleCollections, singleTypes: sampleSingleTypes }, null, 2)}

CRITICAL LIVE DATA INSTRUCTIONS:
1. In "lib/sacms.ts", always include the REAL DATA FROM DATABASE above as rich default fallback data if cmsFetch fails (e.g. during preview sandbox when localhost is not reachable from Vercel cloud). NEVER return null, empty arrays [], or empty strings '' on failure.
2. In the Next.js page and components, render all fields directly (hero_title, hero_subtitle, cover_image, price, etc.) so that all sections are populated with full, vivid content immediately.
3. For image URLs, use the real cover_image from the data above.`
      } catch (err: any) {
        console.warn("[v0/messages/stream] Failed to enrich message with schema context:", err?.message)
      }
    }

    let stream: Awaited<ReturnType<typeof v0.messages.sendStream>>
    try {
      stream = await v0.messages.sendStream({
        chatId,
        message: messageToSend,
        modelConfiguration: { modelId: modelId as any, imageGenerations: false },
      })
    } catch (err: any) {
      console.error("[v0/messages/stream] sendStream failed:", err?.message)
      return apiError("internal", { message: err?.message || "Gagal menerapkan perubahan" })
    }

    await deductUserAiCredits(session.user.id, 5, "iterate_frontend", access.tenant.id, modelId)

    return stream.toResponse()
  },
  { minRole: "admin" },
)
