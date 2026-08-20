import { describe, it, expect, vi, beforeEach } from "vitest"
import { USER_PLAN_LIMITS, AI_CREDIT_PACKS } from "@/lib/constants/tenant-limits"
import { enforceUserAiCredits, deductUserAiCredits } from "@/lib/plan-enforcement"
import { db } from "@/lib/database"

vi.mock("@/lib/database", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

    // Total: 50 initial + 300 extra = 350. Used: 50. Remaining: 300.
    const result = await enforceUserAiCredits("user-1", 25)
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(50)
    expect(result.max).toBe(350)
    expect(result.remaining).toBe(300)
  })

  it("should reject generation and prompt top-up when user credits are depleted", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-free",
      role: "user",
      plan: "free",
      aiCreditsUsed: 40,
      aiCreditsExtra: 0,
    } as any)

    vi.mocked(db.customPlanOverride.findUnique).mockResolvedValue(null)

    // Free plan has 50 credits. 50 - 40 = 10 remaining. Requesting 25 credits.
    const result = await enforceUserAiCredits("user-free", 25)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(10)
    expect(result.message).toContain("AI credits depleted")
    expect(result.message).toContain("top up")
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
})
