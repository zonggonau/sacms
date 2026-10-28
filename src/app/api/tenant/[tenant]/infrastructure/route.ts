import { NextResponse } from "next/server"
import { db, isOwnerEligibleForByoInfra, invalidateOwnerMasterInfraCache } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { z } from "zod"

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

  return NextResponse.json({
    isCustomDbConfigured,
    isCustomStorageConfigured,
    useOwnerInfra: tenant?.useOwnerInfra ?? true,
    ownerHasInfraConfigured,
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
