import { v0 } from "v0"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

/**
 * V0Transport's "resume" URL. Called automatically by `useChat` when the
 * page reloads (or the connection drops) while a v0 generation was still in
 * progress, so the build keeps streaming into the UI instead of silently
 * stalling. No request body — `V0Transport.reconnectToStream` POSTs empty.
 */
export const POST = withStaffAuth(
  async (_req, context, { access }) => {
    const params = await context.params
    const chatId = params.chatId as string
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    try {
      const stream = await v0.chats.resume({ chatId })
      return stream.toResponse()
    } catch (err: any) {
      console.error("[v0/chats/resume] resume failed:", err?.message)
      return apiError("internal", { message: err?.message || "Gagal menyambung ulang ke AI Engine" })
    }
  },
  { minRole: "admin" },
)
