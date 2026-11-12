import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// redeployLatest / removeDomainFromProject back the dashboard's new
// "Redeploy" button and "Ubah Domain" dialog on the Hosting tab — redeploy
// re-runs a project's existing deployment (no file re-upload) so a changed
// Environment-tab var actually takes effect, and domain removal keeps
// Vercel's own domain list from accumulating every domain a workspace ever
// typed in when they change it.

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { redeployLatest, removeDomainFromProject } = await import("@/lib/vercel-client")

describe("redeployLatest", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("redeploys the project's latest production deployment and returns its primary domain", async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    global.fetch = vi.fn((url: any, init?: any) => {
      calls.push({ url: String(url), init })
      if (String(url).includes("/v7/deployments")) {
        return Promise.resolve({ ok: true, json: async () => ({ deployments: [{ uid: "dpl_old123" }] }) })
      }
      if (String(url).includes("/v13/deployments")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "dpl_new456", projectId: "prj_1", readyState: "QUEUED" }) })
      }
      if (String(url).includes("/v9/projects/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ alias: [{ domain: "sacms-abc.vercel.app" }, { domain: "bangparjo.shop" }] }),
        })
      }
      throw new Error(`Unexpected fetch call: ${url}`)
    }) as any

    const result = await redeployLatest("prj_1", "sacms-acme", { FOO: "bar" })

    expect(result).toEqual({
      id: "dpl_new456",
      url: "https://bangparjo.shop",
      state: "QUEUED",
      projectId: "prj_1",
      projectName: undefined,
    })

    const createCall = calls.find((c) => c.url.includes("/v13/deployments"))
    const body = JSON.parse(createCall!.init!.body as string)
    expect(body.deploymentId).toBe("dpl_old123")
    expect(body.target).toBe("production")
    expect(body.env).toEqual({ FOO: "bar" })
    expect(body.files).toBeUndefined()
  })

  it("throws a clear error when the project has no previous deployment to redeploy", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deployments: [] }) }) as any

    await expect(redeployLatest("prj_1", "sacms-acme")).rejects.toThrow(/Belum ada deployment sebelumnya/)
  })

  it("surfaces a clear error when Vercel rejects the redeploy request", async () => {
    global.fetch = vi.fn((url: any) => {
      if (String(url).includes("/v7/deployments")) {
        return Promise.resolve({ ok: true, json: async () => ({ deployments: [{ uid: "dpl_old123" }] }) })
      }
      return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid deployment id" } }) })
    }) as any

    await expect(redeployLatest("prj_1", "sacms-acme")).rejects.toThrow(/Invalid deployment id/)
  })
})

describe("removeDomainFromProject", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("resolves on a successful detach", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any
    await expect(removeDomainFromProject("prj_1", "bangparjo.shop")).resolves.toBeUndefined()
  })

  it("treats a 404 (already detached) as success, not a failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as any
    await expect(removeDomainFromProject("prj_1", "bangparjo.shop")).resolves.toBeUndefined()
  })

  it("throws on a genuine failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Forbidden" } }),
    }) as any
    await expect(removeDomainFromProject("prj_1", "bangparjo.shop")).rejects.toThrow(/Forbidden/)
  })
})
