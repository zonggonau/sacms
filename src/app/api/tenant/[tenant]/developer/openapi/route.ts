import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { EXCLUDE_PLATFORM_CONTENT_TYPES } from "@/lib/platform-content-types"
import { buildOpenApiSpec } from "@/lib/openapi-generator"
import { resolveApiOrigin } from "@/lib/infrastructure/frontend-env"

export const GET = withStaffAuth(async (_request, context, { access }) => {
    const { tenant: tenantSlug } = await context.params

    // Exclude platform-internal types only among the *global* (tenantId:
    // null) rows — never hide a tenant's own content type just because its
    // slug happens to match a platform one.
    const [contentTypesRaw, singleTypesRaw] = await Promise.all([
      db.contentType.findMany({
        where: { OR: [{ tenantId: access.tenantId }, { tenantId: null, ...EXCLUDE_PLATFORM_CONTENT_TYPES }] },
        include: { schemaFields: true }
      }),
      db.singleType.findMany({
        where: { tenantId: access.tenantId },
        include: { schemaFields: true }
      })
    ])

    const spec = buildOpenApiSpec({
      tenantName: access.tenant.name,
      tenantSlug,
      apiOrigin: resolveApiOrigin(),
      contentTypes: contentTypesRaw.map((ct) => ({ slug: ct.slug, name: ct.name, fields: ct.schemaFields })),
      singleTypes: singleTypesRaw.map((st) => ({ slug: st.slug, name: st.name, fields: st.schemaFields })),
    })

    return NextResponse.json(spec)
})
