import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { serializeTenantSchema } from "@/lib/schema-template-sync"

// Snapshots the current state of this template's materialized (draft-tagged)
// rows back into SchemaTemplate.schema. Explicit/manual by design — editing
// the tagged Content Types/Single Types/Components via the normal builder
// pages does NOT auto-sync; the author clicks this when ready.
export const POST = withStaffAuth(
  async (_req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat mengedit Schema Template" })
    }

    const { id } = await context.params
    const template = await db.schemaTemplate.findUnique({ where: { id } })
    if (!template) return apiError("not_found", { message: "Template tidak ditemukan" })

    const tenantDb = await getTenantDb(access.tenant.slug)
    const schema = await serializeTenantSchema(tenantDb, { tenantId: access.tenant.id, draftTemplateId: id })

    const updated = await db.schemaTemplate.update({
      where: { id },
      data: { schema: schema as any },
    })

    return NextResponse.json({ template: updated })
  },
  { minRole: "admin" },
)
