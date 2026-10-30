import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { VALID_FIELD_TYPES } from "@/lib/field-types"
import { assertSchemaEditable } from "@/lib/schema-lock"

// Model-level slug shape (Content Type / Single Type / Component) enforced
// everywhere a human fills the form by hand (see createContentTypeSchema in
// lib/validations/admin.ts) — these end up in real URLs/API paths, so the
// AI/plan path must not be looser than the manual one. relationSlug and
// componentSlug also point at another model's slug, so they follow the
// same kebab-only rule.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

// A FIELD's own slug is a different convention: the manual "new content
// type" form generates these as snake_case (see generateFieldSlug in
// new-content-type-client.tsx) and createContentTypeSchema's fieldDefinitionSchema
// never regex-validates them at all — so underscores are normal here, not a
// looser carve-out. This also has to admit the one deliberate exception in
// ai-schema-generator.ts's restoreVerbatimPlaceholderSlugs: a document_template
// Content Type's field slugs are restored verbatim from an attached .docx's
// {placeholder} keys (which are snake_case) so the later merge can match
// them exactly — reusing the kebab-only SLUG_RE here made every such AI plan
// fail this route's validation with a 400 on save, even though the plan
// previewed fine.
const FIELD_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/

const importFieldSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(FIELD_SLUG_RE),
  type: z.enum(VALID_FIELD_TYPES),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  relationSlug: z.string().trim().min(1).max(100).regex(SLUG_RE).optional(),
  componentSlug: z.string().trim().min(1).max(100).regex(SLUG_RE).optional(),
})

const importModelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(SLUG_RE),
  description: z.string().trim().max(500).optional(),
  fields: z.array(importFieldSchema).max(100).default([]),
})

const importSchemaBodySchema = z.object({
  schema: z.object({
    contentTypes: z.array(importModelSchema).max(50).default([]),
    singleTypes: z.array(importModelSchema).max(50).default([]),
    components: z.array(importModelSchema).max(50).default([]),
  }),
  // Set by "Pakai Template" only — the AI Schema Generator's own save
  // deliberately allows adding to an existing schema (its own banner says
  // "tambah lagi lewat prompt di sini"), but applying a whole template on
  // top of unrelated existing structures would silently skip any
  // slug-conflicting model (materializeSchemaIntoTenant's own behavior)
  // and leave a confusing mix behind — the workspace must be empty first.
  requireEmpty: z.boolean().optional(),
})

export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return apiError("forbidden", { message: lockError.error })

    const parsed = await readJson(req, importSchemaBodySchema)
    if (!parsed.ok) return parsed.response
    const { schema, requireEmpty } = parsed.data

    const totalModels = schema.contentTypes.length + schema.singleTypes.length + schema.components.length
    if (totalModels === 0) {
      return apiError("validation", { message: "Tidak ada struktur untuk diimpor" })
    }

    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.slug)

    if (requireEmpty) {
      const [hasCt, hasSt, hasComp] = await Promise.all([
        tenantDb.contentType.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
        tenantDb.singleType.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
        tenantDb.component.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
      ])
      if (hasCt || hasSt || hasComp) {
        return apiError("validation", {
          message: "Masih ada Content Type/Single Type/Component di workspace ini. Hapus dulu (tombol \"Hapus Semua Schema\") sebelum menerapkan template.",
        })
      }
    }

    const { imported } = await materializeSchemaIntoTenant(tenantDb, tenant.id, schema)

    return NextResponse.json({ success: true, imported })
  },
  { minRole: "admin" },
)
