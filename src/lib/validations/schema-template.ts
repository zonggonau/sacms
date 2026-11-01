import { z } from "zod/v4"

/**
 * Shared shape for a Schema Template's `schema` JSON blob (prisma/schema.prisma
 * SchemaTemplate.schema) — a bundle of Content Type / Single Type / Component
 * model definitions, the same field shape get_full_schema returns for a real
 * workspace. Used by both the dashboard REST route
 * (src/app/api/tenant/[tenant]/schema-templates/route.ts) and the SaCMS
 * Global "Schema Template" MCP server (src/app/api/mcp/global-schema), so
 * the validation rules only live in one place.
 */

export const schemaTemplateFieldSchema = z.object({
  name: z.string(),
  slug: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  relationSlug: z.string().optional(),
  componentSlug: z.string().optional(),
  // Generic per-type extras — the field this whole module was missing:
  // `select`/`multiselect` need { choices: [{label, value}, ...] } to be
  // anything but a plain text input once materialized into a real
  // ContentType/SingleType/Component (see schema-template-sync.ts). Also
  // carries other field-specific extras (e.g. currency's currencyCode),
  // same generic bag SchemaField.options already uses everywhere else.
  options: z.record(z.string(), z.any()).optional(),
})

export const schemaTemplateModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
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
  slug: z.string(),
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
