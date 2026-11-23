import { describe, it, expect, vi, beforeEach } from "vitest"

const m = vi.hoisted(() => ({
  approval: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  schemaTemplate: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  websiteTemplate: { updateMany: vi.fn(), findMany: vi.fn() },
  globalComponent: { updateMany: vi.fn() },
  tenant: { delete: vi.fn() },
  transaction: vi.fn(),
  deleteVercelProject: vi.fn(),
}))

vi.mock("@/lib/database", () => ({
  db: {
    mcpApprovalRequest: m.approval,
    schemaTemplate: m.schemaTemplate,
    websiteTemplate: m.websiteTemplate,
    globalComponent: m.globalComponent,
    tenant: m.tenant,
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/vercel-client", () => ({ deleteVercelProject: m.deleteVercelProject }))

const { requestApproval, decideApproval, summarizeApproval } = await import("@/lib/infrastructure/mcp-approvals")

const pending = (action: string, targetId = "target-1") => ({ id: "req-1", action, targetId, targetName: "Target", status: "processing" })

describe("requestApproval", () => {
  beforeEach(() => vi.resetAllMocks())

  it("returns the request already waiting for the same action + target instead of queueing a duplicate", async () => {
    m.approval.findFirst.mockResolvedValue({ id: "req-existing", status: "pending" })
    const result = await requestApproval({ action: "publish_website_template", targetId: "wt-1", targetName: "Site", tokenId: "tok", tokenName: "Agent" })
    expect(result).toEqual({ id: "req-existing", status: "pending" })
    expect(m.approval.findFirst).toHaveBeenCalledWith({ where: { action: "publish_website_template", targetId: "wt-1", status: "pending" } })
    expect(m.approval.create).not.toHaveBeenCalled()
  })

  it("records who asked, from the token, when nothing is pending yet", async () => {
    m.approval.findFirst.mockResolvedValue(null)
    m.approval.create.mockImplementation(async ({ data }) => ({ id: "req-new", status: "pending", ...data }))
    await requestApproval({ action: "set_default_schema_template", targetId: "st-1", targetName: "Company", tokenId: "tok", tokenName: "Agent" })
    expect(m.approval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "set_default_schema_template", targetId: "st-1", requestedByTokenId: "tok", requestedByName: "Agent" }),
    })
  })

  it("tells the agent where the human decides while a request is pending", () => {
    expect(summarizeApproval({ id: "r", action: "a", status: "pending" }).message).toMatch(/\/admin\/developer\/approvals/)
  })
})

describe("decideApproval", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.approval.updateMany.mockResolvedValue({ count: 1 })
    m.approval.update.mockResolvedValue({})
  })

  it("claims the request conditionally, so a second click on an already-decided request does nothing", async () => {
    m.approval.updateMany.mockResolvedValue({ count: 0 })
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(result.ok).toBe(false)
    expect(m.approval.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "pending" },
      data: expect.objectContaining({ status: "processing", decidedBy: "admin-1" }),
    })
    expect(m.websiteTemplate.updateMany).not.toHaveBeenCalled()
  })

  it("rejecting never touches the target", async () => {
    const result = await decideApproval("req-1", "reject", "admin-1")
    expect(result).toMatchObject({ ok: true, status: "rejected" })
    expect(m.approval.updateMany).toHaveBeenCalledWith({ where: { id: "req-1", status: "pending" }, data: expect.objectContaining({ status: "rejected" }) })
    expect(m.approval.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it("approving a publish request publishes the target and records approved", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("publish_website_template", "wt-1"))
    m.websiteTemplate.updateMany.mockResolvedValue({ count: 1 })
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(m.websiteTemplate.updateMany).toHaveBeenCalledWith({ where: { id: "wt-1" }, data: { published: true } })
    expect(result).toMatchObject({ ok: true, status: "approved" })
    expect(m.approval.update).toHaveBeenCalledWith({ where: { id: "req-1" }, data: expect.objectContaining({ status: "approved" }) })
  })

  it("marks the request failed (not approved) when the target was deleted meanwhile", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("publish_global_component", "gc-gone"))
    m.globalComponent.updateMany.mockResolvedValue({ count: 0 })
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(result).toMatchObject({ ok: true, status: "failed" })
    expect(m.approval.update).toHaveBeenCalledWith({ where: { id: "req-1" }, data: expect.objectContaining({ status: "failed" }) })
  })

  it("marks the request failed when applying throws, instead of leaving it stuck in processing", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("publish_schema_template", "st-1"))
    m.schemaTemplate.updateMany.mockRejectedValue(new Error("db down"))
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(result).toMatchObject({ ok: true, status: "failed", message: "db down" })
  })

  it("set_default moves the platform default in one transaction", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("set_default_schema_template", "st-1"))
    m.schemaTemplate.findUnique.mockResolvedValue({ id: "st-1" })
    m.transaction.mockResolvedValue([])
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(m.transaction).toHaveBeenCalledTimes(1)
    expect(m.schemaTemplate.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, id: { not: "st-1" } }, data: { isDefault: false } })
    expect(m.schemaTemplate.update).toHaveBeenCalledWith({ where: { id: "st-1" }, data: { isDefault: true } })
    expect(result.status).toBe("approved")
  })

  it("cascade delete refuses the platform default schema", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("cascade_delete_schema_template", "st-1"))
    m.schemaTemplate.findUnique.mockResolvedValue({ id: "st-1", isDefault: true, demoTenantId: null })
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(result.status).toBe("failed")
    expect(m.schemaTemplate.update).not.toHaveBeenCalled()
    expect(m.websiteTemplate.updateMany).not.toHaveBeenCalled()
  })

  it("cascade delete soft-deletes dependents' schemas and cleans up demo projects + demo tenant", async () => {
    m.approval.findUniqueOrThrow.mockResolvedValue(pending("cascade_delete_schema_template", "st-1"))
    m.schemaTemplate.findUnique.mockResolvedValue({ id: "st-1", isDefault: false, demoTenantId: "demo-1" })
    m.websiteTemplate.findMany.mockResolvedValue([{ id: "wt_1", demoVercelProjectId: "prj_a" }, { id: "wt_2", demoVercelProjectId: null }])
    m.deleteVercelProject.mockResolvedValue({ ok: true })
    m.schemaTemplate.update.mockResolvedValue({})
    m.websiteTemplate.updateMany.mockResolvedValue({ count: 2 })
    m.tenant.delete.mockResolvedValue({})
    const result = await decideApproval("req-1", "approve", "admin-1")
    expect(m.deleteVercelProject).toHaveBeenCalledTimes(1)
    expect(m.deleteVercelProject).toHaveBeenCalledWith("prj_a")
    expect(m.schemaTemplate.update).toHaveBeenCalledWith({ where: { id: "st-1" }, data: { deletedAt: expect.any(Date) } })
    expect(m.websiteTemplate.updateMany).toHaveBeenCalledWith({ where: { schemaTemplateId: "st-1" }, data: { deletedAt: expect.any(Date) } })
    expect(m.tenant.delete).toHaveBeenCalledWith({ where: { id: "demo-1" } })
    expect(result.status).toBe("approved")
  })
})
