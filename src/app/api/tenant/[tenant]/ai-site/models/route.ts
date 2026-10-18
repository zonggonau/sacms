import { NextResponse } from "next/server"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { fetchGatewayLanguageModels } from "@/lib/ai"
import { FALLBACK_AI_SITE_MODEL_OPTIONS } from "@/lib/ai-site/models"

/**
 * The AI Site model picker's live source of truth — the Gateway's full
 * model catalog, not a hardcoded list. Falls back to a small static list on
 * any fetch failure (Gateway not configured, network issue) so the picker
 * still renders something usable instead of an empty dropdown.
 */
export const GET = withStaffAuth(async () => {
  try {
    const models = await fetchGatewayLanguageModels()
    return NextResponse.json({ models: models.length > 0 ? models : FALLBACK_AI_SITE_MODEL_OPTIONS })
  } catch {
    return NextResponse.json({ models: FALLBACK_AI_SITE_MODEL_OPTIONS })
  }
}, { minRole: "editor" })
