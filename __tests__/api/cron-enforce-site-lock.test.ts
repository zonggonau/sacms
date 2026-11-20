import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/database"
import { isTenantLocked } from "@/lib/tenant-lock"
import { setDomainRedirect, clearDomainRedirect } from "@/lib/vercel-client"
import { GET } from "../../src/app/api/cron/enforce-site-lock/route"

vi.mock("@/lib/database", () => ({
  db: {
    tenant: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/tenant-lock", () => ({
  isTenantLocked: vi.fn(),
}))

vi.mock("@/lib/vercel-client", () => ({
  setDomainRedirect: vi.fn().mockResolvedValue({ ok: true }),
  clearDomainRedirect: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { TENANT_UPDATED: "TENANT_UPDATED" },
}))

describe("GET /api/cron/enforce-site-lock", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: "my_cron_secret", NEXT_PUBLIC_ROOT_DOMAIN: "sacms.cloud" }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function req() {
    return new Request("http://localhost:3000/api/cron/enforce-site-lock", {
      headers: { authorization: "Bearer my_cron_secret" },
    })
  }

  it("returns 401 with a wrong cron secret", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/cron/enforce-site-lock", {
        headers: { authorization: "Bearer wrong" },
      })
    )
    expect(response.status).toBe(401)
  })

  it("redirects a newly-locked tenant's sites.sacms.cloud subdomain to /suspended and marks it", async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      {
        id: "t1",
        slug: "klinik-kartika",
        vercelProjectId: "prj_1",
        customDomain: null,
        customDomainStatus: null,
        siteLockRedirectActive: false,
      },
    ] as any)
    vi.mocked(isTenantLocked).mockResolvedValue(true)

    const response = await GET(req())
    const body = await response.json()

    expect(setDomainRedirect).toHaveBeenCalledWith("prj_1", "klinik-kartika.sites.sacms.cloud", "https://sacms.cloud/suspended")
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { siteLockRedirectActive: true } })
    expect(clearDomainRedirect).not.toHaveBeenCalled()
    expect(body.redirected).toBe(1)
    expect(body.restored).toBe(0)
  })

  it("also redirects a verified custom domain, but not an unverified one", async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      {
        id: "t1",
        slug: "klinik-kartika",
        vercelProjectId: "prj_1",
        customDomain: "klinikkartika.id",
        customDomainStatus: "verified",
        siteLockRedirectActive: false,
      },
      {
        id: "t2",
        slug: "toko-andi",
        vercelProjectId: "prj_2",
        customDomain: "tokoandi.shop",
        customDomainStatus: "pending",
        siteLockRedirectActive: false,
      },
    ] as any)
    vi.mocked(isTenantLocked).mockResolvedValue(true)

    await GET(req())

    expect(setDomainRedirect).toHaveBeenCalledWith("prj_1", "klinikkartika.id", "https://sacms.cloud/suspended")
    expect(setDomainRedirect).not.toHaveBeenCalledWith("prj_2", "tokoandi.shop", expect.anything())
  })

  it("clears the redirect once a previously-locked tenant unlocks again", async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      {
        id: "t1",
        slug: "klinik-kartika",
        vercelProjectId: "prj_1",
        customDomain: null,
        customDomainStatus: null,
        siteLockRedirectActive: true,
      },
    ] as any)
    vi.mocked(isTenantLocked).mockResolvedValue(false)

    const response = await GET(req())
    const body = await response.json()

    expect(clearDomainRedirect).toHaveBeenCalledWith("prj_1", "klinik-kartika.sites.sacms.cloud")
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { siteLockRedirectActive: false } })
    expect(body.restored).toBe(1)
  })

  it("does nothing (no Vercel call) when the lock state already matches siteLockRedirectActive", async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      {
        id: "t1",
        slug: "klinik-kartika",
        vercelProjectId: "prj_1",
        customDomain: null,
        customDomainStatus: null,
        siteLockRedirectActive: true,
      },
    ] as any)
    vi.mocked(isTenantLocked).mockResolvedValue(true)

    const response = await GET(req())
    const body = await response.json()

    expect(setDomainRedirect).not.toHaveBeenCalled()
    expect(clearDomainRedirect).not.toHaveBeenCalled()
    expect(db.tenant.update).not.toHaveBeenCalled()
    expect(body.redirected).toBe(0)
    expect(body.restored).toBe(0)
  })

  it("counts a failure for one tenant without aborting the rest", async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      { id: "t1", slug: "a", vercelProjectId: "prj_1", customDomain: null, customDomainStatus: null, siteLockRedirectActive: false },
      { id: "t2", slug: "b", vercelProjectId: "prj_2", customDomain: null, customDomainStatus: null, siteLockRedirectActive: false },
    ] as any)
    vi.mocked(isTenantLocked)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(true)

    const response = await GET(req())
    const body = await response.json()

    expect(body.failed).toBe(1)
    expect(body.redirected).toBe(1)
  })
})
