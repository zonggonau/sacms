import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// getProjectPrimaryDomain is the fix for a real bug: deploy_to_sacms (and
// the dashboard deploy button, and AI Site Publish — every caller of
// deployToVercel) used to hand back the per-deployment URL whenever a
// fresh deploy's own creation response hadn't been assigned its alias
// yet, which Vercel's "Vercel Authentication" protection gates by default
// and which doesn't even resolve until the build finishes. This tests the
// project-domain lookup directly: custom domain wins over the default
// <project>.vercel.app alias whenever both are attached.
//
// Reads GET /v9/projects/{id}/domains, NOT the project's own `alias`
// field — confirmed live that `alias` stays `[]` for a domain attached via
// addDomainToProject/ensureBrandedSubdomain even once Vercel has fully
// verified it, which silently defeated the hosting-status.ts self-heal.

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { getProjectPrimaryDomain, ensureBrandedSubdomain, ensureDemoSubdomain } = await import("@/lib/vercel-client")

describe("getProjectPrimaryDomain", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("prefers a real custom domain over the default .vercel.app alias", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domains: [
          { name: "sacms-abc123.vercel.app", verified: true },
          { name: "bangparjo.shop", verified: true },
        ],
      }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://bangparjo.shop")
  })

  it("falls back to the default .vercel.app alias when no custom domain is attached", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ domains: [{ name: "sacms-abc123.vercel.app", verified: true }] }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://sacms-abc123.vercel.app")
  })

  it("returns null when the project has no verified domain at all", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ domains: [] }) }) as any
    expect(await getProjectPrimaryDomain("prj_1")).toBeNull()
  })

  it("ignores an unverified domain and falls back to a verified one", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domains: [
          { name: "sacms-abc123.vercel.app", verified: true },
          { name: "pending-custom.example.com", verified: false },
        ],
      }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://sacms-abc123.vercel.app")
  })

  it("returns null (never throws) when the Vercel API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any
    expect(await getProjectPrimaryDomain("prj_1")).toBeNull()
  })

  it("prefers the SaCMS-branded subdomain over the default .vercel.app alias when no real custom domain is attached", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domains: [
          { name: "sacms-abc123.vercel.app", verified: true },
          { name: "acme.sites.sacms.cloud", verified: true },
        ],
      }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://acme.sites.sacms.cloud")
  })

  it("still prefers a real external custom domain over the SaCMS-branded subdomain when both are attached", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        domains: [
          { name: "sacms-abc123.vercel.app", verified: true },
          { name: "acme.sites.sacms.cloud", verified: true },
          { name: "bangparjo.shop", verified: true },
        ],
      }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://bangparjo.shop")
  })
})

describe("ensureBrandedSubdomain", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("attaches <tenantSlug>.sites.sacms.cloud and returns it on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "acme.sites.sacms.cloud", verified: true }),
    }) as any

    const domain = await ensureBrandedSubdomain("prj_1", "Acme")
    expect(domain).toBe("acme.sites.sacms.cloud")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v10/projects/prj_1/domains"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "acme.sites.sacms.cloud" }) }),
    )
  })

  it("treats an already-attached domain (409) as success, not a failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: "Domain already in use" } }),
    }) as any

    expect(await ensureBrandedSubdomain("prj_1", "acme")).toBe("acme.sites.sacms.cloud")
  })

  it("returns null (never throws) when Vercel genuinely rejects the attach — e.g. the wildcard DNS isn't live yet", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid domain" } }),
    }) as any

    expect(await ensureBrandedSubdomain("prj_1", "acme")).toBeNull()
  })
})

describe("ensureDemoSubdomain", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("attaches <templateSlug>.demo.sacms.cloud — a different root from ensureBrandedSubdomain's sites.", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "modern-dark.demo.sacms.cloud", verified: true }),
    }) as any

    const domain = await ensureDemoSubdomain("prj_1", "Modern-Dark")
    expect(domain).toBe("modern-dark.demo.sacms.cloud")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v10/projects/prj_1/domains"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "modern-dark.demo.sacms.cloud" }) }),
    )
  })

  it("returns null (never throws) when Vercel rejects the attach", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid domain" } }),
    }) as any

    expect(await ensureDemoSubdomain("prj_1", "modern-dark")).toBeNull()
  })
})
