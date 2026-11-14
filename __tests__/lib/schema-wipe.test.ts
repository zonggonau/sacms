import { describe, it, expect, vi, beforeEach } from "vitest"

// schema-wipe.ts starts with `import "server-only"` — not an npm package
// vitest's plain Node resolution can see, same stub used elsewhere.
vi.mock("server-only", () => ({}))

vi.mock("@/lib/database", () => ({
  getTenantDb: vi.fn(),
}))

const contentTypeDeleteMany = vi.fn()
const singleTypeDeleteMany = vi.fn()
const componentDeleteMany = vi.fn()

const fakeTenantDb = {
  contentType: { deleteMany: contentTypeDeleteMany },
  singleType: { deleteMany: singleTypeDeleteMany },
  component: { deleteMany: componentDeleteMany },
} as any

const { wipeTenantSchema } = await import("@/lib/schema-wipe")

describe("wipeTenantSchema", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes every ContentType/SingleType/Component row scoped to the tenant and reports counts", async () => {
    contentTypeDeleteMany.mockResolvedValue({ count: 3 })
    singleTypeDeleteMany.mockResolvedValue({ count: 1 })
    componentDeleteMany.mockResolvedValue({ count: 2 })

    const result = await wipeTenantSchema(fakeTenantDb, "tenant1")

    expect(contentTypeDeleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(singleTypeDeleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(componentDeleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(result).toEqual({ contentTypes: 3, singleTypes: 1, components: 2 })
  })

  it("reports zero counts for a workspace that already has nothing to wipe", async () => {
    contentTypeDeleteMany.mockResolvedValue({ count: 0 })
    singleTypeDeleteMany.mockResolvedValue({ count: 0 })
    componentDeleteMany.mockResolvedValue({ count: 0 })

    const result = await wipeTenantSchema(fakeTenantDb, "tenant1")
    expect(result).toEqual({ contentTypes: 0, singleTypes: 0, components: 0 })
  })
})
