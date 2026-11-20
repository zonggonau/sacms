import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/database"
import { parseCorsOrigins } from "@/lib/workspace-api-policy"
import { proxy } from "@/proxy"

vi.unmock("@/lib/rate-limit")

vi.mock("@/lib/database", () => ({
  db: {
    tenant: { findFirst: vi.fn() },
    setting: { findMany: vi.fn() },
  },
}))

function request(url: string, origin?: string, method = "GET") {
  const headers = new Headers({ host: new URL(url).host, "x-real-ip": "192.0.2.70" })
  if (origin) headers.set("origin", origin)
  return new NextRequest(url, { headers, method })
}

describe("workspace public API policy", () => {
  beforeEach(() => {
    vi.mocked(db.tenant.findFirst).mockResolvedValue({ id: "workspace-id" } as never)
    vi.mocked(db.setting.findMany).mockResolvedValue([
      { key: "workspace-id_corsOrigins", value: "https://frontend.example.test" },
    ] as never)
  })

  afterEach(() => vi.useRealTimers())

  it("normalizes and deduplicates exact origins, and rejects paths and wildcards", () => {
    expect(parseCorsOrigins("https://EXAMPLE.test/\nhttps://example.test, http://localhost:4242"))
      .toEqual(["https://example.test", "http://localhost:4242"])
    expect(() => parseCorsOrigins("https://example.test/a")).toThrow()
    expect(() => parseCorsOrigins("https://*.example.test")).toThrow()
  })

  it.each([
    "https://sacms.cloud/api/public/workspace/content/pages",
    "https://api.sacms.cloud/v1/workspace/content/pages",
    "https://cms.sacms.cloud/api/public/workspace/graphql",
  ])("enforces the tenant allowlist on %s", async (url) => {
    const allowed = await proxy(request(url, "https://frontend.example.test", "OPTIONS"))
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://frontend.example.test")
    expect(allowed.headers.get("access-control-allow-credentials")).toBeNull()

    const blocked = await proxy(request(url, "https://unlisted.example.test"))
    expect(blocked.status).toBe(403)
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("shares workspace rate limits across canonical and rewritten URLs", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-20T01:00:59Z"))
    vi.mocked(db.setting.findMany).mockResolvedValue([
      { key: "workspace-id_rateLimiting", value: "true" },
      { key: "workspace-id_requestsPerMinute", value: "1" },
      { key: "workspace-id_burstLimit", value: "10" },
    ] as never)
    const direct = "https://sacms.cloud/api/public/workspace/graphql"
    const alias = "https://api.sacms.cloud/v1/workspace/graphql"

    expect((await proxy(request(direct, undefined, "POST"))).status).toBe(200)
    const blocked = await proxy(request(alias, undefined, "POST"))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("retry-after")).toBe("1")

    vi.setSystemTime(new Date("2026-11-20T01:01:00Z"))
    expect((await proxy(request(alias, undefined, "POST"))).status).toBe(200)
  })
})
