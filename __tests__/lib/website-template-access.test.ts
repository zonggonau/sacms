import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database", () => ({ db: {} }))

import { canApplyWithAccess, websiteTemplateAccess } from "@/lib/billing/website-template-access"

describe("websiteTemplateAccess", () => {
  it("a bought template is owned on every plan", () => {
    expect(websiteTemplateAccess(true, 150_000)).toBe("owned")
    expect(websiteTemplateAccess(true, null)).toBe("owned")
  })

  it("a priced template that is not bought is purchasable on every plan", () => {
    expect(websiteTemplateAccess(false, 150_000)).toBe("purchasable")
  })

  it("a template without a price is free (included) on every plan, not 'not for sale'", () => {
    expect(websiteTemplateAccess(false, null)).toBe("included")
    expect(websiteTemplateAccess(false, 0)).toBe("included")
  })

  it("the SaCMS starter is free even when it carries a price", () => {
    expect(websiteTemplateAccess(false, 150_000, true)).toBe("included")
    expect(websiteTemplateAccess(true, null, true)).toBe("owned")
  })

  it("applying is allowed for owned and free templates only", () => {
    expect(canApplyWithAccess("owned")).toBe(true)
    expect(canApplyWithAccess("included")).toBe(true)
    expect(canApplyWithAccess("purchasable")).toBe(false)
  })
})
