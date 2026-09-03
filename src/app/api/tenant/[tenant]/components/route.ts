import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/components — components available to this workspace. */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const components = await tenantDb.component.findMany({
    include: { fields: { orderBy: { order: "asc" } }, tenants: true },
    orderBy: { createdAt: "desc" },
  })

  // Available = global (no assignments) or explicitly assigned to this tenant.
  const available = components.filter(
    (c) => c.tenants.length === 0 || c.tenants.some((t) => t.tenantId === access.tenantId),
  )
  return NextResponse.json(available)
})
