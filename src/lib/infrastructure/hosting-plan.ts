/**
 * Maps a tenant's billing plan to (a) whether the AI Website Builder's deploy
 * action is allowed at all, and (b) which hosting target production deploys
 * should go to.
 *
 * Source of truth is `Tenant.plan` (defaults to "free" — see prisma/schema.prisma
 * and `USER_PLAN_LIMITS` in tenant-limits.ts for the canonical plan slugs).
 *
 * This replaces the old ad-hoc heuristic in ai-builder/deploy/route.ts, which
 * inferred "has dedicated VPS" from `tenant.databaseUrl` truthiness or a
 * substring match on `tenant.plan` — both fragile (any tenant with a custom
 * databaseUrl for unrelated reasons was silently routed to the VPS deployer,
 * and "vps" appearing anywhere in a plan name/alias was enough to match).
 */

export type HostingTarget = "vercel" | "vps"

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

/** Plans that get dedicated Contabo VPS/VDS infrastructure. */
const VPS_PLANS = new Set([
  "enterprise-vps",
  "vps-s",
  "vps-m",
  "vps-l",
  "enterprise-vds",
  "vds-s",
  "vds-m",
  "vds-l",
])

function normalizePlan(plan: string | null | undefined): string {
  return (plan || "free").trim().toLowerCase()
}

/** True when the tenant's plan is paid — i.e. allowed to deploy from the AI builder. */
export function isTenantPlanPaid(plan: string | null | undefined): boolean {
  return PAID_PLANS.has(normalizePlan(plan))
}

/**
 * Which hosting target a tenant's plan should deploy to. VPS/VDS-tier plans
 * go to the tenant's dedicated Contabo server; every other plan (including
 * free, which is blocked by `isTenantPlanPaid` before this even matters)
 * goes to shared Vercel hosting.
 */
export function resolveHostingTarget(plan: string | null | undefined): HostingTarget {
  return VPS_PLANS.has(normalizePlan(plan)) ? "vps" : "vercel"
}
