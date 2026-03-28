import { describe, it, expect, vi, beforeEach } from "vitest"
import { SaCMS, SaCMSError } from "../../mini-services/sdk/src/client"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("SaCMS SDK", () => {
  let cf: SaCMS

  beforeEach(() => {
    vi.clearAllMocks()
    cf = new SaCMS({
      baseUrl: "https://api.example.com",
      tenant: "my-tenant",
      token: "cf_test_token",
      locale: "en",
    })
  })

  describe("constructor", () => {
    it("strips trailing slashes from baseUrl", () => {
      const cf2 = new SaCMS({
        baseUrl: "https://api.example.com///",
        tenant: "test",
        token: "tok",
      })
      expect(cf2.getTenant()).toBe("test")
    })
  })

  describe("collection().findMany()", () => {
    it("sends GET request with correct URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: { pagination: { total: 0 } } }),
      })

      await cf.collection("articles").findMany()

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/content/articles",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer cf_test_token",
          }),
        })
      )
    })

    it("builds query string with filters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: {} }),
      })

      await cf.collection("articles").findMany({
        filters: { category: { $eq: "tutorial" } },
        fields: ["title", "slug"],
        sort: "createdAt:desc",
        pagination: { page: 1, pageSize: 10 },
        locale: "id",
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain("filters[category][$eq]=tutorial")
      expect(calledUrl).toContain("fields=title")
      expect(calledUrl).toContain("slug")
      expect(calledUrl).toContain("sort=createdAt")
      expect(calledUrl).toContain("pagination[page]=1")
      expect(calledUrl).toContain("pagination[pageSize]=10")
      expect(calledUrl).toContain("locale=id")
    })

    it("uses default locale when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: {} }),
      })

      await cf.collection("articles").findMany({})

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain("locale=en")
    })

    it("builds search param", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: {} }),
      })

      await cf.collection("articles").findMany({ search: "next.js" })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain("search=next.js")
    })
  })

  describe("collection().findOne()", () => {
    it("sends GET request with entry ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "123", title: "Test" } }),
      })

      const result = await cf.collection("articles").findOne("123")

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/content/articles/123",
        expect.anything()
      )
      expect(result.data.id).toBe("123")
    })
  })

  describe("collection().create()", () => {
    it("sends POST request with data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "new-1" } }),
      })

      await cf.collection("articles").create({
        data: { title: "New Article" },
        locale: "en",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/content/articles",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: { title: "New Article" }, locale: "en", status: undefined }),
        })
      )
    })
  })

  describe("collection().update()", () => {
    it("sends PUT request with id and data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: "123" } }),
      })

      await cf.collection("articles").update("123", {
        data: { title: "Updated" },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/content/articles/123",
        expect.objectContaining({ method: "PUT" })
      )
    })
  })

  describe("collection().delete()", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await cf.collection("articles").delete("123")

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/content/articles/123",
        expect.objectContaining({ method: "DELETE" })
      )
      expect(result.success).toBe(true)
    })
  })

  describe("single().find()", () => {
    it("sends GET request with locale", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { hero: "Welcome" } }),
      })

      await cf.single("homepage").find({ locale: "id" })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/single/homepage?locale=id",
        expect.anything()
      )
    })

    it("uses default locale when none specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })

      await cf.single("homepage").find()

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain("locale=en")
    })
  })

  describe("graphql()", () => {
    it("sends POST with query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { articles: [] } }),
      })

      const query = "{ articles { id title } }"
      await cf.graphql(query)

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/public/my-tenant/graphql",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query, variables: undefined }),
        })
      )
    })

    it("sends variables", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })

      await cf.graphql("query ($id: ID!) { article(id: $id) { title } }", { id: "123" })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.variables).toEqual({ id: "123" })
    })
  })

  describe("error handling", () => {
    it("throws SaCMSError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ error: "Forbidden" })),
      })

      await expect(cf.collection("articles").findMany()).rejects.toThrow(SaCMSError)
    })

    it("includes status code in error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      })

      try {
        await cf.collection("articles").findOne("missing")
        expect.fail("Should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(SaCMSError)
        expect((err as SaCMSError).status).toBe(404)
      }
    })

    it("handles non-JSON error responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })

      await expect(cf.collection("articles").findMany()).rejects.toThrow("Internal Server Error")
    })
  })
})
