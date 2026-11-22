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
 *  deliberately a bare z.string() (see that file's own header comment: the
 *  MCP SDK validates a tool's full inputSchema, including this nested
 *  shape, BEFORE the handler runs, so a zod-level z.enum here would reject
 *  with the SDK's own generic error instead of this function's nicer one).
 *  Checked here instead, against the SAME list list_field_types documents. */
export const VALID_FIELD_TYPES: Set<string> = new Set(FIELD_TYPES.map((t) => t.type))

/** Field slugs are JSON property names. Existing CMS fields use kebab-case
 * as well as camelCase and snake_case. Document template keys are verbatim. */
export const FIELD_SLUG_FORMAT_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

/** Same slug format the dashboard's own Content Type/Single Type/Component
 *  creation routes enforce (src/lib/validations/admin.ts) — schema-
 *  template-sync.ts's materialize step writes a model's `slug` straight
 *  into the real ContentType/SingleType/Component row with NO format check
 *  of its own, so a template with "My Article!"/spaces/uppercase silently
 *  materializes a slug no real route would ever let a human create. Kept
 *  as a plain z.string() at the schema layer for the same SDK-pre-handler
 *  reason as VALID_FIELD_TYPES above — enforced here instead. */
const MODEL_SLUG_FORMAT_RE = /^[a-z0-9][a-z0-9-]*$/

/** A dummyData color/date value is allowed to be loose at real content-entry
 *  time (a human typing into a form benefits from forgiving coercion) —
 *  but a demo's entire point is to look like real, finished content, so
 *  these two are checked stricter here specifically. */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const TITLE_LIKE_SLUGS = new Set(["title", "judul", "name"])

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
  /** Absent/"error" blocks a save; "warning" is surfaced to the caller
   *  (dry-run's own `warnings` array, or appended to a real save's text
   *  response) but never blocks it — e.g. a forgiving default that's
   *  probably not what the author meant, vs. something that would
   *  genuinely break at materialize/render/content-entry time. */
  severity?: "error" | "warning"
}

/** Partitions a validateBundleReferences() result into what must block a
 *  save vs. what's advisory-only — every caller in route.ts uses this
 *  instead of treating the flat array as uniformly blocking. */
export function splitIssuesBySeverity(issues: ValidationIssue[]): { blocking: ValidationIssue[]; warnings: ValidationIssue[] } {
  const blocking: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  for (const issue of issues) {
    if (issue.severity === "warning") warnings.push(issue)
    else blocking.push(issue)
  }
  return { blocking, warnings }
}

/** A bundle-shaped field, loose enough to cover contentTypes/singleTypes/components entries without importing the full generated zod-inferred type here. */
export interface BundleFieldRef {
  type?: string
  slug?: string
  name?: string
  required?: boolean
  relationSlug?: string
  options?: { targetModel?: string; componentSlug?: string; allowedComponents?: string[]; componentSlugs?: unknown; choices?: unknown[]; sourceField?: string } | null
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

/** Report P1 (gap #1): each of contentTypes/singleTypes/components backs
 *  its own real DB table with a `@@unique([tenantId, slug])` constraint
 *  (ContentType/SingleType/Component) — two entries sharing a slug within
 *  the SAME array pass zod/the reference checks fine today and only fail
 *  much later, as a raw Prisma P2002 thrown mid-materialize on a real
 *  tenant. Also used for `groups`, which has no DB table of its own yet
 *  but would still resolve two same-slug groups to the same parent/child
 *  ambiguously. */
function checkDuplicateSlugs(models: { slug: string }[] | undefined, basePath: string, issues: ValidationIssue[]): void {
  const seen = new Map<string, number>()
  ;(models || []).forEach((m, i) => {
    const firstIndex = seen.get(m.slug)
    if (firstIndex !== undefined) {
      issues.push({ path: `${basePath}[${i}].slug`, message: `Duplicate slug '${m.slug}' — already used by ${basePath}[${firstIndex}]. Each ${basePath} entry needs its own unique slug.` })
    } else {
      seen.set(m.slug, i)
    }
  })
}

/** Third/fourth external audit, VAL-8: a model/group slug materializes
 *  straight into a real ContentType/SingleType/Component row with no
 *  format check of its own elsewhere (see MODEL_SLUG_FORMAT_RE's own
 *  comment) — checked here, not at the zod schema layer (ERR-4: would
 *  otherwise be rejected by the MCP SDK's own pre-handler validation with
 *  a generic error, bypassing this function's nicer one entirely). */
function checkSlugFormat(models: { slug: string }[] | undefined, basePath: string, issues: ValidationIssue[]): void {
  ;(models || []).forEach((m, i) => {
    if (m.slug && !MODEL_SLUG_FORMAT_RE.test(m.slug)) {
      issues.push({ path: `${basePath}[${i}].slug`, message: `'${m.slug}' is not a valid slug — use lowercase letters/digits/dashes, starting with a letter or digit (e.g. 'blog-post').` })
    }
  })
}

/**
 * Cross-reference checks a zod shape check alone can't catch: a
 * relation/component/repeater field pointing at a model or component
 * slug that doesn't actually exist anywhere else IN THIS SAME BUNDLE, a
 * select/multiselect with no (or an empty) options.choices, and duplicate
 * slugs that would only otherwise surface as a raw DB error at materialize
 * time — silently unusable at render/content-entry/materialize time
 * either way. Pure, no DB access — every slug it needs is already right
 * there in the bundle being validated. Returns bracket-indexed paths like
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

  checkDuplicateSlugs(bundle.contentTypes, "contentTypes", issues)
  checkDuplicateSlugs(bundle.singleTypes, "singleTypes", issues)
  checkDuplicateSlugs(bundle.components, "components", issues)
  checkDuplicateSlugs(bundle.groups, "groups", issues)

  checkSlugFormat(bundle.contentTypes, "contentTypes", issues)
  checkSlugFormat(bundle.singleTypes, "singleTypes", issues)
  checkSlugFormat(bundle.components, "components", issues)
  checkSlugFormat(bundle.groups, "groups", issues)

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
    const seenFieldSlugs = new Map<string, number>()
    ;(fields || []).forEach((f, idx) => {
      const fieldPath = `${basePath}.fields[${idx}]`
      // Backs a real `@@unique([contentTypeId, slug])`-style constraint
      // (per-model, same rationale as checkDuplicateSlugs above).
      if (f.slug) {
        const firstIndex = seenFieldSlugs.get(f.slug)
        if (firstIndex !== undefined) {
          issues.push({ path: `${fieldPath}.slug`, message: `Duplicate field slug '${f.slug}' within ${basePath} — already used by fields[${firstIndex}]. Field slugs must be unique within the same model.` })
        } else {
          seenFieldSlugs.set(f.slug, idx)
        }
      }
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
      if (f.type === "repeater") {
        if (Array.isArray(f.options?.allowedComponents)) {
          f.options!.allowedComponents!.forEach((slug, i) => {
            if (!componentSlugs.has(slug)) {
              issues.push({ path: `${fieldPath}.options.allowedComponents[${i}]`, message: `allowedComponents '${slug}' does not match any components[] slug in this bundle.` })
            }
          })
        } else if (f.options?.componentSlugs !== undefined) {
          // Report P1 (gap #4): this exact typo is called out by name in
          // list_field_types' own `note` for 'repeater' (an earlier version
          // of this guide documented the wrong key) — but until now nothing
          // actually checked for it, so writing componentSlugs instead of
          // allowedComponents silently fell all the way through to render
          // time as "every component is allowed" with zero feedback here.
          // Warning, not blocking: "every component allowed" is still a
          // VALID, working state — just probably not what was intended.
          issues.push({ path: `${fieldPath}.options.componentSlugs`, message: `'componentSlugs' is not a real option key for 'repeater' — the renderer reads 'allowedComponents' instead. Rename it, or this field silently allows every component regardless of what you listed here.`, severity: "warning" })
        }
      }
      // Third external audit, VAL-9: field slugs are the Content API's own
      // JSON keys — a space/punctuation/leading-digit would be a genuinely
      // broken property name in every frontend fetch. camelCase/snake_case
      // are both fine (unlike MODEL slugs, which materialize straight into
      // a URL path and so stay kebab-case-only). document_template is
      // exempt: its field slugs deliberately mirror a .docx's own
      // placeholder keys verbatim (see ai-schema-generator.ts's own
      // documented exception), which can't be forced into this shape.
      if (f.type !== "document_template" && f.slug && !FIELD_SLUG_FORMAT_RE.test(f.slug)) {
        issues.push({ path: `${fieldPath}.slug`, message: `'${f.slug}' is not a valid field slug — start with a letter and use letters, digits, hyphens, or underscores (e.g. 'cover-image').` })
      }
      if (f.type === "select" || f.type === "multiselect") {
        const choices = f.options?.choices
        if (!Array.isArray(choices) || choices.length === 0) {
          issues.push({ path: `${fieldPath}.options.choices`, message: `${f.type} fields need a non-empty options.choices array — without it, every value is rejected at content-entry time.` })
        }
      }
    })

    // Third external audit, VAL-7: slug.ts's real auto-generate logic
    // (processAutoSlugs) hardcodes `data.title ?? data.judul ?? data.name`
    // as its fallback source whenever an explicit options.sourceField isn't
    // configured — a 'slug' field with no title/judul/name sibling AND no
    // sourceField has nothing to auto-generate from at all. Warning, not
    // blocking: a template author may still want a manually-filled slug.
    ;(fields || []).forEach((f, idx) => {
      if (f.type !== "slug") return
      const sourceField = f.options?.sourceField
      const hasExplicitSource = !!sourceField && (fields || []).some((other) => other !== f && other.slug === sourceField)
      const hasTitleLikeSibling = (fields || []).some((other) => other !== f && other.slug && TITLE_LIKE_SLUGS.has(other.slug))
      if (!hasExplicitSource && !hasTitleLikeSibling) {
        issues.push({ path: `${basePath}.fields[${idx}]`, message: `'slug'-type field '${f.slug}' has no 'title'/'judul'/'name' sibling field (or a matching options.sourceField) in this model to auto-generate from.`, severity: "warning" })
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
type ModelKind = "contentTypes" | "singleTypes" | "components" | "groups"
type SlugLists = Partial<Record<ModelKind, Array<{ slug?: string }>>>

/**
 * create_schema_template/create_website_template validate the bundle AFTER
 * composeTemplateStarterSchema has merged the platform starter's models in
 * front of the caller's own — so a path like `contentTypes[3]` pointed at
 * the merged array, not at the `contentTypes[0]` the caller actually wrote
 * (audit VAL-8/VAL-15). Rewrites each top-level model index back to the
 * caller's own input by slug (matching the Nth occurrence, so a duplicate
 * slug still maps to the right duplicate), and labels a model that came
 * purely from the starter as `starter.<kind>(<slug>)` instead of a
 * misleading index into input the caller never sent.
 */
export function remapIssuePathsToInput(issues: ValidationIssue[], merged: SlugLists, input: SlugLists): ValidationIssue[] {
  return issues.map((issue) => {
    const match = /^(contentTypes|singleTypes|components|groups)\[(\d+)\](.*)$/.exec(issue.path)
    if (!match) return issue
    const kind = match[1] as ModelKind
    const mergedIndex = Number(match[2])
    const rest = match[3]
    const mergedList = merged[kind] || []
    const slug = mergedList[mergedIndex]?.slug
    if (!slug) return issue

    const occurrence = mergedList.slice(0, mergedIndex + 1).filter((m) => m.slug === slug).length
    let seen = 0
    const inputIndex = (input[kind] || []).findIndex((m) => m.slug === slug && ++seen === occurrence)
    if (inputIndex >= 0) return { ...issue, path: `${kind}[${inputIndex}]${rest}` }
    return { ...issue, path: `starter.${kind}(${slug})${rest}`, message: `${issue.message} (This model comes from the platform starter, not your input.)` }
  })
}

/** Mirrors demo-tenant.ts's SKIP_FIELD_TYPES — types the demo seeder never
 *  fills with a placeholder, so a missing required value there just stays
 *  empty rather than looking fake. */
const SEEDER_NEVER_SYNTHESIZES = new Set(["media", "mediaMultiple", "file", "relation", "component", "repeater", "document_template", "slug"])

function checkDummyData(model: BundleModelRef, basePath: string, issues: ValidationIssue[]): void {
  if (!model.dummyData || model.dummyData.length === 0) return
  const fields = (model.fields || [])
    .filter((f): f is BundleFieldRef & { slug: string; type: string } => !!f.slug && !!f.type)
    .map((f) => ({ slug: f.slug, name: f.name || f.slug, type: f.type, required: false, options: f.options }))
  if (fields.length === 0) return

  const schema = generateContentSchema(fields, { enforceRequired: false })
  const fieldBySlug = new Map(fields.map((f) => [f.slug, f] as const))
  model.dummyData.forEach((entry, i) => {
    const result = schema.safeParse(entry)
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        issues.push({ path: `${basePath}.dummyData[${i}]${issue.path.length ? `.${issue.path.join(".")}` : ""}`, message: issue.message })
      })
    }

    // Third external audit, VAL-11/12/14: generateContentSchema's own
    // color/date/boolean cases are deliberately forgiving for a human
    // typing into a real form (Boolean("ya") === true, any non-empty
    // string passes as a date, 'color' isn't even validated at all —
    // confirmed in content-validations.ts). That forgiveness is the wrong
    // default for a demo, whose entire point is to look like finished,
    // real content — checked stricter here, specific to dummyData only.
    for (const [slug, field] of fieldBySlug) {
      const val = entry[slug]
      if (val === undefined || val === null || val === "") continue
      if (field.type === "color" && !(typeof val === "string" && HEX_COLOR_RE.test(val))) {
        issues.push({ path: `${basePath}.dummyData[${i}].${slug}`, message: `'${val}' is not a valid hex color (e.g. '#1a2b3c') — a demo renders this value straight into a swatch/CSS.` })
      }
      if ((field.type === "date" || field.type === "datetime") && !(typeof val === "string" && !Number.isNaN(Date.parse(val)))) {
        issues.push({ path: `${basePath}.dummyData[${i}].${slug}`, message: `'${val}' is not a parseable date${field.type === "datetime" ? "time" : ""} value.` })
      }
      if (field.type === "boolean" && typeof val !== "boolean") {
        issues.push({ path: `${basePath}.dummyData[${i}].${slug}`, message: `'${JSON.stringify(val)}' is not a real boolean (true/false), got ${typeof val} — a coercible string like "ya"/"yes" would silently become true everywhere else, but a demo should use real booleans.` })
      }
    }

    // VAL-13: a dummyData key with no matching field in this model at all
    // — likely a typo or a leftover from a field that got renamed/removed.
    // Warning, not blocking: the extra key is simply ignored at seed time.
    Object.keys(entry).forEach((key) => {
      if (!fieldBySlug.has(key)) {
        issues.push({ path: `${basePath}.dummyData[${i}].${key}`, message: `'${key}' does not match any field slug in this model.`, severity: "warning" })
      }
    })

    // The demo seeder leaves an OPTIONAL field the author didn't write
    // empty, but must fill a REQUIRED one or the entry can't be created —
    // with a generic placeholder ("Contoh …", 100, a fixed color). Warn
    // here so a dryRun shows exactly which values will look fake in the
    // demo before anything is saved. Types the seeder never synthesizes
    // (slug is auto-generated; media/relation/component/repeater have no
    // placeholder) are excluded — they'd simply stay empty.
    for (const f of model.fields || []) {
      if (!f.required || !f.slug || !f.type || SEEDER_NEVER_SYNTHESIZES.has(f.type)) continue
      const val = entry[f.slug]
      if (val === undefined || val === null || val === "") {
        issues.push({ path: `${basePath}.dummyData[${i}].${f.slug}`, message: `Required field '${f.slug}' is missing — the demo will fill it with a generic placeholder value. Provide a real value to keep the demo realistic.`, severity: "warning" })
      }
    }
  })
}

/**
 * Field-level checks for a standalone GlobalComponent (src/app/api/mcp/
 * global-schema's create_global_component/update_global_component) — a
 * single reusable Component-shaped field definition with no sibling
 * models of its own, unlike a full SchemaTemplate bundle. Deliberately a
 * SUBSET of checkFields (inlined inside validateBundleReferences above):
 * duplicate-slug/type-validity/slug-format/choices checks all still apply,
 * but relation/component/repeater cross-reference checks do NOT — a
 * relationSlug/componentSlug here legitimately points at something that
 * only exists once a workspace actually applies this component into its
 * own schema (create_component), not at another model in this same call.
 */
export function validateGlobalComponentFields(fields: BundleFieldRef[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenFieldSlugs = new Map<string, number>()

  fields.forEach((f, idx) => {
    const fieldPath = `fields[${idx}]`
    if (f.slug) {
      const firstIndex = seenFieldSlugs.get(f.slug)
      if (firstIndex !== undefined) {
        issues.push({ path: `${fieldPath}.slug`, message: `Duplicate field slug '${f.slug}' — already used by fields[${firstIndex}]. Field slugs must be unique within the same component.` })
      } else {
        seenFieldSlugs.set(f.slug, idx)
      }
    }
    if (f.type && !VALID_FIELD_TYPES.has(f.type)) {
      issues.push({ path: `${fieldPath}.type`, message: `'${f.type}' is not a real field type. Call list_field_types for the official list of 36 types — a typo'd/fictional type has no renderer anywhere and silently falls back to accepting any value.` })
    }
    if (f.type !== "document_template" && f.slug && !FIELD_SLUG_FORMAT_RE.test(f.slug)) {
      issues.push({ path: `${fieldPath}.slug`, message: `'${f.slug}' is not a valid field slug — start with a letter and use letters, digits, hyphens, or underscores (e.g. 'cover-image').` })
    }
    if (f.type === "select" || f.type === "multiselect") {
      const choices = f.options?.choices
      if (!Array.isArray(choices) || choices.length === 0) {
        issues.push({ path: `${fieldPath}.options.choices`, message: `${f.type} fields need a non-empty options.choices array — without it, every value is rejected at content-entry time.` })
      }
    }
  })

  return issues
}
