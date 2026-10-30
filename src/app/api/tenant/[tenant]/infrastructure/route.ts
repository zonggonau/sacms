import { NextResponse } from "next/server"
import { db, isOwnerEligibleForByoInfra, isWorkspaceEligibleForByoInfra, invalidateOwnerMasterInfraCache } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { MinioConfigSchema, isValidPostgresUrl } from "@/lib/byo-infra-validation"
import { z } from "zod"

const MASK = "••••••••"

/**
 * GET /api/tenant/[tenant]/infrastructure
 *
 * Whether this workspace is on dedicated database/storage — either its own
 * (`tenant.databaseUrl`/`storageConfig`, no remaining writer but kept for
 * backward compatibility with any historical row) or, more commonly today,
 * its owning account's Enterprise-licensed dedicated infra (see
 * getOwnerMasterInfra() in src/lib/database.ts, auto-provisioned on
 * license activation). Without either it runs on the shared SaCMS database
 * and storage.
 */
export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const tenant = await db.tenant.findUnique({
    where: { id: access.tenantId },
    select: { databaseUrl: true, storageConfig: true, useOwnerInfra: true },
  })

  let isCustomDbConfigured = !!tenant?.databaseUrl
  let isCustomStorageConfigured = !!tenant?.storageConfig
  if (!isCustomDbConfigured || !isCustomStorageConfigured) {
    const { getOwnerMasterInfra } = await import("@/lib/database")
    const master = await getOwnerMasterInfra(access.tenantId)
    isCustomDbConfigured = isCustomDbConfigured || !!master.databaseUrl
    isCustomStorageConfigured = isCustomStorageConfigured || !!master.storageConfig
  }

  // Whether the OWNER has BYODB/BYOS configured at all, independent of
  // this tenant's own useOwnerInfra switch — so the UI knows whether to
  // offer the switch, even when it's currently off (and getOwnerMasterInfra
  // above would otherwise report nothing configured).
  const owner = await db.tenantMember.findFirst({ where: { tenantId: access.tenantId, role: "owner" }, select: { userId: true } })
  let ownerHasInfraConfigured = false
  if (owner) {
    const ownerUser = await db.user.findUnique({ where: { id: owner.userId }, select: { masterDatabaseUrl: true, masterStorageConfig: true } })
    const sc = ownerUser?.masterStorageConfig as { endpoint?: string; accessKey?: string; secretKey?: string; bucket?: string } | null
    const hasStorage = !!(sc && sc.endpoint && sc.accessKey && sc.secretKey && sc.bucket)
    ownerHasInfraConfigured = !!ownerUser?.masterDatabaseUrl || hasStorage
  }

  // Second, independent BYODB/BYOS gate — driven by this WORKSPACE's own
  // plan (Tenant.plan === "business") or its owner's Enterprise License,
  // not the owner's account plan — see isWorkspaceEligibleForByoInfra in
  // src/lib/database.ts.
  const workspaceEligibleForByoInfra = await isWorkspaceEligibleForByoInfra(access.tenantId)
  const tenantSc = tenant?.storageConfig as { endpoint?: string; accessKey?: string; secretKey?: string; bucket?: string } | null

  return NextResponse.json({
    isCustomDbConfigured,
    isCustomStorageConfigured,
    useOwnerInfra: tenant?.useOwnerInfra ?? true,
    ownerHasInfraConfigured,
    workspaceEligibleForByoInfra,
    tenantDatabaseUrl: tenant?.databaseUrl ? MASK : "",
    tenantStorageConfig: tenantSc
      ? { endpoint: tenantSc.endpoint || "", accessKey: tenantSc.accessKey || "", secretKey: tenantSc.secretKey ? MASK : "", bucket: tenantSc.bucket || "" }
      : null,
  })
})

const PatchSchema = z.object({ useOwnerInfra: z.boolean() })

/**
 * PATCH /api/tenant/[tenant]/infrastructure
 *
 * Owner-only per-workspace switch — see Tenant.useOwnerInfra and
 * getOwnerMasterInfra() in src/lib/database.ts. Turning it ON requires the
 * owner to actually have BYODB/BYOS configured already (set at
 * /dashboard/infrastructure); turning it OFF (back to SaCMS's own
 * dedicated DB / Enterprise storage pool) is always allowed.
 */
export const PATCH = withStaffAuth(
  async (request, _context, { access }) => {
    const body = await readJson(request, PatchSchema)
    if (!body.ok) return body.response

    if (body.data.useOwnerInfra) {
      const owner = await db.tenantMember.findFirst({ where: { tenantId: access.tenantId, role: "owner" }, select: { userId: true } })
      const ownerId = owner?.userId ?? access.userId
      const eligible = await isOwnerEligibleForByoInfra(ownerId)
      const user = await db.user.findUnique({ where: { id: ownerId }, select: { masterDatabaseUrl: true, masterStorageConfig: true } })
      const sc = user?.masterStorageConfig as { endpoint?: string; accessKey?: string; secretKey?: string; bucket?: string } | null
      const hasStorage = !!(sc && sc.endpoint && sc.accessKey && sc.secretKey && sc.bucket)
      const hasConfiguredInfra = !!user?.masterDatabaseUrl || hasStorage

      if (!eligible || !hasConfiguredInfra) {
        return apiError("validation", {
          message: "Anda belum mengatur database/storage sendiri di halaman Infrastruktur.",
        })
      }
    }

    await db.tenant.update({
      where: { id: access.tenantId },
      data: { useOwnerInfra: body.data.useOwnerInfra },
    })
    await invalidateOwnerMasterInfraCache(access.userId)

    return NextResponse.json({ useOwnerInfra: body.data.useOwnerInfra })
  },
  { minRole: "owner" },
)

const PutByoSchema = z.object({
  databaseUrl: z.string().max(2000).nullable().optional(),
  storageConfig: MinioConfigSchema.nullable().optional(),
})

/**
 * PUT /api/tenant/[tenant]/infrastructure
 *
 * This WORKSPACE's own direct database/storage override (Tenant.databaseUrl
 * / storageConfig) — distinct from the account-level BYODB/BYOS set via
 * /api/user/infrastructure. Unlocked by isWorkspaceEligibleForByoInfra
 * (workspace plan "business"/"enterprise", or the owner's Enterprise
 * License) rather than the owner's account plan. Clearing to null is
 * always allowed (same "don't strand a stale value from a past downgrade"
 * reasoning as the account-level route); setting a new value requires
 * eligibility. No cache to invalidate here — getTenantDb() checks
 * tenant.databaseUrl before ever calling getOwnerMasterInfra(), so this
 * takes effect on the very next read.
 */
export const PUT = withStaffAuth(
  async (request, _context, { access }) => {
    const body = await readJson(request, PutByoSchema)
    if (!body.ok) return body.response
    const { databaseUrl, storageConfig } = body.data

    const existing = await db.tenant.findUnique({ where: { id: access.tenantId }, select: { storageConfig: true } })
    const data: { databaseUrl?: string | null; storageConfig?: any } = {}

    if (databaseUrl !== undefined) {
      if (databaseUrl === MASK) {
        // leave the stored value alone
      } else if (databaseUrl === null || databaseUrl === "") {
        data.databaseUrl = null
      } else {
        if (!(await isWorkspaceEligibleForByoInfra(access.tenantId))) {
          return apiError("forbidden", { message: "Database sendiri hanya tersedia untuk workspace plan Business atau lisensi Enterprise." })
        }
        if (!isValidPostgresUrl(databaseUrl)) {
          return apiError("validation", { message: "URL database harus dimulai dengan postgres:// atau postgresql://" })
        }
        data.databaseUrl = databaseUrl
      }
    }

    if (storageConfig !== undefined) {
      if (storageConfig === null) {
        data.storageConfig = null
      } else {
        if (!(await isWorkspaceEligibleForByoInfra(access.tenantId))) {
          return apiError("forbidden", { message: "Storage sendiri hanya tersedia untuk workspace plan Business atau lisensi Enterprise." })
        }
        const sc = { ...storageConfig }
        if (sc.secretKey === MASK) {
          const existingSc = existing?.storageConfig as { secretKey?: string } | null
          if (!existingSc?.secretKey) return apiError("validation", { message: "Secret Key MinIO wajib diisi." })
          sc.secretKey = existingSc.secretKey
        }
        data.storageConfig = sc
      }
    }

    if (Object.keys(data).length > 0) {
      await db.tenant.update({ where: { id: access.tenantId }, data })
    }

    return NextResponse.json({ success: true })
  },
  { minRole: "owner" },
)
