import { db } from "./database"
import { isEnterpriseTenant } from "./license"
import { PlanConfig, UserPlanConfig, USER_PLAN_LIMITS, DEFAULT_LIMITS } from "./constants/tenant-limits"

export type { PlanConfig, UserPlanConfig }

/**
 * Gets the effective plan configuration for a tenant.
 * It tries to fetch dynamic config from CMS (sacms-workspace-pricing),
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

  // 1b. Check dynamic Addons from CMS
  const activeSubs = await db.subscription.findMany({
    where: { tenantId, status: "active" },
    select: { plan: true }
  })
  
  if (activeSubs.length > 0) {
    const planIds = activeSubs.map(s => s.plan)
    const dynamicAddons = await db.contentEntry.findMany({
      where: {
        id: { in: planIds },
        contentType: { slug: "sacms-addons" },
        status: "PUBLISHED"
      }
    })
    
    for (const addon of dynamicAddons) {
      const data: any = typeof addon.data === "string" ? JSON.parse(addon.data) : addon.data
      const name = (data.name || "").toLowerCase()
      
      if (featureKey === "ENABLE_AI" && name.includes("ai")) return true
      if (featureKey === "EXTRA_STORAGE" && (name.includes("penyimpanan") || name.includes("storage"))) return true
      if (featureKey === "ENABLE_BACKUP" && name.includes("backup")) return true
    }
  }

  // 2. Enterprise plan usually has everything enabled
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  })

  let isEnterprise = await isEnterpriseTenant("sacms-global")
  if (!isEnterprise) {
    isEnterprise = await isEnterpriseTenant(tenantId)
  }

  if (isEnterprise) return true

  if (["ENABLE_WHITE_LABEL", "ENABLE_CUSTOM_DOMAIN"].includes(featureKey)) {
    return ["pro", "enterprise", "custom"].includes(tenant?.plan || "free")
  }

  if (tenant?.plan === "enterprise" || tenant?.plan === "custom") return true

  return false
}

/**
 * Gets the plan configuration for a user.
 * Fetches dynamic limits from sacms-account-pricing if available.
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
