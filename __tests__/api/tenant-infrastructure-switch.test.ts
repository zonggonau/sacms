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
  invalidateOwnerMasterInfraCache: vi.fn(),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db, isOwnerEligibleForByoInfra } from "@/lib/database"
import { PATCH } from "@/app/api/tenant/[tenant]/infrastructure/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const ctx = (tenant: string) => ({ params: Promise.resolve({ tenant }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "PATCH", body: JSON.stringify(body) }) as any

describe("PATCH /api/tenant/[tenant]/infrastructure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "owner1" } } as any)
    mockAccess.mockResolvedValue({ role: "owner", tenantId: "tenant1", userId: "owner1" } as any)
  })

  it("always allows turning the switch OFF (back to SaCMS)", async () => {
    const res = await PATCH(jsonReq({ useOwnerInfra: false }), ctx("tenant1"))

    expect(res.status).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { useOwnerInfra: false },
    })
  })

  it("rejects turning the switch ON when the owner has no BYODB/BYOS configured", async () => {
    vi.mocked(db.tenantMember.findFirst).mockResolvedValue({ userId: "owner1" } as any)
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(db.user.findUnique).mockResolvedValue({ masterDatabaseUrl: null, masterStorageConfig: null } as any)

    const res = await PATCH(jsonReq({ useOwnerInfra: true }), ctx("tenant1"))

    expect(res.status).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("rejects turning the switch ON when the owner's plan isn't Enterprise/Agency, even with infra fields set", async () => {
    vi.mocked(db.tenantMember.findFirst).mockResolvedValue({ userId: "owner1" } as any)
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(false)
    vi.mocked(db.user.findUnique).mockResolvedValue({ masterDatabaseUrl: "postgresql://x", masterStorageConfig: null } as any)

    const res = await PATCH(jsonReq({ useOwnerInfra: true }), ctx("tenant1"))

    expect(res.status).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it("allows turning the switch ON when the owner is eligible and has a configured database", async () => {
    vi.mocked(db.tenantMember.findFirst).mockResolvedValue({ userId: "owner1" } as any)
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(db.user.findUnique).mockResolvedValue({ masterDatabaseUrl: "postgresql://x", masterStorageConfig: null } as any)

    const res = await PATCH(jsonReq({ useOwnerInfra: true }), ctx("tenant1"))

    expect(res.status).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { useOwnerInfra: true },
    })
  })

  it("rejects a non-owner (minRole enforcement happens before the handler runs)", async () => {
    mockAccess.mockResolvedValue({ role: "editor", tenantId: "tenant1", userId: "editor1" } as any)

    const res = await PATCH(jsonReq({ useOwnerInfra: false }), ctx("tenant1"))

    expect(res.status).toBe(403)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })
})
