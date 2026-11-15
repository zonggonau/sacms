import { describe, it, expect, vi, beforeEach } from "vitest"
import { queryContentForTenant } from "@/lib/cms-introspection"

// A real, confirmed bug (chatgpt5.md): query_content's `search` param was
// destructured out of QueryContentOptions and declared on the MCP tool's
// inputSchema, but queryContentForTenant's own destructuring silently
// dropped it — the where clause never applied it, so a term matching
// NOTHING still returned the whole unfiltered, paginated collection
// (searching "Cappuccino" returned other products; a guaranteed-nonexistent
// word still came back with total: 10).

function mockTenantDb() {
  return {
    contentType: { findFirst: vi.fn() },
    contentEntry: { findMany: vi.fn(), count: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  } as any
}

describe("queryContentForTenant", () => {
  let tenantDb: ReturnType<typeof mockTenantDb>

  beforeEach(() => {
    tenantDb = mockTenantDb()
    tenantDb.contentType.findFirst.mockResolvedValue({ id: "ct_1", slug: "menu-kedai" })
  })

  it("returns null when the content type doesn't exist", async () => {
    tenantDb.contentType.findFirst.mockResolvedValue(null)
    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "nope" })
    expect(result).toBeNull()
  })

  it("without a search term, uses the plain Prisma findMany/count path unchanged", async () => {
    tenantDb.contentEntry.findMany.mockResolvedValue([{ id: "e1", status: "PUBLISHED", locale: "id", createdAt: new Date(), publishedAt: null, data: { title: "Cappuccino" } }])
    tenantDb.contentEntry.count.mockResolvedValue(1)

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai" })
    expect(tenantDb.contentEntry.findMany).toHaveBeenCalled()
    expect(tenantDb.$queryRawUnsafe).not.toHaveBeenCalled()
    expect(result?.pagination.total).toBe(1)
  })

  it("applies the search term via raw SQL instead of silently ignoring it", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "e1", status: "PUBLISHED", locale: "id", createdAt: new Date(), publishedAt: null, data: { title: "Cappuccino" } }])
      .mockResolvedValueOnce([{ count: BigInt(1) }])

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "Cappuccino" })

    expect(tenantDb.contentEntry.findMany).not.toHaveBeenCalled()
    expect(tenantDb.$queryRawUnsafe).toHaveBeenCalledTimes(2)
    const [dataSql, ...dataParams] = tenantDb.$queryRawUnsafe.mock.calls[0]
    expect(dataSql).toMatch(/"data"::text ILIKE/)
    expect(dataParams).toContain("%Cappuccino%")
    expect(result?.data).toHaveLength(1)
    expect(result?.pagination.total).toBe(1)
  })

  it("a term matching nothing returns data: [] and total: 0, not the whole collection", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }])

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "zzz-definitely-not-a-real-word-zzz" })

    expect(result?.data).toEqual([])
    expect(result?.pagination.total).toBe(0)
  })

  it("combines search with status and locale filters in the same raw query", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }])

    await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "latte", status: "PUBLISHED", locale: "id" })

    const [dataSql, ...params] = tenantDb.$queryRawUnsafe.mock.calls[0]
    expect(dataSql).toMatch(/"status"::text = \$\d+/)
    expect(dataSql).toMatch(/"locale" = \$\d+/)
    expect(params).toContain("PUBLISHED")
    expect(params).toContain("id")
  })

  it("ignores a whitespace-only search term (falls back to the unfiltered path)", async () => {
    tenantDb.contentEntry.findMany.mockResolvedValue([])
    tenantDb.contentEntry.count.mockResolvedValue(0)

    await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "   " })

    expect(tenantDb.$queryRawUnsafe).not.toHaveBeenCalled()
    expect(tenantDb.contentEntry.findMany).toHaveBeenCalled()
  })
})
