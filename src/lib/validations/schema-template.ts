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
})

export const schemaTemplateModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  fields: z.array(schemaTemplateFieldSchema),
  dummyData: z.array(z.record(z.string(), z.any())).optional(),
})

export const schemaTemplateBundleSchema = z.object({
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
