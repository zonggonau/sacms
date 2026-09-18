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

    let stream: Awaited<ReturnType<typeof v0.messages.sendStream>>
    try {
      stream = await v0.messages.sendStream({
        chatId,
        message,
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
