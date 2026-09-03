import { describe, it, expect, vi } from "vitest"
import path from "path"

// Keep DNS lookups off the network: public hostnames resolve to a public IP,
// nothing else is called (literal-IP and scheme cases never hit DNS).
vi.mock("dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === "example.com") return [{ address: "93.184.216.34", family: 4 }]
    throw new Error("ENOTFOUND")
  }),
}))

const { assertPublicUrl, resolveWithinBase, SsrfError } = await import("@/lib/safe-url")

describe("assertPublicUrl", () => {
  it("rejects private / loopback / link-local literals", async () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://[::1]/",
      "https://localhost/x",
      "http://0.0.0.0/",
    ]) {
      await expect(assertPublicUrl(u, { allowHttp: true })).rejects.toBeInstanceOf(SsrfError)
    }
  })

  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicUrl("gopher://x/")).rejects.toBeInstanceOf(SsrfError)
  })

  it("rejects http when allowHttp is not set", async () => {
    await expect(assertPublicUrl("http://example.com/")).rejects.toBeInstanceOf(SsrfError)
  })

  it("allows a public https URL", async () => {
    const u = await assertPublicUrl("https://example.com/image.png")
    expect(u.hostname).toBe("example.com")
  })
})

describe("resolveWithinBase", () => {
  const base = path.join(process.cwd(), "public", "upload", "acme")

  it("resolves a normal nested path", () => {
    const p = resolveWithinBase(base, "2026", "pic.png")
    expect(p).toBe(path.join(base, "2026", "pic.png"))
  })

  it("throws on traversal", () => {
    expect(() => resolveWithinBase(base, "..", "..", "..", ".env")).toThrow(SsrfError)
    expect(() => resolveWithinBase(base, "../other-tenant/secret.png")).toThrow(SsrfError)
  })

  it("strips leading slashes rather than treating them as absolute", () => {
    const p = resolveWithinBase(base, "/etc/passwd")
    expect(p).toBe(path.join(base, "etc", "passwd"))
  })
})
