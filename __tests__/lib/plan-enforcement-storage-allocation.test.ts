import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getOwnerStorageAllocationPlan } from "@/lib/plan-enforcement"

vi.mock("@/lib/database", () => {
  const mockDb = {
    tenantMember: { findMany: vi.fn() },
    enterpriseStorageAllocation: { findMany: vi.fn() },
  }
  return { db: mockDb, getTenantDb: vi.fn() }
})

const GB = 1024 * 1024 * 1024

describe("getOwnerStorageAllocationPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("splits the pool evenly across every owned tenant when nothing is explicit", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }, { tenantId: "B" }])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([])

    const plan = await getOwnerStorageAllocationPlan("owner1", 10 * GB)

    expect(plan.get("A")).toEqual({ allocatedBytes: 5 * GB, isExplicit: false })
    expect(plan.get("B")).toEqual({ allocatedBytes: 5 * GB, isExplicit: false })
  })

  it("gives explicit tenants their own figure, splitting the remainder among the rest", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }, { tenantId: "B" }, { tenantId: "C" }])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([{ tenantId: "A", allocatedGb: 7 }])

    const plan = await getOwnerStorageAllocationPlan("owner1", 10 * GB)

    expect(plan.get("A")).toEqual({ allocatedBytes: 7 * GB, isExplicit: true })
    // Remainder (3GB) split between B and C → 1.5GB each.
    expect(plan.get("B")).toEqual({ allocatedBytes: 1.5 * GB, isExplicit: false })
    expect(plan.get("C")).toEqual({ allocatedBytes: 1.5 * GB, isExplicit: false })
  })

  it("clamps the remainder at 0 when explicit allocations alone exceed the pool (e.g. after a license downgrade)", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }, { tenantId: "B" }])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([{ tenantId: "A", allocatedGb: 20 }])

    const plan = await getOwnerStorageAllocationPlan("owner1", 10 * GB)

    // A keeps its full explicit figure even though it now exceeds the pool —
    // never silently rescaled or deleted.
    expect(plan.get("A")).toEqual({ allocatedBytes: 20 * GB, isExplicit: true })
    expect(plan.get("B")).toEqual({ allocatedBytes: 0, isExplicit: false })
  })

  it("returns an empty map with no divide-by-zero when the owner has no workspaces", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([])

    const plan = await getOwnerStorageAllocationPlan("owner1", 10 * GB)

    expect(plan.size).toBe(0)
  })

  it("ignores an explicit row for a tenant no longer owned by this user", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([
      { tenantId: "A", allocatedGb: 4 },
      { tenantId: "stale-transferred-tenant", allocatedGb: 9999 },
    ])

    const plan = await getOwnerStorageAllocationPlan("owner1", 10 * GB)

    expect(plan.get("A")).toEqual({ allocatedBytes: 4 * GB, isExplicit: true })
    expect(plan.has("stale-transferred-tenant")).toBe(false)
  })

  it("picks up a newly created tenant as auto-split with no extra write (live recompute, nothing stored)", async () => {
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }, { tenantId: "B" }])
    ;(db.enterpriseStorageAllocation.findMany as any).mockResolvedValue([{ tenantId: "A", allocatedGb: 7 }])

    const beforeC = await getOwnerStorageAllocationPlan("owner1", 10 * GB)
    expect(beforeC.get("B")).toEqual({ allocatedBytes: 3 * GB, isExplicit: false })

    // Tenant C appears (e.g. a new workspace was just created) — same
    // explicit rows, no write to enterpriseStorageAllocation for C.
    ;(db.tenantMember.findMany as any).mockResolvedValue([{ tenantId: "A" }, { tenantId: "B" }, { tenantId: "C" }])

    const afterC = await getOwnerStorageAllocationPlan("owner1", 10 * GB)
    expect(afterC.get("B")).toEqual({ allocatedBytes: 1.5 * GB, isExplicit: false })
    expect(afterC.get("C")).toEqual({ allocatedBytes: 1.5 * GB, isExplicit: false })
  })
})
