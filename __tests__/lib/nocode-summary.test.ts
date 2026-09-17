import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchNocodeSummary, getNocodeBaseUrl } from "@/lib/nocode-summary"

const validSummary = {
  generatedAt: "2026-09-16T10:00:00.000Z",
  users: { total: 120, newLast7Days: 9 },
  projects: { total: 80, newLast7Days: 4 },
  builds: { finishedToday: 20, failedToday: 2, successRatePercent: 90, runningNow: 1 },
  creditsUsedThisMonth: 3400,
  finance30Days: {
    revenueIdr: 1_500_000,
    aiCostIdr: 700_000,
    marginIdr: 800_000,
    newLiveWebsites: 6,
    unreconciledEvents: 3,
    plans: [{ name: "Pro", users: 5, revenueIdr: 1_000_000, costIdr: 500_000, marginIdr: 500_000 }],
  },
  system: { killSwitch: false, maintenance: false, signupEnabled: true },
  attention: [{ message: "2 build gagal dalam 1 jam terakhir", path: "/admin/build?status=FAILED" }],
}

function mockFetch(impl: (...args: unknown[]) => Promise<Response>) {
  const fn = vi.fn(impl)
  vi.stubGlobal("fetch", fn)
  return fn
}

describe("fetchNocodeSummary (nocode ADR-016)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("does not call nocode at all when the key is missing", async () => {
    vi.stubEnv("NOCODE_SUMMARY_KEY", "")
    const fetchFn = mockFetch(async () => new Response("{}"))

    const result = await fetchNocodeSummary()

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe("not_configured")
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("sends the key as a bearer token to /api/platform/ringkasan and returns the parsed summary", async () => {
    vi.stubEnv("NOCODE_SUMMARY_KEY", "k".repeat(40))
    vi.stubEnv("NOCODE_BASE_URL", "https://sacms.cloud/")
    const fetchFn = mockFetch(async () => Response.json(validSummary))

    const result = await fetchNocodeSummary()

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://sacms.cloud/api/platform/ringkasan")
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${"k".repeat(40)}`)
    expect(result).toEqual({ ok: true, summary: validSummary, adminBaseUrl: "https://sacms.cloud" })
  })

  it("explains a rejected key instead of throwing", async () => {
    vi.stubEnv("NOCODE_SUMMARY_KEY", "k".repeat(40))
    mockFetch(async () => new Response("Unauthorized", { status: 401 }))

    const result = await fetchNocodeSummary()

    expect(result.ok === false && result.reason).toBe("unauthorized")
  })

  it("reports nocode as unreachable on a network error or a 5xx", async () => {
    vi.stubEnv("NOCODE_SUMMARY_KEY", "k".repeat(40))

    mockFetch(async () => {
      throw new TypeError("fetch failed")
    })
    const networkError = await fetchNocodeSummary()
    expect(networkError.ok === false && networkError.reason).toBe("unreachable")

    mockFetch(async () => Response.json({ error: "Gagal menyusun ringkasan" }, { status: 500 }))
    const serverError = await fetchNocodeSummary()
    expect(serverError.ok === false && serverError.reason).toBe("unreachable")
  })

  it("rejects a response whose shape does not match (version drift between the two apps)", async () => {
    vi.stubEnv("NOCODE_SUMMARY_KEY", "k".repeat(40))
    const { finance30Days: _dropped, ...withoutFinance } = validSummary
    mockFetch(async () => Response.json(withoutFinance))

    const result = await fetchNocodeSummary()

    expect(result.ok === false && result.reason).toBe("invalid_response")
  })
})

describe("getNocodeBaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("defaults to the apex in production and to the dev runner port locally", () => {
    vi.stubEnv("NOCODE_BASE_URL", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(getNocodeBaseUrl()).toBe("https://sacms.cloud")

    vi.stubEnv("NODE_ENV", "development")
    expect(getNocodeBaseUrl()).toBe("http://localhost:3001")
  })
})
