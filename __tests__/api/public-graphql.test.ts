import { createHash } from "node:crypto"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fixtures = vi.hoisted(() => ({
  cache: { getCache: vi.fn(), setCache: vi.fn(), invalidatePattern: vi.fn() },
  db: {
    apiKey: { findUnique: vi.fn(), update: vi.fn() },
    apiToken: { findUnique: vi.fn(), update: vi.fn() },
    tenantContentTypeAssignment: { findMany: vi.fn() },
    tenantSingleTypeAssignment: { findMany: vi.fn(), findFirst: vi.fn() },
    contentType: { findFirst: vi.fn() },
    schemaField: { findMany: vi.fn() },
    contentEntry: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/database", () => ({ db: fixtures.db, getTenantDb: async () => fixtures.db }))
vi.mock("@/lib/cache", () => fixtures.cache)
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })), RATE_LIMITS: {} }))
vi.mock("@/lib/plan-enforcement", () => ({ checkApiCallQuota: vi.fn(async () => ({ allowed: true })) }))
vi.mock("@/lib/monitoring", () => ({ logApiRequest: vi.fn(async () => undefined) }))
vi.mock("@/lib/slug", () => ({ processAutoSlugs: vi.fn(async (_tenant, _type, _fields, data: unknown) => data) }))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(), AuditAction: { CONTENT_UPDATED: "content.updated" } }))
vi.mock("@/lib/webhooks", () => ({
  executeSyncHooks: vi.fn(async () => ({ allowed: true })),
  triggerWebhooks: vi.fn(),
  WebhookEvents: { BEFORE_UPDATE: "content.beforeUpdate", CONTENT_UPDATED: "content.updated" },
}))

import { POST } from "@/app/api/public/[tenant]/graphql/route"

const date = new Date("2026-10-01T12:00:00Z")
const publishedPost = {
  id: "published-post",
  tenantId: "workspace",
  contentTypeId: "post-type",
  data: { "short-title": "Published title", related: "draft-post" },
  status: "PUBLISHED",
  publishedAt: date,
  updatedAt: date,
  createdAt: date,
}
const draftPost = {
  ...publishedPost,
  id: "draft-post",
  data: { "short-title": "Draft title" },
  status: "DRAFT",
  publishedAt: null,
}
const postType = {
  id: "post-type",
  slug: "blog-post",
  schemaFields: [{ slug: "short-title", name: "Short title", type: "text", required: true }, { slug: "related", type: "relation" }],
}
const homeType = { id: "home-type", slug: "home-page", schemaFields: [{ slug: "heading", type: "text" }] }

function callGraphQL(body: { query: string; operationName?: string; variables?: Record<string, unknown> }, access = "read-only") {
  const request = new NextRequest("https://example.com/api/public/coffee/graphql", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer fixture-${access}`, "Content-Type": "application/json" },
  })
  return POST(request, { params: Promise.resolve({ tenant: "coffee" }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures.db.apiKey.findUnique.mockResolvedValue(null)
  fixtures.db.apiToken.findUnique.mockImplementation(async ({ where }) => ({
    id: "fixture-token",
    tenantId: "workspace",
    tenant: { slug: "coffee" },
    type: where.token === createHash("sha256").update("fixture-full-access").digest("hex")
      ? "full-access"
      : "read-only",
  }))
  fixtures.db.tenantContentTypeAssignment.findMany.mockResolvedValue([{ contentType: postType }])
  fixtures.db.tenantSingleTypeAssignment.findMany.mockResolvedValue([{ singleType: homeType }])
  fixtures.db.contentType.findFirst.mockResolvedValue(postType)
  fixtures.db.schemaField.findMany.mockResolvedValue(postType.schemaFields)
  fixtures.db.contentEntry.count.mockImplementation(async ({ where }) => where.AND?.status === "DRAFT" ? 0 : 2)
  fixtures.db.contentEntry.findMany.mockImplementation(async ({ where }) => where.AND?.status === "DRAFT" ? [] : [publishedPost])
  fixtures.db.contentEntry.findFirst.mockImplementation(async ({ where }) => {
    if (where.id === publishedPost.id) return { ...publishedPost, contentType: postType }
    if (where.id === draftPost.id && where.status !== "PUBLISHED") return { ...draftPost, contentType: postType }
    return null
  })
  fixtures.db.tenantSingleTypeAssignment.findFirst.mockImplementation(async ({ where }) => ({
    data: { heading: "Published" },
    draftData: { heading: "Draft" },
    publishedAt: date,
    updatedAt: new Date("2026-10-02T12:00:00Z"),
  }))
})

describe("tenant GraphQL endpoint", () => {
  it("forwards list and detail arguments and applies publication visibility to nested lookups", async () => {
    const response = await callGraphQL({
      query: `query Posts($id: ID!) {
        blog_post(page: 2, limit: 1, sort: "updatedAt", order: "asc", published: false) {
          data { id short_title related }
          meta { page limit total }
        }
        hidden: blog_postById(id: $id) { id short_title }
        draftStatus: blog_post(status: "DRAFT") { meta { total } }
      }`,
      variables: { id: draftPost.id },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({ data: {
      blog_post: {
        data: [{ id: publishedPost.id, short_title: "Published title", related: draftPost.id }],
        meta: { page: 2, limit: 1, total: 2 },
      },
      hidden: null,
      draftStatus: { meta: { total: 0 } },
    } })
    expect(fixtures.db.contentEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "workspace", contentTypeId: "post-type", status: "PUBLISHED", deletedAt: null },
      orderBy: { updatedAt: "asc" }, skip: 1, take: 1,
    }))
    expect(fixtures.db.contentEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: draftPost.id, tenantId: "workspace", contentType: { draftTemplateId: null }, status: "PUBLISHED" }),
    }))
  })

  it("returns a singleton's published version by default and limits draft reads to explicit full-access requests", async () => {
    const query = `{
      current: home_page { heading updatedAt }
      preview: home_page(draft: true) { heading updatedAt }
    }`
    const publicResponse = await callGraphQL({ query })
    expect(await publicResponse.json()).toEqual({ data: {
      current: { heading: "Published", updatedAt: date.toISOString() },
      preview: { heading: "Published", updatedAt: date.toISOString() },
    } })
    const authenticatedResponse = await callGraphQL({ query }, "full-access")
    expect(await authenticatedResponse.json()).toEqual({ data: {
      current: { heading: "Published", updatedAt: date.toISOString() },
      preview: { heading: "Draft", updatedAt: "2026-10-02T12:00:00.000Z" },
    } })
    expect(fixtures.cache.setCache).toHaveBeenCalledTimes(1)
  })

  it("selects the requested named mutation, passes its variables and clears stale caches", async () => {
    const updated = { ...publishedPost, data: { ...publishedPost.data, "short-title": "Edited" } }
    const transaction = {
      contentEntry: { update: vi.fn().mockResolvedValue(updated) },
      contentVersion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    }
    fixtures.db.$transaction.mockImplementation(async (run) => run(transaction))

    const query = `query Read { blog_post { meta { total } } }
      mutation Edit($id: ID!, $data: JSON!) { updateBlogPost(id: $id, data: $data) { id short_title } }`
    const body = { query, operationName: "Edit", variables: { id: publishedPost.id, data: { "short-title": "Edited" } } }

    const forbidden = await callGraphQL(body)
    expect(forbidden.status).toBe(403)
    expect(transaction.contentEntry.update).not.toHaveBeenCalled()

    const response = await callGraphQL(body, "full-access")
    expect(await response.json()).toEqual({ data: { updateBlogPost: { id: publishedPost.id, short_title: "Edited" } } })
    expect(transaction.contentEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: publishedPost.id }, data: expect.objectContaining({ data: updated.data }),
    }))
    expect(fixtures.db.contentType.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: postType.id, draftTemplateId: null, tenants: { some: { tenantId: "workspace", enabled: true } } }),
    }))
    expect(fixtures.cache.invalidatePattern).toHaveBeenCalledWith("graphql:workspace:*")
    expect(fixtures.cache.setCache).not.toHaveBeenCalled()
  })

  it("validates the effective content before writing an already published entry", async () => {
    const response = await callGraphQL({
      query: `mutation Update($data: JSON!) {
        updateBlogPost(id: "published-post", data: $data) { id }
      }`,
      variables: { data: { "short-title": "" } },
    }, "full-access")

    expect(await response.json()).toMatchObject({
      data: { updateBlogPost: null }, errors: [{ message: expect.stringContaining("Short title is required") }],
    })
    expect(fixtures.db.$transaction).not.toHaveBeenCalled()
  })
})
