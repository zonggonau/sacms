import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Regression tests for the P0/P1 security fixes. Each asserts the *behaviour*
 * of the actual route handler with mocked auth + Prisma — so a future edit that
 * re-opens one of these holes fails CI.
 */

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {}, hashPassword: vi.fn(async () => "hashed") }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/plan-enforcement", () => ({ enforcePlanLimit: vi.fn(async () => ({ allowed: true })) }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db } from "@/lib/database"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const jsonReq = (body: unknown, method = "PATCH") =>
  new Request("https://api.test/x", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as any

beforeEach(() => vi.clearAllMocks())

// ── P0-4: admin cannot escalate to super_admin ──────────────────────────────
describe("P0-4  /api/admin/users/[userId] PATCH", () => {
  it("a plain admin PATCHing role:super_admin is forbidden", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as any)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "victim", role: "owner" } as any)

    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")
    const res = await PATCH(jsonReq({ role: "super_admin" }), ctx({ userId: "victim" }) as any)
    expect(res.status).toBe(403)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("a plain admin cannot change their own role", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as any)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "admin-1", role: "admin" } as any)

    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")
    const res = await PATCH(jsonReq({ role: "owner" }), ctx({ userId: "admin-1" }) as any)
    expect(res.status).toBe(403)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("an admin cannot modify a super_admin account", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as any)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "sa", role: "super_admin" } as any)

    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")
    const res = await PATCH(jsonReq({ name: "x" }), ctx({ userId: "sa" }) as any)
    expect(res.status).toBe(403)
  })

  it("a super_admin promoting another user to a normal role works", async () => {
    mockSession.mockResolvedValue({ user: { id: "sa-1", role: "super_admin" } } as any)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u", role: "user" } as any)
    vi.mocked(db.user.update).mockResolvedValue({ id: "u", role: "admin" } as any)

    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")
    const res = await PATCH(jsonReq({ role: "admin" }), ctx({ userId: "u" }) as any)
    expect(res.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "admin" }) }),
    )
  })
})

// ── P0-4: DELETE protects the last super_admin ──────────────────────────────
describe("P0-4  /api/admin/users/[userId] DELETE", () => {
  it("a super_admin cannot delete the last super_admin", async () => {
    mockSession.mockResolvedValue({ user: { id: "sa-1", role: "super_admin" } } as any)
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "sa-2", email: "b@x.co", role: "super_admin" } as any)
    vi.mocked(db.user.count).mockResolvedValue(1)

    const { DELETE } = await import("@/app/api/admin/users/[userId]/route")
    const res = await DELETE(new Request("https://api.test/x", { method: "DELETE" }) as any, ctx({ userId: "sa-2" }) as any)
    expect(res.status).toBe(400)
  })
})

// ── P0-5: license/activate requires auth ────────────────────────────────────
describe("P0-5  /api/tenant/[tenant]/license/activate", () => {
  it("rejects an unauthenticated POST", async () => {
    mockSession.mockResolvedValue(null as any)
    const { POST } = await import("@/app/api/tenant/[tenant]/license/activate/route")
    const res = await POST(jsonReq({ licenseKey: "x" }, "POST"), ctx({ tenant: "acme" }) as any)
    expect(res.status).toBe(401)
  })

  it("rejects a member who is not an owner", async () => {
    mockSession.mockResolvedValue({ user: { id: "u", role: "user" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", role: "editor", userId: "u", tenant: { slug: "acme", name: "Acme" }, isGlobal: false } as any)
    const { POST } = await import("@/app/api/tenant/[tenant]/license/activate/route")
    const res = await POST(jsonReq({ licenseKey: "x" }, "POST"), ctx({ tenant: "acme" }) as any)
    expect(res.status).toBe(403)
  })
})

// ── P0-6: Vercel webhook needs a valid signature ────────────────────────────
describe("P0-6  /api/webhooks/vercel", () => {
  it("rejects a POST with no signature", async () => {
    const { POST } = await import("@/app/api/webhooks/vercel/route")
    const res = await POST(
      new Request("https://api.test/x", {
        method: "POST",
        body: JSON.stringify({ type: "deployment.succeeded", payload: { deployment: { id: "d", url: "x" } } }),
      }) as any,
    )
    expect(res.status).toBe(401)
  })
})

// ── P0-8: content-version routes are tenant-scoped ──────────────────────────
describe("P0-8  content version restore", () => {
  it("404s when the entry is not in the caller's tenant", async () => {
    mockSession.mockResolvedValue({ user: { id: "u", role: "user" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "tenant-A", role: "editor", userId: "u", tenant: { slug: "a", name: "A" }, isGlobal: false } as any)
    // findEntryInTenant → contentEntry.findFirst returns null (belongs to tenant-B)
    vi.mocked(db.contentEntry.findFirst).mockResolvedValue(null as any)

    const { POST } = await import(
      "@/app/api/tenant/[tenant]/content-types/slug/[slug]/entries/[entryId]/versions/restore/route"
    )
    const res = await POST(
      jsonReq({ versionId: "v-from-tenant-B" }, "POST"),
      ctx({ tenant: "a", slug: "posts", entryId: "entry-from-tenant-B" }) as any,
    )
    expect(res.status).toBe(404)
  })
})

// ── P1: SSRF guard (safe-url) ───────────────────────────────────────────────
describe("P1  assertPublicUrl / resolveWithinBase", () => {
  it("blocks cloud-metadata, loopback, and private ranges", async () => {
    const { assertPublicUrl, SsrfError } = await import("@/lib/safe-url")
    for (const u of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "https://localhost/",
      "file:///etc/passwd",
    ]) {
      await expect(assertPublicUrl(u, { allowHttp: true })).rejects.toBeInstanceOf(SsrfError)
    }
  })

  it("resolveWithinBase blocks path traversal", async () => {
    const path = await import("path")
    const { resolveWithinBase, SsrfError } = await import("@/lib/safe-url")
    const base = path.join(process.cwd(), "public", "upload", "acme")
    expect(() => resolveWithinBase(base, "..", "..", ".env")).toThrow(SsrfError)
    expect(resolveWithinBase(base, "2026", "x.png")).toBe(path.join(base, "2026", "x.png"))
  })
})

// ── P1: trusted-host rejects an unknown X-Forwarded-Host ────────────────────
describe("P1  resolveTrustedOrigin", () => {
  it("falls back to the configured origin for an unknown host", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "sacms.cloud")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sacms.cloud")
    const { resolveTrustedOriginSync } = await import("@/lib/trusted-host")
    const evil = { headers: { get: (h: string) => (h === "x-forwarded-host" ? "evil.example.com" : null) } }
    expect(resolveTrustedOriginSync(evil)).toBe("https://sacms.cloud")

    const ok = { headers: { get: (h: string) => (h === "x-forwarded-host" ? "cms.sacms.cloud" : h === "x-forwarded-proto" ? "https" : null) } }
    expect(resolveTrustedOriginSync(ok)).toBe("https://cms.sacms.cloud")
    vi.unstubAllEnvs()
  })
})

// ── P1: staff member role cannot exceed the caller's own ────────────────────
describe("P1  /api/tenant/[tenant]/members/[memberId] PATCH", () => {
  it("an admin cannot promote a member to owner", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "user" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", role: "admin", userId: "admin-1", tenant: { slug: "acme", name: "A" }, isGlobal: false } as any)
    vi.mocked(db.tenantMember.findUnique as any).mockResolvedValue({ id: "m", tenantId: "t1", role: "editor", userId: "other" })

    const { PATCH } = await import("@/app/api/tenant/[tenant]/members/[memberId]/route")
    const res = await PATCH(jsonReq({ role: "owner" }), ctx({ tenant: "acme", memberId: "m" }) as any)
    expect(res.status).toBe(403)
  })

  it("rejects an unknown role string (not in STAFF_ROLES)", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "user" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", role: "owner", userId: "admin-1", tenant: { slug: "acme", name: "A" }, isGlobal: false } as any)
    vi.mocked(db.tenantMember.findUnique as any).mockResolvedValue({ id: "m", tenantId: "t1", role: "editor", userId: "other" })

    const { PATCH } = await import("@/app/api/tenant/[tenant]/members/[memberId]/route")
    const res = await PATCH(jsonReq({ role: "god-mode" }), ctx({ tenant: "acme", memberId: "m" }) as any)
    expect(res.status).toBe(400) // zod enum rejection
  })
})
