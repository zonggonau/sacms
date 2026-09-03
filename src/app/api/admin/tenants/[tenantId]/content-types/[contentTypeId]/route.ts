import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

/**
 * POST /api/admin/tenants/[tenantId]/content-types/[contentTypeId]
 * Enable or disable a content type for a tenant.
 */
export const POST = withAdminAuth(async (request, context) => {
  const { tenantId, contentTypeId } = await context.params
  const body = await request.json()

  const assignment = await db.tenantContentTypeAssignment.upsert({
    where: { tenantId_contentTypeId: { tenantId, contentTypeId } },
    update: { enabled: body.enabled },
    create: { tenantId, contentTypeId, enabled: body.enabled },
  })
  return NextResponse.json(assignment)
})
