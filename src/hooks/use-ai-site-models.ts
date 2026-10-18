"use client"

import { useEffect, useState } from "react"
import { FALLBACK_AI_SITE_MODEL_OPTIONS, RECOMMENDED_CODING_MODELS, type AiSiteModelOption } from "@/lib/ai-site/models"

export type { AiSiteModelOption }

/**
 * AI Site's model picker is backed by the Gateway's live catalog, not a
 * hardcoded list — fetched once per mount from `GET .../ai-site/models`.
 * Starts with the same small fallback the server itself falls back to, so
 * the dropdown never renders empty while the real list loads.
 *
 * Returns `recommended` (the fixed, live-verified strong-coding shortlist —
 * always shown first, independent of the catalog fetch) and `others` (the
 * rest of the live catalog, with anything already in `recommended` filtered
 * out so it isn't listed twice).
 */
export function useAiSiteModels(tenantSlug: string) {
  const [others, setOthers] = useState<AiSiteModelOption[]>(FALLBACK_AI_SITE_MODEL_OPTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/models`)
      .then((res) => res.json())
      .then((body: { models?: AiSiteModelOption[] }) => {
        if (cancelled || !Array.isArray(body.models) || body.models.length === 0) return
        const recommendedValues = new Set(RECOMMENDED_CODING_MODELS.map((m) => m.value))
        setOthers(body.models.filter((m) => !recommendedValues.has(m.value)))
      })
      .catch(() => {
        // Keep the fallback list — better than an empty dropdown.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantSlug])

  return { recommended: RECOMMENDED_CODING_MODELS, others, loading }
}
