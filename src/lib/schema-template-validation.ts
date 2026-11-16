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

import { FIELD_TYPES } from "@/lib/field-types"
import { generateContentSchema } from "@/lib/content-validations"

/** The 36 real field-type slugs — schemaTemplateFieldSchema's own `type` is
 *  a bare `z.string()` (needed since this bundle shape is reused for
 *  singleTypes/components, which have their own type rules elsewhere), so
 *  a typo'd/fictional type (e.g. "nonsense") passes zod untouched. Checked
 *  here instead, against the SAME list list_field_types documents. */
const VALID_FIELD_TYPES: Set<string> = new Set(FIELD_TYPES.map((t) => t.type))

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
  name?: string
  required?: boolean
  relationSlug?: string
  options?: { targetModel?: string; componentSlug?: string; allowedComponents?: string[]; choices?: unknown[] } | null
}
export interface BundleModelRef {
  slug: string
  fields?: BundleFieldRef[]
  /** Content Types only — a synthetic, template-local key into `bundle.groups[].slug` (see schema-template.ts's own doc comment). Ignored for singleTypes/components. */
  group?: string
  /** Sample rows shown in the dashboard/MCP catalog — validated against the SAME per-type value rules real content creation uses (see checkDummyData below). */
  dummyData?: Record<string, unknown>[]
}
export interface BundleGroupRef {
  slug: string
  parentSlug?: string
}
export interface SchemaBundleRef {
  groups?: BundleGroupRef[]
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
  const groupSlugs = new Set((bundle.groups || []).map((g) => g.slug))

  // chatgpt8.md P1: a typo'd contentTypes[].group or groups[].parentSlug
  // used to be silently dropped at materialize time (schema-template-sync.ts
  // resolves an unknown slug to `null`/top-level instead of erroring) —
  // the content type just ends up ungrouped with no feedback anywhere.
  ;(bundle.groups || []).forEach((g, i) => {
    if (g.parentSlug && !groupSlugs.has(g.parentSlug)) {
      issues.push({ path: `groups[${i}].parentSlug`, message: `parentSlug '${g.parentSlug}' does not match any groups[].slug in this bundle.` })
    }
  })
  ;(bundle.contentTypes || []).forEach((ct, i) => {
    if (ct.group && !groupSlugs.has(ct.group)) {
      issues.push({ path: `contentTypes[${i}].group`, message: `group '${ct.group}' does not match any groups[].slug in this bundle.` })
    }
  })

  const checkFields = (fields: BundleFieldRef[] | undefined, basePath: string) => {
    (fields || []).forEach((f, idx) => {
      const fieldPath = `${basePath}.fields[${idx}]`
      if (f.type && !VALID_FIELD_TYPES.has(f.type)) {
        issues.push({ path: `${fieldPath}.type`, message: `'${f.type}' is not a real field type. Call list_field_types for the official list of 36 types — a typo'd/fictional type has no renderer anywhere and silently falls back to accepting any value.` })
      }
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

  ;(bundle.contentTypes || []).forEach((ct, i) => checkDummyData(ct, `contentTypes[${i}]`, issues))
  ;(bundle.singleTypes || []).forEach((st, i) => checkDummyData(st, `singleTypes[${i}]`, issues))
  ;(bundle.components || []).forEach((c, i) => checkDummyData(c, `components[${i}]`, issues))

  return issues
}

/**
 * Runs each dummyData row through the SAME per-field-type zod validator
 * real content creation uses (generateContentSchema, entry-service.ts's
 * createContentEntry) — so a value that would genuinely be rejected at
 * import time (a select value outside its own options.choices, an invalid
 * email, a number field that can't be coerced) is flagged here too, not
 * silently accepted. Deliberately `enforceRequired: false`: dummyData is
 * illustrative sample data, not a real entry, so a field being OMITTED is
 * not itself an issue — only a VALUE that's actually present and invalid
 * for its type is. (A scalar coerced into a text field, e.g. a number
 * where the sample meant a string, is likewise NOT flagged — that's
 * exactly what real content creation does too: text fields coerce any
 * scalar via String(val), by design, so flagging it here would disagree
 * with what actually happens on import.)
 */
function checkDummyData(model: BundleModelRef, basePath: string, issues: ValidationIssue[]): void {
  if (!model.dummyData || model.dummyData.length === 0) return
  const fields = (model.fields || [])
    .filter((f): f is BundleFieldRef & { slug: string; type: string } => !!f.slug && !!f.type)
    .map((f) => ({ slug: f.slug, name: f.name || f.slug, type: f.type, required: false, options: f.options }))
  if (fields.length === 0) return

  const schema = generateContentSchema(fields, { enforceRequired: false })
  model.dummyData.forEach((entry, i) => {
    const result = schema.safeParse(entry)
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        issues.push({ path: `${basePath}.dummyData[${i}]${issue.path.length ? `.${issue.path.join(".")}` : ""}`, message: issue.message })
      })
    }
  })
}
