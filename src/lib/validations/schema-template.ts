import { z } from "zod/v4"
import { VALID_FIELD_TYPES } from "@/lib/field-types"

/**
 * Shared shape for a Schema Template's `schema` JSON blob (prisma/schema.prisma
 * SchemaTemplate.schema) — a bundle of Content Type / Single Type / Component
 * model definitions, the same field shape get_full_schema returns for a real
 * workspace. Used by both the dashboard REST route
 * (src/app/api/tenant/[tenant]/schema-templates/route.ts) and the SaCMS
 * Global "Schema Template" MCP server (src/app/api/mcp/global-schema), so
 * the validation rules only live in one place.
 */

// Same slug format the dashboard's own Content Type/Single Type/Component
// creation routes enforce (src/lib/validations/admin.ts) — but
// schema-template-sync.ts's materialize step writes a model's `slug`
// straight into the real ContentType/SingleType/Component row with NO
// format check of its own (confirmed: no slugify() call on these, only on
// the group-slug fallback), so a template with "My Article!"/spaces/
// uppercase silently materializes a slug no real route would ever let a
// human create, breaking routing/API paths downstream. Enforcing the same
// rule here catches it at template-definition time instead.
const modelSlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase alphanumeric with dashes (e.g. 'blog-post')")

export const schemaTemplateFieldSchema = z.object({
  name: z.string().describe("Field label shown in the CMS editor, e.g. 'Cover Image'"),
  slug: z.string().describe("Field key used in the Content API's JSON, e.g. 'cover-image'. Kebab-case is the convention (not hard-enforced — document_template fields that mirror a .docx's own placeholder keys verbatim are a known, deliberate exception)."),
  type: z.enum(VALID_FIELD_TYPES).describe("One of the 36 real field types — call list_field_types for the full list with each type's options/relationSlug/entryValue shape. A typo'd/fictional type is now rejected here directly instead of silently accepted and only flagged by a separate reference check."),
  required: z.boolean().optional().describe("Default false."),
  unique: z.boolean().optional().describe("Default false."),
  relationSlug: z.string().optional().describe("Required when type is 'relation' — the target Content Type/Single Type's slug (must match one elsewhere in this same bundle, or be 'member' for the tenant's own end-user table)."),
  componentSlug: z.string().optional().describe("Used by a 'component'-type field's options.componentSlug instead (kept here only for a looser/legacy shape some callers use) — prefer options: { componentSlug: '...' }."),
  // Generic per-type extras — the field this whole module was missing:
  // `select`/`multiselect` need { choices: [{label, value}, ...] } to be
  // anything but a plain text input once materialized into a real
  // ContentType/SingleType/Component (see schema-template-sync.ts). Also
  // carries other field-specific extras (e.g. currency's currencyCode),
  // same generic bag SchemaField.options already uses everywhere else.
  options: z.record(z.string(), z.any()).optional().describe("Per-type extras — call list_field_types first, its `supportedOptions`/`exampleOptions` per type is the authoritative shape. No `default` value concept exists anywhere in SaCMS's schema model yet (SchemaField has no such column) — don't invent one."),
})

export const schemaTemplateModelSchema = z.object({
  name: z.string(),
  slug: modelSlugSchema,
  description: z.string().optional(),
  fields: z.array(schemaTemplateFieldSchema),
  dummyData: z.array(z.record(z.string(), z.any())).optional(),
  // Content Types only — Single Types have no grouping concept anywhere in
  // SaCMS (ContentTypeGroup has no relation to SingleType), so this is
  // simply ignored by materialize/serialize for a singleType/component
  // model. References `groups[].slug` below, NOT a real database id —
  // templates are plain JSON with no group rows of their own yet.
  group: z.string().optional(),
})

// A template has no real ContentTypeGroup rows (those only exist once
// materialized into a real tenant) — `slug` is a synthetic, template-local
// key each contentTypes[] entry's `group` field references, and
// `parentSlug` nests groups the same way `parentId` does on the real
// model (3 levels max, enforced at materialize time by the same
// content-type-group-service.ts the dashboard dialog and the per-workspace
// MCP server's group tools use). List parents before their children.
export const schemaTemplateGroupSchema = z.object({
  slug: modelSlugSchema,
  name: z.string(),
  parentSlug: z.string().optional(),
})

export const schemaTemplateBundleSchema = z.object({
  groups: z.array(schemaTemplateGroupSchema).default([]),
  contentTypes: z.array(schemaTemplateModelSchema).default([]),
  singleTypes: z.array(schemaTemplateModelSchema).default([]),
  components: z.array(schemaTemplateModelSchema).default([]),
})

export const createSchemaTemplateSchema = z.object({
  name: z.string().trim().min(1, "Nama template wajib diisi").max(150),
  category: z.string().trim().min(1, "Kategori wajib diisi").max(100),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  schema: schemaTemplateBundleSchema,
})
