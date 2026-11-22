import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { GET } from "@/app/api/admin/vercel-projects/route"
import { db } from "@/lib/database"
import { listVercelProjectsDetailed, isVercelConfigured, getProjectPrimaryDomain } from "@/lib/vercel-client"

// Regression coverage for the fix: an orphaned Vercel project (no owning
// Tenant row — typically an internal demo workspace from a Website/Schema
// Template preview, since deployWebsiteTemplateDemo persists its resolved
// URL onto WebsiteTemplate.demoUrl, never onto any Tenant row) used to show
// whatever crude fallback listVercelProjectsDetailed's own `url` field held
// — the current deployment's unstable, random-hash preview URL when the
// project had no alias yet (e.g. "sacms-demo-foo-ab12cd34.vercel.app")
// instead of the real verified custom/sacms.cloud domain. Now resolved via
// getProjectPrimaryDomain, same helper a real tenant's own URL is built from.

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/database", () => ({
  db: { tenant: { findMany: vi.fn() } },
}))
vi.mock("@/lib/vercel-client", () => ({
  isVercelConfigured: vi.fn(),
  listVercelProjectsDetailed: vi.fn(),
  getProjectPrimaryDomain: vi.fn(),
  deleteVercelProject: vi.fn(),
}))

function request() {
  return new NextRequest("https://example.test/api/admin/vercel-projects", { method: "GET" })
}

const RAW_PROJECT = {
  id: "prj_demo1",
  name: "sacms-demo-profil-dinas",
  framework: "nextjs",
  nodeVersion: null,
  url: "https://sacms-demo-profil-dinas-i7boetvve.vercel.app",
  latestDeploymentState: "READY",
  latestDeploymentUrl: "https://sacms-demo-profil-dinas-i7boetvve.vercel.app",
  latestDeploymentAt: 1700000000000,
  createdAt: 1700000000000,
  gitRepo: null,
}

describe("GET /api/admin/vercel-projects", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin1", role: "super_admin" }, expires: "2030-01-01" } as any)
    vi.mocked(isVercelConfigured).mockResolvedValue(true)
  })

  it("resolves an orphaned project's URL via getProjectPrimaryDomain instead of the raw random-hash fallback", async () => {
    vi.mocked(listVercelProjectsDetailed).mockResolvedValue([RAW_PROJECT] as any)
    vi.mocked(db.tenant.findMany).mockResolvedValue([] as any) // no owning tenant — orphan
    vi.mocked(getProjectPrimaryDomain).mockResolvedValue("https://demo-profil-dinas.sites.sacms.cloud")

    const res = await GET(request(), {} as any)
    const data = await res.json()

    expect(getProjectPrimaryDomain).toHaveBeenCalledWith("prj_demo1")
    expect(data.projects[0].url).toBe("https://demo-profil-dinas.sites.sacms.cloud")
    expect(data.projects[0].tenant).toBeNull()
  })

  it("falls back to the raw listVercelProjectsDetailed url when getProjectPrimaryDomain finds no verified domain", async () => {
    vi.mocked(listVercelProjectsDetailed).mockResolvedValue([RAW_PROJECT] as any)
    vi.mocked(db.tenant.findMany).mockResolvedValue([] as any)
    vi.mocked(getProjectPrimaryDomain).mockResolvedValue(null)

    const res = await GET(request(), {} as any)
    const data = await res.json()

    expect(data.projects[0].url).toBe(RAW_PROJECT.url)
  })

  it("prefers the tenant's own stored vercelDeploymentUrl and skips the extra Vercel API call entirely when a tenant owns the project", async () => {
    vi.mocked(listVercelProjectsDetailed).mockResolvedValue([{ ...RAW_PROJECT, id: "prj_real1" }] as any)
    vi.mocked(db.tenant.findMany).mockResolvedValue([
      { id: "t1", name: "Toko Kopi", slug: "toko-kopi", vercelProjectId: "prj_real1", vercelDeploymentUrl: "https://toko-kopi.sites.sacms.cloud" },
    ] as any)

    const res = await GET(request(), {} as any)
    const data = await res.json()

    expect(getProjectPrimaryDomain).not.toHaveBeenCalled()
    expect(data.projects[0].url).toBe("https://toko-kopi.sites.sacms.cloud")
    expect(data.projects[0].tenant).toEqual({ id: "t1", name: "Toko Kopi", slug: "toko-kopi" })
  })
})
