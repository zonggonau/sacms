import type { z } from "zod"
import { loadDefaultTenantSchema } from "./default-tenant-schema"
import { SITE_SETTINGS_SCHEMA } from "./site-settings"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"
import type { ValidationIssue } from "@/lib/schema-template-validation"

type Bundle = z.infer<typeof schemaTemplateBundleSchema>

const STARTER_PAGE = {
  name: "Halaman",
  slug: "pages",
  description: "Halaman publik dengan slug dan konten yang dapat dikelola dari CMS.",
  fields: [
    { name: "Judul", slug: "title", type: "text", required: true },
    { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
    { name: "Konten", slug: "content", type: "richText", required: true },
    { name: "SEO", slug: "seo", type: "seo" },
  ],
}

function mergeBySlug<T extends { slug: string }>(defaults: T[], additions: T[]) {
  const result = [...defaults]
  const defaultPositions = new Map(defaults.map(({ slug }, index) => [slug, index]))
  for (const addition of additions) {
    const index = defaultPositions.get(addition.slug)
    if (index === undefined) result.push(addition)
    else {
      result[index] = addition
      defaultPositions.delete(addition.slug)
    }
  }
  return result
}

export async function composeTemplateStarterSchema(additions: Bundle, excluded: string[]) {
  const { schema, templateSlug } = await loadDefaultTenantSchema()
  const parsed = schemaTemplateBundleSchema.safeParse(schema)
  if (!parsed.success) return parsed

  const starter = parsed.data
  const contentTypes = starter.contentTypes.slice()
  if (templateSlug === "default-starter-schema" && !contentTypes.some(({ slug }) => slug === "pages" || slug === "halaman")) {
    contentTypes.push(STARTER_PAGE)
  }
  const defaultSlugs = new Set(contentTypes.map(({ slug }) => slug))
  const excludedSlugs = new Set(excluded)
  const issues = excluded.flatMap((slug, index) => defaultSlugs.has(slug)
    ? []
    : [{ path: `excludeDefaultContentTypes[${index}]`, message: `'${slug}' is not a starter Content Type.` }])
  const conflicting = additions.contentTypes.filter(({ slug }) => excludedSlugs.has(slug))
  for (const { slug } of conflicting) {
    issues.push({ path: "excludeDefaultContentTypes", message: `'${slug}' is also defined in schema.contentTypes. Either keep it or exclude it.` })
  }

  return {
    success: true as const,
    issues,
    data: {
      groups: mergeBySlug(starter.groups, additions.groups),
      contentTypes: mergeBySlug(contentTypes.filter(({ slug }) => !excludedSlugs.has(slug)), additions.contentTypes),
      singleTypes: mergeBySlug(mergeBySlug<Bundle["singleTypes"][number]>([SITE_SETTINGS_SCHEMA], starter.singleTypes), additions.singleTypes),
      components: mergeBySlug(starter.components, additions.components),
    },
  }
}

/** A template may drop Content Types, while Single Types and Components
 * that already belong to it must keep their model slugs. */
export function protectedSchemaModelIssues(previous: unknown, next: Bundle): ValidationIssue[] {
  if (!previous || typeof previous !== "object") return []
  const prior = previous as Partial<Bundle>
  return (["singleTypes", "components"] as const).flatMap((kind) => {
    const retained = new Set(next[kind].map(({ slug }) => slug))
    return (Array.isArray(prior[kind]) ? prior[kind] : []).flatMap((model) =>
      model?.slug && !retained.has(model.slug)
        ? [{ path: `schema.${kind}`, message: `Keep '${model.slug}' in ${kind}. Only Content Types may be removed.` }]
        : [],
    )
  })
}
