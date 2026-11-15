import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// chatgpt5.md P0: a rich-text patch once reported READY while the
// production domain itself returned HTTP 500 on every request — Vercel's
// build success says nothing about runtime correctness. deployToVercel now
// defaults to a "staging" candidate instead of immediately going live;
// promoteDeployment is the explicit, separate step that actually flips the
// production alias, and getRuntimeLogs is the new diagnostic for an HTTP
// 500 a real request hit (a build log alone never shows that).

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { deployToVercel, promoteDeployment, getRuntimeLogs } = await import("@/lib/vercel-client")

describe("deployToVercel — target defaults to staging", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("defaults to target: 'staging' when no target is given", async () => {
    const calls: { url: string; init?: any }[] = []
    global.fetch = vi.fn((url: any, init?: any) => {
      calls.push({ url: String(url), init })
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: "dpl_1", url: "sacms-acme-abc123.vercel.app", readyState: "QUEUED", projectId: "prj_1", name: "sacms-acme" }),
      })
    }) as any

    const result = await deployToVercel("sacms-acme", [{ name: "index.html", content: "<h1>hi</h1>" }])

    const body = JSON.parse(calls[0].init.body)
    expect(body.target).toBe("staging")
    expect(result.target).toBe("staging")
  })

  it("a staging deploy's `url` is the candidate's OWN hostname, NOT the project's production domain", async () => {
    global.fetch = vi.fn((url: any) => {
      if (String(url).includes("/v13/deployments")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "dpl_1", url: "sacms-acme-abc123.vercel.app", readyState: "QUEUED", projectId: "prj_1" }) })
      }
      throw new Error(`Unexpected fetch call for a staging deploy: ${url}`)
    }) as any

    const result = await deployToVercel("sacms-acme", [{ name: "index.html", content: "<h1>hi</h1>" }], undefined, undefined, "staging")

    // Never calls getProjectPrimaryDomain (the /v9/.../domains lookup) for
    // a staging deploy — reporting the OLD production domain as `url` here
    // would misleadingly suggest this candidate is already live.
    expect(result.url).toBe("https://sacms-acme-abc123.vercel.app")
    expect(result.deploymentUrl).toBe("https://sacms-acme-abc123.vercel.app")
  })

  it("an explicit target: 'production' still resolves `url` to the project's real public domain, same as before", async () => {
    global.fetch = vi.fn((url: any) => {
      const u = String(url)
      if (u.includes("/v13/deployments")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "dpl_1", url: "sacms-acme-abc123.vercel.app", readyState: "QUEUED", projectId: "prj_1" }) })
      }
      if (u.includes("/v9/projects/") && u.includes("/domains")) {
        return Promise.resolve({ ok: true, json: async () => ({ domains: [{ name: "acme.sites.sacms.cloud", verified: true }] }) })
      }
      throw new Error(`Unexpected fetch call: ${u}`)
    }) as any

    const result = await deployToVercel("sacms-acme", [{ name: "index.html", content: "<h1>hi</h1>" }], undefined, undefined, "production")

    expect(result.url).toBe("https://acme.sites.sacms.cloud")
    expect(result.deploymentUrl).toBe("https://sacms-acme-abc123.vercel.app")
    expect(result.target).toBe("production")
  })

  it("the no-token simulated fallback still reports a target", async () => {
    const { isMockAllowed } = await import("@/lib/dev-mode")
    vi.mocked(isMockAllowed).mockReturnValue(true)
    const { getPlatformSettings } = await import("@/lib/settings")
    vi.mocked(getPlatformSettings).mockResolvedValueOnce({} as any)

    const result = await deployToVercel("sacms-acme", [{ name: "index.html", content: "x" }])
    expect(result.simulated).toBe(true)
    expect(result.target).toBe("staging")
  })
})

describe("promoteDeployment", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("POSTs to the v10 promote endpoint with the project and deployment ids, no body", async () => {
    const calls: { url: string; init?: any }[] = []
    global.fetch = vi.fn((url: any, init?: any) => {
      calls.push({ url: String(url), init })
      return Promise.resolve({ ok: true, status: 201 })
    }) as any

    const result = await promoteDeployment("prj_1", "dpl_1")

    expect(result).toEqual({ ok: true, status: 201 })
    expect(calls[0].url).toContain("/v10/projects/prj_1/promote/dpl_1")
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].init.body).toBeUndefined()
  })

  it("returns ok: false with Vercel's error message when the promote request is rejected", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: "Deployment does not belong to this project" } }),
    }) as any

    const result = await promoteDeployment("prj_1", "dpl_wrong")
    expect(result).toEqual({ ok: false, status: 409, message: "Deployment does not belong to this project" })
  })
})

describe("getRuntimeLogs", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  function streamBodyOf(lines: string[]) {
    let i = 0
    return {
      getReader: () => ({
        read: async () => {
          if (i >= lines.length) return { done: true, value: undefined }
          const chunk = new TextEncoder().encode(lines[i] + "\n")
          i++
          return { done: false, value: chunk }
        },
        cancel: async () => {},
      }),
    }
  }

  it("parses newline-delimited JSON log lines and separates 5xx/error/fatal into errorLines", async () => {
    const lines = [
      JSON.stringify({ level: "info", message: "GET /", requestMethod: "GET", requestPath: "/", responseStatusCode: "200", source: "serverless", timestampInMs: 1 }),
      JSON.stringify({ level: "error", message: "TypeError: x is not a function", requestMethod: "GET", requestPath: "/menu", responseStatusCode: "500", source: "serverless", timestampInMs: 2 }),
    ]
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: streamBodyOf(lines) }) as any

    const result = await getRuntimeLogs("prj_1", "dpl_1")

    expect(result.lines).toHaveLength(2)
    expect(result.lines[0].responseStatusCode).toBe(200) // numeric, even though Vercel's example shows it as a string
    expect(result.errorLines).toHaveLength(1)
    expect(result.errorLines[0].requestPath).toBe("/menu")
    expect(result.truncated).toBe(false)
  })

  it("caps at maxLines and reports truncated: true instead of reading indefinitely", async () => {
    const lines = Array.from({ length: 10 }, (_, i) => JSON.stringify({ level: "info", message: `line ${i}`, responseStatusCode: "200" }))
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: streamBodyOf(lines) }) as any

    const result = await getRuntimeLogs("prj_1", "dpl_1", { maxLines: 3 })

    expect(result.lines.length).toBeLessThanOrEqual(3)
    expect(result.truncated).toBe(true)
  })

  it("skips malformed lines instead of throwing", async () => {
    const lines = ["not json at all", JSON.stringify({ level: "info", message: "ok", responseStatusCode: "200" })]
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: streamBodyOf(lines) }) as any

    const result = await getRuntimeLogs("prj_1", "dpl_1")
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].message).toBe("ok")
  })

  it("returns empty results (never throws) when there's no access token configured", async () => {
    const { getPlatformSettings } = await import("@/lib/settings")
    vi.mocked(getPlatformSettings).mockResolvedValueOnce({} as any)
    const result = await getRuntimeLogs("prj_1", "dpl_1")
    expect(result).toEqual({ lines: [], errorLines: [], truncated: false })
  })
})
