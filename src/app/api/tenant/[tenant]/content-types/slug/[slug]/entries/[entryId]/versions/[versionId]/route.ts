import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, context) => {
  const { tenant: tenantSlug, versionId } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const version = await tenantDb.contentVersion.findUnique({ where: { id: versionId } })
  if (!version) return apiError("not_found", { message: "Version not found" })
  return NextResponse.json({ version })
})
