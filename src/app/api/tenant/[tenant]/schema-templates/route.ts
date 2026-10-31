import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { slugify } from "@/lib/slug"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { createSchemaTemplateSchema } from "@/lib/validations/schema-template"

// Schema templates are platform catalog data (see prisma/schema.prisma —
// no tenantId FK) and must be visible to every tenant regardless of
// dedicated-database status, so this always queries the plain shared `db`
// client, never getTenantDb().

const createTemplateSchema = createSchemaTemplateSchema

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const templates = await db.schemaTemplate.findMany({
    where: access.isGlobal ? {} : { published: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ templates })
})

export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat membuat Schema Template" })
    }

    const parsed = await readJson(req, createTemplateSchema)
    if (!parsed.ok) return parsed.response
    const { name, category, icon, description, schema } = parsed.data

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
        schema,
        published: false,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ template })
  },
  { minRole: "admin" },
)
