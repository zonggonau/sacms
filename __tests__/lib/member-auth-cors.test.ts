import { describe, it, expect, afterEach, beforeEach } from "vitest"
import { authCorsHeaders } from "@/lib/member-auth-cors"

function req(origin?: string): Request {
  return new Request("https://api.sacms.cloud/api/public/acme/auth/local", {
    headers: origin ? { origin } : {},
  })
}

const tenant = {
  slug: "acme",
  customDomain: "acme.com",
  allowedAuthOrigins: ["https://app.acme.io"],
}

describe("authCorsHeaders", () => {
  const originalEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it("echoes an origin listed in allowedAuthOrigins", () => {
    process.env.NODE_ENV = "production"
    const h = authCorsHeaders(req("https://app.acme.io"), tenant)
    expect(h["Access-Control-Allow-Origin"]).toBe("https://app.acme.io")
    expect(h["Access-Control-Allow-Credentials"]).toBe("true")
  })

  it("echoes the tenant's own custom domain", () => {
    process.env.NODE_ENV = "production"
    const h = authCorsHeaders(req("https://acme.com"), tenant)
    expect(h["Access-Control-Allow-Origin"]).toBe("https://acme.com")
  })

  it("echoes the tenant subdomain on the root domain", () => {
    process.env.NODE_ENV = "production"
    const h = authCorsHeaders(req("https://acme.sacms.cloud"), tenant)
    expect(h["Access-Control-Allow-Origin"]).toBe("https://acme.sacms.cloud")
  })

  it("does NOT echo an unknown origin in production", () => {
    process.env.NODE_ENV = "production"
    const h = authCorsHeaders(req("https://evil.example"), tenant)
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined()
    expect(h["Access-Control-Allow-Credentials"]).toBeUndefined()
    expect(h.Vary).toBe("Origin")
  })

  it("allows localhost only when not in production", () => {
    process.env.NODE_ENV = "development"
    expect(authCorsHeaders(req("http://localhost:3000"), tenant)["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000",
    )
    process.env.NODE_ENV = "production"
    expect(authCorsHeaders(req("http://localhost:3000"), tenant)["Access-Control-Allow-Origin"]).toBeUndefined()
  })

  it("omits ACAO entirely when there is no Origin header", () => {
    const h = authCorsHeaders(req(), tenant)
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined()
    expect(h["Access-Control-Allow-Methods"]).toContain("POST")
  })

  it("with no tenant context, only localhost (dev) is allowed", () => {
    process.env.NODE_ENV = "development"
    expect(authCorsHeaders(req("http://localhost:5173"), null)["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:5173",
    )
    expect(authCorsHeaders(req("https://app.acme.io"), null)["Access-Control-Allow-Origin"]).toBeUndefined()
  })
})
