import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { assertSchemaEditable } from "@/lib/schema-lock"

/**
 * Nuclear option: wipes every Content Type, Single Type, and Component this
 * tenant OWNS (never a Global/platform type it merely has enabled) —
 * everything under them (fields, content entries, versions) cascades via
 * the schema's own onDelete: Cascade relations. Same draft-required lock as
 * every other schema-mutating dashboard action; MCP is unaffected (see
 * schema-lock.ts) since it never calls this route.
 */
export const POST = withStaffAuth(
  async (_req, _context, { access }) => {
    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return apiError("forbidden", { message: lockError.error })

    const tenantDb = await getTenantDb(access.tenant.slug)

    const [contentTypes, singleTypes, components] = await Promise.all([
      tenantDb.contentType.deleteMany({ where: { tenantId: access.tenantId } }),
      tenantDb.singleType.deleteMany({ where: { tenantId: access.tenantId } }),
      tenantDb.component.deleteMany({ where: { tenantId: access.tenantId } }),
    ])

    return NextResponse.json({
      success: true,
      deleted: {
        contentTypes: contentTypes.count,
        singleTypes: singleTypes.count,
        components: components.count,
      },
    })
  },
  { minRole: "admin" },
)
