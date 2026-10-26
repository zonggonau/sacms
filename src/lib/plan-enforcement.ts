import { db, getTenantDb } from "./database"
import { getTenantPlanConfig, getUserPlanConfig } from "./tenant-plan"
import type { PlanConfig, UserPlanConfig } from "./tenant-plan"
import { isEnterpriseTenant, validateLicense } from "./license"
import { isPlatformStaff } from "./platform-roles"
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

/** The user who owns this workspace (TenantMember role "owner"), if any. */
async function getTenantOwnerId(tenantId: string): Promise<string | null> {
  const owner = await db.tenantMember.findFirst({ where: { tenantId, role: "owner" }, select: { userId: true } })
  return owner?.userId ?? null
}

/**
 * An ACCOUNT-level enterprise license (activated via /api/user/license/activate,
 * keyed by the user's own id — see isEnterpriseTenant(userId) elsewhere) grants
 * a pooled storage allowance shared across every workspace this owner owns.
 * Deliberately bounded by the license's own storageGb, not unlimited — unlike
 * isInstanceEnterpriseLicensed() above, which is a different, fully-unmetered
 * mechanism for a whole self-hosted instance.
 */
export async function getOwnerStorageLicense(ownerId: string): Promise<{ licensed: boolean; limitBytes: number }> {
  try {
    const result = await validateLicense(ownerId)
    if (result.valid && result.type === "enterprise" && result.storageGb) {
      return { licensed: true, limitBytes: result.storageGb * 1024 * MB }
    }
  } catch {
    // Ignore and treat as unlicensed
  }
  return { licensed: false, limitBytes: 0 }
}

/** Total storage used across every workspace this owner owns — the shared pool's usage. */
export async function getOwnerPooledStorageUsedBytes(ownerId: string): Promise<number> {
  const ownedTenants = await db.tenantMember.findMany({ where: { userId: ownerId, role: "owner" }, select: { tenantId: true } })
  const perTenantBytes = await Promise.all(ownedTenants.map((t) => getStorageUsedBytes(t.tenantId)))
  return perTenantBytes.reduce((sum, bytes) => sum + bytes, 0)
}

export interface WorkspaceStorageSlice {
  allocatedBytes: number
  isExplicit: boolean
}

/**
 * This owner's pooled license storage, split across every workspace they
 * currently own. Explicit EnterpriseStorageAllocation rows are honored
 * first; every owned tenant WITHOUT a row gets an equal share of
 * (poolLimitBytes − sum(explicit)), divided by however many owned tenants
 * are currently unassigned. Recomputed from the CURRENT explicit rows +
 * CURRENT owner-member count on every call — nothing here is cached or
 * stored, so creating/deleting a workspace, or setting/clearing an explicit
 * allocation, is reflected on the very next read with no migration/backfill
 * step. Remainder clamps at 0 rather than going negative (e.g. after a
 * license downgrade leaves the explicit sum over the new pool size) — see
 * getStorageQuota()'s enterprise branch for what that means for an upload.
 */
export async function getOwnerStorageAllocationPlan(
  ownerId: string,
  poolLimitBytes: number
): Promise<Map<string, WorkspaceStorageSlice>> {
  const [ownedTenants, explicitRows] = await Promise.all([
    db.tenantMember.findMany({ where: { userId: ownerId, role: "owner" }, select: { tenantId: true } }),
    db.enterpriseStorageAllocation.findMany({ where: { ownerId }, select: { tenantId: true, allocatedGb: true } }),
  ])

  const ownedTenantIds = new Set(ownedTenants.map((t) => t.tenantId))
  // Only count explicit rows for tenants still actually owned by this user —
  // guards against a stale row surviving an ownership change.
  const explicitByTenant = new Map(
    explicitRows
      .filter((r) => ownedTenantIds.has(r.tenantId))
      .map((r) => [r.tenantId, r.allocatedGb * 1024 * MB] as const)
  )

  const unassignedTenantIds = [...ownedTenantIds].filter((id) => !explicitByTenant.has(id))
  const explicitTotalBytes = [...explicitByTenant.values()].reduce((sum, b) => sum + b, 0)
  const remainderBytes = Math.max(0, poolLimitBytes - explicitTotalBytes)
  const autoShareBytes = unassignedTenantIds.length > 0 ? Math.floor(remainderBytes / unassignedTenantIds.length) : 0

  const plan = new Map<string, WorkspaceStorageSlice>()
  for (const tenantId of ownedTenantIds) {
    plan.set(
      tenantId,
      explicitByTenant.has(tenantId)
        ? { allocatedBytes: explicitByTenant.get(tenantId)!, isExplicit: true }
        : { allocatedBytes: autoShareBytes, isExplicit: false }
    )
  }
  return plan
}

/** This single workspace's own slice of its owner's storage pool, or null if the owner has no active storage license. */
export async function getWorkspaceStorageAllocation(
  tenantId: string,
  ownerId: string
): Promise<WorkspaceStorageSlice | null> {
  const ownerLicense = await getOwnerStorageLicense(ownerId)
  if (!ownerLicense.licensed) return null
  const plan = await getOwnerStorageAllocationPlan(ownerId, ownerLicense.limitBytes)
  return plan.get(tenantId) ?? { allocatedBytes: 0, isExplicit: false }
}

/**
 * This user's own account-level enterprise license, if it grants a bounded
 * AI credit pool (admin sets this per-license — not every enterprise
 * license needs one). Deliberately NOT unlimited, unlike the instance-wide
 * license bypass in enforceUserAiCredits/reserveUserAiCredits below: once
 * this pool is used up the holder renews/upgrades rather than getting free
 * unlimited generation.
 */
export async function getUserAiCreditLicense(userId: string): Promise<{ licensed: boolean; max: number }> {
  try {
    const result = await validateLicense(userId)
    if (result.valid && result.type === "enterprise" && result.aiCredits) {
      return { licensed: true, max: result.aiCredits }
    }
  } catch {
    // Ignore and treat as unlicensed
  }
  return { licensed: false, max: 0 }
}

/**
 * Same bounded-grant pattern as getUserAiCreditLicense above, for workspace
 * count — see EnterpriseLicense.maxWorkspaces. `max` of 999999 is the
 * reserved "Unlimited" sentinel (matches the literal 999999 already used
 * elsewhere in this file for "practically unbounded"); any other positive
 * number is a hard cap enforced by enforceUserPlanLimit() below. `licensed:
 * false` means this license grants no workspace entitlement at all (e.g. a
 * storage/AI-credit-only license) — callers fall back to the account's
 * normal plan limit in that case, same as an unlicensed account.
 */
export async function getUserWorkspaceLicense(userId: string): Promise<{ licensed: boolean; max: number }> {
  try {
    const result = await validateLicense(userId)
    if (result.valid && result.type === "enterprise" && result.maxWorkspaces) {
      return { licensed: true, max: result.maxWorkspaces }
    }
  } catch {
    // Ignore and treat as unlicensed
  }
  return { licensed: false, max: 0 }
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

  // Pooled account-level enterprise storage: only relevant when this
  // workspace isn't already unmetered some other way (instance-wide
  // license, or its own BYOS bucket). Regular Pro/Business tenants are
  // untouched — they keep taking storage from their own plan exactly as
  // before. Checked per-call rather than cached: cheap (one TenantMember
  // lookup + one license validation, same cost as isInstanceEnterpriseLicensed
  // above), and storage usage changes too often to risk a stale cap.
  if (!instanceLicensed && !tenant?.storageConfig) {
    const ownerId = await getTenantOwnerId(tenantId)
    if (ownerId) {
      // Owner's own master BYOS (set once at /dashboard, see
      // getOwnerMasterInfra() in database.ts) — unmetered, same as
      // tenant.storageConfig being set directly, and checked ahead of the
      // bounded license storage pool below since it's the owner's own
      // infra, not a capped grant.
      const { getOwnerMasterInfra } = await import('./database')
      const master = await getOwnerMasterInfra(tenantId)
      if (master.storageConfig) {
        return { usedBytes, limitBytes: null, planBytes, addonBytes, planSlug: planConfig.plan_slug }
      }

      const ownerLicense = await getOwnerStorageLicense(ownerId)
      if (ownerLicense.licensed) {
        // Per-workspace slice of the pool (owner-assigned, or an even share
        // of whatever's left over — see getWorkspaceStorageAllocation),
        // plus this workspace's own active storage add-ons. usedBytes/
        // addonBytes are already this workspace's own numbers from above —
        // previously this branch discarded both in favor of the account-wide
        // pooled total, so every workspace under the same license saw an
        // identical used/limit pair and one workspace's uploads could block
        // every sibling workspace regardless of its own allocation.
        const slice = (await getWorkspaceStorageAllocation(tenantId, ownerId)) ?? { allocatedBytes: 0, isExplicit: false }
        return {
          usedBytes,
          limitBytes: slice.allocatedBytes + addonBytes,
          planBytes: slice.allocatedBytes,
          addonBytes,
          planSlug: "enterprise",
        }
      }
    }
  }

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
    
    // 2. Fallback to tenant-specific license or dedicated plan if no global license
    if (!enterprise && tenantId && tenantId !== globalTenantId) {
      enterprise = await isEnterpriseTenant(tenantId)
      if (!enterprise) {
        const t = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true, databaseUrl: true, storageConfig: true }
        })
        const p = (t?.plan || "").toLowerCase()
        if (p.includes("dedicated") || p.includes("enterprise") || (t?.databaseUrl && t?.storageConfig)) {
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
    if (isPlatformStaff(user?.role)) {
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
  // 0. Enterprise Mode Bypass — a whole self-hosted instance (global tenant
  // license) always stays fully unlimited regardless of resource.
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    if (await isEnterpriseTenant(globalTenantId)) {
      return {
        allowed: true,
        current: 0,
        max: 999999,
        planSlug: "enterprise",
        message: "Enterprise License — Unlimited",
      }
    }

    // An account-level license's workspace entitlement is bounded by its own
    // maxWorkspaces grant (see getUserWorkspaceLicense) rather than an
    // unconditional bypass — a license sold for "up to N workspaces" must
    // actually stop at N, not quietly grant unlimited like before. `max`
    // itself carries the 999999 "Unlimited" sentinel when that's what was
    // purchased, so this check naturally covers both cases.
    if (resource === "workspaces") {
      const workspaceLicense = await getUserWorkspaceLicense(userId)
      if (workspaceLicense.licensed) {
        const currentUsage = await getUserUsage(userId, "workspaces")
        const allowed = currentUsage < workspaceLicense.max
        return {
          allowed,
          current: currentUsage,
          max: workspaceLicense.max,
          planSlug: "enterprise",
          message: allowed
            ? `OK — workspaces: ${currentUsage}/${workspaceLicense.max}`
            : `Kuota workspace lisensi Enterprise Anda sudah penuh (${currentUsage}/${workspaceLicense.max}). Hubungi admin untuk menaikkan kuota.`,
        }
      }
    } else if (await isEnterpriseTenant(userId)) {
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

  if (isPlatformStaff(user?.role)) {
    return {
      allowed: true,
      current: user?.aiCreditsUsed || 0,
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
  // Instance-wide license (self-hosted install, LICENSE_KEY env var) stays
  // fully unlimited — distinct from an account-level license below, which
  // is bounded by its own aiCredits grant instead.
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    if (await isEnterpriseTenant(globalTenantId)) {
      return { allowed: true, remaining: 999999, max: 999999, current: 0, planSlug: "enterprise", message: "Enterprise Unlimited" }
    }
  } catch {}

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, aiCreditsUsed: true, aiCreditsExtra: true }
  })

  if (isPlatformStaff(user?.role)) {
    return { allowed: true, remaining: 999999, max: 999999, current: user?.aiCreditsUsed || 0, planSlug: "custom", message: "Super Admin Bypass" }
  }

  const accountLicense = await getUserAiCreditLicense(userId)
  let effectiveMax: number
  let planSlug: string
  if (accountLicense.licensed) {
    effectiveMax = accountLicense.max
    planSlug = "enterprise"
  } else {
    const planConfig = await getUserPlanConfig(userId)
    const override = await getUserOverride(userId)
    effectiveMax = getUserEffectiveMax(planConfig, override, "ai_credits", user?.aiCreditsExtra || 0)
    planSlug = planConfig.plan_slug
  }

  const currentUsage = user?.aiCreditsUsed || 0
  const remaining = Math.max(0, effectiveMax - currentUsage)

  const allowed = remaining >= cost

  return {
    allowed,
    remaining,
    max: effectiveMax,
    current: currentUsage,
    planSlug,
    message: allowed
      ? `OK (${remaining} credits remaining)`
      : accountLicense.licensed
        ? `Kuota AI credits lisensi Enterprise Anda sudah habis (${currentUsage}/${effectiveMax}). Hubungi admin untuk berlangganan lagi.`
        : `AI credits depleted. This action requires ${cost} credits, but you only have ${remaining} credits remaining. Please top up your credits to continue.`
  }
}

/**
 * Atomically check-and-reserve AI credits in ONE database operation, closing
 * the gap `enforceUserAiCredits` alone leaves open: that function only
 * reads the current balance, so two concurrent requests from the same user
 * can both see "enough remaining" and both proceed before either's
 * deduction lands, letting the user spend past their limit. This instead
 * does a conditional `UPDATE ... WHERE aiCreditsUsed <= max - cost`, which
 * Postgres's row lock makes atomic: a second concurrent call only sees the
 * first's increment once it's committed, so it correctly fails the
 * condition instead of racing it. Enterprise/super_admin bypasses mirror
 * enforceUserAiCredits exactly (no reservation needed — nothing to overrun).
 * Call reserveUserAiCredits instead of enforceUserAiCredits wherever the
 * cost is known up front and credits should actually be spent (not just
 * previewed) — see refundUserAiCredits for undoing a reservation whose
 * paid-for action then failed.
 */
export async function reserveUserAiCredits(
  userId: string,
  cost: number = 1
): Promise<{ allowed: boolean; remaining: number; max: number; message: string }> {
  // Instance-wide license stays unlimited — see enforceUserAiCredits's
  // comment above for why this is split from the account-level check below.
  try {
    const { getGlobalWorkspaceId } = await import('@/lib/settings')
    const globalTenantId = await getGlobalWorkspaceId()
    if (await isEnterpriseTenant(globalTenantId)) {
      return { allowed: true, remaining: 999999, max: 999999, message: "Enterprise Unlimited" }
    }
  } catch {}

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, aiCreditsUsed: true, aiCreditsExtra: true }
  })

  if (isPlatformStaff(user?.role)) {
    return { allowed: true, remaining: 999999, max: 999999, message: "Super Admin Bypass" }
  }

  const accountLicense = await getUserAiCreditLicense(userId)
  let effectiveMax: number
  if (accountLicense.licensed) {
    effectiveMax = accountLicense.max
  } else {
    const planConfig = await getUserPlanConfig(userId)
    const override = await getUserOverride(userId)
    effectiveMax = getUserEffectiveMax(planConfig, override, "ai_credits", user?.aiCreditsExtra || 0)
  }
  const maxUsageAfterReserve = effectiveMax - cost

  const result = await db.user.updateMany({
    where: { id: userId, aiCreditsUsed: { lte: maxUsageAfterReserve } },
    data: { aiCreditsUsed: { increment: cost } },
  })

  if (result.count === 0) {
    const current = user?.aiCreditsUsed || 0
    const remaining = Math.max(0, effectiveMax - current)
    return {
      allowed: false,
      remaining,
      max: effectiveMax,
      message: accountLicense.licensed
        ? `Kuota AI credits lisensi Enterprise Anda sudah habis (${current}/${effectiveMax}). Hubungi admin untuk berlangganan lagi.`
        : `AI credits depleted. This action requires ${cost} credits, but you only have ${remaining} credits remaining. Please top up your credits to continue.`,
    }
  }

  return { allowed: true, remaining: Math.max(0, maxUsageAfterReserve), max: effectiveMax, message: "Reserved" }
}

/**
 * Undo a reservation made by reserveUserAiCredits — call this if the action
 * that consumed those credits then failed, so a failed AI call stays free
 * (matching the pre-existing behavior: credits were only ever deducted on
 * success, back when enforce/deduct were separate read-then-write steps).
 */
export async function refundUserAiCredits(userId: string, cost: number): Promise<void> {
  try {
    await db.user.updateMany({
      where: { id: userId, aiCreditsUsed: { gte: cost } },
      data: { aiCreditsUsed: { decrement: cost } },
    })
  } catch (error) {
    console.error("[AI Credit Refund Error]", error)
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
 * Restrictions are enforced on the total workspace count of the account —
 * except the Free WORKSPACE tier specifically, which is capped at one per
 * account, ever, regardless of account plan (Starter/Pro/Business all
 * only get the one free workspace too). See User.freeWorkspaceUsed.
 */
export async function validateWorkspacePlanBinding(
  userId: string,
  workspacePlanSlug: string
): Promise<{ allowed: boolean; message: string }> {
  if (workspacePlanSlug.toLowerCase() === "free") {
    const user = await db.user.findUnique({ where: { id: userId }, select: { freeWorkspaceUsed: true } })
    if (user?.freeWorkspaceUsed) {
      return {
        allowed: false,
        message: "Anda sudah pernah menggunakan paket Workspace Gratis. Setiap akun hanya dapat membuat satu workspace gratis — pilih paket berbayar untuk workspace baru.",
      }
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
      case "content_entries": {
        const tenantDb = await getTenantDb(tenantId)
        // Soft-deleted (trashed) entries don't count against the plan limit —
        // they're meant to be freely discardable without a quota penalty
        // while still recoverable within the restore window.
        return tenantDb.contentEntry.count({ where: { tenantId, deletedAt: null } }).catch(() => 0)
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

