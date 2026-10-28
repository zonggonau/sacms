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

// Bug fixed 2026-10-28: the custom domain's blanket "/api/* -> public
// content API" rewrite didn't exclude /api/auth/*, so NextAuth's own
// callback/error/session routes got silently rewritten to
// /api/public/<tenant>/auth/... (not a real route, 404) — login was
// completely broken on any connected custom domain. Confirmed live by a
// user report: https://<their-domain>/api/auth/error -> 404.
describe("Custom domain → NextAuth's own /api/auth/* routes pass through untouched (proxy.ts)", () => {
  beforeEach(() => mockGet.mockClear())

  it("does not rewrite /api/auth/error to the public content API", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/api/auth/error", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("does not rewrite /api/auth/callback/credentials to the public content API", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/api/auth/callback/credentials", {
      headers: { host: "admin.theirdomain.com" },
      method: "POST",
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("still rewrites a real content API path to the public API (regression guard)", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/api/content/posts", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    const rewrite = res.headers.get("x-middleware-rewrite")
    expect(rewrite).toContain("/api/public/acme-corp/content/posts")
  })
})

// Bug fixed 2026-10-28: the custom domain's blanket "/api/* -> public
// content API" rewrite also hijacked INTERNAL app API calls the dashboard
// itself makes (e.g. /api/tenant/[tenant]/white-label/domain), so any
// client-side fetch made from a /dashboard/* page accessed via a custom
// domain silently 404'd. Confirmed live: the Infrastruktur > Domains tab
// came back empty on a custom domain while the same tenant's domains
// showed fine on the main platform domain.
describe("Custom domain → internal app API namespaces pass through untouched (proxy.ts)", () => {
  beforeEach(() => mockGet.mockClear())

  it("does not rewrite /api/tenant/* (the dashboard's own management API)", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/api/tenant/acme-corp/white-label/domain", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("does not rewrite /api/admin/* or /api/billing/*", async () => {
    for (const path of ["/api/admin/pricing", "/api/billing/checkout"]) {
      const req = new NextRequest(`http://admin.theirdomain.com${path}`, {
        headers: { host: "admin.theirdomain.com" },
      })
      const res = await proxy(req)
      expect(res.headers.get("x-middleware-rewrite"), `expected ${path} to pass through`).toBeNull()
    }
  })
})

// Bug fixed 2026-10-28: a custom domain is bound to exactly one tenant, but
// the bare /dashboard path (or another tenant's dashboard path) passed
// straight through to the generic multi-workspace picker page instead of
// being bound to this domain's own tenant — confirmed live: deleting the
// tenant id from the URL briefly showed the workspace list before a
// client-side redirect sent it back to /cms.
describe("Custom domain → bare /dashboard redirects to the bound tenant (proxy.ts)", () => {
  beforeEach(() => mockGet.mockClear())

  it("redirects bare /dashboard to this domain's own tenant cms", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/dashboard", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/dashboard/acme-corp/cms")
  })

  it("redirects a DIFFERENT tenant's dashboard path back to this domain's own tenant", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/dashboard/some-other-tenant/cms", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/dashboard/acme-corp/cms")
  })

  it("passes through this domain's own tenant dashboard path unchanged", async () => {
    const req = new NextRequest("http://admin.theirdomain.com/dashboard/acme-corp/cms/content", {
      headers: { host: "admin.theirdomain.com" },
    })
    const res = await proxy(req)

    expect(res.status).not.toBe(307)
    const rewrite = res.headers.get("x-middleware-rewrite")
    expect(rewrite).toContain("/dashboard/acme-corp/cms/content")
  })
})
