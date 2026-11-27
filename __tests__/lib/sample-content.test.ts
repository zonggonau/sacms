import { describe, it, expect, vi } from "vitest"
import { buildSamplePlan, MAX_PER_TYPE, DEFAULT_PER_TYPE, type SampleSchema } from "@/lib/sample-content/plan"
import { sampleEntryData } from "@/lib/sample-content/values"
import { runSamplePlan, type EntryWriter, type SeedLedger, type SeedRecord } from "@/lib/sample-content/run"

const f = (slug: string, type: string, extra: Record<string, unknown> = {}) => ({ name: slug, slug, type, ...extra }) as any

const schema = (over: Partial<SampleSchema> = {}): SampleSchema => ({
  contentTypes: [],
  singleTypes: [],
  components: [],
  ...over,
})

const authors = { name: "Penulis", slug: "authors", fields: [f("nama", "text", { required: true })] }
const books = { name: "Buku", slug: "books", fields: [f("judul", "text", { required: true }), f("penulis", "relation", { relationSlug: "authors", options: { relationType: "manyToOne" } })] }

describe("buildSamplePlan", () => {
  it("writes relation targets before the Content Types that point at them", () => {
    const plan = buildSamplePlan(schema({ contentTypes: [books, authors] }), {})
    const order = plan.steps.map((s) => s.contentType)
    expect(order.indexOf("authors")).toBeLessThan(order.indexOf("books"))
    expect(plan.steps.find((s) => s.contentType === "books")!.dependsOn).toEqual(["authors"])
  })

  it("skips a Content Type that already has entries, and says so", () => {
    const plan = buildSamplePlan(schema({ contentTypes: [authors] }), { existingCounts: { authors: 4 } })
    expect(plan.steps).toHaveLength(0)
    expect(plan.skipped[0]).toMatchObject({ contentType: "authors" })
    expect(plan.skipped[0].reason).toContain("4 entri")
  })

  it("skips a Content Type whose required media cannot be produced", () => {
    const ct = { name: "Produk", slug: "products", fields: [f("nama", "text", { required: true }), f("foto", "media", { required: true })] }
    const plan = buildSamplePlan(schema({ contentTypes: [ct] }), {})
    expect(plan.steps).toHaveLength(0)
    expect(plan.skipped[0].reason).toContain("foto")
  })

  it("keeps a Content Type and reports an optional media field it cannot fill", () => {
    const ct = { name: "Produk", slug: "products", fields: [f("nama", "text", { required: true }), f("foto", "media")] }
    const plan = buildSamplePlan(schema({ contentTypes: [ct] }), {})
    expect(plan.steps.map((s) => s.contentType)).toEqual(["products"])
    expect(plan.unfillable).toEqual([expect.objectContaining({ contentType: "products", field: "foto" })])
  })

  it("treats a relation to Member as unfillable (not a planned dependency)", () => {
    const ct = { name: "Ulasan", slug: "reviews", fields: [f("isi", "text"), f("pembeli", "relation", { options: { targetModel: "member" } })] }
    const plan = buildSamplePlan(schema({ contentTypes: [ct] }), {})
    expect(plan.steps[0].dependsOn).toEqual([])
    expect(plan.unfillable.map((u) => u.field)).toContain("pembeli")
  })

  it("skips a dependent when its relation target was skipped", () => {
    const broken = { name: "Penulis", slug: "authors", fields: [f("foto", "media", { required: true })] }
    const plan = buildSamplePlan(schema({ contentTypes: [broken, books] }), {})
    expect(plan.steps).toHaveLength(0)
    expect(plan.skipped.find((s) => s.contentType === "books")!.reason).toContain("authors")
  })

  it("drops a relation cycle rather than looping", () => {
    const a = { name: "A", slug: "a", fields: [f("x", "text"), f("b", "relation", { relationSlug: "b", required: true })] }
    const b = { name: "B", slug: "b", fields: [f("y", "text"), f("a", "relation", { relationSlug: "a", required: true })] }
    const plan = buildSamplePlan(schema({ contentTypes: [a, b] }), {})
    expect(plan.steps).toHaveLength(0)
    expect(plan.skipped.map((s) => s.reason).join(" ")).toMatch(/melingkar|tidak tersedia|dilewati/)
  })

  it("clamps the per-type count", () => {
    expect(buildSamplePlan(schema({ contentTypes: [authors] }), { perType: 50 }).perType).toBe(MAX_PER_TYPE)
    expect(buildSamplePlan(schema({ contentTypes: [authors] }), { perType: 0 }).perType).toBe(DEFAULT_PER_TYPE)
  })

  it("gives a stable batch key for the same inputs and a different one for another perType", () => {
    const s = schema({ contentTypes: [books, authors] })
    const a = buildSamplePlan(s, {}).batchKey
    expect(buildSamplePlan(s, {}).batchKey).toBe(a)
    expect(buildSamplePlan(s, { perType: 1 }).batchKey).not.toBe(a)
  })

  it("reports a slug field with no title-like sibling", () => {
    const ct = { name: "Halaman", slug: "pages", fields: [f("kode", "slug"), f("isi", "text")] }
    const plan = buildSamplePlan(schema({ contentTypes: [ct] }), {})
    expect(plan.unfillable.find((u) => u.field === "kode")).toBeDefined()
  })

  it("skips a required component whose definition is missing", () => {
    const ct = { name: "Hero", slug: "heroes", fields: [f("blok", "component", { required: true, options: { componentSlug: "ghost" } })] }
    const plan = buildSamplePlan(schema({ contentTypes: [ct] }), {})
    expect(plan.steps).toHaveLength(0)
  })
})

describe("sampleEntryData", () => {
  const ctx = (index: number, relationIds: (t: string) => string[] = () => []) => ({
    index, contentTypeName: "Menu", relationIds, schema: schema(),
  })

  it("picks select choices by index and multiselect as an array", () => {
    const ct = { name: "Menu", slug: "menu", fields: [f("kategori", "select", { options: { choices: [{ label: "A", value: "a" }, { label: "B", value: "b" }] } }), f("tag", "multiselect", { options: { choices: [{ label: "X", value: "x" }] } })] }
    expect(sampleEntryData(ct, ["kategori", "tag"], ctx(0))).toEqual({ kategori: "a", tag: ["x"] })
    expect(sampleEntryData(ct, ["kategori"], ctx(1)).kategori).toBe("b")
  })

  it("writes currency as a number and location as Nabire coordinates", () => {
    const ct = { name: "Menu", slug: "menu", fields: [f("harga", "currency"), f("lokasi", "location")] }
    const data = sampleEntryData(ct, ["harga", "lokasi"], ctx(0))
    expect(data.harga).toBe(15000)
    expect(data.lokasi).toEqual({ lat: -3.3667, lng: 135.4833 })
  })

  it("never sets a slug field itself", () => {
    const ct = { name: "Menu", slug: "menu", fields: [f("judul", "text"), f("kode", "slug")] }
    expect(sampleEntryData(ct, ["judul", "kode"], ctx(0))).not.toHaveProperty("kode")
  })

  it("uses a relation id that was written or already exists", () => {
    const ct = { name: "Buku", slug: "books", fields: [f("penulis", "relation", { relationSlug: "authors", options: { relationType: "manyToOne" } })] }
    expect(sampleEntryData(ct, ["penulis"], ctx(0, (t) => (t === "authors" ? ["a1", "a2"] : [])))).toEqual({ penulis: "a1" })
    expect(sampleEntryData(ct, ["penulis"], ctx(1, (t) => (t === "authors" ? ["a1", "a2"] : [])))).toEqual({ penulis: "a2" })
  })

  it("wraps a repeatable component in an array", () => {
    const comp = { name: "Kartu", slug: "card", fields: [f("judul", "text")] }
    const ct = { name: "Halaman", slug: "pages", fields: [f("kartu", "component", { options: { componentSlug: "card", repeatable: true } })] }
    const data = sampleEntryData(ct, ["kartu"], { ...ctx(0), schema: schema({ components: [comp] }) })
    expect(Array.isArray(data.kartu)).toBe(true)
    expect((data.kartu as any[])[0]).toHaveProperty("judul")
  })
})

describe("runSamplePlan", () => {
  function memoryLedger(initial: SeedRecord | null = null): SeedLedger & { store: Map<string, SeedRecord> } {
    const store = new Map<string, SeedRecord>()
    if (initial) store.set("k", initial)
    return {
      store,
      load: async (key) => store.get(key) ?? null,
      save: async (key, rec) => { store.set(key, JSON.parse(JSON.stringify(rec))) },
    }
  }

  function writer(overrides: Partial<EntryWriter> = {}) {
    let n = 0
    const create = vi.fn(async (slug: string, _data: Record<string, unknown>) => ({ ok: true as const, id: `${slug}-${++n}` }))
    const w: EntryWriter = {
      create,
      upsertSingle: async (slug) => ({ ok: true as const, id: `single-${slug}` }),
      existingIds: async () => [],
      ...overrides,
    }
    return { w, create }
  }

  it("writes in dependency order and links each book to a real author id", async () => {
    const s = schema({ contentTypes: [books, authors] })
    const plan = buildSamplePlan(s, { perType: 2 })
    const { w, create } = writer()
    const ledger = memoryLedger()
    const result = await runSamplePlan({ schema: s, plan, writer: w, ledger, ledgerKey: "k" })

    expect(result.ok).toBe(true)
    expect(result.created).toBe(4)
    const slugs = create.mock.calls.map((c) => c[0])
    expect(slugs.lastIndexOf("authors")).toBeLessThan(slugs.indexOf("books"))
    const bookData = create.mock.calls.find((c) => c[0] === "books")![1]
    expect(result.ids.authors).toContain(bookData.penulis)
  })

  it("does not write again once a batch is complete", async () => {
    const s = schema({ contentTypes: [authors] })
    const plan = buildSamplePlan(s, { perType: 1 })
    const ledger = memoryLedger()
    const first = writer()
    await runSamplePlan({ schema: s, plan, writer: first.w, ledger, ledgerKey: "k" })

    const second = writer()
    const again = await runSamplePlan({ schema: s, plan, writer: second.w, ledger, ledgerKey: "k" })
    expect(again.alreadySeeded).toBe(true)
    expect(second.create).not.toHaveBeenCalled()
    expect(again.ids.authors).toHaveLength(1)
  })

  it("stops on the first failed write and keeps the ids written so far for cleanup", async () => {
    const s = schema({ contentTypes: [authors] })
    const plan = buildSamplePlan(s, { perType: 3 })
    let calls = 0
    const { w } = writer({
      create: async (slug) => {
        calls++
        if (calls === 2) return { ok: false as const, message: "validasi gagal" }
        return { ok: true as const, id: `${slug}-${calls}` }
      },
    })
    const ledger = memoryLedger()
    const result = await runSamplePlan({ schema: s, plan, writer: w, ledger, ledgerKey: "k" })

    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({ contentType: "authors", message: "validasi gagal" })
    expect(ledger.store.get("k")!.complete).toBe(false)
    expect(ledger.store.get("k")!.ids.authors).toEqual(["authors-1"])
  })

  it("links a book to an author that already existed in the workspace", async () => {
    const s = schema({ contentTypes: [books] })
    const plan = buildSamplePlan(s, { perType: 1, existingCounts: { authors: 2 } })
    const { w, create } = writer({ existingIds: async (slug) => (slug === "authors" ? ["existing-a1", "existing-a2"] : []) })
    const result = await runSamplePlan({ schema: s, plan, writer: w, ledger: memoryLedger(), ledgerKey: "k" })
    expect(result.ok).toBe(true)
    expect(create.mock.calls[0][1].penulis).toBe("existing-a1")
  })
})

describe("Single Types", () => {
  const home = { name: "Beranda", slug: "homepage", fields: [f("judul", "text", { required: true }), f("hero", "text")] }
  const settings = { name: "Pengaturan", slug: "site-settings", fields: [f("nama-situs", "text", { required: true })] }

  it("plans single types after the Content Types they depend on, one entry each", () => {
    const profile = { name: "Profil", slug: "profiles", fields: [f("nama", "text")] }
    const single = { name: "Tentang", slug: "about", fields: [f("pemilik", "relation", { relationSlug: "profiles" })] }
    const plan = buildSamplePlan(schema({ contentTypes: [profile], singleTypes: [single] }), { perType: 5 })
    const order = plan.steps.map((s) => `${s.kind}:${s.contentType}`)
    expect(order.indexOf("collection:profiles")).toBeLessThan(order.indexOf("single:about"))
    expect(plan.steps.find((s) => s.kind === "single")!.count).toBe(1)
  })

  it("skips a single type that already has content", () => {
    const plan = buildSamplePlan(schema({ singleTypes: [home] }), { existingCounts: { "single:homepage": 1 } })
    expect(plan.steps).toHaveLength(0)
    expect(plan.skipped[0].reason).toContain("sudah berisi data")
  })

  it("writes a single type through upsertSingle under a single: ledger key", async () => {
    const s = schema({ singleTypes: [settings, home] })
    const plan = buildSamplePlan(s, {})
    const create = vi.fn(async () => ({ ok: true as const, id: "never" }))
    const upsertSingle = vi.fn(async (slug: string) => ({ ok: true as const, id: `assign-${slug}` }))
    const store = new Map<string, SeedRecord>()
    const ledger: SeedLedger = { load: async (k) => store.get(k) ?? null, save: async (k, r) => { store.set(k, r) } }
    const result = await runSamplePlan({ schema: s, plan, writer: { create, upsertSingle, existingIds: async () => [] }, ledger, ledgerKey: "k" })

    expect(result.ok).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(upsertSingle.mock.calls.map((c) => c[0]).sort()).toEqual(["homepage", "site-settings"])
    expect(result.ids["single:homepage"]).toEqual(["assign-homepage"])
  })
})
