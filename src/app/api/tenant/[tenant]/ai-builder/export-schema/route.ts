import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { serializeTenantSchema } from "@/lib/schema-template-sync"

export const GET = withStaffAuth(async (_req, context, { access }) => {
    const { tenant: tenantSlug } = await context.params
    const tenantDb = await getTenantDb(tenantSlug)

    const schema = await serializeTenantSchema(tenantDb, { tenantId: access.tenant.id })

    return NextResponse.json(schema)
})
