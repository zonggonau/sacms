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

const createContentEntry = vi.fn().mockResolvedValue({ ok: true })
vi.mock("@/lib/content/entry-service", () => ({
  createContentEntry: (...args: any[]) => createContentEntry(...args),
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
  })

  it("returns the existing demo tenant without creating anything when it already exists", async () => {
    tenantFindUnique.mockResolvedValue({ id: "demo-tenant-1", slug: "demo-company-profile" })

    const result = await ensureDemoTenantForSchemaTemplate({ ...schemaTemplate, demoTenantId: "demo-tenant-1" })

    expect(result).toEqual({ id: "demo-tenant-1", slug: "demo-company-profile" })
    expect(tenantCreate).not.toHaveBeenCalled()
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
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
})
