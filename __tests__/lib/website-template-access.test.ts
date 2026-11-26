import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database", () => ({ db: {} }))

import { canApplyWithAccess, websiteTemplateAccess } from "@/lib/billing/website-template-access"

describe("websiteTemplateAccess", () => {
  it("a bought template is owned on every plan, priced or not", () => {
    expect(websiteTemplateAccess(true, 150_000)).toBe("owned")
    expect(websiteTemplateAccess(true, null, true)).toBe("owned")
  })

  it("a priced template must be bought by Standard, Pro, and Business", () => {
    expect(websiteTemplateAccess(false, 150_000)).toBe("purchasable")
    expect(websiteTemplateAccess(false, 150_000, false)).toBe("purchasable")
  })

  it("an unpriced template is not for sale to non-Enterprise plans", () => {
    expect(websiteTemplateAccess(false, null)).toBe("unavailable")
    expect(websiteTemplateAccess(false, 0, false)).toBe("unavailable")
  })

  it("an unpriced template is free for Enterprise", () => {
    expect(websiteTemplateAccess(false, null, true)).toBe("included")
    expect(websiteTemplateAccess(false, 0, true)).toBe("included")
  })

  it("a priced template is still bought once, for life, by Enterprise", () => {
    expect(websiteTemplateAccess(false, 150_000, true)).toBe("purchasable")
  })

  it("applying is allowed for owned and included templates only", () => {
    expect(canApplyWithAccess("owned")).toBe(true)
    expect(canApplyWithAccess("included")).toBe(true)
    expect(canApplyWithAccess("purchasable")).toBe(false)
    expect(canApplyWithAccess("unavailable")).toBe(false)
  })
})
