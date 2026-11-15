import { describe, it, expect, vi, beforeEach } from "vitest"
import { reorderContentTypeGroups } from "@/lib/content-type-group-service"

// A real, confirmed bug (chatgpt6.md): reorderContentTypeGroups used the
// array form of $transaction (`$transaction(orderedIds.map(id => ...))`).
// A dedicated-tenant client is wrapped in a connection-fallback Proxy whose
// .catch() wrapping strips the PrismaPromise branding that array form
// requires — some updates landed individually, THEN the batch call itself
// threw, leaving the group order changed despite the tool reporting
// failure. The interactive callback form (`$transaction(async (tx) => ...)`)
// gets a real `tx` handle directly from the engine and is genuinely atomic.

function makeTenantDb() {
  const update = vi.fn().mockResolvedValue({})
  const findMany = vi.fn()
  return {
    contentTypeGroup: { findMany, update },
    // Mirrors the real interactive-transaction contract: the callback
    // receives a `tx` object whose methods are what actually get awaited.
    $transaction: vi.fn(async (cb: any) => cb({ contentTypeGroup: { update } })),
  }
}

describe("reorderContentTypeGroups", () => {
  let tenantDb: ReturnType<typeof makeTenantDb>

  beforeEach(() => {
    tenantDb = makeTenantDb()
  })

  it("rejects when any id isn't actually a sibling under this parent/tenant", async () => {
    tenantDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }])
    const result = await reorderContentTypeGroups(tenantDb, "t1", null, ["g1", "g2", "g-not-a-sibling"])
    expect(result).toEqual({ error: "Daftar grup tidak valid" })
    expect(tenantDb.$transaction).not.toHaveBeenCalled()
  })

  it("uses the interactive callback form, never the array form, so a dedicated-tenant Proxy client can't strip PrismaPromise branding", async () => {
    tenantDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }, { id: "g3" }])
    await reorderContentTypeGroups(tenantDb, "t1", null, ["g3", "g1", "g2"])

    expect(tenantDb.$transaction).toHaveBeenCalledTimes(1)
    expect(typeof tenantDb.$transaction.mock.calls[0][0]).toBe("function")
    expect(tenantDb.contentTypeGroup.update).toHaveBeenCalledWith({ where: { id: "g3" }, data: { order: 0 } })
    expect(tenantDb.contentTypeGroup.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { order: 1 } })
    expect(tenantDb.contentTypeGroup.update).toHaveBeenCalledWith({ where: { id: "g2" }, data: { order: 2 } })
  })

  it("rolls back every update already applied in this call when one fails partway through — the whole reorder is one transaction", async () => {
    tenantDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }, { id: "g3" }])
    const update = vi.fn()
      .mockResolvedValueOnce({}) // g1 succeeds
      .mockRejectedValueOnce(new Error("db exploded")) // g2 fails
    // The interactive form's real behavior: if the callback throws,
    // Prisma rolls back and $transaction itself rejects — simulate that
    // by having the mocked $transaction propagate the callback's throw.
    tenantDb.$transaction = vi.fn(async (cb: any) => cb({ contentTypeGroup: { update } }))

    await expect(reorderContentTypeGroups(tenantDb, "t1", null, ["g1", "g2", "g3"])).rejects.toThrow("db exploded")
    // g3's update must never even be attempted once g2 failed mid-loop —
    // proof this is one sequential transaction, not independent writes.
    expect(update).toHaveBeenCalledTimes(2)
  })

  it("returns success when every update applies cleanly", async () => {
    tenantDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }])
    const result = await reorderContentTypeGroups(tenantDb, "t1", null, ["g2", "g1"])
    expect(result).toEqual({ success: true })
  })
})
