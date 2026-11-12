import { describe, it, expect, vi, beforeEach } from "vitest"

// resolveTenantHostingStatus is read by every Hosting-tab-facing route to
// decide what URL to show. This covers the self-heal added alongside it:
// ensureBrandedSubdomain is best-effort at deploy time and can silently
// fail (transient Vercel hiccup, wildcard DNS not propagated yet), leaving
// a tenant stuck showing the raw `<project>-<team>.vercel.app` alias
// forever since nothing else ever retries the attach. This retries it on
// every status read and persists the nicer URL the moment it works.

const update = vi.fn().mockResolvedValue({})
const upsert = vi.fn().mockResolvedValue({})
const deleteMany = vi.fn().mockResolvedValue({})

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { update },
    setting: { upsert, deleteMany },
  },
}))

const checkVercelProjectExists = vi.fn()
const ensureBrandedSubdomain = vi.fn()
const getProjectPrimaryDomain = vi.fn()

vi.mock("@/lib/vercel-client", () => ({
  checkVercelProjectExists: (...args: any[]) => checkVercelProjectExists(...args),
  ensureBrandedSubdomain: (...args: any[]) => ensureBrandedSubdomain(...args),
  getProjectPrimaryDomain: (...args: any[]) => getProjectPrimaryDomain(...args),
}))

const { resolveTenantHostingStatus } = await import("@/lib/infrastructure/hosting-status")

describe("resolveTenantHostingStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns not-deployed immediately when there's no stored URL/project", async () => {
    const result = await resolveTenantHostingStatus("t1", null, null)
    expect(result).toEqual({ deployed: false, url: null, projectId: null })
    expect(checkVercelProjectExists).not.toHaveBeenCalled()
  })

  it("clears stale fields when the Vercel project was confirmed deleted", async () => {
    checkVercelProjectExists.mockResolvedValue(false)
    const result = await resolveTenantHostingStatus("t1", "https://old.vercel.app", "prj_1")
    expect(result).toEqual({ deployed: false, url: null, projectId: null, wasCleared: true })
    expect(update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { vercelDeploymentUrl: null, vercelProjectId: null } })
  })

  it("skips the self-heal attempt when no tenantSlug is given", async () => {
    checkVercelProjectExists.mockResolvedValue(true)
    const result = await resolveTenantHostingStatus("t1", "https://sacms-abc-team.vercel.app", "prj_1")
    expect(result).toEqual({ deployed: true, url: "https://sacms-abc-team.vercel.app", projectId: "prj_1" })
    expect(ensureBrandedSubdomain).not.toHaveBeenCalled()
  })

  it("skips the self-heal attempt when the stored URL is already the branded subdomain", async () => {
    checkVercelProjectExists.mockResolvedValue(true)
    const result = await resolveTenantHostingStatus("t1", "https://acme.sites.sacms.cloud", "prj_1", undefined, "acme")
    expect(result.url).toBe("https://acme.sites.sacms.cloud")
    expect(ensureBrandedSubdomain).not.toHaveBeenCalled()
  })

  it("retries attaching the branded subdomain and persists the healed URL when it succeeds", async () => {
    checkVercelProjectExists.mockResolvedValue(true)
    ensureBrandedSubdomain.mockResolvedValue("acme.sites.sacms.cloud")
    getProjectPrimaryDomain.mockResolvedValue("https://acme.sites.sacms.cloud")

    const result = await resolveTenantHostingStatus("t1", "https://sacms-abc-team.vercel.app", "prj_1", undefined, "acme")

    expect(ensureBrandedSubdomain).toHaveBeenCalledWith("prj_1", "acme")
    expect(result).toEqual({ deployed: true, url: "https://acme.sites.sacms.cloud", projectId: "prj_1" })
    expect(update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { vercelDeploymentUrl: "https://acme.sites.sacms.cloud" } })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: "https://acme.sites.sacms.cloud" } }))
  })

  it("falls back to the stored URL when the self-heal attempt doesn't improve anything", async () => {
    checkVercelProjectExists.mockResolvedValue(true)
    ensureBrandedSubdomain.mockResolvedValue(null)
    getProjectPrimaryDomain.mockResolvedValue("https://sacms-abc-team.vercel.app")

    const result = await resolveTenantHostingStatus("t1", "https://sacms-abc-team.vercel.app", "prj_1", undefined, "acme")

    expect(result).toEqual({ deployed: true, url: "https://sacms-abc-team.vercel.app", projectId: "prj_1" })
    expect(update).not.toHaveBeenCalled()
  })
})
