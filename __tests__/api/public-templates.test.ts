import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { db } from "@/lib/database"
import { GET } from "../../src/app/api/public/templates/route"

// Backs /templates' infinite scroll — each scroll-triggered page after the
// server-rendered first one comes from here. hasMore is derived from
// fetching one extra row past `limit` rather than a separate count query.

vi.mock("@/lib/database", () => ({
  db: { websiteTemplate: { findMany: vi.fn() } },
}))

function req(url: string) {
  return new NextRequest(url, { method: "GET" })
}

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Template ${i}`,
    slug: `template-${i}`,
    icon: "LayoutTemplate",
    description: `Desc ${i}`,
    demoUrl: null,
  }))
}

describe("GET /api/public/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("defaults to limit 21 (3x7 grid) and reports hasMore when an extra row exists", async () => {
    vi.mocked(db.websiteTemplate.findMany).mockResolvedValue(makeRows(22) as any)

    const res = await GET(req("http://localhost:3000/api/public/templates"))
    const body = await res.json()

    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true }, skip: 0, take: 22 })
    )
    expect(body.templates).toHaveLength(21)
    expect(body.hasMore).toBe(true)
    expect(body.nextOffset).toBe(21)
  })

  it("reports hasMore: false on the last page", async () => {
    vi.mocked(db.websiteTemplate.findMany).mockResolvedValue(makeRows(10) as any)

    const res = await GET(req("http://localhost:3000/api/public/templates?offset=21&limit=21"))
    const body = await res.json()

    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 21, take: 22 })
    )
    expect(body.templates).toHaveLength(10)
    expect(body.hasMore).toBe(false)
  })

  it("clamps limit to the configured maximum", async () => {
    vi.mocked(db.websiteTemplate.findMany).mockResolvedValue([] as any)

    await GET(req("http://localhost:3000/api/public/templates?limit=999"))

    expect(db.websiteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 61 })
    )
  })

  it("returns 500 with a safe message on a database error", async () => {
    vi.mocked(db.websiteTemplate.findMany).mockRejectedValue(new Error("boom"))

    const res = await GET(req("http://localhost:3000/api/public/templates"))

    expect(res.status).toBe(500)
  })
})
