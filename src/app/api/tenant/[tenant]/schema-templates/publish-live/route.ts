import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db, getTenantDb } from "@/lib/database"
import { slugify } from "@/lib/slug"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { serializeTenantSchema } from "@/lib/schema-template-sync"

const publishLiveSchema = z.object({
  name: z.string().trim().min(1, "Nama template wajib diisi").max(150),
  category: z.string().trim().min(1, "Kategori wajib diisi").max(100),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
})

/**
 * SaCMS Global's Content Type/Single Type/Component tabs double as a
 * staging area for whatever new template is being built (via the AI
 * Schema Generator or manual editing) — this bundles the CURRENT live
 * schema (tenantId-scoped, draftTemplateId: null — never a different
 * template's own in-progress draft rows) into a brand-new, immediately
 * published SchemaTemplate, then wipes those live rows so the tabs go
 * back to empty, ready for the next template. One action, not the
 * separate materialize/edit/sync/dematerialize cycle an EXISTING
 * template's draft goes through (see schema-templates/[id]/route.ts).
 */
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat publish ke template" })
    }

    const parsed = await readJson(req, publishLiveSchema)
    if (!parsed.ok) return parsed.response
    const { name, category, icon, description } = parsed.data

    const tenantDb = await getTenantDb(access.tenant.slug)
    const liveWhere = { tenantId: access.tenantId, draftTemplateId: null }

    const schema = await serializeTenantSchema(tenantDb, liveWhere)
    const totalModels = schema.contentTypes.length + schema.singleTypes.length + schema.components.length
    if (totalModels === 0) {
      return apiError("validation", { message: "Belum ada Content Type/Single Type/Component untuk dijadikan template" })
    }

    const baseSlug = slugify(name)
    let slug = baseSlug
    let suffix = 1
    while (await db.schemaTemplate.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`
    }

    const template = await db.schemaTemplate.create({
      data: {
        name,
        slug,
        category,
        icon: icon || "📦",
        description: description || null,
        schema: schema as any,
        published: true,
        createdBy: session.user.id,
      },
    })

    await Promise.all([
      tenantDb.contentType.deleteMany({ where: liveWhere }),
      tenantDb.singleType.deleteMany({ where: liveWhere }),
      tenantDb.component.deleteMany({ where: liveWhere }),
    ])

    return NextResponse.json({ template })
  },
  { minRole: "admin" },
)
