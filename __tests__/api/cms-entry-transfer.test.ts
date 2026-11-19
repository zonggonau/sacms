import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { GET } from "@/app/api/tenant/[tenant]/content-types/slug/[slug]/entries/export/route"
import { POST } from "@/app/api/tenant/[tenant]/content-types/slug/[slug]/entries/import/route"

const { findEntries, createEntry } = vi.hoisted(() => ({
  findEntries: vi.fn(),
  createEntry: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/rbac", () => ({
  checkPermission: vi.fn(async () => ({ allowed: true })),
  PERMISSIONS: { CONTENT_CREATE: "content.create", CONTENT_READ: "content.read" },
}))
vi.mock("@/lib/database", () => ({
  db: {},
  getTenantDb: vi.fn(async () => ({
    contentType: {
      findFirst: vi.fn(async () => ({ id: "type1", slug: "articles", name: "Articles", schemaFields: [] })),
    },
    contentEntry: { findMany: findEntries },
  })),
}))
vi.mock("@/lib/content/entry-service", () => ({ createContentEntry: createEntry }))

const context = { params: Promise.resolve({ tenant: "coffee", slug: "articles" }) }
const url = "https://example.test/api/tenant/coffee/content-types/slug/articles/entries"

describe("CMS entry import and export", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "staff1" }, expires: "2030-01-01" })
    vi.mocked(getTenantAccess).mockResolvedValue({ role: "owner", tenantId: "tenant1" } as NonNullable<Awaited<ReturnType<typeof getTenantAccess>>>)
  })

  it("excludes entries in Trash and exports the document grouping", async () => {
    findEntries.mockResolvedValueOnce([{ id: "entry1", documentId: "document1", locale: "id", data: { title: "Kopi" } }])
    const response = await GET(new NextRequest(`${url}/export`), context)

    expect(response.status).toBe(200)
    expect(findEntries).toHaveBeenCalledWith(expect.objectContaining({
      where: { contentTypeId: "type1", tenantId: "tenant1", deletedAt: null },
    }))
    expect(await response.json()).toMatchObject({
      count: 1,
      entries: [{ sourceId: "entry1", documentId: "document1", locale: "id" }],
    })
  })

  it("groups translated rows under the new destination ID and keeps new entries as drafts", async () => {
    createEntry
      .mockResolvedValueOnce({ ok: true, data: { id: "destination-id", locale: "id" } })
      .mockResolvedValueOnce({ ok: true, data: { id: "translated-id", locale: "en" } })

    const response = await POST(new NextRequest(`${url}/import`, {
      method: "POST",
      body: JSON.stringify({
        entries: [
          { documentId: "origin-id", locale: "id", status: "PUBLISHED", data: { title: "Kopi" } },
          { documentId: "origin-id", locale: "en", status: "PUBLISHED", data: { title: "Coffee" } },
          { documentId: "origin-id", locale: "id", data: { title: "Duplikat" } },
        ],
      }),
    }), context)

    expect(response.status).toBe(200)
    expect(createEntry).toHaveBeenCalledTimes(2)
    expect(createEntry.mock.calls.map(([, , input]) => input)).toMatchObject([
      { locale: "id", status: "DRAFT", importDocumentId: undefined },
      { locale: "en", status: "DRAFT", importDocumentId: "destination-id" },
    ])
    expect(await response.json()).toMatchObject({ imported: 2, failed: 1, failures: [{ index: 2 }] })
  })
})
