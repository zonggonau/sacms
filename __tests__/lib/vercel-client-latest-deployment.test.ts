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

const { getLatestDeployment, getDeploymentStatus, getDeploymentFiles, getDeploymentBuildLogs } = await import("@/lib/vercel-client")

describe("getLatestDeployment", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns BOTH urls distinctly — deploymentUrl (this build's own hostname) and productionUrl (the project's real domain, null when none is verified yet)", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/domains")) return Promise.resolve({ ok: true, json: async () => ({ domains: [] }) })
      return Promise.resolve({
        ok: true,
        json: async () => ({ deployments: [{ uid: "dpl_abc", url: "my-site.vercel.app", readyState: "READY" }] }),
      })
    }) as any

    const latest = await getLatestDeployment("prj_1")
    expect(latest).toEqual({ id: "dpl_abc", deploymentUrl: "https://my-site.vercel.app", productionUrl: null, state: "READY" })
  })

  it("resolves productionUrl from the project's verified domains when one exists", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/domains")) {
        return Promise.resolve({ ok: true, json: async () => ({ domains: [{ name: "acme.sites.sacms.cloud", verified: true }] }) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ deployments: [{ uid: "dpl_abc", url: "my-site-xyz.vercel.app", readyState: "READY" }] }),
      })
    }) as any

    const latest = await getLatestDeployment("prj_1")
    expect(latest?.productionUrl).toBe("https://acme.sites.sacms.cloud")
    expect(latest?.deploymentUrl).toBe("https://my-site-xyz.vercel.app")
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

describe("getDeploymentStatus", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns productionUrl and deploymentUrl as separate fields instead of collapsing them into one `url` (chatgpt1.md P0)", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/domains")) {
        return Promise.resolve({ ok: true, json: async () => ({ domains: [{ name: "acme.sites.sacms.cloud", verified: true }] }) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ readyState: "READY", url: "project-abc123-team.vercel.app", projectId: "prj_1" }),
      })
    }) as any

    const status = await getDeploymentStatus("dpl_1")
    expect(status.deploymentUrl).toBe("https://project-abc123-team.vercel.app")
    expect(status.productionUrl).toBe("https://acme.sites.sacms.cloud")
    expect(status.state).toBe("READY")
  })
})

describe("getDeploymentFiles", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("flattens the file tree, reads each file's content incl. checksum, and only skips node_modules/.git-style noise dirs", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              name: "app",
              type: "directory",
              children: [{ name: "page.tsx", type: "file", uid: "file_1" }],
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
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe("app/page.tsx")
    expect(result.files[0].content).toBe("export default function Page() {}")
    expect(result.files[0].encoding).toBe("utf-8")
    expect(result.files[0].checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(result.skipped).toEqual([])
    expect(result.truncated).toBe(false)
  })

  it("no longer skips lockfiles — a revision deploy must redeploy the exact same lockfile, not a freshly regenerated one (chatgpt1.md P0)", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({ ok: true, json: async () => [{ name: "bun.lockb", type: "file", uid: "file_2" }] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: "lockfile-contents" }) })
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files.map((f) => f.name)).toEqual(["bun.lockb"])
    expect(result.skipped).toEqual([])
  })

  it("reads binary assets back as base64 instead of skipping them — deploy_to_sacms can now redeploy them", async () => {
    const encoded = Buffer.from("fake-png-bytes", "utf-8").toString("base64")
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({ ok: true, json: async () => [{ name: "favicon.png", type: "file", uid: "file_1" }] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: encoded, encoding: "base64" }) })
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({ name: "favicon.png", content: encoded, encoding: "base64" })
    expect(result.skipped).toEqual([])
  })

  it("marks plain-text files utf-8 and leaves their content as-is (no decoding)", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({ ok: true, json: async () => [{ name: "index.html", type: "file", uid: "file_1" }] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: "<html></html>" }) })
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({ name: "index.html", content: "<html></html>", encoding: "utf-8" })
  })

  it("skips a file over the per-file size cap even if it isn't a known noise extension", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v6/deployments/dpl_1/files")) {
        return Promise.resolve({ ok: true, json: async () => [{ name: "huge.bin", type: "file", uid: "file_1", size: 5_000_000 }] })
      }
      throw new Error(`Unexpected fetch call: ${u}`)
    }) as any

    const result = await getDeploymentFiles("dpl_1")
    expect(result.files).toEqual([])
    expect(result.skipped).toEqual(["huge.bin"])
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

describe("getDeploymentBuildLogs", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("extracts log text from each event and flags error-looking lines", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { payload: { text: "Installing dependencies..." } },
        { payload: { text: "Error: Cannot find module 'foo'" } },
        { payload: { text: "" } },
      ],
    }) as any

    const result = await getDeploymentBuildLogs("dpl_1")
    expect(result.lines).toEqual(["Installing dependencies...", "Error: Cannot find module 'foo'"])
    expect(result.errorLines).toEqual(["Error: Cannot find module 'foo'"])
  })

  it("returns an empty result (never throws) when there are no events yet", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as any
    expect(await getDeploymentBuildLogs("dpl_1")).toEqual({ lines: [], errorLines: [] })
  })

  it("throws a clear error when the Vercel API call itself fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Deployment not found" } }),
    }) as any

    await expect(getDeploymentBuildLogs("dpl_missing")).rejects.toThrow(/Deployment not found/)
  })
})
