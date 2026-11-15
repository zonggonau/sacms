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

const {
  startOrResumeBuildRun,
  getBuildRun,
  advanceBuildRun,
  findOrClaimByIdempotencyKey,
  isIdempotencyClaimStillInFlight,
} = await import("@/lib/infrastructure/mcp-build-run")

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

  it("looks up by idempotencyKey when given instead of runId — the recovery path for a lost deploy response", async () => {
    findFirst.mockResolvedValue({ id: "run_4", tenantId: "t1", idempotencyKey: "key-abc" })
    const run = await getBuildRun("t1", undefined, "key-abc")
    expect(run).toEqual({ id: "run_4", tenantId: "t1", idempotencyKey: "key-abc" })
    expect(findFirst).toHaveBeenCalledWith({ where: { tenantId: "t1", idempotencyKey: "key-abc" } })
  })
})

describe("findOrClaimByIdempotencyKey", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the existing run when this key was already claimed", async () => {
    const existing = { id: "run_1", tenantId: "t1", idempotencyKey: "key-1", deploymentId: "dpl_1" }
    findFirst.mockResolvedValue(existing)

    const result = await findOrClaimByIdempotencyKey("t1", "key-1", "update")
    expect(result).toEqual({ run: existing, isNew: false })
    expect(create).not.toHaveBeenCalled()
  })

  it("atomically claims a fresh key by creating a new run", async () => {
    findFirst.mockResolvedValue(null)
    const created = { id: "run_2", tenantId: "t1", idempotencyKey: "key-2", stage: "discover" }
    create.mockResolvedValue(created)

    const result = await findOrClaimByIdempotencyKey("t1", "key-2", "create")
    expect(result).toEqual({ run: created, isNew: true })
    expect(create).toHaveBeenCalledWith({ data: { tenantId: "t1", intent: "create", stage: "discover", idempotencyKey: "key-2" } })
  })

  it("re-reads and returns the winning row when two claims race on the same key (unique constraint conflict)", async () => {
    findFirst.mockResolvedValueOnce(null) // initial check: not claimed yet
    create.mockRejectedValue(new Error("Unique constraint failed on the fields: (`tenantId`,`idempotencyKey`)"))
    const winner = { id: "run_3", tenantId: "t1", idempotencyKey: "key-3" }
    findFirst.mockResolvedValueOnce(winner) // re-read after the race

    const result = await findOrClaimByIdempotencyKey("t1", "key-3", "update")
    expect(result).toEqual({ run: winner, isNew: false })
  })
})

describe("isIdempotencyClaimStillInFlight", () => {
  it("is false once a deploymentId has been recorded — the submission completed", () => {
    const run = { id: "r1", tenantId: "t1", intent: "update", stage: "deploying", hostingProjectId: null, deploymentId: "dpl_1", sourceRevision: null, lastError: null, idempotencyKey: "k", createdAt: new Date(), updatedAt: new Date() }
    expect(isIdempotencyClaimStillInFlight(run)).toBe(false)
  })

  it("is true for a claim with no deploymentId yet, updated moments ago", () => {
    const run = { id: "r1", tenantId: "t1", intent: "update", stage: "discover", hostingProjectId: null, deploymentId: null, sourceRevision: null, lastError: null, idempotencyKey: "k", createdAt: new Date(), updatedAt: new Date() }
    expect(isIdempotencyClaimStillInFlight(run)).toBe(true)
  })

  it("is false for a claim with no deploymentId that's old enough to be treated as abandoned", () => {
    const run = { id: "r1", tenantId: "t1", intent: "update", stage: "discover", hostingProjectId: null, deploymentId: null, sourceRevision: null, lastError: null, idempotencyKey: "k", createdAt: new Date(), updatedAt: new Date(Date.now() - 5 * 60 * 1000) }
    expect(isIdempotencyClaimStillInFlight(run)).toBe(false)
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
