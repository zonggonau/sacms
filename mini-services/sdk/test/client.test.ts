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

  // Fifth external audit: `new SaCMS({ baseUrl, tenant })` with no token at
  // all used to send the literal header "Authorization: Bearer undefined"
  // — the server's own bearer-extraction treats any NON-EMPTY value as a
  // real (if invalid) credential attempt, not as "no credential", so every
  // such request was rejected with 401 even for public, unauthenticated
  // content the server would have served happily with no Authorization
  // header at all.
  it("omits the Authorization header entirely when no token is configured, instead of sending 'Bearer undefined'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    const anon = new SaCMS({ baseUrl: "https://app.test", tenant: "acme" })
    await anon.collection("articles").findMany()

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
    expect(Object.values(init.headers)).not.toContain("Bearer undefined")
  })

  it("also omits Authorization when token is explicitly an empty string (the documented former workaround)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    const anon = new SaCMS({ baseUrl: "https://app.test", tenant: "acme", token: "" })
    await anon.collection("articles").findMany()

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
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

  // Sixth external audit: a dropped connection on POST/PUT/DELETE leaves
  // genuine ambiguity about whether the server already wrote the data
  // before the connection died — retrying blindly (as every method used
  // to) risked creating a duplicate. Only a GET (no side effects) is safe
  // to retry on a raw network failure.
  it("does NOT retry a network failure for create() (POST) — fails immediately instead of risking a duplicate write", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    await expect(client().collection("articles").create({ data: { title: "x" } })).rejects.toMatchObject({ name: "SaCMSError" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("still retries a 429 for create() (POST) — a 429 means the request was never processed at all, so retrying is always safe", async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "slow down" }, 429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: "1" } }))

    const promise = client().collection("articles").create({ data: { title: "x" } })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toEqual({ data: { id: "1" } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  // Sixth external audit: Retry-After is valid as EITHER delta-seconds OR
  // an HTTP-date (RFC 9110) — parseInt() on the date form used to return
  // NaN, silently collapsing the intended backoff to an immediate retry.
  it("honors a Retry-After sent as an HTTP-date, not just delta-seconds", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(now)
    const retryAt = new Date(now.getTime() + 2000).toUTCString()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "slow down" }, 429, { "Retry-After": retryAt }))
      .mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))

    const promise = client().collection("articles").findMany()
    // Not yet due — still only the first call.
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1100)
    await expect(promise).resolves.toEqual({ data: [], meta: {} })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  // Sixth external audit: no timeout existed at all before — a request
  // the server never answers could hang a page's render indefinitely.
  // Real timers with a tiny override, not fake timers: AbortController's
  // event firing doesn't need faking, and this keeps the test fast and
  // free of fake-timer/microtask-interleaving edge cases.
  it("aborts a request that never resolves once the timeout elapses, honoring a per-call override", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const err = new Error("aborted")
        err.name = "AbortError"
        reject(err)
      })
    }))

    await expect(client().collection("articles").findMany(undefined, { timeoutMs: 50 })).rejects.toMatchObject({
      name: "SaCMSError",
      message: expect.stringContaining("timed out after 50ms"),
    })
  })

  it("never installs its own timeout when the caller supplies their own AbortSignal", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    const controller = new AbortController()
    await client().collection("articles").findMany(undefined, { timeoutMs: 50, signal: controller.signal })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.signal).toBe(controller.signal)
  })

  // Seventh external audit: a caller-aborted signal used to still go
  // through the same retry-with-backoff path as a generic network
  // failure (~7s before the caller finally saw their own cancellation) —
  // it must fail immediately instead, same as a deliberate timeout does.
  it("fails immediately (no retry) when the CALLER's own signal is aborted, instead of treating it like a network failure", async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const err = new Error("aborted")
        err.name = "AbortError"
        reject(err)
      })
    }))

    const promise = client().collection("articles").findMany(undefined, { signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: "SaCMSError", message: expect.stringContaining("aborted by the caller") })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Seventh external audit: the timeout used to be cleared the moment
  // fetch() itself resolved (i.e. once HEADERS arrived, per the Fetch
  // spec) — a server that sends headers immediately but trickles the
  // body slowly sailed straight through a short timeoutMs with nothing
  // enforcing it at all.
  it("the timeout also covers a slow body read, not just the wait for headers", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted")
          err.name = "AbortError"
          reject(err)
        })
      }),
    }))

    await expect(client().collection("articles").findMany(undefined, { timeoutMs: 50 })).rejects.toMatchObject({
      name: "SaCMSError",
      message: expect.stringContaining("timed out after 50ms"),
    })
  })

  // Seventh external audit: findOne() already handled populate: "*"
  // correctly; findMany() crashed on it with a raw TypeError instead of
  // a SaCMSError — `populate?.length` is truthy for the STRING "*" too
  // (strings have .length), falling through to `.map()`, which strings
  // don't have.
  it("findMany() accepts populate: '*' without crashing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").findMany({ populate: "*" })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("populate=*")
  })

  // Sixth external audit: Content-Type: application/json used to be sent
  // unconditionally, including on a GET with no body — a non-empty,
  // non-form Content-Type on a cross-origin request forces an extra CORS
  // preflight (OPTIONS) round-trip for every single read, for nothing.
  it("omits Content-Type on a GET (no body) but sends it on create() (POST, has a body)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").findMany()
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined()

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "1" } }))
    await client().collection("articles").create({ data: { title: "x" } })
    expect(fetchMock.mock.calls[1][1].headers["Content-Type"]).toBe("application/json")
  })

  // Sixth external audit: findOne() didn't accept either of these at all,
  // even though the server's own single-entry route supports both — a
  // relation always came back as a raw id no matter what findMany() itself
  // was asked for.
  it("findOne() builds populate and locale into the query string", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "1" } }))
    await client().collection("articles").findOne("1", { populate: ["author", "category"], locale: "en" })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/content/articles/1?locale=en&populate=author,category")
  })

  it("findOne() defaults to the client's own locale when none is passed, same as findMany()", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "1" } }))
    await client().collection("articles").findOne("1")

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/content/articles/1?locale=id")
  })

  // Sixth external audit: there was no way at all to reach Next.js's own
  // data-cache controls through this SDK — a template had to wrap every
  // call in unstable_cache itself just to get revalidate/tags behavior.
  it("passes next: { revalidate, tags } straight through to fetch()", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], meta: {} }))
    await client().collection("articles").findMany(undefined, { next: { revalidate: 60, tags: ["articles"] } })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.next).toEqual({ revalidate: 60, tags: ["articles"] })
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
