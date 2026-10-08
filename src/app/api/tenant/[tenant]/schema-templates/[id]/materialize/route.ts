import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"

// Idempotent: if this template was already materialized into Global's own
// tenant (tagged draftTemplateId), just return the existing tagged rows
// instead of creating duplicates.
export const POST = withStaffAuth(
  async (_req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat mengedit Schema Template" })
    }

    const { id } = await context.params
    const template = await db.schemaTemplate.findUnique({ where: { id } })
    if (!template) return apiError("not_found", { message: "Template tidak ditemukan" })

    const tenantDb = await getTenantDb(access.tenant.slug)
    const where = { tenantId: access.tenant.id, draftTemplateId: id }

    const existing = await Promise.all([
      tenantDb.contentType.findMany({ where, select: { slug: true } }),
      tenantDb.singleType.findMany({ where, select: { slug: true } }),
      tenantDb.component.findMany({ where, select: { slug: true } }),
    ])
    const alreadyMaterialized = existing.some((rows) => rows.length > 0)

    if (!alreadyMaterialized) {
      await materializeSchemaIntoTenant(
        tenantDb,
        access.tenant.id,
        template.schema as any,
        { draftTemplateId: id },
      )
    }

    return NextResponse.json({ success: true, alreadyMaterialized })
  },
  { minRole: "admin" },
)
