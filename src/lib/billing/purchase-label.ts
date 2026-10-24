// Addon ids sold as flat top-ups with no row in the Addon table (mirrors
// BUILTIN_TOPUPS in checkout/route.ts) — kept here too so a resolved label
// still shows a real name instead of the raw id for these.
const BUILTIN_TOPUP_NAMES: Record<string, string> = {
  topup_ai_500k: "AI Booster (500K Tokens)",
  topup_ai_2m: "AI Power Pack (2M Tokens)",
  topup_api_500k: "Extra API Quota (500K Calls)",
}

export interface PurchaseLabelInput {
  /** e.g. "ACC-20261022-ab12", "SUB-...", "ADD-...", "AIC-..." — see checkout/route.ts. */
  orderId: string
  rawResponse: unknown
  /** Subscription.plan — used only when rawResponse has nothing better (a safety net for data predating this metadata). */
  fallbackPlanSlug: string
}

export interface PurchaseLabel {
  /** The real id to resume a pending checkout at — an addon id, or the plan slug being bought. */
  purchasedId: string
  /** Human-readable name for display. */
  purchasedLabel: string
}

/**
 * What a PaymentTransaction/Invoice was actually for — resolved from the
 * rawResponse checkout always stores (intendedPlan for a plan change,
 * addonId for an addon/top-up — see checkout/route.ts), never from
 * Subscription.plan: an addon/top-up never touches that field at all, and a
 * plan subscription's CURRENT plan can drift away from what a given
 * historical order actually bought (e.g. after a later upgrade). Shared by
 * the tenant-scoped invoices route and the account-level transaction
 * history action — same resolution rules, same two server-side call sites.
 */
export async function resolvePurchaseLabel({
  orderId,
  rawResponse,
  fallbackPlanSlug,
}: PurchaseLabelInput): Promise<PurchaseLabel> {
  const raw = (rawResponse as any) || {}
  const { getAccountPlan, getWorkspacePlan, getAddon, getAiCreditPack } = await import("@/lib/pricing")
  const isAccountOrder = orderId.startsWith("ACC-")

  if (raw.type === "ai_credits" || orderId.startsWith("AIC-")) {
    const addonId = raw.addonId || ""
    const pack = addonId ? await getAiCreditPack(addonId) : null
    return {
      purchasedId: addonId || fallbackPlanSlug,
      purchasedLabel: pack?.name || (raw.credits ? `${raw.credits} AI Credits Pack` : "AI Credits Pack"),
    }
  }

  if (raw.isAddon && raw.addonId) {
    const addon = await getAddon(raw.addonId)
    return {
      purchasedId: raw.addonId,
      purchasedLabel: addon?.name || BUILTIN_TOPUP_NAMES[raw.addonId] || raw.addonId,
    }
  }

  const planSlug = raw.intendedPlan || fallbackPlanSlug
  const plan = isAccountOrder ? await getAccountPlan(planSlug) : await getWorkspacePlan(planSlug)
  return { purchasedId: planSlug, purchasedLabel: plan?.name || planSlug }
}
