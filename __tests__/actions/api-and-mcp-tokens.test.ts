import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "user-1", role: "user" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn(async () => ({ tenantId: "tenant-1", role: "owner" })) }))

const { db } = vi.hoisted(() => ({
  db: {
    apiToken: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import { createApiTokenAction, deleteApiTokenAction, getApiTokensAction } from "@/actions/api-keys"
import { createMcpTokenAction, deleteMcpTokenAction, getMcpTokensAction } from "@/actions/mcp-tokens"

const userKeyWhere = { tenantId: "tenant-1", type: { in: ["read-only", "full-access"] }, NOT: { name: { startsWith: "Template preview " } } }
const row = (over: Record<string, unknown>) => ({
  id: "row", tenantId: "tenant-1", name: "Key", description: null, token: "hash", type: "read-only", permissions: ["read"],
  lastUsedAt: null, expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date(), createdBy: "user-1", ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.apiToken.create.mockImplementation(async ({ data }) => row({ id: "new", ...data }))
  db.apiToken.findMany.mockResolvedValue([])
})

describe("API keys", () => {
  it("creates another key even when the workspace already has one", async () => {
    db.apiToken.findFirst.mockResolvedValue(row({ id: "existing" }))
    const res = await createApiTokenAction("acme", { name: "Mobile app", type: "read-only", permissions: ["read"] })
    expect(res).toMatchObject({ token: { id: "new", name: "Mobile app" }, plainToken: expect.stringMatching(/^cf_[0-9a-f]{64}$/) })
    expect(db.apiToken.create).toHaveBeenCalledTimes(1)
  })

  it("lists only hand-managed keys, never the hosting deploy token or Sandbox preview tokens", async () => {
    await getApiTokensAction("acme")
    expect(db.apiToken.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: userKeyWhere }))
  })

  it("refuses to delete a token that is not a hand-managed key", async () => {
    db.apiToken.findFirst.mockResolvedValue(null)
    expect(await deleteApiTokenAction("acme", "service-token")).toEqual({ error: "API token not found" })
    expect(db.apiToken.findFirst).toHaveBeenCalledWith({ where: { id: "service-token", ...userKeyWhere } })
    expect(db.apiToken.delete).not.toHaveBeenCalled()
  })

  it("deletes one key and leaves the others alone", async () => {
    db.apiToken.findFirst.mockResolvedValue(row({ id: "key-a" }))
    expect(await deleteApiTokenAction("acme", "key-a")).toEqual({ success: true })
    expect(db.apiToken.delete).toHaveBeenCalledWith({ where: { id: "key-a" } })
  })
})

describe("workspace MCP tokens", () => {
  it("creates another MCP token even when one already exists", async () => {
    db.apiToken.findFirst.mockResolvedValue(row({ id: "existing", type: "mcp" }))
    const res = await createMcpTokenAction("acme", { name: "Claude Desktop" })
    expect(res).toMatchObject({ success: true, token: { id: "new", name: "Claude Desktop" }, plainToken: expect.stringMatching(/^mcp_[0-9a-f]{48}$/) })
  })

  it("lists only type mcp rows, not keys whose name merely mentions MCP", async () => {
    await getMcpTokensAction("acme")
    expect(db.apiToken.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-1", type: "mcp" } }))
  })

  it("only deletes type mcp rows from the MCP page", async () => {
    db.apiToken.findFirst.mockResolvedValue(null)
    expect(await deleteMcpTokenAction("acme", "rest-key")).toEqual({ error: "Token MCP tidak ditemukan" })
    expect(db.apiToken.findFirst).toHaveBeenCalledWith({ where: { id: "rest-key", tenantId: "tenant-1", type: "mcp" } })
    expect(db.apiToken.delete).not.toHaveBeenCalled()
  })
})
