import { describe, it, expect, vi, beforeEach } from "vitest"

// deploy-frontend.ts starts with `import "server-only"` (correctly, to keep
// it out of any client bundle) — not an npm package vitest's plain Node
// resolution can see, so it needs a stub here the way Next's own bundler
// provides one for free.
vi.mock("server-only", () => ({}))

// redeployTenantFrontend backs the dashboard's "Redeploy" button. The one
// piece of real logic worth covering here (the Vercel call itself is
// covered by vercel-client-redeploy.test.ts) is the guard: a workspace that
// has never deployed has no vercelProjectId, and redeploying "nothing" must
// fail with a clear message instead of calling Vercel with an empty/garbage
// project id.

const findUnique = vi.fn()
const update = vi.fn().mockResolvedValue({})
const upsert = vi.fn().mockResolvedValue({})

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findUnique, update },
    setting: { upsert },
  },
}))

const redeployLatest = vi.fn()
vi.mock("@/lib/vercel-client", () => ({
  deployToVercel: vi.fn(),
  redeployLatest: (...args: any[]) => redeployLatest(...args),
}))

vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveFrontendEnv: vi.fn().mockResolvedValue({ NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud" }),
  pushEnvToVercelProject: vi.fn().mockResolvedValue({ applied: [], failed: [] }),
  resolveApiOrigin: vi.fn().mockReturnValue("https://sacms.cloud"),
}))

const { redeployTenantFrontend } = await import("@/lib/infrastructure/deploy-frontend")

describe("redeployTenantFrontend", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuses to redeploy a workspace that has no existing deployment project", async () => {
    findUnique.mockResolvedValue({ vercelProjectId: null })

    await expect(redeployTenantFrontend("tenant1", "acme")).rejects.toThrow(/Deploy terlebih dahulu/)
    expect(redeployLatest).not.toHaveBeenCalled()
  })

  it("redeploys the workspace's existing project and persists the result", async () => {
    findUnique.mockResolvedValue({ vercelProjectId: "prj_1" })
    redeployLatest.mockResolvedValue({
      id: "dpl_new456",
      url: "https://acme.sites.sacms.cloud",
      state: "QUEUED",
      projectId: "prj_1",
      simulated: false,
    })

    const result = await redeployTenantFrontend("tenant1", "acme")

    expect(redeployLatest).toHaveBeenCalledWith("prj_1", "sacms-acme", { NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud" })
    expect(result.url).toBe("https://acme.sites.sacms.cloud")
    expect(result.deploymentId).toBe("dpl_new456")
    expect(update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { vercelDeploymentUrl: "https://acme.sites.sacms.cloud", vercelProjectId: "prj_1" },
    })
  })
})
