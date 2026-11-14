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
    contentType: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    singleType: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    component: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}))

vi.mock("@/lib/database", () => ({
  db: {
    setting: { findUnique: vi.fn(), deleteMany: vi.fn().mockResolvedValue({}) },
    tenant: { update: vi.fn().mockResolvedValue({}) },
  },
  getTenantDb: vi.fn().mockResolvedValue(fakeTenantDb),
}))

vi.mock("@/lib/vercel-client", () => ({
  addDomainToProject: vi.fn(),
  deleteVercelProject: vi.fn(),
  getDomainConfig: vi.fn(),
  removeDomainFromProject: vi.fn(),
}))

vi.mock("@/lib/infrastructure/hosting-plan", () => ({
  isTenantPlanPaid: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/infrastructure/deploy-frontend", () => ({
  deployTenantFrontend: vi.fn(),
  redeployTenantFrontend: vi.fn(),
}))

vi.mock("@/lib/infrastructure/frontend-env", () => ({
  getFrontendDeployToken: vi.fn().mockResolvedValue("token"),
  resolveApiOrigin: vi.fn().mockReturnValue("https://sacms.cloud"),
}))

vi.mock("@/lib/schema-lock", () => ({
  assertSchemaEditable: vi.fn().mockResolvedValue(null),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db } from "@/lib/database"
import { deleteVercelProject } from "@/lib/vercel-client"
import { assertSchemaEditable } from "@/lib/schema-lock"
import { POST } from "@/app/api/tenant/[tenant]/ai-builder/deploy/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const req = (body: Record<string, unknown>) =>
  new Request("https://api.test/x", { method: "POST", body: JSON.stringify(body) }) as any

const regularAccess = {
  role: "admin",
  tenantId: "tenant1",
  userId: "user1",
  isGlobal: false,
  tenant: { id: "tenant1", slug: "acme", plan: "business", vercelProjectId: "prj_1" },
}

describe("POST /api/tenant/[tenant]/ai-builder/deploy — action: reset-website", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1", role: "owner" } } as any)
    mockAccess.mockResolvedValue(regularAccess as any)
    vi.mocked(assertSchemaEditable).mockResolvedValue(null as any)
    vi.mocked(db.setting.findUnique).mockResolvedValue({ value: "prj_1" } as any)
    vi.mocked(deleteVercelProject).mockResolvedValue({ ok: true } as any)
  })

  it("is blocked entirely for the SaCMS Global workspace", async () => {
    mockAccess.mockResolvedValue({ ...regularAccess, isGlobal: true } as any)
    const res = await POST(req({ action: "reset-website" }), ctx({ tenant: "sacms-global" }))
    expect(res.status).toBe(403)
    expect(deleteVercelProject).not.toHaveBeenCalled()
  })

  it("is blocked while the schema is finalized (draft lock)", async () => {
    vi.mocked(assertSchemaEditable).mockResolvedValue({ error: "Schema sudah final" } as any)
    const res = await POST(req({ action: "reset-website" }), ctx({ tenant: "acme" }))
    expect(res.status).toBe(403)
    expect(deleteVercelProject).not.toHaveBeenCalled()
  })

  it("aborts before touching the DB when the Vercel project deletion fails — a retry stays safe", async () => {
    vi.mocked(deleteVercelProject).mockResolvedValue({ ok: false, error: "quota exceeded" } as any)
    const res = await POST(req({ action: "reset-website" }), ctx({ tenant: "acme" }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("quota exceeded")
    expect(db.tenant.update).not.toHaveBeenCalled()
    expect(fakeTenantDb.contentType.deleteMany).not.toHaveBeenCalled()
  })

  it("still wipes the schema and clears tenant fields when there is no Vercel project to delete", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null)
    mockAccess.mockResolvedValue({ ...regularAccess, tenant: { ...regularAccess.tenant, vercelProjectId: null } } as any)

    const res = await POST(req({ action: "reset-website" }), ctx({ tenant: "acme" }))
    expect(res.status).toBe(200)
    expect(deleteVercelProject).not.toHaveBeenCalled()
    expect(fakeTenantDb.contentType.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant1" } })
  })

  it("on success: deletes the Vercel project, clears all four tenant fields + settings, and wipes the schema", async () => {
    fakeTenantDb.contentType.deleteMany.mockResolvedValue({ count: 2 })
    fakeTenantDb.singleType.deleteMany.mockResolvedValue({ count: 1 })
    fakeTenantDb.component.deleteMany.mockResolvedValue({ count: 0 })

    const res = await POST(req({ action: "reset-website" }), ctx({ tenant: "acme" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(deleteVercelProject).toHaveBeenCalledWith("prj_1")
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { vercelDeploymentUrl: null, vercelProjectId: null, customDomain: null, sourceWebsiteTemplateId: null },
    })
    expect(db.setting.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: ["tenant1_vercelDeploymentUrl", "tenant1_vercelProjectId", "tenant1_customDomain"] } },
    })
    expect(body).toEqual({ success: true, deletedSchema: { contentTypes: 2, singleTypes: 1, components: 0 } })
  })
})
