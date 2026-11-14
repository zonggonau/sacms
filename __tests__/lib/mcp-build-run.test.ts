import { describe, it, expect, vi, beforeEach } from "vitest"

// mcp-build-run.ts starts with `import "server-only"` — not an npm package
// vitest's plain Node resolution can see, same stub used elsewhere.
vi.mock("server-only", () => ({}))

// Backs start_website_build/get_build_run — the resumable work unit a
// build/revise request is tied to, so an interrupted ChatGPT conversation
// can pick back up via runId (or just the tenant's latest run) instead of
// starting over or guessing at state that was never persisted anywhere.

const findFirst = vi.fn()
const findUnique = vi.fn()
const create = vi.fn()
const updateMany = vi.fn()

vi.mock("@/lib/database", () => ({
  db: { mcpBuildRun: { findFirst, findUnique, create, updateMany } },
}))

const { startOrResumeBuildRun, getBuildRun, advanceBuildRun } = await import("@/lib/infrastructure/mcp-build-run")

describe("startOrResumeBuildRun", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resumes the tenant's existing non-terminal run instead of creating a new one", async () => {
    const existing = { id: "run_1", tenantId: "t1", intent: "create", stage: "deploying" }
    findFirst.mockResolvedValue(existing)

    const result = await startOrResumeBuildRun("t1", "update")
    expect(result).toEqual({ run: existing, resumed: true })
    expect(create).not.toHaveBeenCalled()
  })

  it("creates a fresh run when none is resumable", async () => {
    findFirst.mockResolvedValue(null)
    const created = { id: "run_2", tenantId: "t1", intent: "create", stage: "discover" }
    create.mockResolvedValue(created)

    const result = await startOrResumeBuildRun("t1", "create")
    expect(result).toEqual({ run: created, resumed: false })
    expect(create).toHaveBeenCalledWith({ data: { tenantId: "t1", intent: "create", stage: "discover" } })
  })

  it("only considers runs still in a non-terminal stage as resumable", async () => {
    await startOrResumeBuildRun("t1", "update")
    const where = findFirst.mock.calls[0][0].where
    expect(where.stage).toEqual({ notIn: ["done", "failed"] })
  })
})

describe("getBuildRun", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches a specific run by id, scoped to the tenant", async () => {
    findUnique.mockResolvedValue({ id: "run_1", tenantId: "t1", stage: "done" })
    const run = await getBuildRun("t1", "run_1")
    expect(run).toEqual({ id: "run_1", tenantId: "t1", stage: "done" })
  })

  it("returns null for a run that belongs to a different tenant — a runId alone carries no isolation", async () => {
    findUnique.mockResolvedValue({ id: "run_1", tenantId: "someone-else", stage: "done" })
    expect(await getBuildRun("t1", "run_1")).toBeNull()
  })

  it("falls back to the tenant's most recent run (any stage) when no runId is given", async () => {
    findFirst.mockResolvedValue({ id: "run_3", tenantId: "t1", stage: "failed" })
    const run = await getBuildRun("t1")
    expect(run).toEqual({ id: "run_3", tenantId: "t1", stage: "failed" })
    expect(findFirst).toHaveBeenCalledWith({ where: { tenantId: "t1" }, orderBy: { createdAt: "desc" } })
  })
})

describe("advanceBuildRun", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates the run's fields, scoped to the tenant", async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await advanceBuildRun("t1", "run_1", { stage: "deploying", deploymentId: "dpl_1" })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "run_1", tenantId: "t1" },
      data: { stage: "deploying", deploymentId: "dpl_1" },
    })
  })

  it("never throws — a run-tracking failure must not fail the real operation that triggered it", async () => {
    updateMany.mockRejectedValue(new Error("db down"))
    await expect(advanceBuildRun("t1", "run_1", { stage: "failed" })).resolves.toBeUndefined()
  })
})
