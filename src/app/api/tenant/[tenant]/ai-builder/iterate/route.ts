import { NextResponse } from "next/server"
import { iterateV0Chat } from "@/lib/v0-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(async (req, context, { access, session }) => {
  const { tenant: tenantSlug } = await context.params
  const { chatId, prompt } = await req.json()
  if (!chatId || !prompt) return apiError("validation", { message: "Missing chatId or prompt" })

  // Personal AI credits: 5 per UI iteration.
  const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditCheck = await enforceUserAiCredits(session.user.id, 5)
  if (!creditCheck.allowed) return apiError("rate_limited", { message: creditCheck.message })

  const iterRes = await iterateV0Chat(chatId, prompt)
  await deductUserAiCredits(session.user.id, 5, "iterate_frontend", access.tenant.id, "v0.dev")

  const previewUrl = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`
  return NextResponse.json({ success: true, previewUrl, files: iterRes?.files || [] })
}, { minRole: "admin" })
