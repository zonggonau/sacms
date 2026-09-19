import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"
import { getPortalUrl, getPortalBaseUrl } from "@/lib/portal-urls"

describe("Multi-Subdomain Edge Routing (proxy.ts)", () => {
  it("should rewrite api.sacms.cloud/tenant/content/posts to public API", async () => {
    const req = new NextRequest("http://api.sacms.cloud/delvia/content/posts", {
      headers: {
        host: "api.sacms.cloud",
        origin: "https://cms.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/api/public/delvia/content/posts")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("api")
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://cms.sacms.cloud")
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  it("should rewrite versioned api.sacms.cloud/v1/tenant/content/posts", async () => {
    const req = new NextRequest("http://api.sacms.cloud/v1/delvia/content/posts", {
      headers: {
        host: "api.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/api/public/delvia/content/posts")
    expect(res.headers.get("X-API-Version")).toBe("v1")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("api")
  })

  it("should rewrite api.sacms.cloud/ to interactive docs (/api-docs)", async () => {
    const req = new NextRequest("http://api.sacms.cloud/", {
      headers: {
        host: "api.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/api-docs")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("api")
  })

  it("should rewrite cms.sacms.cloud/tenant/content/articles to CMS route group", async () => {
    const req = new NextRequest("http://cms.sacms.cloud/delvia/content/articles", {
      headers: {
        host: "cms.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/delvia/cms/content/articles")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("cms")
  })

  it("should rewrite cms.sacms.cloud/tenant directly to CMS dashboard", async () => {
    const req = new NextRequest("http://cms.sacms.cloud/delvia", {
      headers: {
        host: "cms.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/delvia/cms")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("cms")
  })

  it("should rewrite admin.sacms.cloud/tenant/settings to dashboard settings", async () => {
    const req = new NextRequest("http://admin.sacms.cloud/delvia/settings", {
      headers: {
        host: "admin.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/delvia/settings")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("admin")
  })

  it("should rewrite unauthenticated admin.sacms.cloud/ directly to /login", async () => {
    const req = new NextRequest("http://admin.sacms.cloud/", {
      headers: {
        host: "admin.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/login")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("admin")
  })

  it("should rewrite authenticated admin.sacms.cloud/ to /dashboard workspace hub", async () => {
    const req = new NextRequest("http://admin.sacms.cloud/", {
      headers: {
        host: "admin.sacms.cloud",
        cookie: "next-auth.session-token=valid-token-mock",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("admin")
  })

  it("should rewrite unauthenticated owner subdomain to /login", async () => {
    const req = new NextRequest("http://u8f9c1d2e3b4a5f6.sacms.cloud/", {
      headers: {
        host: "u8f9c1d2e3b4a5f6.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/login")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("owner")
  })

  it("should rewrite authenticated owner subdomain u8f9c1d2e3b4a5f6.sacms.cloud to /owner/u8f9c1d2e3b4a5f6", async () => {
    const req = new NextRequest("http://u8f9c1d2e3b4a5f6.sacms.cloud/", {
      headers: {
        host: "u8f9c1d2e3b4a5f6.sacms.cloud",
        cookie: "next-auth.session-token=valid-token-mock",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/owner/u8f9c1d2e3b4a5f6")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("owner")
    expect(res.headers.get("X-Owner-Slug")).toBe("u8f9c1d2e3b4a5f6")
  })

  it("should rewrite direct workspace subdomain klinik.sacms.cloud to /dashboard/klinik/cms", async () => {
    const req = new NextRequest("http://klinik.sacms.cloud/", {
      headers: {
        host: "klinik.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/klinik/cms")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("workspace")
    expect(res.headers.get("X-Tenant-Slug")).toBe("klinik")
  })

  it("should rewrite direct workspace subdomain admin route klinik.sacms.cloud/admin to /dashboard/klinik", async () => {
    const req = new NextRequest("http://klinik.sacms.cloud/admin", {
      headers: {
        host: "klinik.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/klinik")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("workspace")
  })

  it("should rewrite direct workspace subdomain API route klinik.sacms.cloud/api/content/posts to /api/public/klinik/content/posts", async () => {
    const req = new NextRequest("http://klinik.sacms.cloud/api/content/posts", {
      headers: {
        host: "klinik.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/api/public/klinik/content/posts")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("workspace")
  })

  // developer.sacms.cloud is an alias entry point alongside the apex. Before this
  // host was reserved it matched the *.sacms.cloud branch and was rewritten to
  // /dashboard/developer/cms — a workspace that does not exist.
  it("should NOT treat developer.sacms.cloud as a workspace subdomain", async () => {
    const req = new NextRequest("http://developer.sacms.cloud/", {
      headers: {
        host: "developer.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toBeNull()
    expect(res.headers.get("X-Subdomain-Portal")).not.toBe("workspace")
    expect(res.headers.get("X-Tenant-Slug")).toBeNull()
  })

  it("should permanently redirect the legacy /developer/tenant bookmark to /dashboard/tenant", async () => {
    const req = new NextRequest("http://developer.sacms.cloud/developer/delvia", {
      headers: {
        host: "developer.sacms.cloud",
        cookie: "next-auth.session-token=valid-token-mock",
      },
    })

    const res = await proxy(req)
    expect(res.status).toBe(308)
    expect(res.headers.get("location")).toContain("/dashboard/delvia")
  })

  it("keeps /dashboard itself (the global cross-workspace hub) from being caught by the legacy redirect", async () => {
    const req = new NextRequest("http://developer.sacms.cloud/dashboard", {
      headers: {
        host: "developer.sacms.cloud",
        cookie: "next-auth.session-token=valid-token-mock",
      },
    })

    const res = await proxy(req)
    expect(res.status).not.toBe(308)
  })

  it("should keep cms.sacms.cloud routing to the CMS dashboard", async () => {
    const req = new NextRequest("http://cms.sacms.cloud/delvia/media", {
      headers: {
        host: "cms.sacms.cloud",
      },
    })

    const res = await proxy(req)
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dashboard/delvia/cms/media")
    expect(res.headers.get("X-Subdomain-Portal")).toBe("cms")
  })
})

describe("Portal URLs Generator Helper", () => {
  it("should generate correct URLs for admin, cms, and api portals", () => {
    const adminUrl = getPortalUrl("admin", "intanjaya", "/settings")
    expect(adminUrl).toContain("admin.sacms.cloud/intanjaya/settings")

    const cmsUrl = getPortalUrl("cms", "intanjaya", "/content/berita")
    expect(cmsUrl).toContain("cms.sacms.cloud/intanjaya/content/berita")

    const apiUrl = getPortalUrl("api", "intanjaya", "/content/berita")
    expect(apiUrl).toContain("api.sacms.cloud/intanjaya/content/berita")
  })

  it("should point the app portal at the apex domain", () => {
    expect(getPortalBaseUrl("app")).toMatch(/^https?:\/\/sacms\.cloud$/)
    expect(getPortalUrl("app", "intanjaya")).toMatch(/^https?:\/\/sacms\.cloud\/dashboard\/intanjaya$/)
  })
})
