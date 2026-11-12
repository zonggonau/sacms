import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/database", () => ({
  db: {
    websiteTemplate: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db } from "@/lib/database"
import { GET as listGET } from "@/app/api/tenant/[tenant]/website-templates/route"
import { GET as detailGET, PATCH, DELETE } from "@/app/api/tenant/[tenant]/website-templates/[id]/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const getReq = () => new Request("https://api.test/x", { method: "GET" }) as any
const patchReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "PATCH", body: JSON.stringify(body) }) as any

const regularAccess = { role: "admin", tenantId: "tenant1", userId: "user1", isGlobal: false, tenant: { id: "tenant1", name: "T", slug: "tenant1", plan: "business" } }
const globalAccess = { role: "admin", tenantId: "global1", userId: "user1", isGlobal: true, tenant: { id: "global1", name: "Global", slug: "sacms-global", plan: "enterprise" } }

describe("GET /api/tenant/[tenant]/website-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
    vi.mocked(db.websiteTemplate.findMany).mockResolvedValue([])
  })

  it("only returns published templates for a regular tenant", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    await listGET(getReq(), ctx({ tenant: "tenant1" }))
    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true } }),
    )
  })

  it("returns every template (published or draft) for SaCMS Global", async () => {
    mockAccess.mockResolvedValue(globalAccess as any)
    await listGET(getReq(), ctx({ tenant: "sacms-global" }))
    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    )
  })
})

describe("GET /api/tenant/[tenant]/website-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
  })

  it("404s when the template doesn't exist", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(null)
    const res = await detailGET(getReq(), ctx({ tenant: "tenant1", id: "wt1" }))
    expect(res.status).toBe(404)
  })

  it("404s for a regular tenant viewing a DRAFT template (not just filters it out of the list)", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ id: "wt1", published: false } as any)
    const res = await detailGET(getReq(), ctx({ tenant: "tenant1", id: "wt1" }))
    expect(res.status).toBe(404)
  })

  it("returns a published template's full detail (incl. files) to a regular tenant", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ id: "wt1", published: true, files: [{ path: "a.ts", content: "x" }] } as any)
    const res = await detailGET(getReq(), ctx({ tenant: "tenant1", id: "wt1" }))
    expect(res.status).toBe(200)
  })

  it("returns a DRAFT template's full detail to SaCMS Global", async () => {
    mockAccess.mockResolvedValue(globalAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ id: "wt1", published: false, files: [] } as any)
    const res = await detailGET(getReq(), ctx({ tenant: "sacms-global", id: "wt1" }))
    expect(res.status).toBe(200)
  })
})

describe("PATCH /api/tenant/[tenant]/website-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
  })

  it("rejects a regular (non-Global) tenant", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    const res = await PATCH(patchReq({ published: true }), ctx({ tenant: "tenant1", id: "wt1" }))
    expect(res.status).toBe(403)
    expect(db.websiteTemplate.update).not.toHaveBeenCalled()
  })

  it("404s when the template doesn't exist", async () => {
    mockAccess.mockResolvedValue(globalAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(null)
    const res = await PATCH(patchReq({ published: true }), ctx({ tenant: "sacms-global", id: "wt1" }))
    expect(res.status).toBe(404)
  })

  it("toggles published for SaCMS Global", async () => {
    mockAccess.mockResolvedValue(globalAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ id: "wt1", published: false } as any)
    vi.mocked(db.websiteTemplate.update).mockResolvedValue({ id: "wt1", published: true } as any)
    const res = await PATCH(patchReq({ published: true }), ctx({ tenant: "sacms-global", id: "wt1" }))
    expect(res.status).toBe(200)
    expect(db.websiteTemplate.update).toHaveBeenCalledWith({ where: { id: "wt1" }, data: { published: true } })
  })
})

describe("DELETE /api/tenant/[tenant]/website-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
  })

  it("rejects a regular (non-Global) tenant", async () => {
    mockAccess.mockResolvedValue(regularAccess as any)
    const res = await DELETE(getReq(), ctx({ tenant: "tenant1", id: "wt1" }))
    expect(res.status).toBe(403)
    expect(db.websiteTemplate.delete).not.toHaveBeenCalled()
  })

  it("deletes for SaCMS Global", async () => {
    mockAccess.mockResolvedValue(globalAccess as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ id: "wt1" } as any)
    const res = await DELETE(getReq(), ctx({ tenant: "sacms-global", id: "wt1" }))
    expect(res.status).toBe(200)
    expect(db.websiteTemplate.delete).toHaveBeenCalledWith({ where: { id: "wt1" } })
  })
})
