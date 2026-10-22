import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/pricing", () => ({
  getAccountPlan: vi.fn().mockResolvedValue({ name: "Akun Profesional" }),
  getWorkspacePlan: vi.fn().mockResolvedValue({ name: "Pro" }),
  getAddon: vi.fn().mockResolvedValue(null),
  getAiCreditPack: vi.fn().mockResolvedValue(null),
  getVpsOffering: vi.fn().mockResolvedValue({ name: "VPS XS 1.1" }),
}))

import { resolvePurchaseLabel } from "@/lib/billing/purchase-label"
import { getVpsOffering } from "@/lib/pricing"

describe("resolvePurchaseLabel", () => {
  it("resolves a VPS order to the real offering name, not a generic fallback", async () => {
    const result = await resolvePurchaseLabel({
      orderId: "VPS-20261022-ab12",
      rawResponse: { isAddon: true, isVps: true, addonId: "vps_xs", scope: "tenant", interval: "month" },
      fallbackPlanSlug: "pro",
    })

    expect(result.purchasedId).toBe("vps_xs")
    expect(result.purchasedLabel).toBe("VPS XS 1.1")
    expect(getVpsOffering).toHaveBeenCalledWith("vps_xs")
  })

  it("falls back to a generic VPS label when the offering no longer exists", async () => {
    ;(getVpsOffering as any).mockResolvedValueOnce(null)

    const result = await resolvePurchaseLabel({
      orderId: "VPS-20261022-cd34",
      rawResponse: { isAddon: true, isVps: true, addonId: "vps_removed", scope: "account" },
      fallbackPlanSlug: "pro",
    })

    expect(result.purchasedId).toBe("vps_removed")
    expect(result.purchasedLabel).toBe("VPS (vps_removed)")
  })

  it("does not fall through to the generic addon branch for a VPS order", async () => {
    const result = await resolvePurchaseLabel({
      orderId: "VPS-20261022-ef56",
      rawResponse: { isAddon: true, isVps: true, addonId: "vps_xs" },
      fallbackPlanSlug: "pro",
    })

    expect(result.purchasedLabel).toBe("VPS XS 1.1")
  })
})
