import { beforeEach, describe, expect, it, vi } from "vitest"

const getLatestDeployment = vi.fn()
const getDeploymentFiles = vi.fn()
vi.mock("@/lib/vercel-client", () => ({
  getLatestDeployment: (...args: unknown[]) => getLatestDeployment(...args),
  getDeploymentFiles: (...args: unknown[]) => getDeploymentFiles(...args),
}))

const settings = new Map<string, string>()
vi.mock("@/lib/database", () => ({
  db: {
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) => (settings.has(where.key) ? { value: settings.get(where.key) } : null),
    },
  },
}))

import {
  loadStarterSnapshot,
  resetStarterCache,
  starterChangeBreach,
  starterLockBreach,
  starterLockFor,
  starterLockViolations,
  StarterUnavailableError,
  templateLockKey,
  workspaceLockKey,
} from "@/lib/infrastructure/starter-template"

const DEPLOYMENT_ID = "dpl_starter_1"

const schemaJson = {
  $comment: "test",
  version: 1,
  components: [{ slug: "hero", name: "Hero", category: null, description: "x", fields: [{ name: "Title", slug: "title", type: "text", required: true }] }],
  singles: [{ slug: "site-settings", name: "Site", description: "x", fields: [{ name: "Name", slug: "name", type: "text", required: false }] }],
}

function deployed(extra: { name: string; content: string; encoding?: "utf-8" | "base64" }[] = []) {
  return {
    files: [
      { name: "package.json", content: JSON.stringify({ name: "starter" }), encoding: "utf-8", size: 2, checksum: "x" },
      { name: "app/page.tsx", content: "export default function Page() { return null }", encoding: "utf-8", size: 1, checksum: "x" },
      { name: "sacms/schema.json", content: JSON.stringify(schemaJson), encoding: "utf-8", size: 1, checksum: "x" },
      { name: "package-lock.json", content: "{}", encoding: "utf-8", size: 1, checksum: "x" },
      { name: "node_modules/left-pad/index.js", content: "x", encoding: "utf-8", size: 1, checksum: "x" },
      ...extra.map((f) => ({ ...f, encoding: f.encoding ?? "utf-8", size: 1, checksum: "x" })),
    ],
    skipped: [],
    truncated: false,
    invalidAssets: [],
  }
}

describe("starter snapshot from the Vercel project", () => {
  beforeEach(() => {
    settings.clear()
    resetStarterCache()
    getLatestDeployment.mockReset()
    getDeploymentFiles.mockReset()
    vi.stubEnv("SACMS_STARTER_VERCEL_PROJECT_ID", "prj_starter")
    getLatestDeployment.mockResolvedValue({ id: DEPLOYMENT_ID, deploymentUrl: "x", productionUrl: null, state: "READY" })
    getDeploymentFiles.mockResolvedValue(deployed())
  })

  it("reads the production deployment of the starter project and drops generated and machine-local files", async () => {
    const snapshot = await loadStarterSnapshot()
    expect(getLatestDeployment).toHaveBeenCalledWith("prj_starter")
    expect(getDeploymentFiles).toHaveBeenCalledWith(DEPLOYMENT_ID, expect.any(Number))
    expect(snapshot.commit).toBe(DEPLOYMENT_ID)
    expect(snapshot.files.map((f) => f.path)).toEqual(["app/page.tsx", "package.json", "sacms/schema.json"])
  })

  it("keeps binary files as base64", async () => {
    getDeploymentFiles.mockResolvedValue(deployed([{ name: "public/logo.png", content: "iVBORw0K", encoding: "base64" }]))
    const snapshot = await loadStarterSnapshot()
    expect(snapshot.files.find((f) => f.path === "public/logo.png")).toMatchObject({ encoding: "base64" })
  })

  it("reads sacms/schema.json into the Schema Template bundle shape (singles become Single Types)", async () => {
    const { schema } = await loadStarterSnapshot()
    expect(schema.contentTypes).toEqual([])
    expect(schema.singleTypes.map((s) => s.slug)).toEqual(["site-settings"])
    expect(schema.components.map((c) => c.slug)).toEqual(["hero"])
  })

  it("is unavailable when the starter project is not configured", async () => {
    vi.stubEnv("SACMS_STARTER_VERCEL_PROJECT_ID", "")
    await expect(loadStarterSnapshot()).rejects.toBeInstanceOf(StarterUnavailableError)
    expect(getLatestDeployment).not.toHaveBeenCalled()
  })

  it("is unavailable when the project has no production deployment", async () => {
    getLatestDeployment.mockResolvedValue(null)
    await expect(loadStarterSnapshot()).rejects.toBeInstanceOf(StarterUnavailableError)
  })

  it("is unavailable when the deployment is truncated", async () => {
    getDeploymentFiles.mockResolvedValue({ ...deployed(), truncated: true })
    await expect(loadStarterSnapshot()).rejects.toBeInstanceOf(StarterUnavailableError)
  })

  it("fails when sacms/schema.json is missing", async () => {
    getDeploymentFiles.mockResolvedValue({
      ...deployed(),
      files: [{ name: "package.json", content: "{}", encoding: "utf-8", size: 2, checksum: "x" }],
    })
    await expect(loadStarterSnapshot()).rejects.toThrow(/sacms\/schema\.json/)
  })

  it("serves the cached snapshot inside the TTL instead of asking Vercel again", async () => {
    await loadStarterSnapshot()
    await loadStarterSnapshot()
    expect(getDeploymentFiles).toHaveBeenCalledTimes(1)
  })
})

describe("starter lock", () => {
  const files = [
    { path: "package.json", content: "{}" },
    { path: "app/page.tsx", content: "export default null" },
  ]
  const lock = starterLockFor({
    repo: "vercel:prj_starter",
    commit: DEPLOYMENT_ID,
    files: [
      { path: "package.json", content: "{}", encoding: "utf-8" },
      { path: "app/page.tsx", content: "export default null", encoding: "utf-8" },
    ],
    schema: { groups: [], contentTypes: [], singleTypes: [], components: [] },
  })

  it("allows new files and unchanged starter files", () => {
    expect(starterLockViolations(lock, [...files, { path: "app/blog/page.tsx", content: "new" }])).toEqual([])
  })

  it("reports a changed starter file", () => {
    expect(starterLockViolations(lock, [{ path: "package.json", content: '{"x":1}' }, files[1]])).toEqual(["diubah: package.json"])
  })

  it("reports a removed starter file", () => {
    expect(starterLockViolations(lock, [files[0]])).toEqual(["dihapus: app/page.tsx"])
  })

  it("returns no breach when no lock exists for the scope", async () => {
    expect(await starterLockBreach(workspaceLockKey("tenant-1"), [{ path: "package.json", content: "changed" }])).toBeNull()
  })

  it("returns an Indonesian breach message when a stored lock is violated", async () => {
    settings.set(templateLockKey("tpl-1"), JSON.stringify(lock))
    const breach = await starterLockBreach(templateLockKey("tpl-1"), [{ path: "package.json", content: "changed" }, files[1]])
    expect(breach).toMatch(/^Starter template terkunci/)
    expect(breach).toContain("diubah: package.json")
  })

  it("judges only the files a partial write carries", async () => {
    settings.set(workspaceLockKey("t-partial"), JSON.stringify(lock))
    expect(await starterChangeBreach(workspaceLockKey("t-partial"), [{ path: "app/blog/page.tsx", content: "new" }, files[0]])).toBeNull()
    expect(await starterChangeBreach(workspaceLockKey("t-partial"), [{ path: "app/page.tsx", content: "changed" }])).toMatch(/diubah: app\/page\.tsx/)
  })

  it("keeps workspace and Website Template locks in separate keys", () => {
    expect(workspaceLockKey("t1")).not.toBe(templateLockKey("t1"))
  })
})
