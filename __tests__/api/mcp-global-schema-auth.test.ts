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

  it("authorizes whenever a matching token row exists, with no tenant involved", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1" } as any)
    const auth = await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(auth).toEqual({ authenticated: true })
  })

  it("bumps lastUsedAt on a successful match", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue({ id: "tok-1" } as any)
    await resolveGlobalSchemaToken("mcpglobal_valid")
    expect(db.apiToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "mcp-global-schema" }), data: { lastUsedAt: expect.any(Date) } }),
    )
  })
})
