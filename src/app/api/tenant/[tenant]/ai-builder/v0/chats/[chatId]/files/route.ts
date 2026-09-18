import { NextResponse } from "next/server"
import { v0 } from "v0"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

/**
 * Single-shot fresh read of a chat's current source files, no retry/poll —
 * used by the Code tab to check again later if `/v0/finalize` returned
 * `stillGenerating: true` right after the message stream ended.
 */
export const GET = withStaffAuth(
  async (_req, context, { access }) => {
    const params = await context.params
    const chatId = params.chatId as string
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    let files: { name: string; content: string }[] = []
    try {
      const filesRes = await v0.chats.getFiles({ chatId })
      const rawFiles = (filesRes as any)?.data?.files || (filesRes as any)?.files || (filesRes as any)?.data || []
      if (Array.isArray(rawFiles)) {
        files = rawFiles.map((f: any) => ({ name: f.path ?? f.name ?? "app/page.tsx", content: f.content ?? "" }))
      }
    } catch (err: any) {
      console.warn("[v0/chats/files] getFiles failed:", err?.message)
    }

    return NextResponse.json({ files })
  },
  { minRole: "admin" },
)
