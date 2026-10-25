import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Feature added 2026-10-25: a tenant's own verified custom domain (e.g.
// admin.theirdomain.com) previously fell through to the generic, unbranded
// /login page — the white-label ?ws=<tenant> query param that drives
// src/app/login/page.tsx's logo/favicon swap was never injected. proxy.ts
// now rewrites /login (and the other auth pages) on a custom domain to add
// ?ws=<tenant> automatically.

const mockGet = vi.fn((key: string) => {
  if (key === "domain:admin.theirdomain.com") {
    return Promise.resolve(JSON.stringify({ slug: "acme-corp", target: "cms" }))
  }
  return Promise.resolve(undefined)
})

vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ get: mockGet }),
}))

const { proxy } = await import("@/proxy")

describe("Custom domain → white-label auth pages (proxy.ts)", () => {
  beforeEach(() => mockGet.mockClear())

  it("rewrites /login on a verified custom domain to add ?ws=<tenant slug>", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/login", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    const rewrite = res.headers.get("x-middleware-rewrite")
    expect(rewrite).toContain("/login")
    expect(rewrite).toContain("ws=acme-corp")
  })

  it("preserves other existing query params (e.g. redirect_to) alongside ws", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/login?redirect_to=%2Fdashboard", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    const rewrite = res.headers.get("x-middleware-rewrite")
    expect(rewrite).toContain("ws=acme-corp")
    expect(rewrite).toContain("redirect_to")
  })

  it("does not override an explicitly-provided ws param", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/login?ws=some-other-tenant", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    const rewrite = res.headers.get("x-middleware-rewrite")
    expect(rewrite).toContain("ws=some-other-tenant")
  })

  it("also injects ws on /register, /forgot-password, /reset-password", async () => {
    for (const path of ["/register", "/forgot-password", "/reset-password"]) {
      const req = new NextRequest(`http://admin.theirdomain.com${path}`, {
        headers: { host: "admin.theirdomain.com" },
      })
      const res = await proxy(req)
      const rewrite = res.headers.get("x-middleware-rewrite")
      expect(rewrite, `expected ${path} to be rewritten`).toContain("ws=acme-corp")
    }
  })

  it("leaves /login untouched on the main platform domain (no custom-domain mapping)", async () => {
    const req = new NextRequest("http://localhost:3000/login", {
      headers: { host: "localhost:3000" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
