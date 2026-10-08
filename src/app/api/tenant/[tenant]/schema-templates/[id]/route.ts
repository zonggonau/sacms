import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

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

    const template = await db.schemaTemplate.update({
      where: { id },
      data: parsed.data,
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
