import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"

const m = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), decideApproval: vi.fn() }))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/database", () => ({ db: { mcpApprovalRequest: { findMany: m.findMany, count: m.count } } }))
vi.mock("@/lib/infrastructure/mcp-approvals", () => ({
  APPROVAL_ACTION_LABELS: { publish_website_template: "Publikasikan Website Template" },
  decideApproval: m.decideApproval,
}))

const { GET } = await import("@/app/api/admin/mcp-approvals/route")
const { POST } = await import("@/app/api/admin/mcp-approvals/[id]/route")

const params = { params: Promise.resolve({ id: "req-1" }) } as any
const decide = (body: unknown) =>
  POST(new NextRequest("https://example.test/api/admin/mcp-approvals/req-1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), params)

describe("/api/admin/mcp-approvals", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "super_admin" }, expires: "2030-01-01" } as any)
  })

  it("only a super admin can list or decide — a developer-role token holder cannot approve its own request", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "dev-1", role: "developer" }, expires: "2030-01-01" } as any)
    expect((await GET(new NextRequest("https://example.test/api/admin/mcp-approvals"), {} as any)).status).toBe(403)
    expect((await decide({ decision: "approve" })).status).toBe(403)
    expect(m.decideApproval).not.toHaveBeenCalled()
  })

  it("lists requests with a human label and the pending count", async () => {
    m.findMany.mockResolvedValue([{
      id: "req-1", action: "publish_website_template", targetId: "wt-1", targetName: "Site", details: null,
      status: "pending", requestedByName: "Agent", resultMessage: null,
      createdAt: new Date("2026-11-01T00:00:00Z"), decidedAt: null,
    }])
    m.count.mockResolvedValue(1)
    const res = await GET(new NextRequest("https://example.test/api/admin/mcp-approvals?status=pending"), {} as any)
    const body = await res.json()
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "pending" } }))
    expect(body.pendingCount).toBe(1)
    expect(body.requests[0]).toMatchObject({ id: "req-1", actionLabel: "Publikasikan Website Template", createdAt: "2026-11-01T00:00:00.000Z" })
  })

  it("passes the decision and the deciding admin's id through", async () => {
    m.decideApproval.mockResolvedValue({ ok: true, status: "approved", message: "Website Template published." })
    const res = await decide({ decision: "approve" })
    expect(res.status).toBe(200)
    expect(m.decideApproval).toHaveBeenCalledWith("req-1", "approve", "admin-1")
  })

  it("rejects an unknown decision and reports an already-decided request as a conflict", async () => {
    expect((await decide({ decision: "maybe" })).status).toBe(400)
    m.decideApproval.mockResolvedValue({ ok: false, error: "Permintaan ini sudah diputuskan atau tidak ditemukan." })
    expect((await decide({ decision: "reject" })).status).toBe(409)
  })
})
