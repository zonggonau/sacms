import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// getProjectPrimaryDomain is the fix for a real bug: deploy_to_sacms (and
// the dashboard deploy button, and AI Site Publish — every caller of
// deployToVercel) used to hand back the per-deployment URL whenever a
// fresh deploy's own creation response hadn't been assigned its alias
// yet, which Vercel's "Vercel Authentication" protection gates by default
// and which doesn't even resolve until the build finishes. This tests the
// project-domain lookup directly: custom domain wins over the default
// <project>.vercel.app alias whenever both are attached.

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { getProjectPrimaryDomain } = await import("@/lib/vercel-client")

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
        alias: [{ domain: "sacms-abc123.vercel.app" }, { domain: "bangparjo.shop" }],
      }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://bangparjo.shop")
  })

  it("falls back to the default .vercel.app alias when no custom domain is attached", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ alias: [{ domain: "sacms-abc123.vercel.app" }] }),
    }) as any

    const url = await getProjectPrimaryDomain("prj_1")
    expect(url).toBe("https://sacms-abc123.vercel.app")
  })

  it("returns null when the project has no alias at all", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ alias: [] }) }) as any
    expect(await getProjectPrimaryDomain("prj_1")).toBeNull()
  })

  it("returns null (never throws) when the Vercel API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as any
    expect(await getProjectPrimaryDomain("prj_1")).toBeNull()
  })
})
