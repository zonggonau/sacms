import { db } from "@/lib/database"
import type { AccountPlan, WorkspacePlan, AiCreditPack, Addon } from "@prisma/client"

/**
 * Platform pricing — the single, type-safe read path for all four kinds of
 * plan/pricing data. Replaces at least 4 independent, hand-written CMS
 * Content Entry readers that used to exist across the codebase
 * (getDynamicWorkspacePrices/getDynamicAccountPrices in midtrans.ts, plus
 * separate direct ContentEntry queries in checkout, subscriptions/plans,
 * tenant-plan.ts, public/plans, the account dashboard/billing pages, and
 * public-api.ts's landing-page aggregator) — none of which agreed on the
 * same fallback/parsing rule. See the long comment above these models in
 * prisma/schema.prisma for the full history.
 *
 * Every getter defaults to active-only, ordered by `order` — pass
 * `includeInactive: true` for an admin listing that needs to show (and let
 * someone re-enable) a disabled plan too.
 */

interface ListOptions {
  includeInactive?: boolean
}

export async function getAccountPlans(opts: ListOptions = {}): Promise<AccountPlan[]> {
  return db.accountPlan.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: { order: "asc" },
  })
}

export async function getAccountPlan(slug: string): Promise<AccountPlan | null> {
  return db.accountPlan.findUnique({ where: { slug } })
}

export async function getWorkspacePlans(opts: ListOptions = {}): Promise<WorkspacePlan[]> {
  return db.workspacePlan.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: { order: "asc" },
  })
}

export async function getWorkspacePlan(slug: string): Promise<WorkspacePlan | null> {
  return db.workspacePlan.findUnique({ where: { slug } })
}

export async function getAiCreditPacks(opts: ListOptions = {}): Promise<AiCreditPack[]> {
  return db.aiCreditPack.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: { order: "asc" },
  })
}

export async function getAiCreditPack(slug: string): Promise<AiCreditPack | null> {
  return db.aiCreditPack.findUnique({ where: { slug } })
}

export async function getAddons(opts: ListOptions = {}): Promise<Addon[]> {
  return db.addon.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: { order: "asc" },
  })
}

export async function getAddon(slug: string): Promise<Addon | null> {
  return db.addon.findUnique({ where: { slug } })
}

/**
 * Resolve a workspace or account plan's real monthly price by slug — the
 * one thing nearly every caller above actually needed from a bigger CMS
 * query. Returns 0 for an unknown slug rather than throwing, matching the
 * old resolver's "unknown plan = free" fallback behavior so callers that
 * multiply this straight into a bill don't need their own try/catch.
 */
export async function resolvePlanMonthlyPrice(category: "account" | "workspace", slug: string): Promise<number> {
  const plan = category === "account" ? await getAccountPlan(slug) : await getWorkspacePlan(slug)
  return plan?.price ?? 0
}
