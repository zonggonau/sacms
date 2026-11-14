import { describe, it, expect, vi, beforeEach } from "vitest"

// schema-wipe.ts (imported transitively via route.ts) starts with
// `import "server-only"` — not an npm package vitest's plain Node
// resolution can see, same stub used elsewhere.
vi.mock("server-only", () => ({}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))

const { fakeTenantDb } = vi.hoisted(() => ({
  fakeTenantDb: {
    contentType: { deleteMany: vi.fn() },
    singleType: { deleteMany: vi.fn() },
    component: { deleteMany: vi.fn() },
  },
}))

vi.mock("@/lib/database", () => ({
  getTenantDb: vi.fn().mockResolvedValue(fakeTenantDb),
}))

vi.mock("@/lib/schema-lock", () => ({
  assertSchemaEditable: vi.fn().mockResolvedValue(null),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { assertSchemaEditable } from "@/lib/schema-lock"
import { POST } from "@/app/api/tenant/[tenant]/ai-builder/delete-schema/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const req = () => new Request("https://api.test/x", { method: "POST" }) as any

const regularAccess = { role: "admin", tenantId: "tenant1", userId: "user1", isGlobal: false, tenant: { id: "tenant1", slug: "acme" } }

describe("POST /api/tenant/[tenant]/ai-builder/delete-schema", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1", role: "owner" } } as any)
    mockAccess.mockResolvedValue(regularAccess as any)
    vi.mocked(assertSchemaEditable).mockResolvedValue(null as any)
    fakeTenantDb.contentType.deleteMany.mockResolvedValue({ count: 0 })
    fakeTenantDb.singleType.deleteMany.mockResolvedValue({ count: 0 })
    fakeTenantDb.component.deleteMany.mockResolvedValue({ count: 0 })
  })

  it("is blocked entirely for the SaCMS Global workspace", async () => {
    mockAccess.mockResolvedValue({ ...regularAccess, isGlobal: true } as any)
    const res = await POST(req(), ctx({ tenant: "sacms-global" }))
    expect(res.status).toBe(403)
    expect(fakeTenantDb.contentType.deleteMany).not.toHaveBeenCalled()
  })

  it("is blocked while the schema is finalized (draft lock)", async () => {
    vi.mocked(assertSchemaEditable).mockResolvedValue({ error: "Schema sudah final" } as any)
    const res = await POST(req(), ctx({ tenant: "acme" }))
    expect(res.status).toBe(403)
    expect(fakeTenantDb.contentType.deleteMany).not.toHaveBeenCalled()
  })

  it("delegates to wipeTenantSchema and reports the deleted counts on the happy path", async () => {
    fakeTenantDb.contentType.deleteMany.mockResolvedValue({ count: 3 })
    fakeTenantDb.singleType.deleteMany.mockResolvedValue({ count: 1 })
    fakeTenantDb.component.deleteMany.mockResolvedValue({ count: 2 })

    const res = await POST(req(), ctx({ tenant: "acme" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(fakeTenantDb.contentType.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(fakeTenantDb.singleType.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(fakeTenantDb.component.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
    expect(body).toEqual({ success: true, deleted: { contentTypes: 3, singleTypes: 1, components: 2 } })
  })
})
