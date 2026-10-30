import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// __tests__/setup.ts globally replaces "@/lib/database" with a fake object
// for every test file — override that here with the REAL module (via
// importOriginal) so isWorkspaceEligibleForByoInfra's actual implementation
// runs. Its internal closure calls `db.tenant.findUnique` on the module's
// own `db` binding, so spying on that SAME object (not a separately
// constructed fake) is what makes the mock actually take effect below.
vi.mock("@/lib/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/database")>()
  return actual
})
vi.mock("@/lib/license", () => ({ isEnterpriseTenant: vi.fn() }))
vi.mock("@/lib/settings", () => ({ getGlobalWorkspaceId: vi.fn().mockResolvedValue("global1") }))

import { db, isWorkspaceEligibleForByoInfra } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"

describe("isWorkspaceEligibleForByoInfra", () => {
  let findUniqueSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    findUniqueSpy = vi.spyOn(db.tenant, "findUnique")
  })

  afterEach(() => {
    findUniqueSpy.mockRestore()
  })

  it("returns true for a business-plan tenant", async () => {
    findUniqueSpy.mockResolvedValue({ plan: "business", ownerId: "owner1" } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(true)
    expect(isEnterpriseTenant).not.toHaveBeenCalled()
  })

  it("returns true for an enterprise-plan tenant", async () => {
    findUniqueSpy.mockResolvedValue({ plan: "enterprise", ownerId: "owner1" } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(true)
  })

  it("normalizes whitespace/case on the plan string", async () => {
    findUniqueSpy.mockResolvedValue({ plan: " Business ", ownerId: "owner1" } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(true)
  })

  it("returns false for free/starter/pro with no Enterprise License", async () => {
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)

    findUniqueSpy.mockResolvedValue({ plan: "free", ownerId: "owner1" } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(false)

    findUniqueSpy.mockResolvedValue({ plan: "pro", ownerId: "owner1" } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(false)
  })

  it("returns true for a free-plan tenant whose owner has a valid Enterprise License", async () => {
    findUniqueSpy.mockResolvedValue({ plan: "free", ownerId: "owner1" } as any)
    vi.mocked(isEnterpriseTenant).mockResolvedValue(true)

    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(true)
    expect(isEnterpriseTenant).toHaveBeenCalledWith("global1", "owner1")
  })

  it("returns false when the tenant is not found", async () => {
    findUniqueSpy.mockResolvedValue(null as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(false)
  })

  it("returns false when the tenant has no ownerId", async () => {
    findUniqueSpy.mockResolvedValue({ plan: "free", ownerId: null } as any)
    expect(await isWorkspaceEligibleForByoInfra("tenant1")).toBe(false)
    expect(isEnterpriseTenant).not.toHaveBeenCalled()
  })
})
