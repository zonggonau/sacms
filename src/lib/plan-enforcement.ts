import { db, getTenantDb } from "./database"
import { getTenantPlanConfig, getUserPlanConfig } from "./tenant-plan"
import type { PlanConfig, UserPlanConfig } from "./tenant-plan"
import { isEnterpriseMode } from "./license"

/**
 * Plan Enforcement Module
 *
 * Centralizes all plan limit checks for both User and Workspace plans.
 * Supports custom plan overrides via the CustomPlanOverride table.
 *
 * ENTERPRISE MODE: If this instance is running under a valid enterprise license,
 * ALL plan limits are bypassed (unlimited workspaces, team, storage, etc.)
 *
 * Usage:
 *   const result = await enforcePlanLimit(tenantId, "content_types")
 *   if (!result.allowed) return NextResponse.json({ error: result.message }, { status: 403 })
 */

// Workspace plan hierarchy (lowest → highest)
export const PLAN_HIERARCHY = ["free", "starter", "pro", "enterprise", "custom"] as const
export type PlanSlug = (typeof PLAN_HIERARCHY)[number]

export type WorkspaceResource =
  | "content_types"
  | "content_entries"
  | "team_members"
  | "storage"       // in bytes (current usage)
  | "locales"
  | "api_calls"

export type UserResource = "workspaces"

export interface EnforcementResult {
  allowed: boolean
  current: number
  max: number
  message: string
  planSlug: string
}

// ==================== ENTERPRISE BYPASS ====================

/**
 * Check if enterprise mode is active and return a bypass result if so.
 */
async function enterpriseBypass(): Promise<EnforcementResult | null> {
  try {
    const enterprise = await isEnterpriseMode()
    if (enterprise) {
      return {
        allowed: true,
        current: 0,
        max: 999999,
        planSlug: "enterprise",
        message: "Enterprise Self-Hosted — Unlimited",
      }
    }
  } catch {
    // If license check fails, continue to normal limits
  }
  return null
}

// ==================== WORKSPACE PLAN ENFORCEMENT ====================

/**
 * Check if a workspace has capacity for a specific resource.
 * Considers: enterprise bypass -> super admin bypass -> base plan limits -> custom overrides -> current usage.
 */
export async function enforcePlanLimit(
  tenantId: string,
  resource: WorkspaceResource,
  userId?: string
): Promise<EnforcementResult> {
  // 0. Enterprise Mode Bypass (entire instance is unlimited)
  const bypass = await enterpriseBypass()
  if (bypass) return bypass

  // 1. Super Admin Bypass
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (user?.role === "super_admin") {
      return {
        allowed: true,
        current: 0,
        max: 999999,
        planSlug: "custom",
        message: "Super Admin Bypass",
      }
    }
  }

  // 2. Get base plan config
  const planConfig = await getTenantPlanConfig(tenantId)

  // 3. Get custom overrides (if any)
  const override = await getWorkspaceOverride(tenantId)

  // 4. Calculate effective max
  const effectiveMax = getEffectiveWorkspaceMax(planConfig, override, resource)

  // 5. Get current usage
  const currentUsage = await getWorkspaceUsage(tenantId, resource)

  // 6. Check
  const allowed = currentUsage < effectiveMax

  return {
    allowed,
    current: currentUsage,
    max: effectiveMax,
    planSlug: planConfig.slug,
    message: allowed
      ? "OK"
      : `Limit reached: ${resource} (${currentUsage}/${effectiveMax}). Upgrade your plan or contact support.`,
  }
}

/**
 * Get the effective maximum for a workspace resource,
 * considering base plan limits and custom overrides.
 */
function getEffectiveWorkspaceMax(
  planConfig: PlanConfig,
  override: WorkspaceOverride | null,
  resource: WorkspaceResource
): number {
  switch (resource) {
    case "content_types":
      return override?.maxContentTypes ?? planConfig.max_content_types
    case "content_entries":
      return override?.maxContentEntries ?? planConfig.max_content_entries
    case "team_members":
      return override?.maxTeamMembers ?? planConfig.max_team_members
    case "storage":
      return override?.maxStorage ?? planConfig.max_storage
    case "locales":
      return override?.maxLocales ?? planConfig.max_locales
    case "api_calls":
      return override?.maxApiCalls ?? planConfig.max_api_calls
    default:
      return 0
  }
}

// ==================== USER PLAN ENFORCEMENT ====================

/**
 * Check if a user has capacity for a specific resource (currently just workspaces).
 */
export async function enforceUserPlanLimit(
  userId: string,
  resource: UserResource
): Promise<EnforcementResult> {
  // 0. Enterprise Mode Bypass
  const bypass = await enterpriseBypass()
  if (bypass) return bypass

  // 1. Super Admin Bypass
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (user?.role === "super_admin") {
    return {
      allowed: true,
      current: 0,
      max: 9999,
      planSlug: "custom",
      message: "Super Admin Bypass",
    }
  }

  const planConfig = await getUserPlanConfig(userId)
  const override = await getUserOverride(userId)

  const effectiveMax = getUserEffectiveMax(planConfig, override, resource)
  const currentUsage = await getUserUsage(userId, resource)

  const allowed = currentUsage < effectiveMax

  return {
    allowed,
    current: currentUsage,
    max: effectiveMax,
    planSlug: planConfig.plan_slug,
    message: allowed
      ? `OK — ${resource}: ${currentUsage}/${effectiveMax}`
      : `Plan limit reached. Your ${planConfig.plan_slug} plan allows max ${effectiveMax} ${formatResourceName(resource)}. Current: ${currentUsage}.`,
  }
}

async function getUserUsage(userId: string, resource: UserResource): Promise<number> {
  switch (resource) {
    case "workspaces": {
      // Count workspaces where user is owner (excluding system tenants)
      return db.tenantMember.count({
        where: {
          userId,
          role: "owner",
          tenant: { slug: { notIn: ["sacms-global"] } },
        },
      })
    }
    default:
      return 0
  }
}

function getUserEffectiveMax(
  planConfig: UserPlanConfig,
  override: UserOverride | null,
  resource: UserResource
): number {
  switch (resource) {
    case "workspaces":
      return override?.maxWorkspaces ?? planConfig.max_workspaces
    default:
      return 0
  }
}

// ==================== WORKSPACE PLAN BINDING ====================

/**
 * Validate that a workspace plan does not exceed the user's account plan.
 * User Free cannot create workspace Pro, etc.
 */
export function validateWorkspacePlanBinding(
  userPlanSlug: string,
  workspacePlanSlug: string
): { allowed: boolean; message: string } {
  const userIdx = PLAN_HIERARCHY.indexOf(userPlanSlug as any)
  const wsIdx = PLAN_HIERARCHY.indexOf(workspacePlanSlug as any)

  // Fallback for unknown plans
  if (userIdx === -1 || wsIdx === -1) {
    return {
      allowed: userPlanSlug === "enterprise" || userPlanSlug === "custom",
      message: "Invalid plan combination."
    }
  }

  const allowed = userIdx >= wsIdx

  if (!allowed) {
    return {
      allowed: false,
      message: `Your account plan (${userPlanSlug}) is too low for a ${workspacePlanSlug} workspace. Please upgrade your account first.`
    }
  }

  return { allowed: true, message: "OK" }
}

// ==================== WORKSPACE USAGE ====================

async function getWorkspaceUsage(tenantId: string, resource: WorkspaceResource): Promise<number> {
  try {
    switch (resource) {
      case "content_types":
        return db.contentType.count({ where: { tenantId } })
      case "content_entries":
        return db.contentEntry.count({ where: { tenantId } })
      case "team_members":
        return db.tenantMember.count({ where: { tenantId, role: { not: "owner" } } })
      case "storage": {
        // Sum of all media files sizes for this tenant
        const result = await db.media.aggregate({
          where: { tenantId },
          _sum: { fileSize: true },
        })
        return result._sum.fileSize || 0
      }
      case "locales":
        return db.tenantLocale.count({ where: { tenantId, isEnabled: true } })
      case "api_calls":
        return db.apiRequest.count({
          where: {
            tenantId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        })
      default:
        return 0
    }
  } catch {
    return 0
  }
}

// ==================== CUSTOM PLAN OVERRIDES ====================

interface WorkspaceOverride {
  maxContentTypes: number | null
  maxContentEntries: number | null
  maxTeamMembers: number | null
  maxStorage: number | null
  maxLocales: number | null
  maxApiCalls: number | null
}

interface UserOverride {
  maxWorkspaces: number | null
}

async function getWorkspaceOverride(tenantId: string): Promise<WorkspaceOverride | null> {
  try {
    const override = await db.customPlanOverride.findUnique({
      where: { tenantId },
    })
    if (!override) return null
    return {
      maxContentTypes: override.maxContentTypes,
      maxContentEntries: override.maxContentEntries,
      maxTeamMembers: override.maxTeamMembers,
      maxStorage: override.maxStorage,
      maxLocales: override.maxLocales,
      maxApiCalls: override.maxApiCalls,
    }
  } catch {
    // Table may not exist yet (before migration)
    return null
  }
}

async function getUserOverride(userId: string): Promise<UserOverride | null> {
  try {
    const override = await db.customPlanOverride.findUnique({
      where: { userId },
    })
    if (!override) return null
    return {
      maxWorkspaces: override.maxWorkspaces,
    }
  } catch {
    // Table may not exist yet (before migration)
    return null
  }
}

// ==================== HELPERS ====================

function formatResourceName(resource: string): string {
  const names: Record<string, string> = {
    content_types: "content types",
    content_entries: "content entries",
    team_members: "team members",
    storage: "MB storage",
    locales: "locales",
    api_calls: "API calls/month",
    workspaces: "workspaces",
  }
  return names[resource] || resource
}
