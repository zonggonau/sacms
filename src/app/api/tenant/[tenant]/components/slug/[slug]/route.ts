import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug, slug: componentSlug } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const component = await tenantDb.component.findFirst({
    where: {
      slug: componentSlug,
      OR: [{ tenantId: null }, { tenantId: access.tenantId }],
    },
    include: { schemaFields: { orderBy: { order: "asc" } }, tenants: true },
  })
  if (!component) return apiError("not_found", { message: "Component not found" })

  const hasAccess =
    component.tenants.length === 0 || component.tenants.some((t) => t.tenantId === access.tenantId)
  if (!hasAccess) {
    return apiError("forbidden", { message: "Component belongs to another workspace" })
  }

  return NextResponse.json({
    id: component.id,
    name: component.name,
    slug: component.slug,
    fields: component.schemaFields,
  })
})
