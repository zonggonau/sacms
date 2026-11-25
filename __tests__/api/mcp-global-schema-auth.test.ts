import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"

// Mirrors mcp-route-auth.test.ts's scope for the main server: this targets
// only the shared auth gate (resolveGlobalSchemaToken), not the tool bodies
// — those are thin Prisma CRUD wrappers over SchemaTemplate.
//
// This token type carries no tenant at all (ApiToken.tenantId: null) since
// the former "SaCMS Global" workspace it used to be minted under was
// retired — the Website/Schema Template catalog it authenticates against
// has no tenant owner either. Auth here is just "does a live
// mcp-global-schema token with this hash exist".

vi.mock("mcp-handler", () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99, limit: 100, resetAt: Date.now() + 60000 }),
}))

vi.mock("@/lib/database", () => ({
  db: {
    apiToken: { findFirst: vi.fn(), updateMany: vi.fn().mockReturnValue({ catch: vi.fn() }) },
  },
}))

const { resolveGlobalSchemaToken } = await import("../../src/lib/mcp/global/context")

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

  it("authorizes a matching token row, with no tenant involved, carrying its identity and scopes", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1", name: "ChatGPT", permissions: ["read", "demo"], expiresAt: null } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    // Identity is recorded on background operations and version history.
    expect(auth).toEqual({ authenticated: true, tokenId: "tok-1", tokenName: "ChatGPT", scopes: ["read", "demo"] })
  })

  it("gives a legacy token (permissions: ['schema-template'], minted before scopes) full access so existing integrations keep working", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1", name: "Old", permissions: ["schema-template"], expiresAt: null } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(auth?.scopes).toEqual(["read", "demo", "write", "publish"])
  })

  it("rejects an expired token (expiresAt used to be stored but never checked)", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1", name: "Old", permissions: ["read"], expiresAt: new Date(Date.now() - 1000) } as any)
    expect(await resolveGlobalSchemaToken("mcpglobal_valid")).toBeNull()
  })

  it("rejects a token with no recognized scope at all", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1", name: "Odd", permissions: ["something-else"], expiresAt: null } as any)
    expect(await resolveGlobalSchemaToken("mcpglobal_valid")).toBeNull()
  })

  it("bumps lastUsedAt on a successful match", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1", name: "ChatGPT", permissions: ["read"], expiresAt: null } as any)
    await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(db.apiToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "mcp-global-schema" }), data: { lastUsedAt: expect.any(Date) } }),
    )
  })
})
