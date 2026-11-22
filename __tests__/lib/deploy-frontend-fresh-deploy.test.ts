import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

// deployTenantFrontend backs the dashboard's "Deploy" button and AI Site's
// Publish action — its one piece of logic worth covering directly here
// (the Vercel call itself is covered by vercel-client-staged-deploy.test.ts)
// is the subdomain-label resolution: prefer a tenant's own random
// publicSubdomainToken over its slug for the PUBLIC `*.sites.sacms.cloud`
// label, so a long/descriptive slug never pushes that domain's SSL
// certificate Common Name past the issuer's 64-character limit. A tenant
// created before this field existed (null token) must keep using its
// existing slug-based subdomain exactly as before.

const findUnique = vi.fn()
const update = vi.fn().mockResolvedValue({})
const upsert = vi.fn().mockResolvedValue({})

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findUnique, update },
    setting: { upsert },
  },
}))

const deployToVercel = vi.fn()
vi.mock("@/lib/vercel-client", () => ({
  deployToVercel: (...args: any[]) => deployToVercel(...args),
  redeployLatest: vi.fn(),
}))

vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveFrontendEnv: vi.fn().mockResolvedValue({ NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud" }),
  pushEnvToVercelProject: vi.fn().mockResolvedValue({ applied: [], failed: [] }),
  resolveApiOrigin: vi.fn().mockReturnValue("https://sacms.cloud"),
}))

const { deployTenantFrontend } = await import("@/lib/infrastructure/deploy-frontend")

describe("deployTenantFrontend — subdomain label resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deployToVercel.mockResolvedValue({
      id: "dpl_1",
      url: "https://acme.sites.sacms.cloud",
      state: "QUEUED",
      projectId: "prj_1",
      simulated: false,
    })
  })

  it("uses the tenant's own publicSubdomainToken instead of its slug when one is already persisted", async () => {
    findUnique.mockResolvedValue({ publicSubdomainToken: "deadbeef01234567" })

    await deployTenantFrontend("tenant-1", "profil-dinas-pemberdayaan-perempuan-emerald-civic", "https://sacms.cloud", [])

    expect(deployToVercel).toHaveBeenCalledWith(
      "sacms-profil-dinas-pemberdayaan-perempuan-emerald-civic",
      [],
      expect.any(Object),
      "deadbeef01234567",
      "production",
    )
  })

  it("falls back to the tenant's slug when it has no publicSubdomainToken (created before that field existed)", async () => {
    findUnique.mockResolvedValue({ publicSubdomainToken: null })

    await deployTenantFrontend("tenant-2", "acme", "https://sacms.cloud", [])

    expect(deployToVercel).toHaveBeenCalledWith("sacms-acme", [], expect.any(Object), "acme", "production")
  })
})
