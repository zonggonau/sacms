import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { updateChatModel } from "@/lib/ai-site/chats"
import { isAllowedAiSiteModel } from "@/lib/ai-site/models"

/** Lets the user change which model this chat's future turns use — the picker shown on the landing screen also appears in the chat toolbar so it isn't a one-time, create-only choice. */
export const PATCH = withStaffAuth(async (req, context, { access }) => {
  const { chatId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)

  const chat = await tenantDb.aiSiteChat.findUnique({
    where: { id: chatId },
    include: { project: true },
  })
  if (!chat || chat.project.tenantId !== access.tenantId) {
    return apiError("not_found", { message: "Chat not found" })
  }

  const { model } = await req.json().catch(() => ({}))
  if (!isAllowedAiSiteModel(model)) {
    return apiError("validation", { message: "Model AI tidak dikenal. Pilih salah satu dari daftar yang tersedia." })
  }

  await updateChatModel(tenantDb, chatId, model)
  return NextResponse.json({ success: true, model })
}, { minRole: "editor" })
