import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// getLatestDeployment and getDeploymentFiles back two of the MCP audit's
// P0 fixes: get_deployment_status can now resolve "the current deployment"
// without a deploymentId (recovering from a lost deploy_to_sacms response),
// and get_deployment_source reads back a workspace's actual deployed files
// (via Vercel's own deployment-files API) so a revision request doesn't
// have to regenerate the whole frontend from scratch.

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { getLatestDeployment, getDeploymentFiles } = await import("@/lib/vercel-client")

describe("getLatestDeployment", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns the latest production deployment's id/url/state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deployments: [{ uid: "dpl_abc", url: "my-site.vercel.app", readyState: "READY" }] }),
    }) as any

    const latest = await getLatestDeployment("prj_1")
    expect(latest).toEqual({ id: "dpl_abc", url: "https://my-site.vercel.app", state: "READY" })
  })

  it("returns null when the project has no deployment history", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deployments: [] }) }) as any
    expect(await getLatestDeployment("prj_1")).toBeNull()
  })

  it("returns null (never throws) when the Vercel API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any
    expect(await getLatestDeployment("prj_1")).toBeNull()
  })
})

describe("getDeploymentFiles", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("flattens the file tree, reads each file's content, and skips binary/build-noise paths", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              name: "app",
              type: "directory",
              children: [
                { name: "page.tsx", type: "file", uid: "file_1" },
                { name: "logo.png", type: "file", uid: "file_2" },
              ],
            },
            { name: "node_modules", type: "directory", children: [{ name: "x.js", type: "file", uid: "file_3" }] },
          ],
        })
      }
      if (u.includes("/files/file_1")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: "export default function Page() {}" }) })
      }
      throw new Error(`Unexpected fetch call: ${u}`)
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files).toEqual([{ name: "app/page.tsx", content: "export default function Page() {}" }])
    expect(result.skipped).toEqual(["app/logo.png"])
    expect(result.truncated).toBe(false)
  })

  it("decodes base64-encoded file content", async () => {
    const encoded = Buffer.from("hello world", "utf-8").toString("base64")
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({ ok: true, json: async () => [{ name: "index.html", type: "file", uid: "file_1" }] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: encoded, encoding: "base64" }) })
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files).toEqual([{ name: "index.html", content: "hello world" }])
  })

  it("truncates at maxFiles and reports it", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { name: "a.tsx", type: "file", uid: "f1" },
            { name: "b.tsx", type: "file", uid: "f2" },
          ],
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: "x" }) })
    }) as any

    const result = await getDeploymentFiles("dpl_1", 1)
    expect(result.files).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  it("throws a clear error when the file tree itself can't be fetched", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Deployment not found" } }),
    }) as any

    await expect(getDeploymentFiles("dpl_missing")).rejects.toThrow(/Deployment not found/)
  })
})
