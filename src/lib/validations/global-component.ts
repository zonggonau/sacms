import { z } from "zod/v4"
import { schemaTemplateFieldSchema } from "./schema-template"

/**
 * Shared shape for a GlobalComponent (prisma/schema.prisma GlobalComponent)
 * — a reusable CMS schema field definition (the same shape as one entry
 * in a SchemaTemplate bundle's `components[]`), built via the SaCMS
 * Global "Schema Template" MCP server and, once published, readable by
 * every workspace's own MCP server. Deliberately schema-only, no frontend
 * code bundle — a workspace that wants to use one calls get_global_component
 * for its `fields`, then create_component with that same array to
 * materialize a real Component in its own schema.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export const globalComponentFieldsSchema = z.array(schemaTemplateFieldSchema).min(1).max(100)

export const createGlobalComponentSchema = z.object({
  name: z.string().trim().min(1, "Nama komponen wajib diisi").max(150),
  slug: z.string().trim().toLowerCase().max(150).refine(
    (s) => SLUG_RE.test(s),
    { message: "slug must be lowercase alphanumeric with hyphens only (e.g. 'testimonial-card')." },
  ).optional(),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(50).optional(),
  fields: globalComponentFieldsSchema,
  published: z.boolean().optional(),
})

export const updateGlobalComponentSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(50).optional(),
  fields: globalComponentFieldsSchema.optional(),
  published: z.boolean().optional(),
})
