import { NextResponse } from "next/server"
import { getV0ChatMessages, getV0Preview } from "@/lib/v0-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

export const GET = withStaffAuth(
  async (_req, context, { access }) => {
    const { chatId } = await context.params

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    const messages = await getV0ChatMessages(chatId)
    const previewUrl = await getV0Preview(chatId)

    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "ai",
      content: m.content || m.text || "Message content",
    }))

    return NextResponse.json({ success: true, messages: formattedMessages, previewUrl })
  },
  { minRole: "admin" },
)
