import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { DELETE } from "@/app/api/admin/website-templates/[id]/route"
import { db } from "@/lib/database"
import { deleteVercelProject } from "@/lib/vercel-client"

// Deleting a Website Template from /admin/developer/templates is a FULL
// cleanup (unlike the MCP server's own delete_website_template, which
// deliberately leaves the backing Schema Template alone): the demo Vercel
// project, the Website Template row, AND — only if no OTHER Website
// Template still follows the same Schema Template, and it isn't the
// platform's isDefault one — the Schema Template plus its internal demo
// tenant too. A workspace that already applied the template/schema must
// never be touched (verified by the schema's own onDelete: SetNull on
// Tenant.sourceWebsiteTemplateId, not re-tested here — out of this route's
// own reach to break).

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/database", () => ({
  db: {
    websiteTemplate: { findUnique: vi.fn(), delete: vi.fn(), count: vi.fn() },
    schemaTemplate: { delete: vi.fn() },
    tenant: { delete: vi.fn() },
  },
}))
vi.mock("@/lib/vercel-client", () => ({
  deleteVercelProject: vi.fn(),
}))

function request() {
  return new NextRequest("https://example.test/api/admin/website-templates/wt_1", { method: "DELETE" })
}

const BASE_TEMPLATE = {
  id: "wt_1",
  slug: "modern-dark",
  name: "Modern Dark",
  demoVercelProjectId: "prj_demo1",
  schemaTemplate: { id: "st_1", slug: "company-profile", isDefault: false, demoTenantId: "demo-tenant-1" },
}

describe("DELETE /api/admin/website-templates/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin1", role: "super_admin" }, expires: "2030-01-01" } as any)
    vi.mocked(db.websiteTemplate.delete as any).mockResolvedValue({})
    vi.mocked(db.schemaTemplate.delete as any).mockResolvedValue({})
    vi.mocked(db.tenant.delete as any).mockResolvedValue({})
    vi.mocked(deleteVercelProject).mockResolvedValue({ ok: true } as any)
  })

  it("deletes the demo Vercel project, the Website Template, and — no other dependents, not the default schema — the backing Schema Template and its demo tenant too", async () => {
    vi.mocked(db.websiteTemplate.findUnique as any).mockResolvedValue(BASE_TEMPLATE)
    vi.mocked(db.websiteTemplate.count as any).mockResolvedValue(0)

    const res = await DELETE(request(), { params: Promise.resolve({ id: "wt_1" }) } as any)
    const data = await res.json()

    expect(deleteVercelProject).toHaveBeenCalledWith("prj_demo1")
    expect(db.websiteTemplate.delete).toHaveBeenCalledWith({ where: { id: "wt_1" } })
    expect(db.tenant.delete).toHaveBeenCalledWith({ where: { id: "demo-tenant-1" } })
    expect(db.schemaTemplate.delete).toHaveBeenCalledWith({ where: { id: "st_1" } })
    expect(data).toEqual({ success: true, schemaDeleted: true })
  })

  it("keeps the Schema Template when another Website Template still follows it", async () => {
    vi.mocked(db.websiteTemplate.findUnique as any).mockResolvedValue(BASE_TEMPLATE)
    vi.mocked(db.websiteTemplate.count as any).mockResolvedValue(1) // a second template still depends on it

    const res = await DELETE(request(), { params: Promise.resolve({ id: "wt_1" }) } as any)
    const data = await res.json()

    expect(db.schemaTemplate.delete).not.toHaveBeenCalled()
    expect(db.tenant.delete).not.toHaveBeenCalled()
    expect(data).toEqual({ success: true, schemaDeleted: false })
  })

  it("never deletes the platform's isDefault Schema Template (used to auto-seed every new workspace), even with zero other dependents", async () => {
    vi.mocked(db.websiteTemplate.findUnique as any).mockResolvedValue({
      ...BASE_TEMPLATE,
      schemaTemplate: { ...BASE_TEMPLATE.schemaTemplate, isDefault: true },
    })
    vi.mocked(db.websiteTemplate.count as any).mockResolvedValue(0)

    const res = await DELETE(request(), { params: Promise.resolve({ id: "wt_1" }) } as any)
    const data = await res.json()

    expect(db.schemaTemplate.delete).not.toHaveBeenCalled()
    expect(db.tenant.delete).not.toHaveBeenCalled()
    expect(data).toEqual({ success: true, schemaDeleted: false })
  })

  it("skips the demo-tenant delete gracefully when the Schema Template never had one", async () => {
    vi.mocked(db.websiteTemplate.findUnique as any).mockResolvedValue({
      ...BASE_TEMPLATE,
      schemaTemplate: { ...BASE_TEMPLATE.schemaTemplate, demoTenantId: null },
    })
    vi.mocked(db.websiteTemplate.count as any).mockResolvedValue(0)

    const res = await DELETE(request(), { params: Promise.resolve({ id: "wt_1" }) } as any)
    const data = await res.json()

    expect(db.tenant.delete).not.toHaveBeenCalled()
    expect(db.schemaTemplate.delete).toHaveBeenCalledWith({ where: { id: "st_1" } })
    expect(data).toEqual({ success: true, schemaDeleted: true })
  })

  it("404s when the Website Template doesn't exist, without touching Vercel or the schema", async () => {
    vi.mocked(db.websiteTemplate.findUnique as any).mockResolvedValue(null)

    const res = await DELETE(request(), { params: Promise.resolve({ id: "missing" }) } as any)

    expect(res.status).toBe(404)
    expect(deleteVercelProject).not.toHaveBeenCalled()
    expect(db.websiteTemplate.delete).not.toHaveBeenCalled()
  })
})
