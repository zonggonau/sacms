"use client"

import { useCallback, useEffect, useState } from "react"
import type { NocodeSummaryResult } from "@/lib/nocode-summary"

/** Loads the read-only SaCMS nocode summary through the admin API (the key stays on the server). */
export function useNocodeSummary(enabled = true) {
  const [result, setResult] = useState<NocodeSummaryResult | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [forbidden, setForbidden] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/nocode/summary", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setForbidden(true)
        setResult(null)
        return
      }
      setForbidden(false)
      setResult(res.ok ? ((await res.json()) as NocodeSummaryResult) : null)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { result, loading, forbidden, reload }
}
