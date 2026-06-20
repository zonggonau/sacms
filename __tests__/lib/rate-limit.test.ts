import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null), // Mock to always use memory fallback by default
  isRedisAvailable: vi.fn(() => false),
}))

vi.mock("@/lib/rate-limit", async () => {
  return vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit")
})

const { rateLimit, getTenantRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit")

describe("Rate Limiter", () => {
  beforeEach(() => {
    // We cannot easily clear the internal map `store` directly because it's not exported.
    // However, we can use different identifiers for each test.
  })

  describe("Memory Fallback Rate Limit", () => {
    it("should allow requests under the limit", async () => {
      const id = "test-ip-1"
      const res = await rateLimit(id, { limit: 2, windowSeconds: 60 })
      
      expect(res.success).toBe(true)
      expect(res.remaining).toBe(1)
      expect(res.limit).toBe(2)
    })

    it("should block requests over the limit", async () => {
      const id = "test-ip-2"
      await rateLimit(id, { limit: 1, windowSeconds: 60 })
      
      const res = await rateLimit(id, { limit: 1, windowSeconds: 60 })
      expect(res.success).toBe(false)
      expect(res.remaining).toBe(0)
    })
  })

  describe("getTenantRateLimit", () => {
    it("should return correct limits based on plan", () => {
      expect(getTenantRateLimit("Enterprise")).toEqual({ limit: 2000, windowSeconds: 60 })
      expect(getTenantRateLimit("Pro")).toEqual({ limit: 1000, windowSeconds: 60 })
      expect(getTenantRateLimit("Starter")).toEqual({ limit: 500, windowSeconds: 60 })
      expect(getTenantRateLimit("Free")).toEqual({ limit: 100, windowSeconds: 60 })
      expect(getTenantRateLimit("unknown")).toEqual({ limit: 100, windowSeconds: 60 })
    })
  })

  describe("RATE_LIMITS presets", () => {
    it("should have correct predefined limits", () => {
      expect(RATE_LIMITS.publicApi.limit).toBe(1000)
      expect(RATE_LIMITS.auth.limit).toBe(30)
      expect(RATE_LIMITS.api.limit).toBe(300)
    })
  })
})
