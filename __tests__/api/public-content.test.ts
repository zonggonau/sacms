import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { rateLimit } from "@/lib/rate-limit"
import { getCache, setCache } from "@/lib/cache"
import { GET } from "../../src/app/api/public/[tenant]/content/[contentType]/route"
import { NextRequest } from "next/server"

// Helper to create mock NextRequest
function createRequest(
  url: string,
  headers: Record<string, string> = { authorization: "Bearer cf_test_token" }
) {
  return new NextRequest(url, {
    method: "GET",
    headers,
  })
}

describe("Public Content API GET Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set default mocks
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 99, limit: 100, resetAt: Date.now() + 60000 })
    vi.mocked(getCache).mockResolvedValue(null)
  })

  it("should return 401 if authorization header is missing", async () => {
    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles", {})
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(401)
    
    const body = await response.json()
    expect(body.error).toContain("Missing or invalid authorization header")
  })

  it("should return 401 if API token is invalid", async () => {
    // Mock db.apiToken.findUnique to return null
    vi.mocked(db.apiToken.findUnique).mockResolvedValue(null)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(401)
    
    const body = await response.json()
    expect(body.error).toContain("Invalid API token")
  })

  it("should return 403 if token does not match tenant", async () => {
    // Mock valid API token but for a different tenant
    vi.mocked(db.apiToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "cf_test_token",
      tenantId: "tenant-other",
      expiresAt: null,
      tenant: {
        id: "tenant-other",
        slug: "tenant-other",
      },
    } as any)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(403)
    
    const body = await response.json()
    expect(body.error).toContain("Token does not match tenant")
  })

  it("should return 401 if token is expired", async () => {
    vi.mocked(db.apiToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "cf_test_token",
      tenantId: "tenant-1",
      expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      tenant: {
        id: "tenant-1",
        slug: "tenant-1",
      },
    } as any)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(401)
    
    const body = await response.json()
    expect(body.error).toContain("API token expired")
  })

  it("should return 429 if rate limit is exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 100,
      resetAt: Date.now() + 60000,
    })

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(429)
    
    const body = await response.json()
    expect(body.error).toContain("Rate limit exceeded")
  })

  it("should return cached response if hit in Redis", async () => {
    vi.mocked(db.apiToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "cf_test_token",
      tenantId: "tenant-1",
      expiresAt: null,
      tenant: {
        id: "tenant-1",
        slug: "tenant-1",
      },
    } as any)

    const mockCachedPayload = {
      data: [{ id: "entry-1", title: "Cached Post" }],
      meta: {
        contentType: { name: "Articles", slug: "articles" },
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    }

    vi.mocked(getCache).mockResolvedValue(mockCachedPayload)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(200)
    expect(response.headers.get("X-Cache")).toBe("HIT")
    
    const body = await response.json()
    expect(body.data[0].title).toBe("Cached Post")
  })

  it("should return 404 if content type is not found", async () => {
    vi.mocked(db.apiToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "cf_test_token",
      tenantId: "tenant-1",
      expiresAt: null,
      tenant: {
        id: "tenant-1",
        slug: "tenant-1",
      },
    } as any)

    // Mock content type findFirst to return null
    vi.mocked(db.contentType.findFirst).mockResolvedValue(null)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(404)
    
    const body = await response.json()
    expect(body.error).toContain("Content type not found")
  })

  it("should retrieve and shape entries correctly (cache MISS)", async () => {
    vi.mocked(db.apiToken.findUnique).mockResolvedValue({
      id: "token-1",
      token: "cf_test_token",
      tenantId: "tenant-1",
      expiresAt: null,
      tenant: {
        id: "tenant-1",
        slug: "tenant-1",
      },
    } as any)

    // Mock Content Type assignment
    vi.mocked(db.contentType.findFirst).mockResolvedValue({
      id: "type-articles",
      name: "Articles",
      slug: "articles",
      fields: [
        { slug: "title", type: "string" },
        { slug: "body", type: "text" },
      ],
      tenants: [], // Global template, so available for all
    } as any)

    // Mock entries fetching
    vi.mocked(db.contentEntry.findMany).mockResolvedValue([
      {
        id: "entry-1",
        documentId: "doc-1",
        contentTypeId: "type-articles",
        tenantId: "tenant-1",
        locale: "en",
        data: { title: "Hello World", body: "First post content" },
        status: "PUBLISHED",
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    ] as any)
    vi.mocked(db.contentEntry.count).mockResolvedValue(1)

    // Mock tenantLocale for locale resolution
    vi.mocked(db.tenantLocale.findFirst).mockResolvedValue({
      locale: "en",
    } as any)

    const req = createRequest("http://localhost:3000/api/public/tenant-1/content/articles")
    const params = Promise.resolve({ tenant: "tenant-1", contentType: "articles" })

    const response = await GET(req, { params })
    expect(response.status).toBe(200)
    expect(response.headers.get("X-Cache")).toBe("MISS")

    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe("Hello World")
    expect(body.data[0].locale).toBe("en")
    expect(body.data[0].availableLocales).toContain("en")
    expect(body.meta.pagination.total).toBe(1)

    // Ensure cache was updated in Redis
    expect(setCache).toHaveBeenCalled()
  })
})
