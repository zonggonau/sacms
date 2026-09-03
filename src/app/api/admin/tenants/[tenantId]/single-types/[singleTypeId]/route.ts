import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

/**
 * POST /api/admin/tenants/[tenantId]/single-types/[singleTypeId]
 * Enable or disable a single type for a tenant (per locale).
 */
export const POST = withAdminAuth(async (request, context) => {
  const { tenantId, singleTypeId } = await context.params
  const body = await request.json()
  const locale = body.locale || "en"

  const assignment = await db.tenantSingleTypeAssignment.upsert({
    where: { tenantId_singleTypeId_locale: { tenantId, singleTypeId, locale } },
    update: { enabled: body.enabled },
    create: { tenantId, singleTypeId, locale, enabled: body.enabled },
  })
  return NextResponse.json(assignment)
})
