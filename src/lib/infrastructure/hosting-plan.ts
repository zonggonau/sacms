/**
 * Whether a tenant's billing plan allows deploying its website to production hosting
 * (Vercel — every tenant's website is hosted there).
 *
 * Source of truth is `Tenant.plan` (defaults to "free" — see prisma/schema.prisma
 * and `USER_PLAN_LIMITS` in tenant-limits.ts for the canonical plan slugs).
 *
 */

/** Plans considered "paid" — allowed to use the AI builder's deploy action. */
const PAID_PLANS = new Set([
  "starter",
  "pro",
  "enterprise",
  "custom",
  // Backward-compat aliases (see USER_PLAN_LIMITS)
  "standard",
  "standar",
  "professional",
  "profesional",
  "business",
  "bisnis",
  "unlimited",
])

function normalizePlan(plan: string | null | undefined): string {
  return (plan || "free").trim().toLowerCase()
}

/** Plans allowed to apply a catalog Website Template: Pro and Business, plus the higher Enterprise/Custom tiers. */
const WEBSITE_TEMPLATE_PLANS = new Set(["pro", "professional", "profesional", "business", "bisnis", "enterprise", "custom", "unlimited"])

export const WEBSITE_TEMPLATE_PLAN_MESSAGE = "Website Template hanya tersedia untuk plan Pro dan Business. Upgrade plan workspace untuk menerapkannya."

export function canUseWebsiteTemplates(plan: string | null | undefined): boolean {
  return WEBSITE_TEMPLATE_PLANS.has(normalizePlan(plan))
}

/** True when the tenant's plan is paid — i.e. allowed to deploy from the AI builder. */
export function isTenantPlanPaid(plan: string | null | undefined): boolean {
  return PAID_PLANS.has(normalizePlan(plan))
}

