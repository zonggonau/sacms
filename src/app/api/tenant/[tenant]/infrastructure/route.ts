import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

/**
 * GET /api/tenant/[tenant]/infrastructure
 *
 * Whether the workspace connected its own database (BYODB) or S3 storage (BYOS). Without
 * either it runs on the shared SaCMS database and storage.
 */
export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const tenant = await db.tenant.findUnique({
    where: { id: access.tenantId },
    select: { databaseUrl: true, storageConfig: true },
  })

  return NextResponse.json({
    isCustomDbConfigured: !!tenant?.databaseUrl,
    isCustomStorageConfigured: !!tenant?.storageConfig,
  })
})
