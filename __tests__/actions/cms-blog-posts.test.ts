import { describe, it, expect, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

// Covers the new auto-derived `date` field (and the author/excerpt/
// is_featured fields passed straight through) added to the blog post
// actions — BlogExplorer renders `date` as a plain string and previously
// never received one at all, since the admin form had no date field and
// nothing computed it server-side.

vi.mock("@/lib/database", () => {
  const mockDb = {
    contentType: { findFirst: vi.fn() },
    contentEntry: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  return { db: mockDb }
})

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { CONTENT_CREATED: "content.created", CONTENT_UPDATED: "content.updated" },
}))

import { db } from "@/lib/database"
import { createCmsBlogPostAction, updateCmsBlogPostAction } from "@/actions/cms-frontend"

const mockDb = db as any

const INPUT = {
  title: "Judul Post",
  slug: "judul-post",
  content: "<p>Isi</p>",
  category: "Artikel",
  cover_image: "",
  excerpt: "Ringkasan",
  author: "Budi",
  is_featured: true,
}

describe("Blog post actions — auto-derived `date` field", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } })
    mockDb.contentType.findFirst.mockResolvedValue({ id: "ct-posts" })
    mockDb.contentEntry.findFirst.mockResolvedValue(null) // no slug clash
  })

  it("create: stores a formatted Indonesian date when published", async () => {
    mockDb.contentEntry.create.mockResolvedValue({ id: "entry-1" })

    await createCmsBlogPostAction(INPUT, "PUBLISHED")

    const call = mockDb.contentEntry.create.mock.calls[0][0]
    expect(call.data.data.date).toMatch(/^\d{1,2} \p{L}+ \d{4}$/u)
    expect(call.data.data.author).toBe("Budi")
    expect(call.data.data.excerpt).toBe("Ringkasan")
    expect(call.data.data.is_featured).toBe(true)
    expect(call.data.publishedAt).toBeInstanceOf(Date)
  })

  it("create: leaves date null for a Draft", async () => {
    mockDb.contentEntry.create.mockResolvedValue({ id: "entry-1" })

    await createCmsBlogPostAction(INPUT, "DRAFT")

    const call = mockDb.contentEntry.create.mock.calls[0][0]
    expect(call.data.data.date).toBeNull()
    expect(call.data.publishedAt).toBeNull()
  })

  it("update: keeps the original publishedAt (and its date) when already published", async () => {
    const originalPublishedAt = new Date("2026-01-05T00:00:00Z")
    mockDb.contentEntry.findFirst
      .mockResolvedValueOnce({ id: "entry-1", data: { slug: "judul-post" }, publishedAt: originalPublishedAt })
      .mockResolvedValueOnce(null) // no slug clash on update's second lookup

    await updateCmsBlogPostAction("entry-1", INPUT, "PUBLISHED")

    const call = mockDb.contentEntry.update.mock.calls[0][0]
    expect(call.data.publishedAt).toBe(originalPublishedAt)
    expect(call.data.data.date).toBe(
      originalPublishedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    )
  })

  it("update: clears date when switched back to Draft", async () => {
    mockDb.contentEntry.findFirst
      .mockResolvedValueOnce({ id: "entry-1", data: { slug: "judul-post" }, publishedAt: new Date() })
      .mockResolvedValueOnce(null)

    await updateCmsBlogPostAction("entry-1", INPUT, "DRAFT")

    const call = mockDb.contentEntry.update.mock.calls[0][0]
    expect(call.data.publishedAt).toBeNull()
    expect(call.data.data.date).toBeNull()
  })

  it("create: normalizes pasted non-breaking spaces in title/content/excerpt before saving", async () => {
    mockDb.contentEntry.create.mockResolvedValue({ id: "entry-1" })

    await createCmsBlogPostAction(
      { ...INPUT, title: "Judul&nbsp;Post", content: "<p>Ingin&nbsp;meminta&nbsp;data</p>", excerpt: "Ring kasan" },
      "PUBLISHED"
    )

    const call = mockDb.contentEntry.create.mock.calls[0][0]
    expect(call.data.data.title).toBe("Judul Post")
    expect(call.data.data.content).toBe("<p>Ingin meminta data</p>")
    expect(call.data.data.excerpt).toBe("Ring kasan")
  })
})
