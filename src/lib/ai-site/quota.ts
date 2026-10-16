import { enforceAiQuota, refundAiQuota, recordAiUsage, toUsageTotals } from "@/lib/ai"

/**
 * AI Site turns are a fixed cost per chat turn, not metered by actual tokens
 * (explicit product decision — see the approved plan). See the plan's §7 for
 * the pricing reasoning behind this number.
 */
export const AI_SITE_TURN_COST = 50

type UsageTotals = ReturnType<typeof toUsageTotals>

const config = (tenantId: string, userId: string) => ({
  tenantId,
  userId,
  creditsCost: AI_SITE_TURN_COST,
  action: "ai_site_turn",
})

/** Throws (status 429) if the user is over quota; atomically reserves the credits. */
export const reserveAiSiteTurn = (tenantId: string, userId: string) => enforceAiQuota(config(tenantId, userId))

/** Call when a turn never started streaming (setup failure) — refunds in full. */
export const refundAiSiteTurn = (tenantId: string, userId: string) => refundAiQuota(config(tenantId, userId))

/** Ledger-only; billing is already fixed-cost, this is for observability. */
export const recordAiSiteTurnUsage = (tenantId: string, userId: string, usage: UsageTotals, modelId: string) =>
  recordAiUsage(config(tenantId, userId), usage, modelId, "")
