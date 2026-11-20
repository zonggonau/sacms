import { describe, it, expect, vi, beforeEach } from "vitest"
import { isTenantLocked } from "@/lib/tenant-lock"
import { db } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"

// tenant-lock.ts starts with `import "server-only"` — not an npm package
// vitest's plain Node resolution can see, same stub used elsewhere.
vi.mock("server-only", () => ({}))

vi.mock("@/lib/database", () => ({
  db: {
    subscription: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    tenantMember: { findFirst: vi.fn() },
  },
}))

vi.mock("@/lib/license", () => ({
  isEnterpriseTenant: vi.fn(),
}))

describe("isTenantLocked — shared public-site/dashboard lock condition", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.tenantMember.findFirst).mockResolvedValue({ userId: "owner-1" } as any)
  })

  it("is not locked when the tenant doesn't exist (caller already 404s elsewhere)", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null)
    expect(await isTenantLocked("missing")).toBe(false)
  })

  it("is locked when status is suspended", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "suspended" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)
    expect(await isTenantLocked("t1")).toBe(true)
  })

  it("is locked when the latest subscription's period has already ended", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "active" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({
      currentPeriodEnd: new Date(Date.now() - 86400000),
    } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)
    expect(await isTenantLocked("t1")).toBe(true)
  })

  it("is NOT locked while the subscription's period hasn't ended yet", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "active" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({
      currentPeriodEnd: new Date(Date.now() + 86400000),
    } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)
    expect(await isTenantLocked("t1")).toBe(false)
  })

  it("a free plan with no subscription period end (null) is never locked", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "active" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ currentPeriodEnd: null } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)
    expect(await isTenantLocked("t1")).toBe(false)
  })

  it("a real licensed Enterprise tenant bypasses lock even past its period end", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "active" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({
      currentPeriodEnd: new Date(Date.now() - 86400000),
    } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(true)
    expect(await isTenantLocked("t1")).toBe(false)
  })

  it("passes the tenant's owner (via TenantMember role=owner), not Tenant.ownerId, to isEnterpriseTenant", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ status: "active" } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null)
    vi.mocked(db.tenantMember.findFirst).mockResolvedValue({ userId: "real-owner-id" } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)

    await isTenantLocked("t1")

    expect(isEnterpriseTenant).toHaveBeenCalledWith("t1", "real-owner-id")
    expect(db.tenantMember.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t1", role: "owner" },
      select: { userId: true },
    })
  })
})
