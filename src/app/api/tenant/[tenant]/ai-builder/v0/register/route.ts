import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/**
 * Called from the client's `V0Transport.onChatCreated` callback, the moment
 * a new chat's id is known — normally seconds into the stream, well before
 * generation finishes. Persists it right away so a page reload mid-build can
 * still resolve `chatBelongsToTenant` and resume the stream.
 */
export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const body = await req.json().catch(() => ({}))
    const chatId = typeof body?.chatId === "string" ? body.chatId : ""
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    const tenantId = access.tenantId
    await db.setting.upsert({
      where: { key: `${tenantId}_v0ChatId` },
      update: { value: chatId },
      create: { tenantId, key: `${tenantId}_v0ChatId`, value: chatId },
    })

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
