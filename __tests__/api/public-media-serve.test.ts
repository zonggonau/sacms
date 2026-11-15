import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/database"
import { rateLimit } from "@/lib/rate-limit"
import { readFromStorage } from "@/lib/r2"
import { GET } from "../../src/app/api/public/media/route"

// GET /api/public/media is the unauthenticated counterpart to
// /api/media/serve (session + tenant-membership gated, for the CMS
// dashboard only) — the rewrite target for any embedded media URL in a
// PUBLISHED entry's public API response (see rewritePublicMediaUrls). It
// must serve the exact same bytes without requiring a login, since a real
// visitor's browser has no SaCMS session to present.

vi.mock("@/lib/database", () => ({
  db: { tenant: { findUnique: vi.fn() } },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  RATE_LIMITS: { publicApi: { limit: 1000, windowSeconds: 60 } },
}))
vi.mock("@/lib/r2", () => ({
  readFromStorage: vi.fn(),
}))

function req(url: string) {
  return new NextRequest(url, { method: "GET" })
}

describe("GET /api/public/media", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 999, limit: 1000, resetAt: Date.now() + 60000 })
  })

  it("requires a key", async () => {
    const res = await GET(req("http://localhost/api/public/media"))
    expect(res.status).toBe(400)
  })

  it("serves the file's real bytes with no authentication required, for a platform-bucket key", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ id: "tenant-1", slug: "sela-coffee" } as any)
    vi.mocked(readFromStorage).mockResolvedValue({ buffer: Buffer.from("fake-png-bytes"), contentType: "image/png" })

    const res = await GET(req("http://localhost/api/public/media?key=tenant-1/png/photo_123.png"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(res.headers.get("cache-control")).toContain("public")
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe("fake-png-bytes")
    expect(readFromStorage).toHaveBeenCalledWith("tenant-1/png/photo_123.png", "tenant-1")
  })

  it("serves a legacy upload/<slug>/... key by resolving the tenant from its slug", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ id: "tenant-1", slug: "sela-coffee" } as any)
    vi.mocked(readFromStorage).mockResolvedValue({ buffer: Buffer.from("legacy-bytes") })

    const res = await GET(req("http://localhost/api/public/media?key=upload/sela-coffee/jpg/photo.jpg"))
    expect(res.status).toBe(200)
    expect(db.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: "sela-coffee" }, select: { id: true, slug: true } })
  })

  it("404s when the tenant doesn't exist", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    const res = await GET(req("http://localhost/api/public/media?key=unknown-tenant/png/x.png"))
    expect(res.status).toBe(404)
  })

  it("404s when the storage read finds nothing", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ id: "tenant-1", slug: "sela-coffee" } as any)
    vi.mocked(readFromStorage).mockResolvedValue(null)
    const res = await GET(req("http://localhost/api/public/media?key=tenant-1/png/missing.png"))
    expect(res.status).toBe(404)
  })

  it("rejects a key with path-traversal segments", async () => {
    const res = await GET(req("http://localhost/api/public/media?key=" + encodeURIComponent("tenant-1/../../etc/passwd")))
    expect(res.status).toBe(400)
  })

  it("rejects a malformed tenant reference before ever touching the database", async () => {
    const res = await GET(req("http://localhost/api/public/media?key=" + encodeURIComponent("not valid!/png/x.png")))
    expect(res.status).toBe(400)
    expect(db.tenant.findUnique).not.toHaveBeenCalled()
  })

  it("429s when the IP rate limit is exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, limit: 1000, resetAt: Date.now() + 60000 })
    const res = await GET(req("http://localhost/api/public/media?key=tenant-1/png/photo.png"))
    expect(res.status).toBe(429)
  })
})
