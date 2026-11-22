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
  richText: {
    entryValue: "A raw HTML string (e.g. '<p><strong>Espresso</strong> dengan susu kukus.</p><ul><li>adsf</li></ul>') — this is exactly what the dashboard's own WYSIWYG editor (Quill) produces and saves, real markup, not plain text.",
    note: "The frontend you scaffold MUST render this as HTML — a sanitized dangerouslySetInnerHTML (or an equivalent HTML-aware renderer), never `{value}`/string interpolation. Confirmed live: a frontend that renders richText as plain text shows the literal tags (<p>, <strong>, <ul>, &nbsp;, …) to visitors instead of formatted text — this only stays hidden by accident when test content happens to be unwrapped plain prose with no real markup in it.",
  },
  markdown: {
    entryValue: "Raw Markdown source text (e.g. '**bold** and a [link](https://...)'), NOT HTML — the dashboard's own editor keeps it as plain Markdown and only renders a preview tab from it.",
    note: "The frontend you scaffold must run this through a Markdown renderer (e.g. react-markdown/remark) before display — showing the raw Markdown source as the page content is the same class of bug as not rendering a richText field's HTML.",
  },
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
  media: {
    note: "No schema options — allowedTypes/maxFileSizeMb are not enforced; accepted file kind is implied by choosing 'media' (image) vs 'file' as the type itself.",
    entryValue: "A single URL string, e.g. 'https://sacms.cloud/api/public/media?key=tenant-x/abc123.jpg'. The CMS stores a private, session-gated proxy path internally, but the public content API (GET /api/public/[tenant]/content/[contentType]) rewrites it to this public, unauthenticated form for any PUBLISHED entry before responding — your frontend fetch gets a plain URL it can drop straight into an <img src>, never the private form.",
  },
  mediaMultiple: { note: "No schema options, same as 'media'.", entryValue: "Array of the same public URL strings 'media' describes, e.g. ['https://sacms.cloud/api/public/media?key=.../1.jpg', '.../2.jpg']." },
  file: { note: "No schema options, same dead-option pattern as 'media'.", entryValue: "Single file URL string, same public-URL rewriting as 'media'." },
  relation: {
    options: "{ relationType: 'oneToOne'|'oneToMany'|'manyToOne'|'manyToMany', targetModel?: 'content-type'|'single-type'|'member' }",
    exampleOptions: { relationType: "oneToMany" },
    relationSlug: "string — target Content Type/Single Type slug, e.g. 'categories'. Omit relationSlug and set options.targetModel: 'member' instead to relate to this tenant's own end-user Members table (a real, separate capability, easy to miss).",
    entryValue:
      "RAW (default): just the related record's id string (or an array of id strings for a *-to-many) — e.g. { \"category\": \"cmt8x...\" }. POPULATED: the public content API only expands a relation when the request explicitly asks for it — add `?populate=<fieldSlug>` (or `?populate=*` for every relation field on that Content Type) to the URL. A populated field then becomes the related record's own fields spread flat alongside its id, e.g. { \"category\": { \"id\": \"cmt8x...\", \"name\": \"Kopi\", \"slug\": \"kopi\", \"locale\": \"id\", \"status\": \"PUBLISHED\" } } — NOT Strapi's { data: { id, attributes: {...} } } wrapper, this project's shape is flat. A *-to-many populated relation is an array of these same flat objects. A relation with options.targetModel: 'member' resolves from the Members table instead and is populated the same way, but only ever returns { id, name, email, avatar, role, status, createdAt } — never a password hash or other credential material.",
  },
  component: {
    options: "{ componentSlug: string, repeatable?: boolean }",
    // Fourth external audit: this used to document componentSlug examples
    // in underscore_case ("hero_section") — confirmed that's NOT actually
    // a valid Component.slug at all (createComponentSchema's own regex,
    // src/lib/validations/admin.ts, is kebab-case-only, no underscores),
    // so following this example literally would get rejected by the real
    // dashboard creation route. Kebab-case throughout, matching reality.
    exampleOptions: { componentSlug: "hero-section" },
    note: "repeatable: true repeats this ONE component as an array. For a zone that mixes several DIFFERENT component types, use 'repeater' instead.",
    entryValue:
      "A plain embedded object with that component's own fields already inline — e.g. { \"heading\": \"Kopi Terbaik di Nabire\", \"subheading\": \"Dipanggang setiap hari\", \"cta\": { \"text\": \"Lihat Menu\", \"url\": \"/menu\" } } for a hero-section component with heading/subheading/cta fields. With repeatable: true, the value is an array of these objects, e.g. [{...}, {...}]. Unlike 'relation', there's no id to resolve — the full data is always already there. CAVEAT: if a component itself contains a 'relation' field, the public content API's `?populate=` only expands TOP-LEVEL relation fields on the Content Type — a relation nested inside a component (or inside a repeater item, see below) always comes back as a raw id, never auto-expanded, regardless of `populate`.",
  },
  repeater: {
    options: "{ allowedComponents?: string[] }",
    exampleOptions: { allowedComponents: ["hero-section", "cta-banner", "testimonial-card"] },
    note: "The real key is `allowedComponents` — do not use `componentSlugs` (an older version of this guide documented that name by mistake; it silently allows every component instead of erroring). Omitted/empty allowedComponents = every component is allowed. Component slugs are kebab-case only, same as any other model slug (see list_field_types' own slug-format guidance) — not underscore_case.",
    entryValue:
      "An array of objects, each carrying a `__component` discriminator naming which of the allowed components that item is, with that component's own fields spread alongside it — e.g. [{ \"__component\": \"hero-banner\", \"heading\": \"Promo Akhir Tahun\" }, { \"__component\": \"testimonial-card\", \"quote\": \"Enak sekali!\", \"author\": \"Budi\" }]. Always render by switching on `__component`, the same way the CMS editor's own dynamic-zone UI builds these items. Same caveat as 'component': a relation field nested inside one of these items is never auto-populated by `?populate=` — it stays a raw id.",
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

/**
 * Real request/response payloads for the public, tenant-facing Content API
 * a deployed Website Template's frontend actually fetches from
 * (GET/POST/PUT/DELETE /api/public/[tenant]/content/[contentType][/id],
 * and /api/public/[tenant]/single/[singleType] for a Single Type) —
 * chatgpt7.md P1: "complete the frontend contract examples with actual API
 * payloads." These are shapes verified directly against that route's code
 * (src/app/api/public/[tenant]/content/[contentType]/route.ts and its
 * [id] sibling), not invented.
 */
export const CONTENT_API_CONTRACT_EXAMPLES = {
  collection: {
    request: "GET /api/public/acme-coffee/content/articles?pagination[pageSize]=10&populate=category&sort=createdAt:desc",
    response: {
      data: [
        {
          id: "cmt8xabc123",
          documentId: "doc_abc123",
          title: "Kopi Terbaik di Nabire",
          slug: "kopi-terbaik-di-nabire",
          cover: "https://sacms.cloud/api/public/media?key=acme-coffee/cover.jpg",
          category: { id: "cmt8xcat01", name: "Kopi", slug: "kopi", locale: "id", status: "PUBLISHED" },
          locale: "id",
          availableLocales: ["id"],
          status: "PUBLISHED",
          publishedAt: "2026-10-01T03:00:00.000Z",
          createdAt: "2026-10-01T03:00:00.000Z",
          updatedAt: "2026-10-01T03:00:00.000Z",
        },
      ],
      meta: { contentType: { name: "Articles", slug: "articles" }, pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
    },
    note: "`category` is populated (a full object) ONLY because `?populate=category` was on the URL — drop it and `category` comes back as just an id string. `data` is a flat array, no Strapi-style `attributes` wrapper.",
  },
  singleEntry: {
    request: "GET /api/public/acme-coffee/content/articles/doc_abc123",
    response: { data: { id: "cmt8xabc123", documentId: "doc_abc123", title: "Kopi Terbaik di Nabire", slug: "kopi-terbaik-di-nabire", locale: "id", availableLocales: ["id"], status: "PUBLISHED", publishedAt: "2026-10-01T03:00:00.000Z", createdAt: "2026-10-01T03:00:00.000Z", updatedAt: "2026-10-01T03:00:00.000Z" }, meta: { contentType: { name: "Articles", slug: "articles" } } },
    note: "Addressable by either the row id OR documentId (the locale-stable id that stays the same across that same document's translations).",
  },
  filtering: {
    request: "GET /api/public/acme-coffee/content/articles?filters[category][$eq]=kopi&filters[$or][0][title][$contains]=nabire&filters[$or][1][title][$contains]=papua&filters[tags][$in][0]=kopi&filters[tags][$in][1]=teh",
    note: "Supported operators: $eq, $ne, $gt, $gte, $lt, $lte (numbers or ISO dates), $contains / $containsi (both case-insensitive), $startsWith, $endsWith, $in, $notIn (indexed [0],[1],… or one comma-joined value), $null, $notNull. Group with $or (alternatives) or $and, one level deep, max 20 conditions. Filter on the entry's own field slugs. An unknown field, unknown operator, or a shape the parser can't read is rejected with HTTP 400 — never silently ignored — so check the response instead of assuming a filter applied.",
  },
  singleType: {
    request: "GET /api/public/acme-coffee/single/homepage",
    note: "Single Types (Homepage, Site Settings, …) use their OWN endpoint shape, /api/public/[tenant]/single/[singleType] — not /content/. Read src/app/api/public/[tenant]/single/[singleType]/route.ts if the exact response envelope matters; either way, relation/component/repeater fields on a Single Type follow the exact same value shapes documented per-type above.",
  },
  testingAgainstTheDemoFixture:
    "Website Templates have an internal demo workspace. The first deploy fills empty models from sample data, and later frontend redeploys preserve editor content. Collection dummyData can reference another collection entry by its slugified label. On SaCMS Global MCP, read actual values with get_demo_single_type_entry or list_demo_content_entries. Use upload_demo_media and the demo entry write tools for media, Component fields and Repeater blocks. Reset demo entries from sample data only through reset_demo_content after explicit confirmation.",
}
