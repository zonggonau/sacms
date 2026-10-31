import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"

// Mirrors mcp-route-auth.test.ts's scope for the main server: this targets
// only the shared auth gate (resolveGlobalSchemaToken), not the tool bodies
// — those are thin Prisma CRUD wrappers over SchemaTemplate.

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99, limit: 100, resetAt: Date.now() + 60000 }),
}))

vi.mock("@/lib/settings", () => ({
  getGlobalWorkspaceId: vi.fn().mockResolvedValue("global-tenant-1"),
}))

vi.mock("@/lib/database", () => ({
  db: {
    apiToken: { findFirst: vi.fn(), updateMany: vi.fn().mockReturnValue({ catch: vi.fn() }) },
  },
}))

const { resolveGlobalSchemaToken } = await import("../../src/app/api/mcp/global-schema/[[...transport]]/route")

describe("Global Schema Template MCP route — resolveGlobalSchemaToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.apiToken.updateMany).mockReturnValue({ catch: vi.fn() } as any)
  })

  it("returns null for an empty or whitespace-only token", async () => {
    expect(await resolveGlobalSchemaToken("")).toBeNull()
    expect(await resolveGlobalSchemaToken("   ")).toBeNull()
  })

  it("returns null when no matching mcp-global-schema ApiToken row exists", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue(null)
    const auth = await resolveGlobalSchemaToken("mcpglobal_bogus")
    expect(auth).toBeNull()
  })

  it("only looks up type mcp-global-schema, never the regular mcp token type", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue(null)
    await resolveGlobalSchemaToken("mcpglobal_whatever")
    expect(db.apiToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "mcp-global-schema" }) }),
    )
  })

  it("authorizes when the token's tenant id matches the configured Global workspace id", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "global-tenant-1",
      tenant: { id: "global-tenant-1", slug: "sacms-global" },
    } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(auth).toEqual({ tenantId: "global-tenant-1" })
  })

  it("authorizes when the Global setting holds the tenant's SLUG instead of its id (the real-world case for this tenant)", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "cuid-abc-123",
      tenant: { id: "cuid-abc-123", slug: "global-tenant-1" },
    } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(auth).toEqual({ tenantId: "cuid-abc-123" })
  })

  it("rejects a token whose tenant matches neither the configured id nor slug (defense in depth)", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({
      id: "tok-1",
      tenantId: "some-other-tenant",
      tenant: { id: "some-other-tenant", slug: "some-other-slug" },
    } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(auth).toBeNull()
  })
})
