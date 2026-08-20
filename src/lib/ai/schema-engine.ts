/**
 * SaCMS AI Schema Engine & Diff Planner
 *
 * Provides Zod validation for structured AI schema output and
 * calculates non-destructive Schema Diffs (CREATE, UPDATE, SKIP, CONFLICT).
 */

import { z } from "zod"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"

// ── 1. Zod Definitions ────────────────────────────────────────────────────────

export const FieldDefinitionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum([
    "text",
    "textarea",
    "richText",
    "markdown",
    "slug",
    "number",
    "currency",
    "date",
    "datetime",
    "time",
    "dateRange",
    "select",
    "multiselect",
    "tags",
    "boolean",
    "email",
    "password",
    "url",
    "phone",
    "uid",
    "media",
    "mediaMultiple",
    "file",
    "relation",
    "component",
    "repeater",
    "json",
    "color",
    "rating",
    "button",
    "document_template",
  ]),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  relationSlug: z.string().optional(),
  componentSlug: z.string().optional(),
  options: z.any().optional(),
})

export const ContentTypePlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FieldDefinitionSchema),
  mockEntries: z.array(z.record(z.any())).optional(),
})

export const SingleTypePlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FieldDefinitionSchema),
  initialData: z.record(z.any()).optional(),
})

export const ComponentPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().default("default"),
  description: z.string().optional(),
  fields: z.array(FieldDefinitionSchema),
})

export const SchemaPlanSchema = z.object({
  summary: z.string(),
  contentTypes: z.array(ContentTypePlanSchema).default([]),
  singleTypes: z.array(SingleTypePlanSchema).default([]),
  components: z.array(ComponentPlanSchema).default([]),
})

export const WebsitePlanSchema = z.object({
  siteName: z.string(),
  description: z.string(),
  theme: z.object({
    style: z.enum(["modern", "luxury", "minimal", "playful", "corporate"]).default("modern"),
    primaryColor: z.string().default("#6366f1"),
    darkMode: z.boolean().default(true),
  }),
  pages: z.array(
    z.object({
      route: z.string(),
      name: z.string(),
      description: z.string(),
      dataSources: z.array(z.string()).default([]),
    })
  ),
})

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>
export type ContentTypePlan = z.infer<typeof ContentTypePlanSchema>
export type SingleTypePlan = z.infer<typeof SingleTypePlanSchema>
export type ComponentPlan = z.infer<typeof ComponentPlanSchema>
export type SchemaPlan = z.infer<typeof SchemaPlanSchema>
export type WebsitePlan = z.infer<typeof WebsitePlanSchema>

export interface SchemaDiff {
  creates: {
    type: "contentType" | "singleType" | "component"
    name: string
    slug: string
    fieldsCount: number
  }[]
  updates: {
    type: "contentType" | "singleType" | "component"
    name: string
    slug: string
    newFields: string[]
  }[]
  skips: {
    type: "contentType" | "singleType" | "component"
    slug: string
    reason: string
  }[]
  conflicts: {
    slug: string
    reason: string
  }[]
}

// ── 2. Schema Diff Computation ────────────────────────────────────────────────

export function computeSchemaDiff(
  currentSchema: {
    contentTypes: Array<{ slug: string; name: string; fields: any[] }>
    singleTypes: Array<{ slug: string; name: string; fields: any[] }>
    components: Array<{ slug: string; name: string; fields: any[] }>
  },
  plan: SchemaPlan
): SchemaDiff {
  const diff: SchemaDiff = {
    creates: [],
    updates: [],
    skips: [],
    conflicts: [],
  }

  // 1. Content Types Diff
  for (const ct of plan.contentTypes) {
    const existing = currentSchema.contentTypes.find((c) => c.slug === ct.slug)
    if (!existing) {
      diff.creates.push({
        type: "contentType",
        name: ct.name,
        slug: ct.slug,
        fieldsCount: ct.fields.length,
      })
    } else {
      const existingFieldSlugs = new Set(existing.fields.map((f) => f.slug))
      const newFields = ct.fields.filter((f) => !existingFieldSlugs.has(f.slug)).map((f) => f.slug)
      if (newFields.length > 0) {
        diff.updates.push({
          type: "contentType",
          name: ct.name,
          slug: ct.slug,
          newFields,
        })
      } else {
        diff.skips.push({
          type: "contentType",
          slug: ct.slug,
          reason: "Semua field sudah ada",
        })
      }
    }
  }

  // 2. Single Types Diff
  for (const st of plan.singleTypes) {
    const existing = currentSchema.singleTypes.find((s) => s.slug === st.slug)
    if (!existing) {
      diff.creates.push({
        type: "singleType",
        name: st.name,
        slug: st.slug,
        fieldsCount: st.fields.length,
      })
    } else {
      diff.skips.push({
        type: "singleType",
        slug: st.slug,
        reason: "Single type sudah ada",
      })
    }
  }

  // 3. Components Diff
  for (const comp of plan.components) {
    const existing = currentSchema.components.find((c) => c.slug === comp.slug)
    if (!existing) {
      diff.creates.push({
        type: "component",
        name: comp.name,
        slug: comp.slug,
        fieldsCount: comp.fields.length,
      })
    } else {
      diff.skips.push({
        type: "component",
        slug: comp.slug,
        reason: "Komponen sudah ada",
      })
    }
  }

  return diff
}

// ── 3. Apply Schema Plan via In-Process MCP Bridge ────────────────────────────

export async function applySchemaPlan(
  bridge: McpClientBridge,
  plan: SchemaPlan,
  onStep?: (msg: string) => void
) {
  const results = {
    createdContentTypes: [] as string[],
    createdSingleTypes: [] as string[],
    createdComponents: [] as string[],
    populatedEntries: 0,
    errors: [] as string[],
  }

  // 1. Create Components
  for (const comp of plan.components) {
    onStep?.(`Membuat komponen SaCMS: ${comp.name} (${comp.slug})...`)
    const res = await bridge.createComponent(comp)
    if (res.success) {
      results.createdComponents.push(comp.slug)
    } else if (res.error && !res.error.includes("already exists")) {
      results.errors.push(res.error)
    }
  }

  // 2. Create Single Types
  for (const st of plan.singleTypes) {
    onStep?.(`Membuat tipe tunggal SaCMS: ${st.name} (${st.slug})...`)
    const res = await bridge.createSingleType(st)
    if (res.success) {
      results.createdSingleTypes.push(st.slug)
    } else if (res.error && !res.error.includes("already exists")) {
      results.errors.push(res.error)
    }
  }

  // 3. Create Content Types
  for (const ct of plan.contentTypes) {
    onStep?.(`Membuat tipe koleksi SaCMS: ${ct.name} (${ct.slug})...`)
    const res = await bridge.createContentType(ct)
    if (res.success) {
      results.createdContentTypes.push(ct.slug)

      // Populate mock entries if provided
      if (ct.mockEntries && ct.mockEntries.length > 0) {
        onStep?.(`Mengisi ${ct.mockEntries.length} entri awal untuk ${ct.name}...`)
        for (const data of ct.mockEntries) {
          try {
            await bridge.createContentEntry({
              contentTypeSlug: ct.slug,
              data,
              status: "PUBLISHED",
            })
            results.populatedEntries++
          } catch (e: any) {
            console.error(`Mock entry error for ${ct.slug}:`, e.message)
          }
        }
      }
    } else if (res.error && !res.error.includes("already exists")) {
      results.errors.push(res.error)
    }
  }

  return results
}
