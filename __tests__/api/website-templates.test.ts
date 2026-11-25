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

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const getReq = () => new Request("https://api.test/x", { method: "GET" }) as any

const regularAccess = { role: "admin", tenantId: "tenant1", userId: "user1", tenant: { id: "tenant1", name: "T", slug: "tenant1", plan: "business" } }

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

  it("never lists draft templates, even for a workspace named like the old Global one", async () => {
    mockAccess.mockResolvedValue({ ...regularAccess, tenant: { ...regularAccess.tenant, slug: "sacms-global" } } as any)
    await listGET(getReq(), ctx({ tenant: "sacms-global" }))
    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true } }),
    )
  })
})
