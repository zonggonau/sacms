import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, context) => {
  const { tenant: tenantSlug, entryId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const versions = await tenantDb.contentVersion.findMany({
    where: { contentEntryId: entryId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      changeType: true,
      changedBy: true,
      changeSummary: true,
      createdAt: true,
      publishedAt: true,
    },
  })
  return NextResponse.json({ versions })
})
