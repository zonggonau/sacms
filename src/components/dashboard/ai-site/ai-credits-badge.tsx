"use client"

import { useEffect, useState } from "react"
import { Coins, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type CreditsState = { remaining: number; isUnlimited: boolean }

/** Compact "credits remaining" chip, backed by the existing account-wide /api/ai/account-credits endpoint (also used by the billing page). Pass `refreshKey` so the balance re-fetches after a turn that spent credits. */
export function AiCreditsBadge({ refreshKey, className }: { refreshKey?: number; className?: string }) {
  const [credits, setCredits] = useState<CreditsState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/ai/account-credits")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled || !body?.success) return
        setCredits({ remaining: body.creditsRemaining, isUnlimited: body.isUnlimited })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (loading && !credits) {
    return (
      <div
        className={cn(
          "flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-2.5 animate-spin" />
      </div>
    )
  }

  if (!credits) return null

  const low = !credits.isUnlimited && credits.remaining < 50

  return (
    <div
      title="Kredit AI tersisa pada akunmu — setiap giliran chat AI Site memakai 50 kredit"
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
        low
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <Coins className="size-2.5" />
      {credits.isUnlimited ? "Kredit tanpa batas" : `${credits.remaining.toLocaleString("id-ID")} kredit`}
    </div>
  )
}
