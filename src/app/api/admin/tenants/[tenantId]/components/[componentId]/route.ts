import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

/**
 * POST /api/admin/tenants/[tenantId]/components/[componentId]
 * Enable or disable a component for a tenant.
 */
export const POST = withAdminAuth(async (request, context) => {
  const { tenantId, componentId } = await context.params
  const body = await request.json()

  const assignment = await db.tenantComponentAssignment.upsert({
    where: { tenantId_componentId: { tenantId, componentId } },
    update: { enabled: body.enabled },
    create: { tenantId, componentId, enabled: body.enabled },
  })
  return NextResponse.json(assignment)
})
