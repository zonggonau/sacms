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
  "enterprise-vps",
  "vps-s",
  "vps-m",
  "vps-l",
  "enterprise-vds",
  "vds-s",
  "vds-m",
  "vds-l",
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

/** True when the tenant's plan is paid — i.e. allowed to deploy from the AI builder. */
export function isTenantPlanPaid(plan: string | null | undefined): boolean {
  return PAID_PLANS.has(normalizePlan(plan))
}

