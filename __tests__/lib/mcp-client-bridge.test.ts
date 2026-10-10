import { describe, it, expect, vi, beforeEach } from "vitest"
import { getTenantDb } from "@/lib/database"
import { hashMemberPassword } from "@/lib/member-auth"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"

// McpClientBridge is how the AI Website Builder (an LLM-driven agent) talks
// to the CMS in-process — executeTool() is a string -> method dispatcher the
// model's own tool-call output feeds directly, and every other method is
// scoped to the tenantId/tenantSlug fixed at construction time. Zero
// coverage existed before this (AUD-013); tests focus on the dispatcher's
// closed routing (no dynamic `this[toolName]()` injection) and representative
// tenant-scoping/not-found paths rather than re-deriving every CRUD method.

vi.mock("@/lib/webhooks", () => ({ triggerWebhooks: vi.fn() }))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(), AuditAction: {} }))
vi.mock("@/lib/field-types", () => ({ FIELD_TYPES: [{ type: "text", category: "Basic" }] }))
vi.mock("@/lib/member-auth", () => ({ hashMemberPassword: vi.fn().mockResolvedValue("hashed:dummy") }))

vi.mock("@/lib/database", () => {
  const mockTenantDb = {
    contentType: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    singleType: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    component: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    schemaField: { deleteMany: vi.fn(), createMany: vi.fn() },
    contentEntry: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    member: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    tenantLocale: { findFirst: vi.fn() },
  }
  return {
    db: { webhook: { findMany: vi.fn(), findFirst: vi.fn() } },
    getTenantDb: vi.fn().mockResolvedValue(mockTenantDb),
  }
})

async function tenantDb() {
  return (await getTenantDb("acme")) as any
}

describe("McpClientBridge.executeTool", () => {
  let bridge: McpClientBridge

  beforeEach(async () => {
    vi.clearAllMocks()
    bridge = new McpClientBridge("tenant-1", "acme", "user-1")
    const db = await tenantDb()
    db.contentType.findFirst.mockResolvedValue({ id: "ct-1", slug: "articles", name: "Articles", description: null, schemaFields: [], _count: { entries: 0 } })
  })

  it("routes a known tool name to its corresponding method with the right args", async () => {
    const result = await bridge.executeTool("get_content_type", { slug: "articles" })
    expect(result).toMatchObject({ id: "ct-1", slug: "articles", name: "Articles" })
  })

  it("accepts either `slug` or `id` for tools documented to take either", async () => {
    await bridge.executeTool("get_content_type", { id: "ct-1" })
    const db = await tenantDb()
    expect(db.contentType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ slug: "ct-1", tenantId: "tenant-1" }, { id: "ct-1", tenantId: "tenant-1" }] } })
    )
  })

  it("rejects an unimplemented/unknown tool name instead of attempting dynamic method dispatch", async () => {
    await expect(bridge.executeTool("drop_database", {})).rejects.toThrow(/not implemented/)
    // Confirms the dispatcher is a closed switch, not `this[toolName](args)` —
    // an unrecognized name must never reach an arbitrary method call.
  })
})

describe("McpClientBridge — tenant scoping & not-found handling", () => {
  let bridge: McpClientBridge

  beforeEach(() => {
    vi.clearAllMocks()
    bridge = new McpClientBridge("tenant-1", "acme", "user-1")
  })

  it("createContentType refuses to create a second Content Type with the same slug in the same tenant", async () => {
    const db = await tenantDb()
    db.contentType.findFirst.mockResolvedValue({ id: "existing", slug: "articles" })

    const result = await bridge.createContentType({ name: "Articles", slug: "articles", fields: [] })
    expect(result).toMatchObject({ success: false })
    expect(db.contentType.create).not.toHaveBeenCalled()
  })

  it("createContentType scopes the uniqueness check to this.tenantId", async () => {
    const db = await tenantDb()
    db.contentType.findFirst.mockResolvedValue(null)
    db.contentType.create.mockResolvedValue({ id: "new", slug: "articles", schemaFields: [] })

    await bridge.createContentType({ name: "Articles", slug: "articles", fields: [] })
    expect(db.contentType.findFirst).toHaveBeenCalledWith({ where: { tenantId: "tenant-1", slug: "articles" } })
    expect(db.contentType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-1" }) })
    )
  })

  it("getComponent returns a not-found result instead of throwing when nothing matches", async () => {
    const db = await tenantDb()
    db.component.findFirst.mockResolvedValue(null)

    const result = await bridge.getComponent("missing-slug")
    expect(result).toEqual({ success: false, error: "Component 'missing-slug' not found" })
  })

  it("deleteContentType returns a not-found result for a slug that doesn't belong to this tenant, without deleting", async () => {
    const db = await tenantDb()
    db.contentType.findFirst.mockResolvedValue(null)

    const result = await bridge.deleteContentType("someone-elses-type")
    expect(result).toMatchObject({ success: false })
    expect(db.contentType.delete).not.toHaveBeenCalled()
  })
})

describe("McpClientBridge — member password handling", () => {
  let bridge: McpClientBridge

  beforeEach(() => {
    vi.clearAllMocks()
    bridge = new McpClientBridge("tenant-1", "acme", "user-1")
  })

  it("createMember hashes the password and never stores or returns the plaintext", async () => {
    const db = await tenantDb()
    db.member.findUnique.mockResolvedValue(null)
    db.member.create.mockImplementation(({ data, select }: any) => {
      // Mirrors Prisma's `select` semantics closely enough to catch a leak:
      // if passwordHash were added to `select`, it would show up here.
      expect(select.passwordHash).toBeUndefined()
      return Promise.resolve({ id: "m-1", email: data.email, name: data.name, role: data.role, status: data.status, metadata: data.metadata, createdAt: new Date() })
    })

    const result = await bridge.createMember({ email: "Test@Example.com", password: "s3cret-plaintext" })

    expect(hashMemberPassword).toHaveBeenCalledWith("s3cret-plaintext")
    expect(db.member.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: "hashed:dummy", email: "test@example.com" }) })
    )
    expect(JSON.stringify(result)).not.toContain("s3cret-plaintext")
  })

  it("updateMember only re-hashes the password when a new one is explicitly provided", async () => {
    const db = await tenantDb()
    db.member.findFirst.mockResolvedValue({ id: "m-1", email: "test@example.com", metadata: {} })
    db.member.update.mockResolvedValue({ id: "m-1", email: "test@example.com" })

    await bridge.updateMember({ idOrEmail: "m-1", name: "New Name" })
    expect(hashMemberPassword).not.toHaveBeenCalled()
    expect(db.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ passwordHash: expect.anything() }) })
    )
  })
})
