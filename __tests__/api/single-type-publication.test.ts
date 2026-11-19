import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { saveSingleTypeDataAction } from "@/actions/single-types"
import { GET, PUT } from "@/app/api/public/[tenant]/single/[singleType]/route"

const mocks = vi.hoisted(() => ({
  dbNull: Symbol("db-null"),
  singleType: vi.fn(),
  assignment: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  cacheRead: vi.fn(),
  cacheWrite: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock("@/lib/database", () => {
  const db = {
    tenant: { findFirst: vi.fn().mockResolvedValue({ id: "tenant-id", slug: "tenant" }) },
    tenantLocale: { findMany: vi.fn().mockResolvedValue([{ locale: "en", name: "English" }]) },
    apiKey: { findUnique: vi.fn().mockResolvedValue(null) },
    apiToken: {
      findFirst: vi.fn().mockResolvedValue({
        id: "write-token",
        type: "full-access",
        tenant: { id: "tenant-id", slug: "tenant" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    singleType: { findFirst: mocks.singleType },
    tenantSingleTypeAssignment: { findUnique: mocks.assignment, update: mocks.update, upsert: mocks.upsert },
  }
  return { db, getTenantDb: vi.fn().mockResolvedValue(db), Prisma: { DbNull: mocks.dbNull } }
})
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "owner" } }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn().mockResolvedValue({ tenantId: "tenant-id", role: "owner" }) }))
vi.mock("@/lib/rbac", () => ({ checkPermission: vi.fn().mockResolvedValue({ allowed: true }), PERMISSIONS: {} }))
vi.mock("@/lib/slug", () => ({ processAutoSlugs: async (_tenant: string, _type: string, _fields: unknown[], data: unknown) => data }))
vi.mock("@/lib/schema-lock", () => ({ assertSchemaEditable: vi.fn() }))
vi.mock("@/actions/content-pipeline", () => ({ parseSchemaFieldOptions: (fields: unknown[]) => fields }))
vi.mock("@/lib/content-resolver", () => ({ resolveContentData: async (_tenant: string, data: unknown) => data }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99 }),
  RATE_LIMITS: { publicApi: {} },
}))
vi.mock("@/lib/plan-enforcement", () => ({ checkApiCallQuota: vi.fn().mockResolvedValue({ allowed: true }) }))
vi.mock("@/lib/monitoring", () => ({ logApiRequest: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/cache", () => ({ getCache: mocks.cacheRead, setCache: mocks.cacheWrite, invalidatePattern: mocks.invalidate }))

const params = { params: Promise.resolve({ tenant: "tenant", singleType: "homepage" }) }
const publishedAt = new Date("2026-01-10T00:00:00.000Z")
const savedAt = new Date("2026-01-12T00:00:00.000Z")

function getPage(query = "", useToken = false) {
  return GET(new NextRequest(`http://localhost/api/public/tenant/single/homepage${query}`, {
    headers: useToken ? { authorization: "Bearer fixture" } : {},
  }), params)
}

function putPage(data: Record<string, unknown>, publish: boolean) {
  return PUT(new NextRequest("http://localhost/api/public/tenant/single/homepage", {
    method: "PUT",
    headers: { authorization: "Bearer fixture", "content-type": "application/json" },
    body: JSON.stringify({ data, publish }),
  }), params)
}

describe("workspace Single Type publication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.singleType.mockResolvedValue({ id: "single-id", slug: "homepage", name: "Home page", schemaFields: [] })
    let assignment = {
      id: "row-id",
      enabled: true,
      data: JSON.stringify({ heading: "Published" }),
      draftData: null,
      publishedAt,
      updatedAt: publishedAt,
    }
    const write = (changes: Record<string, unknown>) => {
      const patch = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value === mocks.dbNull ? null : value]))
      assignment = { ...assignment, ...patch, updatedAt: savedAt }
      return assignment
    }
    mocks.assignment.mockImplementation(async () => assignment)
    mocks.update.mockImplementation(async ({ data }) => write(data))
    mocks.upsert.mockImplementation(async ({ update }) => write(update))
    mocks.cacheRead.mockResolvedValue(null)
  })

  it("stages Studio edits while normal reads use the published payload even with a write token", async () => {
    const result = await saveSingleTypeDataAction("tenant", "single-id", { heading: "Pending" }, false, undefined, "studio")
    expect(result.singleType?.data).toEqual({ heading: "Pending" })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_singleTypeId_locale: { tenantId: "tenant-id", singleTypeId: "single-id", locale: "en" } },
      update: { draftData: { heading: "Pending" } },
    }))

    const published = await getPage("", true)
    expect(published.status).toBe(200)
    expect((await published.json()).data).toMatchObject({ heading: "Published", updatedAt: publishedAt.toISOString() })
    expect((await getPage("?draft=true")).status).toBe(403)
    const preview = await getPage("?draft=true", true)
    expect(preview.headers.get("cache-control")).toBe("private, no-store")
    expect((await preview.json()).data.heading).toBe("Pending")
    expect(mocks.cacheWrite).toHaveBeenCalledTimes(1)
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it("uses separate draft writes and clears pending edits on REST publication", async () => {
    await putPage({ heading: "Pending" }, false)
    expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: "row-id" }, data: { draftData: { heading: "Pending" } } })
    expect((await (await getPage()).json()).data.heading).toBe("Published")

    const published = await putPage({ heading: "Final" }, true)
    expect(published.status).toBe(200)
    expect(mocks.update).toHaveBeenLastCalledWith({
      where: { id: "row-id" },
      data: { data: { heading: "Final" }, draftData: mocks.dbNull, publishedAt: expect.any(Date) },
    })
    expect((await (await getPage()).json()).data.heading).toBe("Final")
    expect(mocks.invalidate).toHaveBeenCalledWith("single:tenant-id:homepage:en:*")
    expect(mocks.invalidate).toHaveBeenCalledWith("graphql:tenant-id:*")
  })

  it("keeps an unpublished Single Type hidden in normal reads", async () => {
    mocks.assignment.mockResolvedValue({ enabled: true, data: null, draftData: { heading: "Pending" }, publishedAt: null, updatedAt: savedAt })
    expect((await getPage()).status).toBe(404)
    expect((await getPage("", true)).status).toBe(404)
    expect((await (await getPage("?draft=true", true)).json()).data.heading).toBe("Pending")
  })
})
