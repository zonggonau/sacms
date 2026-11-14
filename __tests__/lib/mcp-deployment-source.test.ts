import { describe, it, expect, vi, beforeEach } from "vitest"

// mcp-deployment-source.ts starts with `import "server-only"` — not an npm
// package vitest's plain Node resolution can see, same stub used elsewhere.
vi.mock("server-only", () => ({}))

// Backs get_deployment_source/deploy_website_patch/list_website_versions/
// rollback_website — the persisted-source fix for chatgpt1.md's P0 finding
// that reading straight from Vercel's own files API silently skipped
// lockfiles and mislabeled binary content as "utf-8". SaCMS now keeps its
// own byte-exact snapshot of every successful deploy instead.

const create = vi.fn()
const findFirst = vi.fn()
const findUnique = vi.fn()
const findMany = vi.fn()
const deleteMany = vi.fn()

vi.mock("@/lib/database", () => ({
  db: { mcpDeploymentSource: { create, findFirst, findUnique, findMany, deleteMany } },
}))

const {
  checksumOf,
  buildManifest,
  saveDeploymentSource,
  getLatestDeploymentSource,
  getDeploymentSourceByRevision,
  getDeploymentSourceByDeploymentId,
  listDeploymentSources,
} = await import("@/lib/infrastructure/mcp-deployment-source")

describe("checksumOf / buildManifest", () => {
  it("produces a stable sha256 hex digest", () => {
    const sum = checksumOf("hello world")
    expect(sum).toMatch(/^[0-9a-f]{64}$/)
    expect(checksumOf("hello world")).toBe(sum)
    expect(checksumOf("hello World")).not.toBe(sum)
  })

  it("builds one manifest entry per file with size/encoding/checksum", () => {
    const manifest = buildManifest([
      { name: "index.html", content: "<html></html>", encoding: "utf-8" },
      { name: "icon.png", content: "ZmFrZQ==", encoding: "base64" },
    ])
    expect(manifest).toEqual([
      { path: "index.html", size: "<html></html>".length, encoding: "utf-8", checksum: checksumOf("<html></html>") },
      { path: "icon.png", size: "ZmFrZQ==".length, encoding: "base64", checksum: checksumOf("ZmFrZQ==") },
    ])
  })
})

describe("saveDeploymentSource", () => {
  beforeEach(() => vi.clearAllMocks())

  it("persists the full file set with a computed manifest, scoped to the tenant", async () => {
    create.mockResolvedValue({ id: "src_1", tenantId: "t1", deploymentId: "dpl_1", projectId: "prj_1", files: [], manifest: [], createdAt: new Date() })
    findMany.mockResolvedValue([])

    const files = [{ name: "app/page.tsx", content: "export default function(){}", encoding: "utf-8" as const }]
    const saved = await saveDeploymentSource("t1", "dpl_1", "prj_1", files)

    expect(saved.id).toBe("src_1")
    expect(create).toHaveBeenCalledWith({
      data: { tenantId: "t1", deploymentId: "dpl_1", projectId: "prj_1", manifest: buildManifest(files), files },
    })
  })

  it("prunes rows beyond the retention window after a successful write", async () => {
    create.mockResolvedValue({ id: "src_new", tenantId: "t1", deploymentId: "dpl_2", files: [], manifest: [], createdAt: new Date() })
    findMany.mockResolvedValue([{ id: "src_old_1" }, { id: "src_old_2" }])
    deleteMany.mockResolvedValue({ count: 2 })

    await saveDeploymentSource("t1", "dpl_2", null, [])

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t1" }, skip: 20 }))
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["src_old_1", "src_old_2"] } } })
  })

  it("still returns the saved row even if pruning itself fails", async () => {
    create.mockResolvedValue({ id: "src_1", tenantId: "t1", deploymentId: "dpl_1", files: [], manifest: [], createdAt: new Date() })
    findMany.mockRejectedValue(new Error("db down"))

    const saved = await saveDeploymentSource("t1", "dpl_1", null, [])
    expect(saved.id).toBe("src_1")
  })
})

describe("getLatestDeploymentSource / getDeploymentSourceByRevision / getDeploymentSourceByDeploymentId", () => {
  beforeEach(() => vi.clearAllMocks())

  it("getLatestDeploymentSource returns the tenant's most recent row", async () => {
    findFirst.mockResolvedValue({ id: "src_1", tenantId: "t1" })
    const row = await getLatestDeploymentSource("t1")
    expect(row).toEqual({ id: "src_1", tenantId: "t1" })
    expect(findFirst).toHaveBeenCalledWith({ where: { tenantId: "t1" }, orderBy: { createdAt: "desc" } })
  })

  it("getDeploymentSourceByRevision scopes by tenant — a sourceRevision alone carries no isolation", async () => {
    findUnique.mockResolvedValue({ id: "src_1", tenantId: "someone-else" })
    expect(await getDeploymentSourceByRevision("t1", "src_1")).toBeNull()
  })

  it("getDeploymentSourceByRevision returns the row when it belongs to this tenant", async () => {
    findUnique.mockResolvedValue({ id: "src_1", tenantId: "t1" })
    expect(await getDeploymentSourceByRevision("t1", "src_1")).toEqual({ id: "src_1", tenantId: "t1" })
  })

  it("getDeploymentSourceByDeploymentId looks up by (tenantId, deploymentId), not by its own id", async () => {
    findFirst.mockResolvedValue({ id: "src_2", tenantId: "t1", deploymentId: "dpl_9" })
    const row = await getDeploymentSourceByDeploymentId("t1", "dpl_9")
    expect(row?.id).toBe("src_2")
    expect(findFirst).toHaveBeenCalledWith({ where: { tenantId: "t1", deploymentId: "dpl_9" }, orderBy: { createdAt: "desc" } })
  })
})

describe("listDeploymentSources", () => {
  beforeEach(() => vi.clearAllMocks())

  it("summarizes recent rows, newest first, with fileCount derived from the manifest", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    findMany.mockResolvedValue([
      { id: "src_2", deploymentId: "dpl_2", manifest: [{ path: "a" }, { path: "b" }], createdAt },
      { id: "src_1", deploymentId: "dpl_1", manifest: [{ path: "a" }], createdAt },
    ])

    const rows = await listDeploymentSources("t1", 5)
    expect(rows).toEqual([
      { sourceRevision: "src_2", deploymentId: "dpl_2", fileCount: 2, createdAt },
      { sourceRevision: "src_1", deploymentId: "dpl_1", fileCount: 1, createdAt },
    ])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t1" }, take: 5 }))
  })

  it("caps the requested limit at the retention window (20)", async () => {
    findMany.mockResolvedValue([])
    await listDeploymentSources("t1", 999)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }))
  })
})
