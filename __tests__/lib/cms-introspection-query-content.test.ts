import { describe, it, expect, vi, beforeEach } from "vitest"
import { queryContentForTenant } from "@/lib/cms-introspection"

// A real, confirmed bug (chatgpt5.md): query_content's `search` param was
// destructured out of QueryContentOptions and declared on the MCP tool's
// inputSchema, but queryContentForTenant's own destructuring silently
// dropped it — the where clause never applied it, so a term matching
// NOTHING still returned the whole unfiltered, paginated collection
// (searching "Cappuccino" returned other products; a guaranteed-nonexistent
// word still came back with total: 10).
//
// Fixing that introduced a SECOND, separate regression (chatgpt6.md): the
// fix's raw query did `SELECT * FROM "content_entries"`, which includes
// "searchVector" (an Unsupported("tsvector") column) — Prisma can't
// deserialize it, so the query threw the moment a row was actually
// returned. The zero-match case looked fine (nothing to deserialize),
// which is exactly why it slipped through before. Fixed by selecting only
// ids via raw SQL, then re-fetching the real rows through Prisma's own
// typed client (which already knows to skip Unsupported columns).

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

  it("a search that actually matches something: selects only ids via raw SQL (never '*', which would try to deserialize the tsvector column), then re-fetches full rows via Prisma's typed client", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "e1" }])
      .mockResolvedValueOnce([{ count: BigInt(1) }])
    tenantDb.contentEntry.findMany.mockResolvedValue([
      { id: "e1", status: "PUBLISHED", locale: "id", createdAt: new Date(), publishedAt: null, data: { title: "Cappuccino" } },
    ])

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "Cappuccino" })

    const [dataSql, ...dataParams] = tenantDb.$queryRawUnsafe.mock.calls[0]
    expect(dataSql).toMatch(/SELECT "id" FROM/)
    expect(dataSql).not.toMatch(/SELECT \*/)
    expect(dataSql).toMatch(/"data"::text ILIKE/)
    expect(dataParams).toContain("%Cappuccino%")
    expect(tenantDb.contentEntry.findMany).toHaveBeenCalledWith({ where: { id: { in: ["e1"] } } })
    expect(result?.data).toHaveLength(1)
    expect(result?.data[0].title).toBe("Cappuccino")
    expect(result?.pagination.total).toBe(1)
  })

  it("restores the raw query's own id order, since findMany({ id: { in } }) doesn't preserve it", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "e2" }, { id: "e1" }])
      .mockResolvedValueOnce([{ count: BigInt(2) }])
    // Prisma returns them in a different order than requested — findMany
    // never promises to preserve `in` array order.
    tenantDb.contentEntry.findMany.mockResolvedValue([
      { id: "e1", status: "PUBLISHED", locale: "id", createdAt: new Date(), publishedAt: null, data: { title: "A" } },
      { id: "e2", status: "PUBLISHED", locale: "id", createdAt: new Date(), publishedAt: null, data: { title: "B" } },
    ])

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "x" })
    expect(result?.data.map((d: any) => d._id)).toEqual(["e2", "e1"])
  })

  it("a term matching nothing returns data: [] and total: 0, without ever calling findMany", async () => {
    tenantDb.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }])

    const result = await queryContentForTenant(tenantDb, "t1", { contentTypeSlug: "menu-kedai", search: "zzz-definitely-not-a-real-word-zzz" })

    expect(result?.data).toEqual([])
    expect(result?.pagination.total).toBe(0)
    expect(tenantDb.contentEntry.findMany).not.toHaveBeenCalled()
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
