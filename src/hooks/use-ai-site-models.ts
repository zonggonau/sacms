"use client"

import { useEffect, useState } from "react"
import { FALLBACK_AI_SITE_MODEL_OPTIONS, type AiSiteModelOption } from "@/lib/ai-site/models"

export type { AiSiteModelOption }

/**
 * AI Site's model picker is backed by the Gateway's live catalog, not a
 * hardcoded list — fetched once per mount from `GET .../ai-site/models`.
 * Starts with the same small fallback the server itself falls back to, so
 * the dropdown never renders empty while the real list loads.
 */
export function useAiSiteModels(tenantSlug: string) {
  const [options, setOptions] = useState<AiSiteModelOption[]>(FALLBACK_AI_SITE_MODEL_OPTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/models`)
      .then((res) => res.json())
      .then((body: { models?: AiSiteModelOption[] }) => {
        if (cancelled || !Array.isArray(body.models) || body.models.length === 0) return
        setOptions(body.models)
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

  return { options, loading }
}
