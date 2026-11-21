import { db, getTenantDbById } from "@/lib/database"
import { materializeSchemaIntoTenant, type SchemaBlob } from "@/lib/schema-template-sync"

/**
 * Fallback identity for the default SchemaTemplate — only used the very
 * first time ensureDefaultSchemaTemplate runs in a given environment (local,
 * or production after this ships), so that environment self-heals its own
 * `isDefault: true` row instead of needing a manual one-off migration/seed
 * script run against each database separately. Mirrors the self-healing
 * pattern ensureSiteSettings already uses for `site-settings`.
 */
const DEFAULT_SCHEMA_TEMPLATE_SLUG = "default-starter-schema"

/**
 * Posts + Kategori — the same shape as the Blog feature already shipped in
 * Admin CMS (title/slug/excerpt/content/cover image/author/featured/date),
 * minus the Admin-CMS-specific plumbing, plus a real `category` relation
 * since this is a genuine per-tenant Content Type, not a landing-page
 * section. Every workspace gets these two Content Types automatically; an
 * AI agent/IDE builds whatever else the site actually needs on top.
 */
const DEFAULT_SCHEMA_BUNDLE: SchemaBlob = {
  contentTypes: [
    {
      name: "Kategori",
      slug: "kategori",
      description: "Kategori untuk mengelompokkan Post.",
      fields: [
        { name: "Nama", slug: "name", type: "text", required: true },
        { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
        { name: "Deskripsi", slug: "description", type: "textarea" },
      ],
    },
    {
      name: "Post",
      slug: "posts",
      description: "Artikel/blog post.",
      fields: [
        { name: "Judul", slug: "title", type: "text", required: true },
        { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
        { name: "Ringkasan", slug: "excerpt", type: "textarea" },
        { name: "Konten", slug: "content", type: "richText", required: true },
        { name: "Gambar Sampul", slug: "cover_image", type: "media" },
        { name: "Penulis", slug: "author", type: "text" },
        { name: "Post Unggulan", slug: "is_featured", type: "boolean" },
        { name: "Tanggal Publikasi", slug: "date", type: "date" },
        { name: "Kategori", slug: "category", type: "relation", relationSlug: "kategori" },
      ],
    },
  ],
  singleTypes: [],
  components: [],
}

/**
 * Gets the one SchemaTemplate currently marked `isDefault: true`, creating
 * it (idempotently, by slug) the first time this runs in a given
 * environment. Safe to call concurrently/repeatedly — `upsert` on the fixed
 * slug means a race just updates the same row twice, never creates a
 * duplicate.
 */
export async function ensureDefaultSchemaTemplate() {
  const existing = await db.schemaTemplate.findFirst({ where: { isDefault: true } })
  if (existing) return existing

  return db.schemaTemplate.upsert({
    where: { slug: DEFAULT_SCHEMA_TEMPLATE_SLUG },
    update: { isDefault: true },
    create: {
      name: "Default Starter Schema",
      slug: DEFAULT_SCHEMA_TEMPLATE_SLUG,
      category: "Starter",
      icon: "🧱",
      description: "Content Type bawaan (Post, Kategori) yang otomatis tersedia di setiap workspace baru.",
      schema: DEFAULT_SCHEMA_BUNDLE as object,
      published: true,
      isDefault: true,
    },
  })
}

/**
 * Materializes the default SchemaTemplate's Content Types/Single Types
 * PLUS every currently-PUBLISHED GlobalComponent's fields into one workspace
 * — called once, right after a brand-new tenant is created (alongside
 * ensureSiteSettings), never retroactively against an existing tenant.
 * materializeSchemaIntoTenant already skips any model whose slug already
 * exists for this tenant, so calling this twice (or against a tenant an
 * older starter-kit flow already seeded "posts"/"kategori" into) is safe.
 */
export async function seedDefaultTenantSchema(tenantId: string): Promise<void> {
  const { schema } = await loadDefaultTenantSchema(true)
  const tenantDb = await getTenantDbById(tenantId)
  await materializeSchemaIntoTenant(tenantDb, tenantId, schema)
}

/** Read the starter schema and the published reusable catalog. Template previews
 * and dry runs can use the fallback without writing a catalog row. */
export async function loadDefaultTenantSchema(ensureCatalogRow = false) {
  const [defaultTemplate, publishedComponents] = await Promise.all([
    ensureCatalogRow ? ensureDefaultSchemaTemplate() : db.schemaTemplate.findFirst({ where: { isDefault: true } }),
    db.globalComponent.findMany({ where: { published: true } }),
  ])
  const bundle = (defaultTemplate?.schema as SchemaBlob) || DEFAULT_SCHEMA_BUNDLE
  const templateComponents = bundle.components || []
  const templateSlugs = new Set(templateComponents.map((component) => component.slug))
  return {
    templateSlug: defaultTemplate?.slug ?? DEFAULT_SCHEMA_TEMPLATE_SLUG,
    schema: {
      ...bundle,
      components: [
        ...templateComponents,
        ...publishedComponents.filter((component) => !templateSlugs.has(component.slug)).map((component) => ({
          name: component.name,
          slug: component.slug,
          description: component.description || undefined,
          fields: component.fields as unknown as NonNullable<SchemaBlob["components"]>[number]["fields"],
        })),
      ],
    },
  }
}
