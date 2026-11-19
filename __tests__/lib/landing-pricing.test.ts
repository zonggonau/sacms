import { describe, expect, it, vi } from "vitest"
import { getLandingData } from "@/lib/public-api"
import { resolveYearlyPrice } from "@/lib/billing/plan-price"

vi.mock("@/lib/database", () => ({
  db: { singleType: { findMany: vi.fn().mockRejectedValue(new Error("CMS content unavailable")) } },
}))

vi.mock("@/lib/pricing", () => ({
  getAccountPlans: vi.fn().mockResolvedValue([]),
  getAddons: vi.fn().mockResolvedValue([]),
  getWorkspacePlans: vi.fn().mockResolvedValue([
    { slug: "pro", name: "Catalog Pro", price: 270_000, yearlyPrice: 1_560_000, features: [] },
  ]),
}))

describe("public pricing", () => {
  it("uses the checkout catalog when marketing content is unavailable", async () => {
    const data = await getLandingData()
    expect(data.pricingWorkspaces).toMatchObject([
      { plan_slug: "pro", name: "Catalog Pro", price: 270_000, yearly_price: 1_560_000 },
    ])
  })

  it("uses the checkout fallback only when the catalog annual price is missing", () => {
    expect(resolveYearlyPrice(249_000, 1_490_000)).toBe(1_490_000)
    expect(resolveYearlyPrice(249_000, null)).toBe(2_490_000)
    expect(resolveYearlyPrice(249_000, 0)).toBe(0)
  })
})
