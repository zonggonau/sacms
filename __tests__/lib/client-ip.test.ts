import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"

// getClientIp reads TRUSTED_PROXY_HOPS at module load, so re-import per scenario.
async function loadWithHops(hops?: string) {
  vi.resetModules()
  if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS
  else process.env.TRUSTED_PROXY_HOPS = hops
  return import("@/lib/client-ip")
}

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com", { headers })
}

describe("client-ip", () => {
  const original = process.env.TRUSTED_PROXY_HOPS
  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS
    else process.env.TRUSTED_PROXY_HOPS = original
  })

  it("prefers x-real-ip when present and plausible", async () => {
    const { getClientIp } = await loadWithHops("1")
    expect(getClientIp(req({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("203.0.113.5")
  })

  it("with 1 trusted hop, returns the entry before the last (the real client)", async () => {
    const { getClientIp } = await loadWithHops("1")
    // client -> caddy: XFF becomes "client, caddy-observed-client"? Actually Caddy appends its
    // own upstream. Chain "spoofed, realClient" -> real client is second-from-last minus hops.
    expect(getClientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("9.9.9.9")
  })

  it("ignores an attacker-supplied left-most entry when a proxy appended the real IP", async () => {
    const { getClientIp } = await loadWithHops("1")
    // Attacker sends XFF: "1.2.3.4"; Caddy appends real "203.0.113.9" -> "1.2.3.4, 203.0.113.9"
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("1.2.3.4")
  })

  it("with 0 trusted hops, trusts the right-most entry", async () => {
    const { getClientIp } = await loadWithHops("0")
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9")
  })

  it("with 2 trusted hops on a 3-entry chain, returns the first", async () => {
    const { getClientIp } = await loadWithHops("2")
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.1")
  })

  it("clamps to the left-most entry when the chain is shorter than the hop count", async () => {
    const { getClientIp } = await loadWithHops("5")
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1")
  })

  it("falls back to loopback when no headers are present", async () => {
    const { getClientIp } = await loadWithHops("1")
    expect(getClientIp(req({}))).toBe("127.0.0.1")
  })

  it("rejects header-injection garbage and falls back", async () => {
    const { getClientIp } = await loadWithHops("0")
    expect(getClientIp(req({ "x-forwarded-for": "not an ip; rm -rf" }))).toBe("127.0.0.1")
  })

  it("isLoopbackIp recognises loopback forms", async () => {
    const { isLoopbackIp } = await loadWithHops("1")
    expect(isLoopbackIp("127.0.0.1")).toBe(true)
    expect(isLoopbackIp("::1")).toBe(true)
    expect(isLoopbackIp("203.0.113.1")).toBe(false)
  })
})
