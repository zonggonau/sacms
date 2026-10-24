import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

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
    select: { databaseUrl: true, storageConfig: true },
  })

  let isCustomDbConfigured = !!tenant?.databaseUrl
  let isCustomStorageConfigured = !!tenant?.storageConfig
  if (!isCustomDbConfigured || !isCustomStorageConfigured) {
    const { getOwnerMasterInfra } = await import("@/lib/database")
    const master = await getOwnerMasterInfra(access.tenantId)
    isCustomDbConfigured = isCustomDbConfigured || !!master.databaseUrl
    isCustomStorageConfigured = isCustomStorageConfigured || !!master.storageConfig
  }

  return NextResponse.json({ isCustomDbConfigured, isCustomStorageConfigured })
})
