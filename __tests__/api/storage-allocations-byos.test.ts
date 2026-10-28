import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/plan-enforcement", () => ({
  getOwnerStorageLicense: vi.fn(),
  hasOwnerByos: vi.fn(),
}))
vi.mock("@/lib/database", () => ({
  db: {
    tenantMember: { findFirst: vi.fn() },
    enterpriseStorageAllocation: { findMany: vi.fn(), upsert: vi.fn() },
  },
}))

import { getServerSession } from "next-auth"
import { db } from "@/lib/database"
import { getOwnerStorageLicense, hasOwnerByos } from "@/lib/plan-enforcement"
import { PUT } from "@/app/api/user/storage-allocations/[tenantId]/route"

const mockSession = vi.mocked(getServerSession)
const ctx = (tenantId: string) => ({ params: Promise.resolve({ tenantId }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "PUT", body: JSON.stringify(body) }) as any

describe("PUT /api/user/storage-allocations/[tenantId] — BYOS owners", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "owner1" } } as any)
    ;(db.tenantMember.findFirst as any).mockResolvedValue({ id: "member1" })
    ;(db.enterpriseStorageAllocation.upsert as any).mockResolvedValue({})
  })

  it("rejects a non-Enterprise, non-BYOS owner (no infra to back the allocation)", async () => {
    vi.mocked(getOwnerStorageLicense).mockResolvedValue({ licensed: false, limitBytes: 0 })
    vi.mocked(hasOwnerByos).mockResolvedValue(false)

    const res = await PUT(jsonReq({ allocatedGb: 15 }), ctx("tenant-a"))

    expect(res.status).toBe(403)
    expect(db.enterpriseStorageAllocation.upsert).not.toHaveBeenCalled()
  })

  it("allows a BYOS owner to set an allocation with no pool-ceiling check", async () => {
    vi.mocked(getOwnerStorageLicense).mockResolvedValue({ licensed: false, limitBytes: 0 })
    vi.mocked(hasOwnerByos).mockResolvedValue(true)

    const res = await PUT(jsonReq({ allocatedGb: 500 }), ctx("tenant-a"))

    expect(res.status).toBe(200)
    // No "other explicit allocations" sum check performed for a BYOS owner —
    // the pool-overflow guard query is Enterprise-pool-only.
    expect(db.enterpriseStorageAllocation.findMany).not.toHaveBeenCalled()
    expect(db.enterpriseStorageAllocation.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a" },
      update: { allocatedGb: 500, ownerId: "owner1" },
      create: { tenantId: "tenant-a", ownerId: "owner1", allocatedGb: 500 },
    })
  })

  it("still enforces the pool ceiling for an Enterprise-licensed owner", async () => {
    vi.mocked(getOwnerStorageLicense).mockResolvedValue({ licensed: true, limitBytes: 10 * 1024 * 1024 * 1024 })
    vi.mocked(hasOwnerByos).mockResolvedValue(false)
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([])

    const res = await PUT(jsonReq({ allocatedGb: 15 }), ctx("tenant-a"))

    expect(res.status).toBe(400)
    expect(db.enterpriseStorageAllocation.upsert).not.toHaveBeenCalled()
  })
})
