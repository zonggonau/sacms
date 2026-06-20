import { db } from "./database"

export interface PlanConfig {
  plan_slug: string
  max_content_types: number
  max_content_entries: number
  max_team_members: number
  max_api_calls: number
  max_storage: number // in MB
  max_locales: number
  audit_log_retention: number // in days
  support_level: string
}

export interface UserPlanConfig {
  plan_slug: string
  max_workspaces: number
}

export const USER_PLAN_LIMITS: Record<string, UserPlanConfig> = {
  // === Canonical plan names (from planpacket spec) ===
  free: {
    plan_slug: "free",
    max_workspaces: 1,
  },
  starter: {
    plan_slug: "starter",
    max_workspaces: 3,
  },
  pro: {
    plan_slug: "pro",
    max_workspaces: 10,
  },
  enterprise: {
    plan_slug: "enterprise",
    max_workspaces: 9999,
  },
  custom: {
    plan_slug: "custom",
    max_workspaces: 9999, // Overridable via CustomPlanOverride
  },

  // === Backward-compat aliases (legacy plan names → canonical) ===
  standard: {   // legacy → starter
    plan_slug: "starter",
    max_workspaces: 3,
  },
  standar: {    // Indonesian alias → starter
    plan_slug: "starter",
    max_workspaces: 3,
  },
  professional: { // legacy → pro
    plan_slug: "pro",
    max_workspaces: 10,
  },
  profesional: {  // Indonesian alias → pro
    plan_slug: "pro",
    max_workspaces: 10,
  },
  business: {   // legacy → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
  },
  bisnis: {     // Indonesian alias → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
  },
  unlimited: {  // legacy → custom
    plan_slug: "custom",
    max_workspaces: 9999,
  },
}

export const DEFAULT_LIMITS: Record<string, PlanConfig> = {
  free: {
    plan_slug: "free",
    max_content_types: 3,
    max_content_entries: 500,
    max_team_members: 1,
    max_api_calls: 1000,
    max_storage: 100, // MB
    max_locales: 1,
    audit_log_retention: 0,
    support_level: "Community",
  },
  starter: {
    plan_slug: "starter",
    max_content_types: 5,
    max_content_entries: 5000,
    max_team_members: 3,
    max_api_calls: 100000,
    max_storage: 1024, // 1GB
    max_locales: 2,
    audit_log_retention: 7,
    support_level: "Email Support",
  },
  pro: {
    plan_slug: "pro",
    max_content_types: 10,
    max_content_entries: 10000,
    max_team_members: 10,
    max_api_calls: 1000000,
    max_storage: 5120, // 5GB
    max_locales: 5,
    audit_log_retention: 30,
    support_level: "Priority Support",
  },
  enterprise: {
    plan_slug: "enterprise",
    max_content_types: 20,
    max_content_entries: 20000,
    max_team_members: 20,
    max_api_calls: 10000000,
    max_storage: 10240, // 10GB
    max_locales: 20,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated Support",
  },
  custom: {
    plan_slug: "custom",
    max_content_types: 9999,
    max_content_entries: 9999999,
    max_team_members: 9999,
    max_api_calls: 99999999,
    max_storage: 102400,
    max_locales: 99,
    audit_log_retention: 9999,
    support_level: "Custom Support",
  },
}

/**
 * Gets the effective plan configuration for a tenant.
 * It tries to fetch dynamic config from CMS (sacms-pricing), 
 * falling back to DEFAULT_LIMITS.
 */
export async function getTenantPlanConfig(tenantId: string): Promise<PlanConfig> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  })

  if (!tenant) return DEFAULT_LIMITS.free

  try {
    const allPricing = await db.contentEntry.findMany({
      where: {
        contentType: { slug: "sacms-workspace-pricing" },
        status: "PUBLISHED",
      },
    })

    const match = allPricing.find((e: any) => {
      const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data
      return data.plan_slug === tenant.plan
    })

    if (match) {
      const data = typeof match.data === "string" ? JSON.parse(match.data) : match.data
      const base = DEFAULT_LIMITS[tenant.plan] || DEFAULT_LIMITS.free
      return {
        plan_slug: data.plan_slug || base.plan_slug,
        max_content_types: Number(data.max_content_types) || base.max_content_types,
        max_content_entries: Number(data.max_content_entries) || base.max_content_entries,
        max_team_members: Number(data.max_team_members) || base.max_team_members,
        max_api_calls: Number(data.max_api_calls) || base.max_api_calls,
        max_storage: Number(data.max_storage) || base.max_storage,
        max_locales: Number(data.max_locales) || base.max_locales,
        audit_log_retention: Number(data.audit_log_retention) || base.audit_log_retention,
        support_level: data.support_level || base.support_level,
      }
    }
  } catch (error) {
    console.error("Error fetching dynamic plan config:", error)
  }

  return DEFAULT_LIMITS[tenant.plan] || DEFAULT_LIMITS.free
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
  // 1. Check Addons first (direct mapping)
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

  // 2. Enterprise plan usually has everything enabled
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  })

  if (["ENABLE_WHITE_LABEL", "ENABLE_CUSTOM_DOMAIN"].includes(featureKey)) {
    return ["pro", "enterprise", "custom"].includes(tenant?.plan || "free")
  }

  if (tenant?.plan === "enterprise" || tenant?.plan === "custom") return true

  return false
}

/**
 * Gets the plan configuration for a user.
 * Fetches dynamic limits from sacms-pricing if available.
 */
export async function getUserPlanConfig(userId: string): Promise<UserPlanConfig> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })

  if (!user) return USER_PLAN_LIMITS.free

  try {
    const allPricing = await db.contentEntry.findMany({
      where: {
        contentType: { slug: "sacms-account-pricing" },
        status: "PUBLISHED",
      },
    })

    const match = allPricing.find((e: any) => {
      const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data
      return data.plan_slug === user.plan
    })

    if (match) {
      const data = typeof match.data === "string" ? JSON.parse(match.data) : match.data
      const base = USER_PLAN_LIMITS[user.plan] || USER_PLAN_LIMITS.free
      return {
        plan_slug: data.plan_slug || base.plan_slug,
        max_workspaces: Number(data.max_workspaces) || base.max_workspaces,
      }
    }
  } catch (error) {
    console.error("Error fetching dynamic user plan config:", error)
  }

  return USER_PLAN_LIMITS[user.plan] || USER_PLAN_LIMITS.free
}
