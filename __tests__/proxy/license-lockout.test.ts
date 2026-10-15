import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGet = vi.fn()

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ get: mockGet }),
}))

// Imported after the mock so proxy.ts's `getRedis` call resolves to the mock above.
const { proxy } = await import("@/proxy")

describe("Enterprise license hard lockout (proxy.ts)", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it("blocks a normal page with a rewrite to /license-expired when locked", async () => {
    mockGet.mockResolvedValue({ locked: true, reason: "expired" })

    const req = new NextRequest("http://localhost:3000/dashboard/some-tenant", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toContain("/license-expired")
  })

  it("returns a JSON 503 for API routes when locked", async () => {
    mockGet.mockResolvedValue({ locked: true, reason: "expired" })

    const req = new NextRequest("http://localhost:3000/api/tenant/some-tenant/content", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.locked).toBe(true)
  })

  it("never blocks /api/health, even when locked", async () => {
    mockGet.mockResolvedValue({ locked: true, reason: "expired" })

    const req = new NextRequest("http://localhost:3000/api/health", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.status).not.toBe(503)
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("never blocks /api/cron/* routes, even when locked (the lockout cron must be able to clear itself)", async () => {
    mockGet.mockResolvedValue({ locked: true, reason: "expired" })

    const req = new NextRequest("http://localhost:3000/api/cron/license-check", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.status).not.toBe(503)
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("allows normal requests through when not locked", async () => {
    mockGet.mockResolvedValue({ locked: false })

    const req = new NextRequest("http://localhost:3000/dashboard/some-tenant", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("fails open (allows the request) if the Redis lookup throws", async () => {
    mockGet.mockRejectedValue(new Error("Redis unreachable"))

    const req = new NextRequest("http://localhost:3000/dashboard/some-tenant", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
