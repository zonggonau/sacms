vi.mock("@/lib/schema-lock", () => ({ finalizeSchema: vi.fn(async () => {}) }))
import { describe, it, expect, vi, beforeEach } from "vitest"

// seedDefaultTenantSchema materializes the one isDefault SchemaTemplate
// (Post/Kategori Content Types) PLUS every PUBLISHED GlobalComponent into a
// brand-new tenant — self-healing (ensureDefaultSchemaTemplate) rather than
// requiring a manual one-off seed script per environment.

const schemaTemplateFindFirst = vi.fn()
const schemaTemplateUpsert = vi.fn()
const globalComponentFindMany = vi.fn()
const tenantDbMock = { __tag: "tenant-db" }
const getTenantDbById = vi.fn(async () => tenantDbMock)

vi.mock("@/lib/database", () => ({
  db: {
    schemaTemplate: { findFirst: schemaTemplateFindFirst, upsert: schemaTemplateUpsert },
    globalComponent: { findMany: globalComponentFindMany },
  },
  getTenantDbById,
}))

const materializeSchemaIntoTenant = vi.fn().mockResolvedValue({ imported: 0 })
vi.mock("@/lib/schema-template-sync", () => ({
  materializeSchemaIntoTenant,
}))

const { ensureDefaultSchemaTemplate, seedDefaultTenantSchema } = await import("@/lib/infrastructure/default-tenant-schema")

const DEFAULT_TEMPLATE_ROW = {
  id: "st_default",
  slug: "default-starter-schema",
  isDefault: true,
  schema: {
    contentTypes: [
      { name: "Kategori", slug: "kategori", fields: [{ name: "Nama", slug: "name", type: "text" }] },
      { name: "Post", slug: "posts", fields: [{ name: "Judul", slug: "title", type: "text" }] },
    ],
    singleTypes: [],
  },
}

describe("ensureDefaultSchemaTemplate", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the existing isDefault row without creating a new one", async () => {
    schemaTemplateFindFirst.mockResolvedValue(DEFAULT_TEMPLATE_ROW)

    const result = await ensureDefaultSchemaTemplate()

    expect(result).toBe(DEFAULT_TEMPLATE_ROW)
    expect(schemaTemplateUpsert).not.toHaveBeenCalled()
  })

  it("self-heals by upserting the fixed-slug default template when no isDefault row exists yet in this environment", async () => {
    schemaTemplateFindFirst.mockResolvedValue(null)
    schemaTemplateUpsert.mockResolvedValue(DEFAULT_TEMPLATE_ROW)

    await ensureDefaultSchemaTemplate()

    expect(schemaTemplateUpsert).toHaveBeenCalledTimes(1)
    const args = schemaTemplateUpsert.mock.calls[0][0]
    expect(args.where).toEqual({ slug: "default-starter-schema" })
    expect(args.create.isDefault).toBe(true)
    expect(args.update).toEqual({ isDefault: true })
    const bundle = args.create.schema as { contentTypes: Array<{ slug: string }> }
    const slugs = bundle.contentTypes.map((ct) => ct.slug)
    expect(slugs).toEqual(["kategori", "posts"])
  })
})

describe("seedDefaultTenantSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    schemaTemplateFindFirst.mockResolvedValue(DEFAULT_TEMPLATE_ROW)
    globalComponentFindMany.mockResolvedValue([])
  })

  it("deliberately strips contentTypes (Post, Kategori stay opt-in — added later by an AI agent or manually) while still materializing into the tenant's own db", async () => {
    await seedDefaultTenantSchema("tenant-1")

    expect(getTenantDbById).toHaveBeenCalledWith("tenant-1")
    expect(materializeSchemaIntoTenant).toHaveBeenCalledTimes(1)
    const [tenantDbArg, tenantIdArg, schemaArg] = materializeSchemaIntoTenant.mock.calls[0]
    expect(tenantDbArg).toBe(tenantDbMock)
    expect(tenantIdArg).toBe("tenant-1")
    expect(schemaArg.contentTypes).toEqual([])
  })

  it("only queries PUBLISHED GlobalComponents, and maps them into the bundle's `components`", async () => {
    globalComponentFindMany.mockResolvedValue([
      { name: "Testimonial", slug: "testimonial", description: "A quote", fields: [{ name: "Quote", slug: "quote", type: "textarea" }] },
    ])

    await seedDefaultTenantSchema("tenant-1")

    expect(globalComponentFindMany).toHaveBeenCalledWith({ where: { published: true } })
    const [, , schemaArg] = materializeSchemaIntoTenant.mock.calls[0]
    expect(schemaArg.components).toEqual([
      { name: "Testimonial", slug: "testimonial", description: "A quote", fields: [{ name: "Quote", slug: "quote", type: "textarea" }] },
    ])
  })

  it("passes an empty components array when no GlobalComponent is published", async () => {
    await seedDefaultTenantSchema("tenant-1")

    const [, , schemaArg] = materializeSchemaIntoTenant.mock.calls[0]
    expect(schemaArg.components).toEqual([])
  })
})
