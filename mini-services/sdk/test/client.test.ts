import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SaCMS, SaCMSError } from "../src/client"

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

describe("SaCMS client", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function client() {
    return new SaCMS({ baseUrl: "https://app.test", tenant: "acme", token: "svc_token", locale: "id" })
  }

  it("sends the service token as a Bearer header by default", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").findMany()

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe("Bearer svc_token")
  })

  it("findMany builds the expected query string: fields, populate, sort, pagination, search, status, locale", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client()
      .collection("articles")
      .findMany({
        fields: ["title", "slug"],
        populate: ["author"],
        sort: "createdAt:desc",
        pagination: { page: 2, pageSize: 10 },
        search: "next js",
        status: "PUBLISHED",
      })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("/api/public/acme/content/articles?")
    expect(url).toContain("fields=title,slug")
    expect(url).toContain("populate=author")
    expect(url).toContain("sort=createdAt%3Adesc")
    expect(url).toContain("locale=id")
    expect(url).toContain("pagination[page]=2")
    expect(url).toContain("pagination[pageSize]=10")
    expect(url).toContain("search=next%20js")
    expect(url).toContain("status=PUBLISHED")
  })

  it("the fluent query builder produces filters[field][$op]=value", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").query().where("category", "eq", "tech").where("views", "gte", 100).fetch()

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("filters[category][$eq]=tech")
    expect(url).toContain("filters[views][$gte]=100")
  })

  it("$or and $and groups serialize with indexed brackets", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").findMany({
      filters: {
        $or: [{ status: { $eq: "featured" } }],
        $and: [{ price: { $gte: 100 } }],
      },
    })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("filters[$or][0][status][$eq]=featured")
    expect(url).toContain("filters[$and][0][price][$gte]=100")
  })

  it("create() posts data/locale/status in the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "1" } }, 201))
    await client().collection("posts").create({ data: { title: "Hi" }, status: "PUBLISHED" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/content/posts")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ data: { title: "Hi" }, locale: "id", status: "PUBLISHED" })
  })

  it("throws SaCMSError with the response status and parsed message on a non-OK response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Content type not found" }, 404))
    await expect(client().collection("nope").findOne("x")).rejects.toMatchObject({
      name: "SaCMSError",
      status: 404,
      message: "Content type not found",
    })
  })

  it("retries on 429 honoring Retry-After, then succeeds", async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "slow down" }, 429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))

    const promise = client().collection("articles").findMany()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toEqual({ data: [], meta: {} })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("retries a pure network failure and eventually throws a SaCMSError (not a raw exception)", async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const promise = client().collection("articles").findMany()
    const assertion = expect(promise).rejects.toMatchObject({ name: "SaCMSError" })
    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    vi.useRealTimers()
  })

  it("single().find() includes the locale query param and hits the single endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: {}, meta: { singleType: { name: "Homepage", slug: "homepage" }, locale: "id" } }))
    await client().single("homepage").find()

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/single/homepage?locale=id")
  })

  it("graphql() posts the query and variables to the tenant's graphql endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }))
    await client().graphql("query { articles { data { id } } }", { limit: 5 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/graphql")
    expect(JSON.parse(init.body)).toEqual({ query: "query { articles { data { id } } }", variables: { limit: 5 } })
  })
})

describe("SaCMSError", () => {
  it("carries status and message", () => {
    const err = new SaCMSError("bad", 400)
    expect(err.message).toBe("bad")
    expect(err.status).toBe(400)
    expect(err.name).toBe("SaCMSError")
  })
})
