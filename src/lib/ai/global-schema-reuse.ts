/**
 * Reuse of the SaCMS Global schema by the AI Schema Generator.
 *
 * The Global workspace ships default Components and Single Types (e.g. a
 * shared nav link, social link, Site Settings). Before generating, the AI
 * is shown what exists so it can reuse those instead of inventing duplicates.
 * After generation, anything the new schema references (componentSlug,
 * relationSlug, allowedComponents) that the schema does not define itself is
 * copied in from the catalog, so the saved bundle is complete and
 * materialize does not fail on a missing target.
 *
 * Pure: no database access. The loader lives in global-schema-catalog.ts.
 */

export interface CatalogField {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string | null
  componentSlug?: string | null
  options?: Record<string, unknown> | null
}

export interface CatalogModel {
  name: string
  slug: string
  description?: string | null
  fields: CatalogField[]
  group?: string
}

export interface GlobalSchemaCatalog {
  contentTypes: CatalogModel[]
  singleTypes: CatalogModel[]
  components: CatalogModel[]
}

export const EMPTY_GLOBAL_CATALOG: GlobalSchemaCatalog = { contentTypes: [], singleTypes: [], components: [] }

/** Single Types the generator always wants present. Each is copied from Global when the model leaves it (and its aliases) out. */
export const CORE_SINGLE_TYPE_ALIASES: Record<string, string[]> = {
  "site-settings": ["site-settings", "global-settings", "settings", "site-config"],
  homepage: ["homepage", "home-page", "home", "landing-page", "landing"],
}

type Bucket = "contentTypes" | "singleTypes" | "components"

function componentTargetOf(field: CatalogField): string | null {
  return field.componentSlug ?? (field.options?.componentSlug as string | undefined) ?? null
}

function allowedComponentsOf(field: CatalogField): string[] {
  const list = field.options?.allowedComponents
  return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : []
}

/**
 * Compact, prompt-sized description of the Global catalog. Lists each model
 * with its field slugs and types, marking relation and component targets, so
 * the model can reference them by slug. Capped so a large Global schema
 * cannot blow up the prompt.
 */
export function summarizeGlobalCatalog(catalog: GlobalSchemaCatalog, maxModels = 60, maxChars = 6000): string {
  const total = catalog.contentTypes.length + catalog.singleTypes.length + catalog.components.length
  if (total === 0) return ""

  const describeFields = (fields: CatalogField[]) =>
    fields
      .map((f) => {
        const target = f.type === "relation" && f.relationSlug ? `->${f.relationSlug}` : ""
        const comp = f.type === "component" || f.type === "repeater" ? `->${componentTargetOf(f) ?? allowedComponentsOf(f).join("|")}` : ""
        return `${f.slug}:${f.type}${target}${comp}`
      })
      .join(", ")

  const sections: string[] = []
  let used = 0
  let shown = 0
  const add = (title: string, models: CatalogModel[]) => {
    if (models.length === 0) return
    sections.push(`${title}:`)
    used += title.length + 2
    for (const m of models) {
      if (shown >= maxModels) break
      const line = `- ${m.slug} (${m.name})${m.fields.length ? `: ${describeFields(m.fields)}` : ""}`
      if (used + line.length > maxChars) break
      sections.push(line)
      used += line.length + 1
      shown++
    }
  }
  add("Komponen", catalog.components)
  add("Single Type", catalog.singleTypes)
  add("Content Type", catalog.contentTypes)

  const omitted = total - shown
  if (omitted > 0) sections.push(`(${omitted} lagi tidak ditampilkan)`)
  return sections.join("\n")
}

function refsOf(model: { fields?: CatalogField[] }): Array<{ kind: "model" | "component"; slug: string }> {
  const refs: Array<{ kind: "model" | "component"; slug: string }> = []
  for (const f of model.fields ?? []) {
    if (f.relationSlug) refs.push({ kind: "model", slug: f.relationSlug })
    const comp = componentTargetOf(f)
    if (comp) refs.push({ kind: "component", slug: comp })
    for (const s of allowedComponentsOf(f)) refs.push({ kind: "component", slug: s })
  }
  return refs
}

function withoutGroup<T extends CatalogModel>(model: T): T {
  // A copied Content Type's group would need its own group entry in the bundle.
  // Copies land ungrouped; the user can file them into a group afterwards.
  const { group: _group, ...rest } = model as T & { group?: string }
  return rest as T
}

/**
 * Returns the generated schema with every referenced Global model added when
 * the generated schema does not define it. Core Single Types (site-settings,
 * homepage) are added from Global when missing, so the generator's own blank
 * fallback is only used when Global has none either. Existing definitions in
 * the generated schema always win.
 */
export function attachGlobalReferences<T extends { contentTypes: any[]; singleTypes: any[]; components: any[] }>(
  schema: T,
  catalog: GlobalSchemaCatalog,
): T {
  const out: Record<Bucket, CatalogModel[]> = {
    contentTypes: [...(schema.contentTypes as CatalogModel[])],
    singleTypes: [...(schema.singleTypes as CatalogModel[])],
    components: [...(schema.components as CatalogModel[])],
  }
  const presentIn = (bucket: Bucket, slug: string) => out[bucket].some((m) => m.slug === slug)
  const presentAnywhere = (slug: string) =>
    presentIn("contentTypes", slug) || presentIn("singleTypes", slug)

  const queue: Array<{ kind: "model" | "component"; slug: string }> = []
  for (const bucket of ["contentTypes", "singleTypes", "components"] as Bucket[]) {
    for (const m of out[bucket]) queue.push(...refsOf(m))
  }
  // Core Single Types: copy from Global only when neither the slug nor any alias is already defined.
  for (const [core, aliases] of Object.entries(CORE_SINGLE_TYPE_ALIASES)) {
    if (out.singleTypes.some((m) => aliases.includes(m.slug))) continue
    if (presentAnywhere(core)) continue
    const found = catalog.singleTypes.find((m) => m.slug === core)
    if (found) {
      out.singleTypes.push(withoutGroup(found))
      queue.push(...refsOf(found))
    }
  }

  while (queue.length > 0) {
    const ref = queue.shift()!
    if (ref.kind === "component") {
      if (presentIn("components", ref.slug)) continue
      const found = catalog.components.find((m) => m.slug === ref.slug)
      if (!found) continue
      out.components.push(withoutGroup(found))
      queue.push(...refsOf(found))
    } else {
      if (presentAnywhere(ref.slug)) continue
      const inTypes = catalog.contentTypes.find((m) => m.slug === ref.slug)
      const inSingles = catalog.singleTypes.find((m) => m.slug === ref.slug)
      if (inTypes) {
        out.contentTypes.push(withoutGroup(inTypes))
        queue.push(...refsOf(inTypes))
      } else if (inSingles) {
        out.singleTypes.push(withoutGroup(inSingles))
        queue.push(...refsOf(inSingles))
      }
    }
  }

  return { ...schema, ...out }
}
