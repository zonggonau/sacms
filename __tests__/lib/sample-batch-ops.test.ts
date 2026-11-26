import { describe, it, expect, vi } from "vitest"
import { ledgerKeyFor, batchKeyFromLedgerKey, ledgerPrefixFor, summarizeBatch, clearTargets, verifyBatch, type VerifyAdapters } from "@/lib/sample-content/batch-ops"
import { clearSampleBatch, type ClearDeps } from "@/lib/sample-content/clear"
import type { SeedRecord } from "@/lib/sample-content/run"

const record = (over: Partial<SeedRecord> = {}): SeedRecord => ({
  batchKey: "abc123",
  locale: "id",
  createdAt: "2026-11-26T00:00:00.000Z",
  complete: true,
  ids: { authors: ["a1", "a2"], books: ["b1"], "single:homepage": ["s1"] },
  ...over,
})

describe("ledger keys", () => {
  it("reads the batch id from a workspace key and from a demo key", () => {
    expect(batchKeyFromLedgerKey(ledgerKeyFor("tenant1", "abc123"))).toBe("abc123")
    expect(batchKeyFromLedgerKey(ledgerKeyFor("demo:demo-9", "abc123"))).toBe("abc123")
  })

  it("does not read a batch id from an unrelated setting", () => {
    expect(batchKeyFromLedgerKey("vercelProjectId")).toBeNull()
  })

  it("prefixes every batch of one scope and no other", () => {
    expect(ledgerKeyFor("tenant1", "x").startsWith(ledgerPrefixFor("tenant1"))).toBe(true)
    expect(ledgerKeyFor("tenant2", "x").startsWith(ledgerPrefixFor("tenant1"))).toBe(false)
  })
})

describe("summarizeBatch and clearTargets", () => {
  it("counts entries per Content Type and lists single types apart", () => {
    const s = summarizeBatch("abc123", record())
    expect(s.collections).toEqual({ authors: 2, books: 1 })
    expect(s.singles).toEqual(["homepage"])
    expect(s.locale).toBe("id")
    expect(s.cleared).toBe(false)
  })

  it("lists only what the ledger recorded for clearing", () => {
    const t = clearTargets(record({ ids: { authors: ["a1"], books: [], "single:homepage": ["s1"] } }))
    expect(t.collections).toEqual([{ contentType: "authors", ids: ["a1"] }])
    expect(t.singles).toEqual([{ singleType: "homepage", slug: "homepage" }])
  })
})

describe("clearSampleBatch", () => {
  function deps(overrides: Partial<ClearDeps> = {}) {
    const saved: SeedRecord[] = []
    const d: ClearDeps = {
      deleteEntry: vi.fn(async () => "deleted" as const),
      clearSingle: vi.fn(async () => true),
      saveRecord: async (r) => { saved.push(r) },
      ...overrides,
    }
    return { d, saved }
  }

  it("soft-deletes each recorded entry and marks the batch cleared", async () => {
    const { d, saved } = deps()
    const result = await clearSampleBatch(record(), d)
    expect(result.deletedEntries).toBe(3)
    expect(result.clearedSingles).toBe(1)
    expect(result.failures).toEqual([])
    expect(saved[0].cleared).toBe(true)
  })

  it("treats an entry that is already gone as done, not as a failure", async () => {
    const { d, saved } = deps({ deleteEntry: async () => "gone" })
    const result = await clearSampleBatch(record(), d)
    expect(result.failures).toEqual([])
    expect(saved[0].cleared).toBe(true)
  })

  it("keeps the batch uncleared when a delete really fails, so it can be retried", async () => {
    const { d, saved } = deps({ deleteEntry: async (_ct, id) => { if (id === "a2") throw new Error("db down"); return "deleted" } })
    const result = await clearSampleBatch(record(), d)
    expect(result.failures).toEqual([expect.objectContaining({ id: "a2", message: "db down" })])
    expect(saved).toHaveLength(0)
  })

  it("does nothing on a second call", async () => {
    const { d } = deps()
    const result = await clearSampleBatch(record({ cleared: true }), d)
    expect(result.alreadyCleared).toBe(true)
    expect(d.deleteEntry).not.toHaveBeenCalled()
    expect(d.clearSingle).not.toHaveBeenCalled()
  })
})

describe("verifyBatch", () => {
  const rec = record({ ids: { authors: ["pub", "draft", "gone"], "single:homepage": ["s1"] } })

  function adapters(over: Partial<VerifyAdapters> = {}): VerifyAdapters {
    return {
      entry: async (_ct, id) => ({ pub: { status: "PUBLISHED", locale: "id" }, draft: { status: "DRAFT", locale: "id" } } as Record<string, { status: string; locale: string }>)[id] ?? null,
      publicIds: async () => new Set(["pub"]),
      single: async () => ({ published: true }),
      ...over,
    }
  }

  it("passes when published entries are in the public API and drafts are reported as not public", async () => {
    const healthy = record({ ids: { authors: ["pub", "draft"], "single:homepage": ["s1"] } })
    const report = await verifyBatch(healthy, adapters())
    expect(report.ok).toBe(true)
    expect(report.notPublic).toBe(1)
  })

  it("fails a published entry that the public API does not return", async () => {
    const report = await verifyBatch(rec, adapters({ publicIds: async () => new Set() }))
    expect(report.ok).toBe(false)
    expect(report.checks.find((c) => c.id === "pub")!.detail).toContain("public API")
  })

  it("fails an entry that is missing or deleted", async () => {
    const report = await verifyBatch(rec, adapters())
    expect(report.checks.find((c) => c.id === "gone")!.ok).toBe(false)
  })

  it("fails an entry stored in another locale", async () => {
    const report = await verifyBatch(rec, adapters({ entry: async () => ({ status: "PUBLISHED", locale: "en" }) }))
    expect(report.checks.find((c) => c.id === "pub")!.detail).toContain("expected id")
  })

  it("fails a single type whose content for the locale is missing", async () => {
    const report = await verifyBatch(rec, adapters({ single: async () => null }))
    expect(report.checks.find((c) => c.kind === "single")!.ok).toBe(false)
  })
})
