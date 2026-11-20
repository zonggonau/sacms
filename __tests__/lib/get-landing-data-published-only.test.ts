import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getLandingData } from "@/lib/public-api"

// Regression test for a real content-leak bug: the ContentEntry query
// backing getLandingData() (blog list, blog detail, generateStaticParams)
// had no `status` filter at all — a Draft blog post (or any other
// tenantId:null collection entry) was fully public and even statically
// pre-rendered the moment it was created, with no way to actually keep
// it unpublished via the admin's own Draft/Published toggle.

vi.mock("@/lib/database", () => ({
  db: {
    singleType: { findMany: vi.fn().mockResolvedValue([]) },
    contentType: { findMany: vi.fn().mockResolvedValue([]) },
    contentEntry: { findMany: vi.fn().mockResolvedValue([]) },
    websiteTemplate: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock("@/lib/pricing", () => ({
  getAccountPlans: vi.fn().mockResolvedValue([]),
  getWorkspacePlans: vi.fn().mockResolvedValue([]),
  getAddons: vi.fn().mockResolvedValue([]),
}))

describe("getLandingData — only published content is ever returned", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.singleType.findMany).mockResolvedValue([])
    vi.mocked(db.contentType.findMany).mockResolvedValue([])
    vi.mocked(db.contentEntry.findMany).mockResolvedValue([])
    vi.mocked(db.websiteTemplate.findMany).mockResolvedValue([])
  })

  it("queries ContentEntry with status: PUBLISHED, not just tenantId/deletedAt", async () => {
    await getLandingData()

    expect(db.contentEntry.findMany).toHaveBeenCalledWith({
      where: { tenantId: null, deletedAt: null, status: "PUBLISHED" },
    })
  })

  it("only surfaces entries the (now status-filtered) query actually returned — a still-Draft entry never reaches `blogs`", async () => {
    vi.mocked(db.contentType.findMany).mockResolvedValue([{ id: "ct1", slug: "posts" }] as any)
    // Postgres itself does the real filtering (asserted above); this
    // simulates its result — a real DRAFT row would simply never be in
    // this array once the where-clause fix is in place.
    vi.mocked(db.contentEntry.findMany).mockResolvedValue([
      { contentTypeId: "ct1", data: { title: "Published post", slug: "published-post" } },
    ] as any)

    const data = await getLandingData()

    expect(data.blogs).toEqual([{ title: "Published post", slug: "published-post" }])
  })
})
