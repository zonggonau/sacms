import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const create = vi.fn()
const update = vi.fn()
const findUnique = vi.fn()
vi.mock("@/lib/database", () => ({
  db: { globalMcpOperation: { create: (...a: any[]) => create(...a), update: (...a: any[]) => update(...a), findUnique: (...a: any[]) => findUnique(...a) } },
}))

const { startBackgroundOperation, getOperation } = await import("@/lib/infrastructure/global-mcp-operations")

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("startBackgroundOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    create.mockResolvedValue({ id: "op_1", status: "running" })
    update.mockResolvedValue({})
  })

  it("returns the running operation immediately, before the work finishes", async () => {
    let release: () => void = () => {}
    const work = new Promise<void>((resolve) => { release = resolve })
    const operation = await startBackgroundOperation("verify_build", "tok_1", async () => { await work; return { result: { ok: true } } })

    expect(operation).toEqual({ id: "op_1", status: "running" })
    expect(create).toHaveBeenCalledWith({ data: { kind: "verify_build", tokenId: "tok_1", status: "running" } })
    expect(update).not.toHaveBeenCalled()
    release()
  })

  it("records a successful outcome", async () => {
    await startBackgroundOperation("create_website_template", null, async () => ({ result: { id: "wt_1" } }))
    await flush()
    expect(update).toHaveBeenCalledWith({
      where: { id: "op_1" },
      data: expect.objectContaining({ status: "succeeded", result: { id: "wt_1" }, error: null }),
    })
  })

  it("records a reported failure and a thrown error as failed", async () => {
    await startBackgroundOperation("update_website_template", null, async () => ({ result: { code: "CONFLICT" }, failed: true, error: "stale version" }))
    await flush()
    expect(update).toHaveBeenLastCalledWith({ where: { id: "op_1" }, data: expect.objectContaining({ status: "failed", error: "stale version" }) })

    await startBackgroundOperation("redeploy_website_template_demo", null, async () => { throw new Error("vercel down") })
    await flush()
    expect(update).toHaveBeenLastCalledWith({ where: { id: "op_1" }, data: expect.objectContaining({ status: "failed", error: "vercel down" }) })
  })
})

describe("getOperation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reports a still-running operation older than the stale budget as interrupted (the process restarted mid-run)", async () => {
    findUnique.mockResolvedValue({ id: "op_1", status: "running", startedAt: new Date(Date.now() - 60 * 60 * 1000) })
    update.mockResolvedValue({ id: "op_1", status: "failed" })

    const operation = await getOperation("op_1")

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed", error: expect.stringMatching(/Interrupted/) }) }))
    expect(operation?.status).toBe("failed")
  })

  it("leaves a recent running operation alone", async () => {
    findUnique.mockResolvedValue({ id: "op_1", status: "running", startedAt: new Date() })
    const operation = await getOperation("op_1")
    expect(update).not.toHaveBeenCalled()
    expect(operation?.status).toBe("running")
  })
})

it("isolates workspace operation results from other tenants and the Global endpoint", async () => {
  findUnique.mockResolvedValue({ id: "op-a", tenantId: "a", status: "succeeded" })
  expect(await getOperation("op-a", "a")).toMatchObject({ tenantId: "a" })
  expect(await getOperation("op-a", "b")).toBeNull()
  expect(await getOperation("op-a")).toBeNull()
})
