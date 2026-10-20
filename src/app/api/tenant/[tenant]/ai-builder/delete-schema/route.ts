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
 *
 * Blocked entirely for the SaCMS Global workspace — its own Content
 * Types/Single Types/Components can double as the global/platform schema
 * other tenants see (tenantId: null rows aside, Global's OWN tenantId-scoped
 * rows are still too high-blast-radius for a one-click nuke). The dashboard
 * UI already hides the button for Global; this is the server-side backstop.
 */
export const POST = withStaffAuth(
  async (_req, _context, { access }) => {
    if (access.isGlobal) {
      return apiError("forbidden", { message: "Hapus semua schema tidak tersedia untuk workspace SaCMS Global." })
    }

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
