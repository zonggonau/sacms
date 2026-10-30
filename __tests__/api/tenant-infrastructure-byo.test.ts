import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    tenantMember: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  isOwnerEligibleForByoInfra: vi.fn(),
  isWorkspaceEligibleForByoInfra: vi.fn(),
  invalidateOwnerMasterInfraCache: vi.fn(),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db, isWorkspaceEligibleForByoInfra } from "@/lib/database"
import { PUT } from "@/app/api/tenant/[tenant]/infrastructure/route"

const MASK = "••••••••"
const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const ctx = (tenant: string) => ({ params: Promise.resolve({ tenant }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "PUT", body: JSON.stringify(body) }) as any

describe("PUT /api/tenant/[tenant]/infrastructure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "owner1" } } as any)
    mockAccess.mockResolvedValue({ role: "owner", tenantId: "tenant1", userId: "owner1" } as any)
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ storageConfig: null } as any)
  })

  it("rejects a non-owner (minRole enforcement happens before the handler runs)", async () => {
    mockAccess.mockResolvedValue({ role: "editor", tenantId: "tenant1", userId: "editor1" } as any)

    const res = await PUT(jsonReq({ databaseUrl: "postgresql://x" }), ctx("tenant1"))

    expect(res.status).toBe(403)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("allows clearing databaseUrl to null unconditionally, even when ineligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(false)

    const res = await PUT(jsonReq({ databaseUrl: null }), ctx("tenant1"))

    expect(res.status).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: "tenant1" }, data: { databaseUrl: null } })
  })

  it("rejects setting a new databaseUrl when the workspace is ineligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(false)

    const res = await PUT(jsonReq({ databaseUrl: "postgresql://host:5432/db" }), ctx("tenant1"))

    expect(res.status).toBe(403)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("allows setting a valid new databaseUrl when eligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)

    const res = await PUT(jsonReq({ databaseUrl: "postgresql://host:5432/db" }), ctx("tenant1"))

    expect(res.status).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith({ where: { id: "tenant1" }, data: { databaseUrl: "postgresql://host:5432/db" } })
  })

  it("rejects an invalid (non-postgres://) URL even when eligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)

    const res = await PUT(jsonReq({ databaseUrl: "mysql://host/db" }), ctx("tenant1"))

    expect(res.status).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("leaves the stored databaseUrl untouched when the incoming value is the mask", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)

    const res = await PUT(jsonReq({ databaseUrl: MASK }), ctx("tenant1"))

    expect(res.status).toBe(200)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("reuses the existing storage secretKey when the incoming value is the mask", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(db.tenant.findUnique).mockResolvedValue({
      storageConfig: { endpoint: "https://old", accessKey: "old-key", secretKey: "real-secret", bucket: "old-bucket" },
    } as any)

    const res = await PUT(
      jsonReq({ storageConfig: { endpoint: "https://new", accessKey: "new-key", secretKey: MASK, bucket: "new-bucket" } }),
      ctx("tenant1"),
    )

    expect(res.status).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { storageConfig: { endpoint: "https://new", accessKey: "new-key", secretKey: "real-secret", bucket: "new-bucket" } },
    })
  })

  it("rejects a masked secretKey when there is no existing secret on record", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ storageConfig: null } as any)

    const res = await PUT(
      jsonReq({ storageConfig: { endpoint: "https://new", accessKey: "new-key", secretKey: MASK, bucket: "new-bucket" } }),
      ctx("tenant1"),
    )

    expect(res.status).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })
})
