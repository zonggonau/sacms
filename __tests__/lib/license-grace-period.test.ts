import { describe, it, expect, vi, beforeEach } from "vitest"

// Regression test for a real feature gap found 2026-10-25 (FR-ENT-005): an
// expired Enterprise license used to flip `valid: false` the instant
// `expiresAt` passed, with no grace window at all, even though the SRS
// promises 7 days of continued access + a warning before an actual lockout.

vi.mock("@/lib/database", () => ({
  db: { licenseCache: { findUnique: vi.fn() } },
}))

import { db } from "@/lib/database"
import { getCachedLicense, LICENSE_GRACE_PERIOD_DAYS } from "@/lib/license"

const mockDb = db as any

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

describe("getCachedLicense — 7-day grace period (FR-ENT-005)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stays valid immediately after expiry (day 1 of grace)", async () => {
    mockDb.licenseCache.findUnique.mockResolvedValue({
      status: "active",
      expiresAt: daysAgo(1),
      customerName: "Acme",
      type: "enterprise",
      features: [],
    })

    const result = await getCachedLicense("tenant1")
    expect(result?.valid).toBe(true)
    expect(result?.inGracePeriod).toBe(true)
    expect(result?.graceDaysRemaining).toBeGreaterThan(0)
    expect(result?.graceDaysRemaining).toBeLessThanOrEqual(LICENSE_GRACE_PERIOD_DAYS)
  })

  it("stays valid right at the edge of the grace window (day 6)", async () => {
    mockDb.licenseCache.findUnique.mockResolvedValue({
      status: "active",
      expiresAt: daysAgo(6),
      customerName: "Acme",
      type: "enterprise",
      features: [],
    })

    const result = await getCachedLicense("tenant1")
    expect(result?.valid).toBe(true)
    expect(result?.inGracePeriod).toBe(true)
  })

  it("locks out once the full 7-day grace window has elapsed", async () => {
    mockDb.licenseCache.findUnique.mockResolvedValue({
      status: "active",
      expiresAt: daysAgo(LICENSE_GRACE_PERIOD_DAYS + 1),
      customerName: "Acme",
      type: "enterprise",
      features: [],
    })

    const result = await getCachedLicense("tenant1")
    expect(result?.valid).toBe(false)
    expect(result?.inGracePeriod).toBe(false)
  })

  it("never grants grace to a revoked license", async () => {
    mockDb.licenseCache.findUnique.mockResolvedValue({
      status: "revoked",
      expiresAt: daysAgo(-30), // not even expired by date — revoke still wins
      customerName: "Acme",
      type: "enterprise",
      features: [],
    })

    const result = await getCachedLicense("tenant1")
    expect(result?.valid).toBe(false)
    expect(result?.status).toBe("revoked")
  })

  it("stays fully valid, no grace flags, while genuinely unexpired", async () => {
    mockDb.licenseCache.findUnique.mockResolvedValue({
      status: "active",
      expiresAt: daysAgo(-30),
      customerName: "Acme",
      type: "enterprise",
      features: [],
    })

    const result = await getCachedLicense("tenant1")
    expect(result?.valid).toBe(true)
    expect(result?.inGracePeriod).toBe(false)
  })
})
