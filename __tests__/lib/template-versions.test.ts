import { describe, it, expect, vi, beforeEach } from "vitest"

const count = vi.fn()
const findFirst = vi.fn()
const create = vi.fn()
const deleteMany = vi.fn()
vi.mock("@/lib/database", () => ({
  db: {
    websiteTemplateVersion: {
      count: (...a: any[]) => count(...a),
      findFirst: (...a: any[]) => findFirst(...a),
      create: (...a: any[]) => create(...a),
      deleteMany: (...a: any[]) => deleteMany(...a),
    },
  },
}))

const { summarizeFileChanges, recordTemplateVersion, fileSha256, MAX_VERSIONS_PER_TEMPLATE } = await import("@/lib/infrastructure/template-versions")

const f = (path: string, content: string) => ({ path, content })

describe("summarizeFileChanges", () => {
  it("counts added, changed and removed files by content hash", () => {
    const before = [f("a.ts", "1"), f("b.ts", "2"), f("c.ts", "3")]
    const after = [f("a.ts", "1"), f("b.ts", "CHANGED"), f("d.ts", "new")]
    expect(summarizeFileChanges(before, after)).toEqual({ added: 1, changed: 1, removed: 1 })
  })

  it("hashes with sha256", () => {
    expect(fileSha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })
})

describe("recordTemplateVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockImplementation(async ({ data }) => data)
    deleteMany.mockResolvedValue({ count: 0 })
  })

  it("records a brand-new template's first version as 'Created'", async () => {
    count.mockResolvedValue(0)
    findFirst.mockResolvedValue(null)

    await recordTemplateVersion({ websiteTemplateId: "wt_1", files: [f("a.ts", "1")], schema: {}, changedBy: "ChatGPT", tokenId: "tok_1" })

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data).toMatchObject({ version: 1, summary: "Created (1 files)", changedBy: "ChatGPT", tokenId: "tok_1" })
  })

  it("records a baseline of the pre-edit state first when a template had no history yet, so the first tracked change can be rolled back", async () => {
    count.mockResolvedValue(0)
    findFirst
      .mockResolvedValueOnce(null) // baseline: latest version number
      .mockResolvedValueOnce({ files: [f("a.ts", "1")] }) // previous (the baseline) for the diff
      .mockResolvedValueOnce({ version: 1 }) // new version number

    await recordTemplateVersion({
      websiteTemplateId: "wt_1",
      files: [f("a.ts", "2")],
      schema: {},
      changedBy: "ChatGPT",
      tokenId: "tok_1",
      baseline: { files: [f("a.ts", "1")], schema: {} },
    })

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].data).toMatchObject({ version: 1, summary: expect.stringMatching(/^Baseline/) })
    expect(create.mock.calls[1][0].data).toMatchObject({ version: 2, summary: "+0 ~1 -0 files" })
  })

  it("labels a restore and a schema change in the summary, and prunes beyond the retention limit", async () => {
    count.mockResolvedValue(40)
    findFirst
      .mockResolvedValueOnce({ files: [f("a.ts", "1")] })
      .mockResolvedValueOnce({ version: 40 })

    await recordTemplateVersion({
      websiteTemplateId: "wt_1",
      files: [f("a.ts", "1")],
      schema: {},
      changedBy: null,
      tokenId: null,
      schemaChanged: true,
      note: "Restored from v3",
    })

    expect(create.mock.calls[0][0].data.summary).toBe("Restored from v3: +0 ~0 -0 files; schema changed")
    expect(deleteMany).toHaveBeenCalledWith({ where: { websiteTemplateId: "wt_1", version: { lte: 41 - MAX_VERSIONS_PER_TEMPLATE } } })
  })

  it("never throws — a history failure must not fail the edit itself", async () => {
    count.mockRejectedValue(new Error("db down"))
    await expect(recordTemplateVersion({ websiteTemplateId: "wt_1", files: [], schema: {}, changedBy: null, tokenId: null })).resolves.toBeNull()
  })
})
