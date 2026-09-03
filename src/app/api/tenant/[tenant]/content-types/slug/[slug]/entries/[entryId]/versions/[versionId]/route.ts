import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { findEntryInTenant } from "@/lib/content/entry-access"

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, slug, entryId, versionId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const entry = await findEntryInTenant(tenantDb, {
    entryId,
    tenantId: access.tenantId,
    contentTypeSlug: slug,
  })
  if (!entry) return apiError("not_found", { message: "Entry not found" })

  const version = await tenantDb.contentVersion.findFirst({
    where: { id: versionId, contentEntryId: entryId },
  })
  if (!version) return apiError("not_found", { message: "Version not found" })
  return NextResponse.json({ version })
})
