import { NextResponse } from "next/server"
import { getV0Preview } from "@/lib/v0-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

/**
 * Returns v0's real, currently-hosted preview URL (e.g. https://<slug>.v0.build)
 * for a chat, fetched fresh from v0 every call. Used by the "Buka di tab
 * baru" button, which should leave the SaCMS-proxied iframe entirely and
 * link straight at v0's own sandbox — unlike the embedded iframe, a new tab
 * gets no benefit from routing through our `/ai-builder/preview/[chatId]`
 * proxy, and a cached `Setting["<tenant>_v0PreviewUrl"]` can go stale (it's
 * only written when a generate/iterate/finalize call happens to run while
 * v0's sandbox is already up — older builds can be left pointing at that
 * proxy path forever otherwise).
 */
export const GET = withStaffAuth(
  async (_req, context, { access }) => {
    const params = await context.params
    const chatId = params.chatId as string
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    const url = await getV0Preview(chatId)
    return NextResponse.json({ url })
  },
  { minRole: "admin" },
)
