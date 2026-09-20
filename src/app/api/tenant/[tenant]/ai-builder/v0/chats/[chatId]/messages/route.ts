import { NextResponse } from "next/server"
import { v0 } from "v0"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

/**
 * Returns all messages in a v0 chat so the studio can render complete
 * chat history across page reloads and user sessions.
 */
export const GET = withStaffAuth(
  async (_req, context, { access }) => {
    const params = await context.params
    const chatId = params.chatId as string
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    try {
      const res = await v0.messages.list({ chatId, limit: 100 })
      const messages = res.data?.messages || []
      return NextResponse.json({ messages })
    } catch (err: any) {
      console.error("[v0/chats/messages] list messages failed:", err?.message)
      return apiError("internal", { message: err?.message || "Gagal mengambil riwayat pesan" })
    }
  },
  { minRole: "admin" },
)
