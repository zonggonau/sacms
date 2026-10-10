import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"

// This route's `resolveToken`/`hasScope` gate EVERY one of its ~25 MCP tools
// (schema CRUD, content CRUD, webhooks, members) — a bug here would silently
// bypass auth or scope checks for all of them. The tools themselves are thin
// Prisma CRUD wrappers already exercised by other suites; this file targets
// the shared gate instead of re-testing each tool body (AUD-013).

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
}))

vi.mock("@/lib/vercel-client", () => ({
  deployToVercel: vi.fn(),
  getDeploymentStatus: vi.fn(),
  addDomainToProject: vi.fn(),
  getDomainConfig: vi.fn(),
  upsertVercelProjectEnv: vi.fn(),
  disableVercelDeploymentProtection: vi.fn(),
}))

vi.mock("@/lib/field-types", () => ({
  FIELD_TYPES: [],
  FIELD_CATEGORIES: [],
}))

vi.mock("@/lib/member-auth", () => ({
  hashMemberPassword: vi.fn(),
}))

vi.mock("@/lib/safe-url", () => ({
  safeFetch: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99, limit: 100, resetAt: Date.now() + 60000 }),
  getTenantRateLimit: vi.fn().mockReturnValue({ limit: 100, windowSeconds: 60 }),
}))

vi.mock("@/lib/database", () => ({
  db: {
    apiToken: { findFirst: vi.fn(), updateMany: vi.fn().mockReturnValue({ catch: vi.fn() }) },
    subscription: { findFirst: vi.fn() },
  },
  getTenantDb: vi.fn(),
}))

const { resolveToken, hasScope, authenticateRequest } = await import("../../src/app/api/mcp/[[...transport]]/route")

function makeTenant(overrides: Partial<{ status: string; hostingStatus: string | null }> = {}) {
  return {
    id: "tenant-1",
    slug: "acme",
    name: "Acme",
    plan: "pro",
    status: "active",
    hostingStatus: null,
    ...overrides,
  }
}

describe("MCP route — resolveToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.apiToken.updateMany).mockReturnValue({ catch: vi.fn() } as any)
  })

  it("returns null for an empty or whitespace-only token", async () => {
    expect(await resolveToken("")).toBeNull()
    expect(await resolveToken("   ")).toBeNull()
  })

  it("returns null when no matching mcp ApiToken row exists", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue(null)
    expect(await resolveToken("sacms_bogus")).toBeNull()
  })

  it("marks the tenant unpaid when there is no active/paid/trialing subscription and no active hosting", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read", "write"],
      tenant: makeTenant({ status: "trial" }),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null)

    const auth = await resolveToken("sacms_valid")
    expect(auth).not.toBeNull()
    expect(auth!.isPaid).toBe(false)
    expect(auth!.paymentError).toMatch(/Payment Required/)
  })

  it("marks the tenant paid when an active subscription exists", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read", "write"],
      tenant: makeTenant({ status: "active" }),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ id: "sub-1", status: "active" } as any)

    const auth = await resolveToken("sacms_valid")
    expect(auth!.isPaid).toBe(true)
    expect(auth!.paymentError).toBeUndefined()
  })

  it("treats hostingStatus 'active' as paid even without a Subscription row", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read"],
      tenant: makeTenant({ status: "inactive", hostingStatus: "active" }),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue(null)

    const auth = await resolveToken("sacms_valid")
    expect(auth!.isPaid).toBe(true)
  })

  it("uses the token's own permissions array when present, instead of the read/write/delete default", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read"],
      tenant: makeTenant(),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ id: "sub-1", status: "active" } as any)

    const auth = await resolveToken("sacms_valid")
    expect(auth!.permissions).toEqual(["read"])
  })

  it("falls back to the full legacy read/write/delete permission set when the token has no permissions array", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: null,
      tenant: makeTenant(),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ id: "sub-1", status: "active" } as any)

    const auth = await resolveToken("sacms_valid")
    expect(auth!.permissions).toEqual(["read", "write", "delete"])
  })
})

describe("MCP route — hasScope", () => {
  const base = { tenantId: "t1", tenantSlug: "acme", tenantName: "Acme", plan: "pro", isPaid: true }

  it("grants every scope to a super admin regardless of its permissions array", () => {
    const auth = { ...base, permissions: [], isSuperAdmin: true }
    expect(hasScope(auth, "write")).toBe(true)
    expect(hasScope(auth, "delete")).toBe(true)
  })

  it("grants every scope when the token has full_access", () => {
    const auth = { ...base, permissions: ["full_access"] }
    expect(hasScope(auth, "schema")).toBe(true)
    expect(hasScope(auth, "webhooks")).toBe(true)
  })

  it("grants only the scopes explicitly listed on the token", () => {
    const auth = { ...base, permissions: ["read"] }
    expect(hasScope(auth, "read")).toBe(true)
    expect(hasScope(auth, "write")).toBe(false)
    expect(hasScope(auth, "delete")).toBe(false)
  })

  it("denies a scope-less token everything", () => {
    const auth = { ...base, permissions: [] }
    expect(hasScope(auth, "read")).toBe(false)
  })
})

describe("MCP route — authenticateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.apiToken.updateMany).mockReturnValue({ catch: vi.fn() } as any)
  })

  it("reads the token from the Authorization: Bearer header", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read"],
      tenant: makeTenant(),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ id: "sub-1", status: "active" } as any)

    const req = new Request("https://sacms.cloud/api/mcp", {
      headers: { authorization: "Bearer sacms_valid" },
    })
    const auth = await authenticateRequest(req)
    expect(auth).not.toBeNull()
    expect(auth!.tenantSlug).toBe("acme")
  })

  it("falls back to a ?token= query param when there is no Authorization header", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "tenant-1",
      permissions: ["read"],
      tenant: makeTenant(),
    } as any)
    vi.mocked(db.subscription.findFirst).mockResolvedValue({ id: "sub-1", status: "active" } as any)

    const req = new Request("https://sacms.cloud/api/mcp?token=sacms_valid")
    const auth = await authenticateRequest(req)
    expect(auth).not.toBeNull()
  })

  it("returns null when neither an Authorization header nor a token query param is present", async () => {
    const req = new Request("https://sacms.cloud/api/mcp")
    const auth = await authenticateRequest(req)
    expect(auth).toBeNull()
    expect(db.apiToken.findFirst).not.toHaveBeenCalled()
  })
})
