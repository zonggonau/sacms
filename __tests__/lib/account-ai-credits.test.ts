import { describe, it, expect, vi, beforeEach } from "vitest"
import { USER_PLAN_LIMITS, AI_CREDIT_PACKS } from "@/lib/constants/tenant-limits"
import { enforceUserAiCredits, deductUserAiCredits, reserveUserAiCredits, refundUserAiCredits } from "@/lib/plan-enforcement"
import { db } from "@/lib/database"

vi.mock("@/lib/database", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    customPlanOverride: {
      findUnique: vi.fn(),
    },
    aiQuotaLedger: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (promises) => Promise.all(promises)),
  },
  getTenantDb: vi.fn(),
}))

vi.mock("@/lib/settings", () => ({
  getGlobalWorkspaceId: vi.fn().mockResolvedValue("global-system-tenant"),
}))

vi.mock("@/lib/license", () => ({
  isEnterpriseTenant: vi.fn().mockResolvedValue(false),
}))

describe("Account-Level AI Credit Quota & Standalone Top-Up Packs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should have correct credit amounts and pricing for all 4 top-up packs", () => {
    const starter = AI_CREDIT_PACKS.find(p => p.id === "ai_pack_starter")
    const pro = AI_CREDIT_PACKS.find(p => p.id === "ai_pack_pro")
    const business = AI_CREDIT_PACKS.find(p => p.id === "ai_pack_business")
    const agency = AI_CREDIT_PACKS.find(p => p.id === "ai_pack_agency")

    expect(starter?.credits).toBe(300)
    expect(starter?.price_usd).toBe(9)

    expect(pro?.credits).toBe(1500)
    expect(pro?.price_usd).toBe(29)

    expect(business?.credits).toBe(5000)
    expect(business?.price_usd).toBe(79)

    expect(agency?.credits).toBe(15000)
    expect(agency?.price_usd).toBe(149)
  })

  it("should keep Account Plan workspace limits separate", () => {
    expect(USER_PLAN_LIMITS.free.max_workspaces).toBe(1)
    expect(USER_PLAN_LIMITS.starter.max_workspaces).toBe(3)
    expect(USER_PLAN_LIMITS.pro.max_workspaces).toBe(10)
    expect(USER_PLAN_LIMITS.enterprise.max_workspaces).toBe(20)
  })

  it("should allow generation when user has sufficient AI credits from top-up packs", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "user",
      plan: "free",
      aiCreditsUsed: 50,
      aiCreditsExtra: 300, // bought Starter pack
    } as any)

    vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)

    // Free plan's own free allowance (10, see USER_PLAN_LIMITS.free) + 300
    // extra = 310. Used: 50. Remaining: 260.
    const result = await enforceUserAiCredits("user-1", 25)
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(50)
    expect(result.max).toBe(310)
    expect(result.remaining).toBe(260)
  })

  it("should reject generation and prompt top-up when user credits are depleted", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-free",
      role: "user",
      plan: "free",
      aiCreditsUsed: 8,
      aiCreditsExtra: 0,
    } as any)

    vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)

    // Free plan has 10 credits (USER_PLAN_LIMITS.free.max_ai_credits).
    // 10 - 8 = 2 remaining. Requesting 25 credits.
    const result = await enforceUserAiCredits("user-free", 25)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(2)
    expect(result.message).toContain("AI credits depleted")
    expect(result.message).toContain("top up")
  })

  // User-reported bug: getUserEffectiveMax's "ai_credits" case never
  // actually read planConfig.max_ai_credits at all — every account
  // without a purchased Enterprise License got the exact same flat 50
  // regardless of its actual plan, so only a License holder ever saw a
  // different (bigger) number. USER_PLAN_LIMITS now carries a real
  // per-plan allowance, and this is the plumbing that actually uses it.
  it("gives each account plan its own AI credit allowance, not a flat amount regardless of plan", async () => {
    vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)

    const maxForPlan = async (plan: string) => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: "user-1", role: "user", plan, aiCreditsUsed: 0, aiCreditsExtra: 0,
      } as any)
      return (await enforceUserAiCredits("user-1", 1)).max
    }

    expect(await maxForPlan("free")).toBe(10)
    expect(await maxForPlan("starter")).toBe(25)
    expect(await maxForPlan("pro")).toBe(100)
    expect(await maxForPlan("business")).toBe(300)
  })

  it("should bypass credit limits for super admin", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "admin-user",
      role: "super_admin",
      plan: "free",
      aiCreditsUsed: 99999,
      aiCreditsExtra: 0,
    } as any)

    const result = await enforceUserAiCredits("admin-user", 25)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(999999)
  })

  it("should deduct user AI credits and record to ledger", async () => {
    vi.mocked(db.user.update).mockResolvedValue({ id: "user-1", aiCreditsUsed: 75 } as any)
    vi.mocked(db.aiQuotaLedger.create).mockResolvedValue({ id: "ledger-1" } as any)

    await deductUserAiCredits("user-1", 25, "generate_frontend", "workspace-1", "v0.dev")

    expect(db.$transaction).toHaveBeenCalled()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiCreditsUsed: { increment: 25 } },
    })
    expect(db.aiQuotaLedger.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tenantId: "workspace-1",
        action: "generate_frontend",
        credits: 25,
        tokens: 25000,
        model: "v0.dev",
      },
    })
  })

  // reserveUserAiCredits closes the TOCTOU race enforceUserAiCredits alone
  // leaves open: two concurrent calls could both read "enough remaining"
  // before either deduction lands. The fix is a single conditional
  // UPDATE ... WHERE aiCreditsUsed <= max - cost, so these tests assert the
  // exact where/data shape that makes that atomic, not just the boolean
  // outcome — a regression here would silently reopen the race.
  describe("reserveUserAiCredits (atomic check-and-deduct)", () => {
    it("reserves credits in one conditional update when enough remain", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        role: "user",
        aiCreditsUsed: 3,
        aiCreditsExtra: 0,
      } as any)
      vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)
      vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 } as any)

      // No `plan` on the mocked user → falls back to free (10 credits, see
      // USER_PLAN_LIMITS.free). 10 - 5 = 5 is the ceiling the WHERE clause
      // must enforce atomically against concurrent reservations.
      const result = await reserveUserAiCredits("user-1", 5)

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user-1", aiCreditsUsed: { lte: 5 } },
        data: { aiCreditsUsed: { increment: 5 } },
      })
      expect(result.allowed).toBe(true)
    })

    it("fails the reservation (count: 0) instead of racing when the conditional update doesn't match", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        role: "user",
        aiCreditsUsed: 45,
        aiCreditsExtra: 0,
      } as any)
      vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)
      // Simulates a concurrent request having already landed its own
      // increment between this one's read and its conditional update.
      vi.mocked(db.user.updateMany).mockResolvedValue({ count: 0 } as any)

      const result = await reserveUserAiCredits("user-1", 25)

      expect(result.allowed).toBe(false)
      expect(result.message).toContain("AI credits depleted")
    })

    it("bypasses reservation entirely for super admin", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        role: "super_admin",
        aiCreditsUsed: 99999,
        aiCreditsExtra: 0,
      } as any)

      const result = await reserveUserAiCredits("admin-user", 25)

      expect(result.allowed).toBe(true)
      expect(db.user.updateMany).not.toHaveBeenCalled()
    })
  })

  describe("refundUserAiCredits", () => {
    it("atomically decrements, guarded against going negative", async () => {
      vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 } as any)

      await refundUserAiCredits("user-1", 25)

      expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user-1", aiCreditsUsed: { gte: 25 } },
        data: { aiCreditsUsed: { decrement: 25 } },
      })
    })
  })
})
