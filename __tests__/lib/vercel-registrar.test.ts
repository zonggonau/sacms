import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  convertUsdToIdr,
  getDomainPriceBreakdown,
  checkDomainAvailability,
  getDomainPrice,
  purchaseDomain,
} from "@/lib/vercel-registrar"

describe("Vercel Registrar Utility", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.VERCEL_API_TOKEN
    delete process.env.VERCEL_TEAM_ID
    delete process.env.DOMAIN_MARGIN_PERCENT
    delete process.env.DOMAIN_MARGIN_FIXED_IDR
    delete process.env.USD_TO_IDR_RATE
  })

  it("should correctly convert USD price to IDR with profit margin", () => {
    const usd = 14
    // Base: 14 * 16600 = 232,400
    // Margin 20%: 46,480
    // Fixed Markup: 25,000
    // Total before ceil: 303,880 -> Ceil to 1000: 304,000
    const idr = convertUsdToIdr(usd)
    expect(idr).toBe(304000)
    expect(idr % 1000).toBe(0)
  })

  it("should calculate domain price breakdown with profit margin", () => {
    const usd = 10
    const breakdown = getDomainPriceBreakdown(usd, {
      exchangeRate: 16000,
      marginPercent: 25,
      marginFixedIdr: 20000,
    })

    expect(breakdown.baseIdr).toBe(160000)
    expect(breakdown.percentMarkup).toBe(40000)
    expect(breakdown.marginFixedIdr).toBe(20000)
    expect(breakdown.finalPriceIdr).toBe(220000)
    expect(breakdown.totalMarginIdr).toBe(60000)
  })

  it("should handle sandbox mock availability check when token is missing", async () => {
    const availableRes = await checkDomainAvailability("myfreshdomain123.com")
    expect(availableRes.available).toBe(true)

    const takenRes = await checkDomainAvailability("google.com")
    expect(takenRes.available).toBe(false)
  })

  it("should return pricing in sandbox mode", async () => {
    const priceRes = await getDomainPrice("mybrand.com")
    expect(priceRes.priceUsd).toBe(14)
    expect(priceRes.periodYears).toBe(1)
  })

  it("should simulate purchase in sandbox mode", async () => {
    const res = await purchaseDomain("testdomain.com", {
      expectedPrice: 14,
      years: 1,
      contactInformation: {
        firstName: "Test",
        lastName: "User",
        address1: "Jl. Sudirman",
        city: "Jakarta",
        state: "DKI",
        postalCode: "10000",
        country: "ID",
        phone: "+62.8123456789",
        email: "test@example.com",
      },
    })

    expect(res.success).toBe(true)
    expect(res.data?.registered).toBe(true)
  })

  it("should call Vercel API endpoint when token is present", async () => {
    process.env.VERCEL_API_TOKEN = "test_token"

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    })
    global.fetch = mockFetch as any

    const avail = await checkDomainAvailability("example.com")
    expect(avail.available).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.vercel.com/v1/registrar/domains/example.com/availability"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test_token",
        }),
      })
    )
  })
})
