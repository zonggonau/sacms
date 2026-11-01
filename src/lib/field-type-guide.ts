/**
 * Field type reference shared by both MCP servers (the per-workspace
 * server's `list_field_types` tool and the SaCMS Global Schema Template
 * server's equivalent) — ground truth verified directly against the
 * field-renderer components and the dashboard's own field-builder UI, not
 * against any type's own display description in field-types.ts (several
 * of those are themselves inaccurate — see notes below).
 *
 * A number of previously-documented options turned out to be "dead" —
 * accepted and saved, but never read by anything at render time — and
 * `repeater`'s real options key was flat-out wrong in an earlier version of
 * this guide (documented as `componentSlugs`; the field-renderer actually
 * reads `allowedComponents`, so using the old name silently fell back to
 * "allow every component" instead of erroring). Keeping this in ONE shared
 * file, instead of copy-pasted per MCP server, is the fix for exactly that
 * kind of drift happening again.
 *
 * A type with no entry below needs no `options` and has no surprise.
 */

export interface FieldTypeGuideEntry {
  /** The schema-level `options` shape this type actually reads, if any. */
  options?: string
  exampleOptions?: Record<string, any>
  /** Only set for types that use the top-level `relationSlug` key. */
  relationSlug?: string
  /** How a content ENTRY's value must be shaped for this field — a
   *  separate concern from the schema `options` above, and otherwise
   *  undocumented anywhere an agent could discover it before guessing. */
  entryValue?: string
  note?: string
}

export const FIELD_TYPE_GUIDE: Record<string, FieldTypeGuideEntry> = {
  slug: {
    entryValue: "Auto-generated — do not set directly when creating a content entry.",
    note: "Auto-slug generation looks for a sibling field literally named 'title', 'judul', or 'name' — always include one of those alongside a slug field. The dashboard builder's options.sourceField/autoGenerate have NO effect, don't bother setting them.",
  },
  number: { note: "No schema options — min/max/step are not enforced anywhere, despite older docs suggesting otherwise." },
  currency: { note: "No schema options — currencyCode is NOT configurable; every currency field always displays as IDR regardless of what you set." },
  percent: { note: "No schema options — min/max/step are not enforced." },
  select: {
    options: "{ choices: Array<{ label: string, value: string }> }",
    exampleOptions: { choices: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] },
    entryValue: "One of the choices' `value`s.",
    note: "REQUIRED for a usable field — omitting choices renders an empty dropdown. Use 'select' for a FIXED, SMALL set of options (status, category); use 'relation' instead for an open-ended or separately-managed set of records.",
  },
  multiselect: {
    options: "{ choices: Array<{ label: string, value: string }> }",
    exampleOptions: { choices: [{ label: "Red", value: "red" }, { label: "Blue", value: "blue" }] },
    entryValue: "Array of the choices' `value`s.",
    note: "Same rule as 'select' — choices is required.",
  },
  tags: { entryValue: "Array of free-typed strings.", note: "No schema options — always free-typed by the end user; there is no predefined/restricted list even if options.choices is set." },
  icon: {
    entryValue: "Must be one of a fixed ~52-name Lucide icon set (see AVAILABLE_ICONS in icon-field.tsx), e.g. 'Home', 'Star', 'Heart' — an arbitrary name renders as unset.",
    note: "Despite this type's own label ('Lucide / Web Icons'), only Lucide icon names actually work — there is no separate web-icon set.",
  },
  media: { note: "No schema options — allowedTypes/maxFileSizeMb are not enforced; accepted file kind is implied by choosing 'media' (image) vs 'file' as the type itself." },
  mediaMultiple: { note: "No schema options, same as 'media'.", entryValue: "Array of media URL strings." },
  file: { note: "No schema options, same dead-option pattern as 'media'.", entryValue: "Single file URL string." },
  relation: {
    options: "{ relationType: 'oneToOne'|'oneToMany'|'manyToOne'|'manyToMany', targetModel?: 'content-type'|'single-type'|'member' }",
    exampleOptions: { relationType: "oneToMany" },
    relationSlug: "string — target Content Type/Single Type slug, e.g. 'categories'. Omit relationSlug and set options.targetModel: 'member' instead to relate to this tenant's own end-user Members table (a real, separate capability, easy to miss).",
    entryValue: "A related record's id (or an array of ids when relationType is a *-to-many).",
  },
  component: {
    options: "{ componentSlug: string, repeatable?: boolean }",
    exampleOptions: { componentSlug: "hero_section" },
    note: "repeatable: true repeats this ONE component as an array. For a zone that mixes several DIFFERENT component types, use 'repeater' instead.",
  },
  repeater: {
    options: "{ allowedComponents?: string[] }",
    exampleOptions: { allowedComponents: ["hero_section", "cta_banner", "testimonial_card"] },
    note: "The real key is `allowedComponents` — do not use `componentSlugs` (an older version of this guide documented that name by mistake; it silently allows every component instead of erroring). Omitted/empty allowedComponents = every component is allowed.",
  },
  location: {
    entryValue: "{ lat: number, lng: number } only.",
    note: "There is no address string in the value, despite this type's own description mentioning one.",
  },
  dateRange: { entryValue: "{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }" },
  phone: { entryValue: "{ code: string (country calling code), number: string }" },
  seo: { entryValue: "{ meta_title, meta_description, keywords, og_image, no_index } — fixed snake_case keys." },
  code: {
    entryValue: "{ code: string, language: one of 'javascript'|'typescript'|'python'|'html'|'css'|'json'|'sql'|'bash'|'markdown'|'yaml' }",
    note: "Language is chosen per ENTRY, not per schema field — there is no schema-level language option.",
  },
  rating: { entryValue: "Integer 1–5.", note: "Always out of 5 stars — there is no schema option to change the max, despite the renderer technically supporting one internally." },
  button: { entryValue: "{ text: string, url: string, target?: '_blank'|'_self' }" },
  document_template: {
    options: "{ templateUrl: string, fileName?: string }",
    note: "templateUrl must point at an ALREADY-UPLOADED .docx file in this workspace's storage — you can create the field definition, but you cannot fabricate a working templateUrl yourself. Tell the user to upload the real .docx via the dashboard first.",
  },
}
