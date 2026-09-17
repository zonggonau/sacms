import { db, getTenantDb } from "./database"
import { getTenantPlanConfig, getUserPlanConfig } from "./tenant-plan"
import type { PlanConfig, UserPlanConfig } from "./tenant-plan"
import { isEnterpriseTenant } from "./license"
/**
 * Plan Enforcement Module
 *
 * Centralizes all plan limit checks for both User and Workspace plans.
 * Supports custom plan overrides via the CustomPlanOverride table.
 *
 * ENTERPRISE MODE: If this instance is running under a valid enterprise license,
 * plan limits are bypassed (unlimited workspaces, team, etc.).
 *
 * STORAGE is the exception to every other bypass: it is metered per workspace for all plans,
 * including Enterprise and uploads by super admins (see getStorageQuota).
 *
 * Usage:
 *   const result = await enforcePlanLimit(tenantId, "content_types")
 *   if (!result.allowed) return NextResponse.json({ error: result.message }, { status: 403 })
 */

// Workspace & User plan hierarchy (lowest → highest)
export const PLAN_HIERARCHY = ["free", "starter", "pro", "business", "agency", "enterprise", "custom"] as const
export type PlanSlug = (typeof PLAN_HIERARCHY)[number]

export type WorkspaceResource =
  | "content_types"
  | "content_entries"
  | "team_members"
  | "storage"       // in bytes (current usage)
  | "locales"
  | "api_calls"

export type UserResource = "workspaces" | "ai_credits"

export interface EnforcementResult {
  allowed: boolean
  current: number
  max: number
  message: string
  planSlug: string
}

// ==================== STORAGE QUOTA ====================

const MB = 1024 * 1024

/** `max` reported for a workspace whose storage is not metered. */
export const UNLIMITED_STORAGE_BYTES = Number.MAX_SAFE_INTEGER

export interface StorageQuota {
  /** Original files plus their generated thumbnail/medium versions. */
  usedBytes: number
  /** null when not metered: the workspace stores media in its own S3 bucket (BYOS), or the
   *  whole instance runs under an enterprise license. */
  limitBytes: number | null
  planBytes: number
  /** Storage add-ons that are active right now. */
  addonBytes: number
  planSlug: string
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`
  return `${(bytes / MB).toFixed(1)} MB`
}

/** Instance-level enterprise license (self-hosted install). A per-tenant license does not lift the storage quota. */
async function isInstanceEnterpriseLicensed(): Promise<boolean> {
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    return await isEnterpriseTenant(await getGlobalWorkspaceId())
  } catch {
    return false
  }
}

async function getStorageUsedBytes(tenantId: string): Promise<number> {
  const tenantDb = await getTenantDb(tenantId)
  try {
    const result = await tenantDb.media.aggregate({ where: { tenantId }, _sum: { size: true, variantBytes: true } })
    return Number(result._sum.size ?? 0) + Number(result._sum.variantBytes ?? 0)
  } catch {
    // A connected database (BYODB) may not have the variantBytes column yet.
    const result = await tenantDb.media.aggregate({ where: { tenantId }, _sum: { size: true } }).catch(() => null)
    return Number(result?._sum?.size ?? 0)
  }
}

/** Storage quota of one workspace: plan (or admin override) + active add-ons. */
export async function getStorageQuota(tenantId: string): Promise<StorageQuota> {
  const now = new Date()
  const [tenant, planConfig, override, usedBytes, addons, instanceLicensed] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { storageConfig: true } }),
    getTenantPlanConfig(tenantId),
    getWorkspaceOverride(tenantId),
    getStorageUsedBytes(tenantId),
    db.storageAddon
      .aggregate({ where: { tenantId, startsAt: { lte: now }, expiresAt: { gt: now } }, _sum: { bytes: true } })
      .catch(() => null),
    isInstanceEnterpriseLicensed(),
  ])

  const planBytes = (override?.maxStorage ?? planConfig.max_storage) * MB
  const addonBytes = Number(addons?._sum?.bytes ?? 0)
  const metered = !tenant?.storageConfig && !instanceLicensed

  return {
    usedBytes,
    limitBytes: metered ? planBytes + addonBytes : null,
    planBytes,
    addonBytes,
    planSlug: planConfig.plan_slug,
  }
}

/** Whether `incomingBytes` more still fit in the workspace's storage quota. */
export async function checkStorageUpload(
  tenantId: string,
  incomingBytes: number
): Promise<{ allowed: boolean; quota: StorageQuota; message: string }> {
  const quota = await getStorageQuota(tenantId)
  if (quota.limitBytes === null || quota.usedBytes + incomingBytes <= quota.limitBytes) {
    return { allowed: true, quota, message: "OK" }
  }
  return {
    allowed: false,
    quota,
    message:
      `Kuota storage workspace tidak cukup: terpakai ${formatBytes(quota.usedBytes)} dari ${formatBytes(quota.limitBytes)}, ` +
      `file yang diunggah ${formatBytes(incomingBytes)}. Hapus media yang tidak dipakai atau beli storage tambahan.`,
  }
}

// ==================== ENTERPRISE BYPASS ====================

/**
 * Check if the tenant has an active enterprise license and return a bypass result if so.
 */
async function enterpriseBypass(tenantId?: string): Promise<EnforcementResult | null> {
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    // 1. Check global enterprise license first
    let enterprise = await isEnterpriseTenant(globalTenantId)
    
    // 2. Fallback to tenant-specific license or dedicated VPS plan if no global license
    if (!enterprise && tenantId && tenantId !== globalTenantId) {
      enterprise = await isEnterpriseTenant(tenantId)
      if (!enterprise) {
        const t = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true, databaseUrl: true, storageConfig: true }
        })
        const p = (t?.plan || "").toLowerCase()
        if (p.includes("vps") || p.includes("dedicated") || p.includes("enterprise") || (t?.databaseUrl && t?.storageConfig)) {
          enterprise = true
        }
      }
    }

    if (enterprise) {
      return {
        allowed: true,
        current: 0,
        max: 999999999,
        planSlug: "enterprise",
        message: "Enterprise & Dedicated Appliance — Unlimited",
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
  // Storage is metered for every workspace; none of the bypasses below apply to it.
  if (resource === "storage") {
    const quota = await getStorageQuota(tenantId)
    const allowed = quota.limitBytes === null || quota.usedBytes < quota.limitBytes
    return {
      allowed,
      current: quota.usedBytes,
      max: quota.limitBytes ?? UNLIMITED_STORAGE_BYTES,
      planSlug: quota.planSlug,
      message: allowed
        ? "OK"
        : `Limit reached: storage (${formatBytes(quota.usedBytes)}/${formatBytes(quota.limitBytes!)}). Delete unused media or buy extra storage.`,
    }
  }

  // 0. Enterprise Mode Bypass (tenant specific)
  const bypass = await enterpriseBypass(tenantId)
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

  // 3b. Fetch tenant top-up extras
  let topupExtras: { apiCallsExtra?: number } | null = null
  try {
    const tData = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { apiCallsExtra: true }
    })
    if (tData) {
      topupExtras = { apiCallsExtra: tData.apiCallsExtra }
    }
  } catch {}

  // 4. Calculate effective max
  const effectiveMax = getEffectiveWorkspaceMax(planConfig, override, resource, topupExtras)

  // 5. Get current usage
  const currentUsage = await getWorkspaceUsage(tenantId, resource)

  // 6. Check
  const allowed = currentUsage < effectiveMax

  const displayCurrent = currentUsage
  const displayMax = effectiveMax

  return {
    allowed,
    current: currentUsage,
    max: effectiveMax,
    planSlug: planConfig.plan_slug,
    message: allowed
      ? "OK"
      : `Limit reached: ${resource} (${displayCurrent}/${displayMax}). Upgrade your plan or contact support.`,
  }
}

/**
 * Get the effective maximum for a workspace resource,
 * considering base plan limits, custom overrides, and one-time top-ups.
 */
function getEffectiveWorkspaceMax(
  planConfig: PlanConfig,
  override: WorkspaceOverride | null,
  resource: WorkspaceResource,
  topupExtras?: { apiCallsExtra?: number } | null
): number {
  switch (resource) {
    case "content_types":
      return 999999999 // Unlimited schemas for all plans
    case "content_entries":
      return override?.maxContentEntries ?? planConfig.max_content_entries
    case "team_members":
      return override?.maxTeamMembers ?? planConfig.max_team_members
    case "storage":
      // Handled by getStorageQuota before this is reached.
      return 0
    case "locales":
      return override?.maxLocales ?? planConfig.max_locales
    case "api_calls": {
      const baseCalls = override?.maxApiCalls ?? planConfig.max_api_calls
      const extraCalls = Number(topupExtras?.apiCallsExtra || 0)
      return baseCalls + extraCalls
    }
    default:
      return 0
  }
}

// ==================== USER PLAN ENFORCEMENT ====================

/**
 * Check if a user has capacity for a specific resource (workspaces or ai_credits).
 */
export async function enforceUserPlanLimit(
  userId: string,
  resource: UserResource
): Promise<EnforcementResult> {
  // 0. Enterprise Mode Bypass (Check global and user license)
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    let isEnterprise = await isEnterpriseTenant(globalTenantId)
    if (!isEnterprise) {
      isEnterprise = await isEnterpriseTenant(userId)
    }
    
    if (isEnterprise) {
      return {
        allowed: true,
        current: 0,
        max: 999999,
        planSlug: "enterprise",
        message: "Enterprise License — Unlimited",
      }
    }
  } catch {
    // Ignore and proceed to normal limits
  }

  // 1. Super Admin Bypass
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, aiCreditsUsed: true, aiCreditsExtra: true },
  })

  if (user?.role === "super_admin") {
    return {
      allowed: true,
      current: user.aiCreditsUsed || 0,
      max: 999999,
      planSlug: "custom",
      message: "Super Admin Bypass",
    }
  }

  const planConfig = await getUserPlanConfig(userId)
  const override = await getUserOverride(userId)

  const effectiveMax = getUserEffectiveMax(planConfig, override, resource, user?.aiCreditsExtra || 0)
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

/**
 * Enforce and verify user has enough AI credits for a specific action cost.
 */
export async function enforceUserAiCredits(
  userId: string,
  cost: number = 1
): Promise<{ allowed: boolean; remaining: number; max: number; current: number; planSlug: string; message: string }> {
  // Check enterprise & super admin bypass
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    let isEnterprise = await isEnterpriseTenant(globalTenantId) || await isEnterpriseTenant(userId)
    if (isEnterprise) {
      return { allowed: true, remaining: 999999, max: 999999, current: 0, planSlug: "enterprise", message: "Enterprise Unlimited" }
    }
  } catch {}

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, aiCreditsUsed: true, aiCreditsExtra: true }
  })

  if (user?.role === "super_admin") {
    return { allowed: true, remaining: 999999, max: 999999, current: user.aiCreditsUsed || 0, planSlug: "custom", message: "Super Admin Bypass" }
  }

  const planConfig = await getUserPlanConfig(userId)
  const override = await getUserOverride(userId)
  const effectiveMax = getUserEffectiveMax(planConfig, override, "ai_credits", user?.aiCreditsExtra || 0)
  const currentUsage = user?.aiCreditsUsed || 0
  const remaining = Math.max(0, effectiveMax - currentUsage)

  const allowed = remaining >= cost

  return {
    allowed,
    remaining,
    max: effectiveMax,
    current: currentUsage,
    planSlug: planConfig.plan_slug,
    message: allowed
      ? `OK (${remaining} credits remaining)`
      : `AI credits depleted. This action requires ${cost} credits, but you only have ${remaining} credits remaining. Please top up your credits to continue.`
  }
}

/**
 * Atomically deduct AI credits from a user's account pool and record in ledger.
 */
export async function deductUserAiCredits(
  userId: string,
  cost: number,
  action: string,
  tenantId?: string,
  model?: string
): Promise<void> {
  try {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { aiCreditsUsed: { increment: cost } }
      }),
      db.aiQuotaLedger.create({
        data: {
          userId,
          tenantId: tenantId || null,
          action,
          credits: cost,
          tokens: cost * 1000,
          model: model || "deepseek-chat"
        }
      })
    ])
  } catch (error) {
    console.error("[AI Credit Deduction Error]", error)
  }
}

async function getUserUsage(userId: string, resource: UserResource): Promise<number> {
  switch (resource) {
    case "workspaces": {
      const { getGlobalWorkspaceId } = await import('@/lib/settings')
      const globalTenantId = await getGlobalWorkspaceId()
      // Count workspaces where user is owner (excluding system tenants)
      return db.tenantMember.count({
        where: {
          userId,
          role: "owner",
          tenant: { 
            slug: { notIn: [globalTenantId, "sacms-global", "sacms"] },
            id: { not: globalTenantId }
          },
        },
      })
    }
    case "ai_credits": {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { aiCreditsUsed: true }
      })
      return user?.aiCreditsUsed || 0
    }
    default:
      return 0
  }
}

function getUserEffectiveMax(
  planConfig: UserPlanConfig,
  override: UserOverride | null,
  resource: UserResource,
  extraCredits: number = 0
): number {
  switch (resource) {
    case "workspaces":
      return override?.maxWorkspaces ?? planConfig.max_workspaces
    case "ai_credits": {
      // Base initial free credits for every user account is 50, plus any top-up packs
      const base = override?.maxAiCredits ?? 50
      return base + extraCredits
    }
    default:
      return 0
  }
}

// ==================== WORKSPACE PLAN BINDING ====================

/**
 * Validate that a workspace plan can be created by a user's account plan.
 * All account plans (including Free) can create any workspace tier.
 * Restrictions are enforced on the total workspace count of the account.
 */
export function validateWorkspacePlanBinding(
  userPlanSlug: string,
  workspacePlanSlug: string
): { allowed: boolean; message: string } {
  // All account plans are permitted to launch any workspace plan
  return { allowed: true, message: "OK" }
}

// ==================== WORKSPACE USAGE ====================

async function getWorkspaceUsage(tenantId: string, resource: WorkspaceResource): Promise<number> {
  try {
    switch (resource) {
      case "content_types":
        return db.contentType.count({ where: { tenantId } })
      case "content_entries": {
        const tenantDb = await getTenantDb(tenantId)
        return tenantDb.contentEntry.count({ where: { tenantId } }).catch(() => 0)
      }
      case "team_members":
        return db.tenantMember.count({ where: { tenantId, role: { not: "owner" } } })
      case "storage":
        return getStorageUsedBytes(tenantId)
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
  maxAiCredits: number | null
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
      maxAiCredits: override.maxAiCredits,
    }
  } catch {
    // Table may not exist yet (before migration)
    return null
  }
}

// ==================== PUBLIC API QUOTA (COST GUARDRAIL) ====================

/**
 * Monthly `api_calls` quota check for the public content API
 * (/api/public/[tenant]/...) — the actual traffic driver behind a
 * shared-DB (free/pro) tenant's real hosting cost, since every request
 * their deployed Vercel frontend makes to fetch content lands here.
 * `max_api_calls` was already defined per plan tier but never enforced
 * anywhere before this.
 *
 * Deliberately fails OPEN: if the quota check itself errors (DB hiccup,
 * a test's mock not implementing every model, etc.), the request is
 * allowed through rather than taking down the entire public API for every
 * tenant over a bug in cost accounting.
 */
export async function checkApiCallQuota(tenantId: string): Promise<{ allowed: boolean; message: string }> {
  try {
    const result = await enforcePlanLimit(tenantId, "api_calls")
    return { allowed: result.allowed, message: result.message }
  } catch (error) {
    console.error("[plan-enforcement] api_calls quota check failed, allowing request:", error)
    return { allowed: true, message: "OK (quota check unavailable)" }
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
    ai_credits: "AI credits/month",
  }
  return names[resource] || resource
}

