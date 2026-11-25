import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))

const { db, tx } = vi.hoisted(() => {
  const tx = {
    apiToken: { create: vi.fn(), deleteMany: vi.fn() },
  }
  const db = {
    apiToken: { findFirst: vi.fn() },
    oAuthToken: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { db, tx }
})
vi.mock("@/lib/database", () => ({ db }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { rotateMcpTokenAction } from "@/actions/mcp-tokens"

const oldToken = {
  id: "old-1", tenantId: "tenant-1", name: "ChatGPT", description: "MCP Server Integration Token",
  type: "mcp", permissions: ["read", "write"], token: "hash-old",
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "user" } } as any)
  vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "owner" } as any)
  db.apiToken.findFirst.mockResolvedValue(oldToken)
  tx.apiToken.create.mockImplementation(async ({ data }: any) => ({
    id: "new-1", createdAt: new Date("2026-11-26T00:00:00Z"), ...data,
  }))
  tx.apiToken.deleteMany.mockResolvedValue({ count: 1 })
})

describe("rotateMcpTokenAction", () => {
  it("issues a new secret with the same name, scopes, and description, and returns it once", async () => {
    const res = (await rotateMcpTokenAction("acme", "old-1")) as any
    expect(res.success).toBe(true)
    expect(res.plainToken).toMatch(/^mcp_[0-9a-f]{48}$/)
    expect(res.token).toMatchObject({ id: "new-1", name: "ChatGPT", type: "mcp" })
    expect(tx.apiToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        name: "ChatGPT",
        description: "MCP Server Integration Token",
        permissions: ["read", "write"],
        type: "mcp",
      }),
    })
  })

  it("stores only the hash of the new secret", async () => {
    const res = (await rotateMcpTokenAction("acme", "old-1")) as any
    const hashed = createHash("sha256").update(res.plainToken).digest("hex")
    expect(tx.apiToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ token: hashed }) })
  })

  it("revokes the old token inside the same transaction as the new one", async () => {
    await rotateMcpTokenAction("acme", "old-1")
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.apiToken.deleteMany).toHaveBeenCalledWith({ where: { id: "old-1", tenantId: "tenant-1", type: "mcp" } })
  })

  it("does not touch anything when the token is not one of this workspace's MCP tokens", async () => {
    db.apiToken.findFirst.mockResolvedValue(null)
    expect(await rotateMcpTokenAction("acme", "someone-elses")).toEqual({ error: "Token MCP tidak ditemukan" })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("is refused for members who cannot manage tokens", async () => {
    vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "member" } as any)
    const res = (await rotateMcpTokenAction("acme", "old-1")) as any
    expect(res.error).toMatch(/Hanya Admin dan Owner/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
