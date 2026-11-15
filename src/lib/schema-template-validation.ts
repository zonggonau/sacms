/**
 * Shared validation helpers for the SaCMS Global Schema Template MCP
 * server's create/update tools (schema templates AND website templates,
 * which embed the same bundle shape). Pure and DB-free — extracted out of
 * the route file specifically so this logic gets real behavioral tests
 * instead of only source-text contract checks (the route file's own
 * established convention, necessary there because its tools register
 * lazily through the MCP SDK — see that test file's header comment — but
 * unnecessary for plain functions with no such registration to intercept).
 */

/** `["contentTypes", 2, "fields", 4, "options", "choices"]` -> "contentTypes[2].fields[4].options.choices" — the exact bracket-index form an agent needs to locate the offending field itself, not just a flattened message. */
export function formatZodPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === "number") return `${acc}[${seg}]`
    return acc ? `${acc}.${String(seg)}` : String(seg)
  }, "")
}

export interface ValidationIssue {
  path: string
  message: string
}

/** A bundle-shaped field, loose enough to cover contentTypes/singleTypes/components entries without importing the full generated zod-inferred type here. */
export interface BundleFieldRef {
  type?: string
  slug?: string
  relationSlug?: string
  options?: { targetModel?: string; componentSlug?: string; allowedComponents?: string[]; choices?: unknown[] } | null
}
export interface BundleModelRef {
  slug: string
  fields?: BundleFieldRef[]
}
export interface SchemaBundleRef {
  contentTypes?: BundleModelRef[]
  singleTypes?: BundleModelRef[]
  components?: BundleModelRef[]
}

/**
 * Cross-reference checks a zod shape check alone can't catch: a
 * relation/component/repeater field pointing at a model or component
 * slug that doesn't actually exist anywhere else IN THIS SAME BUNDLE, and
 * a select/multiselect with no (or an empty) options.choices — silently
 * unusable at render/content-entry time either way. Pure, no DB access —
 * every slug it needs is already right there in the bundle being
 * validated. Returns bracket-indexed paths like
 * "contentTypes[2].fields[4].options.choices".
 */
export function validateBundleReferences(bundle: SchemaBundleRef): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const modelSlugs = new Set([
    ...(bundle.contentTypes || []).map((m) => m.slug),
    ...(bundle.singleTypes || []).map((m) => m.slug),
  ])
  const componentSlugs = new Set((bundle.components || []).map((c) => c.slug))

  const checkFields = (fields: BundleFieldRef[] | undefined, basePath: string) => {
    (fields || []).forEach((f, idx) => {
      const fieldPath = `${basePath}.fields[${idx}]`
      if (f.type === "relation") {
        const targetModel = f.options?.targetModel
        // "member" relates to the tenant's own end-user table, which
        // never appears in a template bundle's own contentTypes/
        // singleTypes — not something to check membership for.
        if (targetModel !== "member" && f.relationSlug && !modelSlugs.has(f.relationSlug)) {
          issues.push({ path: `${fieldPath}.relationSlug`, message: `relationSlug '${f.relationSlug}' does not match any contentTypes/singleTypes slug in this bundle.` })
        }
      }
      if (f.type === "component") {
        const slug = f.options?.componentSlug
        if (slug && !componentSlugs.has(slug)) {
          issues.push({ path: `${fieldPath}.options.componentSlug`, message: `options.componentSlug '${slug}' does not match any components[] slug in this bundle.` })
        }
      }
      if (f.type === "repeater" && Array.isArray(f.options?.allowedComponents)) {
        f.options!.allowedComponents!.forEach((slug, i) => {
          if (!componentSlugs.has(slug)) {
            issues.push({ path: `${fieldPath}.options.allowedComponents[${i}]`, message: `allowedComponents '${slug}' does not match any components[] slug in this bundle.` })
          }
        })
      }
      if (f.type === "select" || f.type === "multiselect") {
        const choices = f.options?.choices
        if (!Array.isArray(choices) || choices.length === 0) {
          issues.push({ path: `${fieldPath}.options.choices`, message: `${f.type} fields need a non-empty options.choices array — without it, every value is rejected at content-entry time.` })
        }
      }
    })
  }

  ;(bundle.contentTypes || []).forEach((ct, i) => checkFields(ct.fields, `contentTypes[${i}]`))
  ;(bundle.singleTypes || []).forEach((st, i) => checkFields(st.fields, `singleTypes[${i}]`))
  ;(bundle.components || []).forEach((c, i) => checkFields(c.fields, `components[${i}]`))

  return issues
}
