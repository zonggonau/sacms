import { db } from "./database"
import { isEnterpriseTenant } from "./license"
import { PlanConfig, UserPlanConfig, USER_PLAN_LIMITS, DEFAULT_LIMITS } from "./constants/tenant-limits"

export type { PlanConfig, UserPlanConfig }

/**
 * Gets the effective plan configuration for a tenant.
 * Tries the admin-editable WorkspacePlan table (src/lib/pricing.ts) first,
 * falling back to DEFAULT_LIMITS. audit_log_retention/support_level/
 * max_ai_tokens/max_custom_domains have no column on WorkspacePlan (they
 * never had a CMS field either) — always taken from the base defaults.
 */
export async function getTenantPlanConfig(tenantId: string): Promise<PlanConfig> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  })

  if (!tenant) return DEFAULT_LIMITS.free

  const base = DEFAULT_LIMITS[String(tenant.plan).toLowerCase()] || DEFAULT_LIMITS.free

  try {
    const { getWorkspacePlan } = await import("@/lib/pricing")
    const plan = await getWorkspacePlan(String(tenant.plan).toLowerCase())
    if (plan) {
      return {
        plan_slug: plan.slug || base.plan_slug,
        max_content_types: plan.maxContentTypes || base.max_content_types,
        max_content_entries: plan.maxContentEntries || base.max_content_entries,
        max_team_members: plan.maxTeamMembers || base.max_team_members,
        max_api_calls: plan.maxApiCalls || base.max_api_calls,
        max_storage: plan.maxStorageMb || base.max_storage,
        max_locales: plan.maxLocales || base.max_locales,
        audit_log_retention: base.audit_log_retention,
        support_level: base.support_level,
        max_ai_tokens: base.max_ai_tokens,
        max_custom_domains: base.max_custom_domains,
      }
    }
  } catch (error) {
    console.error("Error fetching dynamic plan config:", error)
  }

  return base
}

/**
 * Checks if a specific add-on is active for a tenant.
 * Add-ons are stored as active subscriptions.
 */
export async function isAddonActive(tenantId: string, addonSlug: string): Promise<boolean> {
  const subscription = await db.subscription.findFirst({
    where: {
      tenantId,
      plan: addonSlug,
      status: "active",
    },
  })

  return !!subscription
}

/**
 * Checks if a specific feature is enabled for a tenant.
 * This checks both the base plan (if features_enabled is implemented) 
 * and any active add-ons.
 */
export async function isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
  // 1. Check Addons first (direct mapping for legacy slugs)
  // Mapping feature keys to addon slugs
  const featureToAddon: Record<string, string> = {
    "ENABLE_AI": "ai-gen",
    "ENABLE_BACKUP": "backup",
    "EXTRA_STORAGE": "storage-10gb",
  }

  const addonSlug = featureToAddon[featureKey]
  if (addonSlug && await isAddonActive(tenantId, addonSlug)) {
    return true
  }

  // 1b. Check dynamic Addons from the Addon table
  const activeSubs = await db.subscription.findMany({
    where: { tenantId, status: "active" },
    select: { plan: true }
  })

  if (activeSubs.length > 0) {
    const planIds = activeSubs.map(s => s.plan)
    const { getAddons } = await import("@/lib/pricing")
    const dynamicAddons = await getAddons()

    for (const addon of dynamicAddons) {
      if (planIds.includes(addon.slug)) {
        const name = (addon.name || "").toLowerCase()
        const slug = addon.slug
        if (featureKey === "ENABLE_AI" && (name.includes("ai") || slug.includes("ai"))) return true
        if (featureKey === "EXTRA_STORAGE" && (name.includes("penyimpanan") || name.includes("storage") || slug.includes("storage"))) return true
        if (featureKey === "ENABLE_BACKUP" && (name.includes("backup") || slug.includes("backup"))) return true
      }
    }
  }

  // 2. Enterprise plan usually has everything enabled
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  })

  const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();
  let isEnterprise = await isEnterpriseTenant(globalId)
  if (!isEnterprise) {
    isEnterprise = await isEnterpriseTenant(tenantId)
  }

  if (isEnterprise) return true

  if (["ENABLE_WHITE_LABEL", "ENABLE_CUSTOM_DOMAIN"].includes(featureKey)) {
    return ["pro", "enterprise", "custom"].includes(tenant?.plan || "free")
  }

  if (tenant?.plan === "enterprise" || tenant?.plan === "custom" || tenant?.plan === "pro") return true

  // Allow in development environment for testing
  if (process.env.NODE_ENV === "development") return true

  return false
}

/**
 * Gets the plan configuration for a user.
 * Tries the admin-editable AccountPlan table (src/lib/pricing.ts) first.
 * max_ai_credits/price_usd have no column on AccountPlan (they never had a
 * CMS field either) — always taken from the base defaults.
 */
export async function getUserPlanConfig(userId: string): Promise<UserPlanConfig> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })

  if (!user) return USER_PLAN_LIMITS.free

  const base = USER_PLAN_LIMITS[user.plan] || USER_PLAN_LIMITS.free

  try {
    const { getAccountPlan } = await import("@/lib/pricing")
    const plan = await getAccountPlan(user.plan)
    if (plan) {
      return {
        plan_slug: plan.slug || base.plan_slug,
        max_workspaces: plan.maxWorkspaces || base.max_workspaces,
        max_ai_credits: base.max_ai_credits,
        price_usd: base.price_usd,
      }
    }
  } catch (error) {
    console.error("Error fetching dynamic user plan config:", error)
  }

  return base
}
