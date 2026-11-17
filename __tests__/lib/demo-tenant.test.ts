import { describe, it, expect, vi, beforeEach } from "vitest"

// ensureDemoTenantForSchemaTemplate backs every Website Template's live
// demo deploy — lazily creates one owner-less internal tenant per
// SchemaTemplate (shared by every WebsiteTemplate that follows it),
// materializes its schema, and seeds a few sample entries so the demo
// renders real-looking content instead of an empty shell.

const tenantFindUnique = vi.fn()
const tenantCreate = vi.fn()
const schemaTemplateUpdate = vi.fn().mockResolvedValue({})

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findUnique: tenantFindUnique, create: tenantCreate },
    schemaTemplate: { update: schemaTemplateUpdate },
  },
  getTenantDb: vi.fn(async () => tenantDbMock),
}))

const materializeSchemaIntoTenant = vi.fn().mockResolvedValue({ imported: 2 })
vi.mock("@/lib/schema-template-sync", () => ({
  materializeSchemaIntoTenant: (...args: any[]) => materializeSchemaIntoTenant(...args),
}))

const wipeTenantSchema = vi.fn().mockResolvedValue({ contentTypes: 0, singleTypes: 0, components: 0 })
vi.mock("@/lib/schema-wipe", () => ({
  wipeTenantSchema: (...args: any[]) => wipeTenantSchema(...args),
}))

let createContentEntryCounter = 0
const createContentEntry = vi.fn().mockImplementation(async () => ({ ok: true, data: { id: `entry_${++createContentEntryCounter}` } }))
const updateContentEntry = vi.fn().mockResolvedValue({ ok: true, data: {} })
vi.mock("@/lib/content/entry-service", () => ({
  createContentEntry: (...args: any[]) => createContentEntry(...args),
  updateContentEntry: (...args: any[]) => updateContentEntry(...args),
}))

const contentTypeFindMany = vi.fn().mockResolvedValue([])
const singleTypeFindMany = vi.fn().mockResolvedValue([])
const tenantSingleTypeAssignmentUpsert = vi.fn().mockResolvedValue({})
const tenantLocaleCreate = vi.fn().mockResolvedValue({})
const tenantDbMock = {
  contentType: { findMany: contentTypeFindMany },
  singleType: { findMany: singleTypeFindMany },
  tenantSingleTypeAssignment: { upsert: tenantSingleTypeAssignmentUpsert },
  tenantLocale: { create: tenantLocaleCreate },
}

const { ensureDemoTenantForSchemaTemplate } = await import("@/lib/infrastructure/demo-tenant")

const schemaTemplate = {
  id: "st_1",
  slug: "company-profile",
  name: "Company Profile",
  schema: { contentTypes: [] },
  demoTenantId: null as string | null,
}

describe("ensureDemoTenantForSchemaTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contentTypeFindMany.mockResolvedValue([])
    singleTypeFindMany.mockResolvedValue([])
    createContentEntryCounter = 0
    createContentEntry.mockImplementation(async () => ({ ok: true, data: { id: `entry_${++createContentEntryCounter}` } }))
  })

  // Fourth external audit, DEMO-6: this used to return the existing demo
  // tenant completely as-is — confirmed live, a later redeploy/update left
  // its content from the FIRST deploy untouched forever, no matter how
  // much the template's schema/dummyData changed since. A new Tenant row
  // is never created again (reuses the existing one), but its content IS
  // fully wiped and rebuilt every time, not just once.
  it("reuses the existing Tenant row (no new tenant.create) but still wipes and rebuilds its content every time, not just on first creation", async () => {
    tenantFindUnique.mockResolvedValue({ id: "demo-tenant-1", slug: "demo-company-profile" })

    const result = await ensureDemoTenantForSchemaTemplate({ ...schemaTemplate, demoTenantId: "demo-tenant-1" })

    expect(result).toEqual({ id: "demo-tenant-1", slug: "demo-company-profile" })
    expect(tenantCreate).not.toHaveBeenCalled()
    expect(tenantLocaleCreate).not.toHaveBeenCalled()
    expect(wipeTenantSchema).toHaveBeenCalledWith(tenantDbMock, "demo-tenant-1")
    expect(materializeSchemaIntoTenant).toHaveBeenCalledWith(tenantDbMock, "demo-tenant-1", schemaTemplate.schema)
    // seedSampleContent ran too (reads the now-empty/rematerialized schema).
    expect(contentTypeFindMany).toHaveBeenCalled()
  })

  it("creates a new demo tenant, materializes the schema, and persists demoTenantId when none exists yet", async () => {
    tenantFindUnique.mockResolvedValue(null) // slug availability check
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })

    const result = await ensureDemoTenantForSchemaTemplate(schemaTemplate)

    expect(result).toEqual({ id: "demo-tenant-new", slug: "demo-company-profile" })
    expect(tenantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "demo-company-profile", plan: "enterprise", status: "active" }),
      }),
    )
    expect(materializeSchemaIntoTenant).toHaveBeenCalledWith(tenantDbMock, "demo-tenant-new", schemaTemplate.schema)
    expect(schemaTemplateUpdate).toHaveBeenCalledWith({
      where: { id: "st_1" },
      data: { demoTenantId: "demo-tenant-new" },
    })
    // chatgpt.md P0: without this, createContentEntry's resolveWriteLocale
    // falls back to "en" (no TenantLocale enabled for the tenant) while
    // every public read path defaults to "id" — a locale mismatch that
    // made every seeded sample entry invisible through the demo API.
    expect(tenantLocaleCreate).toHaveBeenCalledWith({
      data: { tenantId: "demo-tenant-new", locale: "id", name: "Bahasa Indonesia", isDefault: true, isEnabled: true },
    })
  })

  it("retries with a suffixed slug when the preferred demo-<slug> is already taken", async () => {
    // First check (preferred slug) finds a collision, second (suffixed) is free.
    tenantFindUnique.mockResolvedValueOnce({ id: "someone-else" }).mockResolvedValueOnce(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile-xxxx" })

    await ensureDemoTenantForSchemaTemplate(schemaTemplate)

    expect(tenantFindUnique).toHaveBeenCalledTimes(2)
    const createdSlug = tenantCreate.mock.calls[0][0].data.slug
    expect(createdSlug).toMatch(/^demo-company-profile-/)
  })

  it("seeds sample entries for every content type and skips structural fields (media/relation/component/repeater)", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "articles",
        schemaFields: [
          { slug: "title", name: "Judul", type: "text", options: null },
          { slug: "cover", name: "Cover", type: "media", options: null },
          { slug: "status", name: "Status", type: "select", options: { choices: [{ label: "Live", value: "live" }] } },
        ],
      },
    ])

    await ensureDemoTenantForSchemaTemplate(schemaTemplate)

    // 3 sample entries per content type (SAMPLE_ENTRIES_PER_CONTENT_TYPE)
    expect(createContentEntry).toHaveBeenCalledTimes(3)
    const [, actor, input] = createContentEntry.mock.calls[0]
    expect(actor).toEqual({ kind: "system" })
    expect(input.contentTypeSlug).toBe("articles")
    expect(input.data).toHaveProperty("title")
    expect(input.data).toHaveProperty("status", "live")
    expect(input.data).not.toHaveProperty("cover") // structural field, skipped
  })

  // Kabar Nusa report P0: a template author's own dummyData (validated at
  // create_schema_template/create_website_template time, confirmed live to
  // never be read by anything downstream) is wired through here now —
  // confirmed by the original author's own admission in
  // ai-schema-generator.ts's comment ("nothing downstream ... reads
  // dummyData") before this fix.
  it("uses the template author's own dummyData instead of the fully generic synthesizer, when the schema blob provides it", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "artikel",
        schemaFields: [
          { slug: "title", name: "Judul", type: "text", options: null },
          { slug: "kategori", name: "Kategori", type: "text", options: null },
        ],
      },
    ])

    const schemaWithDummyData = {
      ...schemaTemplate,
      schema: {
        contentTypes: [
          {
            slug: "artikel",
            dummyData: [
              { title: "Pemkot Luncurkan Transportasi Gratis", kategori: "Nasional" },
              { title: "Harga Beras Naik di Pasar Induk", kategori: "Ekonomi" },
            ],
          },
        ],
      },
    }

    await ensureDemoTenantForSchemaTemplate(schemaWithDummyData)

    const firstEntryData = createContentEntry.mock.calls[0][2].data
    const secondEntryData = createContentEntry.mock.calls[1][2].data
    expect(firstEntryData).toEqual({ title: "Pemkot Luncurkan Transportasi Gratis", kategori: "Nasional" })
    expect(secondEntryData).toEqual({ title: "Harga Beras Naik di Pasar Induk", kategori: "Ekonomi" })
  })

  it("falls back to the generic synthesizer for a content type with no dummyData at all", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    contentTypeFindMany.mockResolvedValue([
      { slug: "artikel", schemaFields: [{ slug: "title", name: "Judul", type: "text", options: null }] },
    ])

    await ensureDemoTenantForSchemaTemplate({ ...schemaTemplate, schema: { contentTypes: [] } })

    const firstEntryData = createContentEntry.mock.calls[0][2].data
    expect(firstEntryData.title).toMatch(/^Contoh Judul/)
  })

  it("seeds one TenantSingleTypeAssignment row per single type via upsert", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    singleTypeFindMany.mockResolvedValue([
      { id: "st_home", slug: "homepage", schemaFields: [{ slug: "headline", name: "Headline", type: "text", options: null }] },
    ])

    await ensureDemoTenantForSchemaTemplate(schemaTemplate)

    // chatgpt.md P0: materializeSchemaIntoTenant's own `tenants: { create:
    // { tenantId } }` already inserts a TenantSingleTypeAssignment row for
    // this exact [tenantId, singleTypeId, locale] key — a plain `.create()`
    // here threw P2002 (silently swallowed), so the real sample data/
    // publishedAt never actually landed and the demo API 404'd as "not
    // published". upsert fixes it regardless of which call ran first.
    expect(tenantSingleTypeAssignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_singleTypeId_locale: { tenantId: "demo-tenant-new", singleTypeId: "st_home", locale: "id" } },
        create: expect.objectContaining({ singleTypeId: "st_home", enabled: true, data: { headline: expect.any(String) }, publishedAt: expect.any(Date) }),
        update: expect.objectContaining({ enabled: true, data: { headline: expect.any(String) }, publishedAt: expect.any(Date) }),
      }),
    )
  })

  // Third external audit, DEMO-3: a relation field's dummyData value is a
  // plain slugified LABEL reference (e.g. "nasional"), resolved against
  // whichever target content type's own entries got seeded — not a real id
  // nobody writing a template could know in advance. "artikel" is listed
  // BEFORE "kategori" here deliberately: resolution runs as a second pass
  // after EVERY content type is seeded, so it must not depend on array order.
  it("resolves a relation dummyData value by natural-key label match against another content type's seeded entries, regardless of array order", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-news" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "artikel",
        schemaFields: [
          { slug: "title", name: "Judul", type: "text", options: null, relationSlug: null },
          { slug: "kategori", name: "Kategori", type: "relation", options: { relationType: "manyToOne" }, relationSlug: "kategori" },
        ],
      },
      {
        slug: "kategori",
        schemaFields: [{ slug: "name", name: "Nama", type: "text", options: null, relationSlug: null }],
      },
    ])

    const schema = {
      ...schemaTemplate,
      schema: {
        contentTypes: [
          { slug: "artikel", dummyData: [{ title: "Berita A", kategori: "nasional" }, { title: "Berita B", kategori: "ekonomi" }, { title: "Berita C", kategori: "olahraga" }] },
          { slug: "kategori", dummyData: [{ name: "Nasional" }, { name: "Ekonomi" }, { name: "Olahraga" }] },
        ],
      },
    }

    await ensureDemoTenantForSchemaTemplate(schema)

    // Created WITHOUT the relation field (a raw label string would
    // otherwise be stored as if it were a real id).
    expect(createContentEntry).toHaveBeenCalledTimes(6)
    expect(createContentEntry.mock.calls[0][2].data).not.toHaveProperty("kategori")

    // kategori entries are entry_4/5/6 (seeded after all 3 artikel entries).
    expect(updateContentEntry).toHaveBeenCalledTimes(3)
    expect(updateContentEntry).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "system" },
      { contentTypeSlug: "artikel", entryId: "entry_1", data: { kategori: "entry_4" } },
    )
    expect(updateContentEntry).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "system" },
      { contentTypeSlug: "artikel", entryId: "entry_3", data: { kategori: "entry_6" } },
    )
  })

  it("resolves a *-to-many relation dummyData array against multiple target entries, and silently drops any label that matches nothing", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-news" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "artikel",
        schemaFields: [
          { slug: "title", name: "Judul", type: "text", options: null, relationSlug: null },
          { slug: "tags", name: "Tags", type: "relation", options: { relationType: "manyToMany" }, relationSlug: "kategori" },
        ],
      },
      {
        slug: "kategori",
        schemaFields: [{ slug: "name", name: "Nama", type: "text", options: null, relationSlug: null }],
      },
    ])

    // 3 rows each (not 1-2) deliberately: dummyData shorter than
    // SAMPLE_ENTRIES_PER_CONTENT_TYPE cycles to fill the minimum, which
    // would otherwise re-seed "Nasional" twice and overwrite its own
    // natural-key mapping — irrelevant to what THIS test checks.
    const schema = {
      ...schemaTemplate,
      schema: {
        contentTypes: [
          { slug: "artikel", dummyData: [{ title: "Berita A", tags: ["nasional", "tidak-ada", "ekonomi"] }, { title: "Berita B" }, { title: "Berita C" }] },
          { slug: "kategori", dummyData: [{ name: "Nasional" }, { name: "Ekonomi" }, { name: "Olahraga" }] },
        ],
      },
    }

    await ensureDemoTenantForSchemaTemplate(schema)

    expect(updateContentEntry).toHaveBeenCalledTimes(1)
    expect(updateContentEntry).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "system" },
      { contentTypeSlug: "artikel", entryId: "entry_1", data: { tags: ["entry_4", "entry_5"] } },
    )
  })

  // Third external audit, DEMO-4: the generic synthesizer's own fallback
  // values for these three types were flatly wrong — boolean always
  // `true` (hiding every seeded entry from nav if the field happened to be
  // named hideFromMenu/hideFromFooter), color falling through to plain
  // placeholder TEXT (not a hex value at all), and a url-type "coverUrl"
  // field pointing at SaCMS's own marketing site instead of a plausible
  // image.
  it("generates a real hex color, an alternating (not always-true) boolean, and a placeholder IMAGE url for a 'cover'-named url field", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "artikel",
        schemaFields: [
          { slug: "accentColor", name: "Warna Aksen", type: "color", options: null, relationSlug: null },
          { slug: "breaking", name: "Breaking", type: "boolean", options: null, relationSlug: null },
          { slug: "coverUrl", name: "Cover URL", type: "url", options: null, relationSlug: null },
          { slug: "externalLink", name: "Link Eksternal", type: "url", options: null, relationSlug: null },
        ],
      },
    ])

    await ensureDemoTenantForSchemaTemplate({ ...schemaTemplate, schema: { contentTypes: [] } })

    const seeded = createContentEntry.mock.calls.map((call) => call[2].data)
    expect(seeded).toHaveLength(3)
    for (const entry of seeded) {
      expect(entry.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(entry.coverUrl).toMatch(/^https:\/\/picsum\.photos\//)
      expect(entry.externalLink).toBe("https://example.com")
    }
    // Alternates rather than being uniformly true — index 0 true, index 1 false.
    expect(seeded[0].breaking).toBe(true)
    expect(seeded[1].breaking).toBe(false)
  })

  it("never calls updateContentEntry when a relation dummyData value matches nothing on either side", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-news" })
    contentTypeFindMany.mockResolvedValue([
      {
        slug: "artikel",
        schemaFields: [{ slug: "kategori", name: "Kategori", type: "relation", options: {}, relationSlug: "kategori-asing" }],
      },
    ])
    const schema = { ...schemaTemplate, schema: { contentTypes: [{ slug: "artikel", dummyData: [{ kategori: "nasional" }] }] } }

    await ensureDemoTenantForSchemaTemplate(schema)

    expect(updateContentEntry).not.toHaveBeenCalled()
  })
})
