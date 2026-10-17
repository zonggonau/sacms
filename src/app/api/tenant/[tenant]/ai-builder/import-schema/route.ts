import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { VALID_FIELD_TYPES } from "@/lib/field-types"
import { assertSchemaEditable } from "@/lib/schema-lock"

// Same slug shape enforced everywhere a human fills the form by hand
// (see createContentTypeSchema in lib/validations/admin.ts) — the AI/plan
// path must not be looser just because the content came from a model
// instead of an input field, since slugs end up in real URLs/API paths.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

const importFieldSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(SLUG_RE),
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
})

export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const parsed = await readJson(req, importSchemaBodySchema)
    if (!parsed.ok) return parsed.response
    const { schema } = parsed.data

    const totalModels = schema.contentTypes.length + schema.singleTypes.length + schema.components.length
    if (totalModels === 0) {
      return apiError("validation", { message: "Tidak ada struktur untuk diimpor" })
    }

    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return apiError("conflict", { message: lockError.error })

    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.slug)

    const { imported } = await materializeSchemaIntoTenant(tenantDb, tenant.id, schema)

    return NextResponse.json({ success: true, imported })
  },
  { minRole: "admin" },
)
