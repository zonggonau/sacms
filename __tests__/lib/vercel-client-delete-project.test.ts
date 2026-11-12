import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// deleteVercelProject backs the Hosting tab's new "Hapus Project" button —
// an irreversible wipe of a tenant's Vercel project, used when they want to
// tear down and redeploy clean later.

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ vercelAccessToken: "test-token" }),
}))
vi.mock("@/lib/dev-mode", () => ({
  isMockAllowed: vi.fn().mockReturnValue(false),
  requireCredentialOutsideMock: vi.fn(),
}))

const { deleteVercelProject } = await import("@/lib/vercel-client")

describe("deleteVercelProject", () => {
  const originalFetch = global.fetch
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("resolves ok on a successful delete", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any
    await expect(deleteVercelProject("prj_1")).resolves.toEqual({ ok: true })
  })

  it("treats a 404 (already deleted) as success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as any
    await expect(deleteVercelProject("prj_1")).resolves.toEqual({ ok: true })
  })

  it("surfaces a clear error on a genuine failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Forbidden" } }),
    }) as any
    await expect(deleteVercelProject("prj_1")).resolves.toEqual({ ok: false, error: "Forbidden" })
  })
})
