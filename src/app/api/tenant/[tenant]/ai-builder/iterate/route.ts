import { NextResponse } from "next/server"
import { iterateV0Chat } from "@/lib/v0-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

export const POST = withStaffAuth(async (req, context, { access, session }) => {
  const { tenant: tenantSlug } = await context.params
  const body = await req.json().catch(() => ({}))
  const chatId = typeof body?.chatId === "string" ? body.chatId : ""
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 5000) : ""
  if (!chatId || !prompt) return apiError("validation", { message: "Missing chatId or prompt" })

  if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
    return apiError("not_found", { message: "Chat not found" })
  }

  // Personal AI credits: 5 per UI iteration.
  const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditCheck = await enforceUserAiCredits(session.user.id, 5)
  if (!creditCheck.allowed) return apiError("rate_limited", { message: creditCheck.message })

  const iterRes = await iterateV0Chat(chatId, prompt)
  await deductUserAiCredits(session.user.id, 5, "iterate_frontend", access.tenant.id, "v0.dev")

  const previewUrl = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`
  return NextResponse.json({ success: true, previewUrl, files: iterRes?.files || [] })
}, { minRole: "admin" })
