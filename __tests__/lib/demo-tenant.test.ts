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
const tenantSingleTypeAssignmentCreate = vi.fn().mockResolvedValue({})
const tenantDbMock = {
  contentType: { findMany: contentTypeFindMany },
  singleType: { findMany: singleTypeFindMany },
  tenantSingleTypeAssignment: { create: tenantSingleTypeAssignmentCreate },
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

  it("seeds one TenantSingleTypeAssignment row per single type", async () => {
    tenantFindUnique.mockResolvedValue(null)
    tenantCreate.mockResolvedValue({ id: "demo-tenant-new", slug: "demo-company-profile" })
    singleTypeFindMany.mockResolvedValue([
      { id: "st_home", slug: "homepage", schemaFields: [{ slug: "headline", name: "Headline", type: "text", options: null }] },
    ])

    await ensureDemoTenantForSchemaTemplate(schemaTemplate)

    expect(tenantSingleTypeAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ singleTypeId: "st_home", enabled: true, data: { headline: expect.any(String) } }),
      }),
    )
  })
})
