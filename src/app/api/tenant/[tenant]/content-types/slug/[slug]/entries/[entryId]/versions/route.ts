import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { findEntryInTenant } from "@/lib/content/entry-access"

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, slug, entryId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const entry = await findEntryInTenant(tenantDb, {
    entryId,
    tenantId: access.tenantId,
    contentTypeSlug: slug,
  })
  if (!entry) return apiError("not_found", { message: "Entry not found" })

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
