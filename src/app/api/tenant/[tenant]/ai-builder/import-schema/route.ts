import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"

export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const { schema } = await req.json()
    if (!schema || typeof schema !== "object") {
      return apiError("validation", { message: "Invalid schema provided" })
    }

    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.slug)

    const { imported } = await materializeSchemaIntoTenant(tenantDb, tenant.id, schema)

    return NextResponse.json({ success: true, imported })
  },
  { minRole: "admin" },
)
