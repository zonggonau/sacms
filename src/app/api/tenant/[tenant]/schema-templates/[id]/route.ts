import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { materializeSchemaIntoTenant, serializeTenantSchema } from "@/lib/schema-template-sync"

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  published: z.boolean().optional(),
})

export const PATCH = withStaffAuth(
  async (req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat mengubah Schema Template" })
    }

    const { id } = await context.params
    const existing = await db.schemaTemplate.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Template tidak ditemukan" })

    const parsed = await readJson(req, updateTemplateSchema)
    if (!parsed.ok) return parsed.response

    const tenantDb = await getTenantDb(access.tenant.slug)
    const draftWhere = { tenantId: access.tenant.id, draftTemplateId: id }

    let schemaOverride: Record<string, unknown> | undefined

    // -> Draft: materialize the template's schema into real, editable rows
    // (tagged draftTemplateId) so the SaCMS team edits them via the normal
    // Content Type/Single Type/Component pages instead of a JSON blob.
    // Idempotent — skips if already materialized (e.g. re-toggling draft).
    if (parsed.data.published === false) {
      const [hasCt, hasSt, hasComp] = await Promise.all([
        tenantDb.contentType.findFirst({ where: draftWhere, select: { id: true } }),
        tenantDb.singleType.findFirst({ where: draftWhere, select: { id: true } }),
        tenantDb.component.findFirst({ where: draftWhere, select: { id: true } }),
      ])
      if (!hasCt && !hasSt && !hasComp) {
        await materializeSchemaIntoTenant(tenantDb, access.tenant.id, existing.schema as any, { draftTemplateId: id })
      }
    }

    // -> Publish: snapshot the current materialized rows back into the
    // template, then dematerialize (delete the tagged rows) — the template
    // becomes a clean, self-contained blob again, no longer touching real
    // schema tables. No-op if nothing was ever materialized.
    if (parsed.data.published === true) {
      const [cts, sts, comps] = await Promise.all([
        tenantDb.contentType.findMany({ where: draftWhere, select: { id: true } }),
        tenantDb.singleType.findMany({ where: draftWhere, select: { id: true } }),
        tenantDb.component.findMany({ where: draftWhere, select: { id: true } }),
      ])
      if (cts.length || sts.length || comps.length) {
        schemaOverride = await serializeTenantSchema(tenantDb, draftWhere)
        await Promise.all([
          tenantDb.contentType.deleteMany({ where: draftWhere }),
          tenantDb.singleType.deleteMany({ where: draftWhere }),
          tenantDb.component.deleteMany({ where: draftWhere }),
        ])
      }
    }

    const template = await db.schemaTemplate.update({
      where: { id },
      data: { ...parsed.data, ...(schemaOverride ? { schema: schemaOverride as any } : {}) },
    })

    return NextResponse.json({ template })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat menghapus Schema Template" })
    }

    const { id } = await context.params
    const existing = await db.schemaTemplate.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Template tidak ditemukan" })

    // Clean up any materialized draft rows (SchemaFields cascade via their
    // own onDelete rule) before dropping the template itself.
    const tenantDb = await getTenantDb(access.tenant.slug)
    const where = { tenantId: access.tenant.id, draftTemplateId: id }
    await Promise.all([
      tenantDb.contentType.deleteMany({ where }),
      tenantDb.singleType.deleteMany({ where }),
      tenantDb.component.deleteMany({ where }),
    ])

    await db.schemaTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
