import { beforeEach, describe, expect, it, vi } from "vitest"

const { findTenant, reserveCredits } = vi.hoisted(() => ({
  findTenant: vi.fn(),
  reserveCredits: vi.fn(),
}))

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findUnique: findTenant },
    customPlanOverride: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))
vi.mock("@/lib/tenant-plan", () => ({
  getTenantPlanConfig: vi.fn().mockResolvedValue({ max_ai_tokens: 100 }),
}))
vi.mock("@/lib/plan-enforcement", () => ({ reserveUserAiCredits: reserveCredits }))

import { enforceAiQuota } from "@/lib/ai"

describe("AI quota reservation", () => {
  const config = { tenantId: "workspace", userId: "account", creditsCost: 3 }

  beforeEach(() => {
    vi.clearAllMocks()
    reserveCredits.mockResolvedValue({ allowed: true })
  })

  it("preserves account credits when the workspace is over quota", async () => {
    findTenant.mockResolvedValue({ aiTokensUsed: 100, aiCreditsExtra: 0 })
    await expect(enforceAiQuota(config)).rejects.toMatchObject({ status: 429 })
    expect(reserveCredits).not.toHaveBeenCalled()
  })

  it("reserves the requested account credits after the workspace check succeeds", async () => {
    findTenant.mockResolvedValue({ aiTokensUsed: 99, aiCreditsExtra: 0 })
    await enforceAiQuota(config)
    expect(reserveCredits).toHaveBeenCalledTimes(1)
    expect(reserveCredits).toHaveBeenCalledWith("account", 3)
  })
})
