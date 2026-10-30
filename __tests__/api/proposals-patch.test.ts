import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { SETTINGS_UPDATED: "settings.updated" },
}))
vi.mock("@/lib/database", () => ({
  db: {
    proposal: { findUnique: vi.fn(), update: vi.fn() },
    proposalActivity: { create: vi.fn() },
  },
}))

import { getServerSession } from "next-auth"
import { db } from "@/lib/database"
import { PATCH } from "@/app/api/admin/proposals/[id]/route"

const mockSession = vi.mocked(getServerSession)
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "PATCH", body: JSON.stringify(body) }) as any

describe("PATCH /api/admin/proposals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "staff1", role: "employee" } } as any)
  })

  it("rejects an invalid stage value", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue({ id: "p1", stage: "draft" } as any)

    const res = await PATCH(jsonReq({ stage: "nonexistent" }), ctx("p1"))

    expect(res.status).toBe(400)
    expect(db.proposal.update).not.toHaveBeenCalled()
  })

  it("moving into a non-terminal stage updates stage, clears closedAt, and logs a status_change activity", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue({ id: "p1", stage: "draft" } as any)
    vi.mocked(db.proposal.update).mockResolvedValue({ id: "p1", stage: "sent" } as any)

    const res = await PATCH(jsonReq({ stage: "sent" }), ctx("p1"))

    expect(res.status).toBe(200)
    expect(db.proposal.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ stage: "sent", closedAt: null }),
    })
    expect(db.proposalActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ proposalId: "p1", type: "status_change", fromStage: "draft", toStage: "sent" }),
    })
  })

  it("moving into a terminal stage ('won') sets closedAt to a real Date", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue({ id: "p1", stage: "negotiation" } as any)
    vi.mocked(db.proposal.update).mockResolvedValue({ id: "p1", stage: "won" } as any)

    await PATCH(jsonReq({ stage: "won" }), ctx("p1"))

    const updateCall = vi.mocked(db.proposal.update).mock.calls[0][0] as any
    expect(updateCall.data.stage).toBe("won")
    expect(updateCall.data.closedAt).toBeInstanceOf(Date)
  })

  it("moving into 'lost' with a reason stores it on the activity row", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue({ id: "p1", stage: "negotiation" } as any)
    vi.mocked(db.proposal.update).mockResolvedValue({ id: "p1", stage: "lost" } as any)

    await PATCH(jsonReq({ stage: "lost", lostReason: "Pilih vendor lain" }), ctx("p1"))

    expect(db.proposalActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toStage: "lost", message: "Pilih vendor lain" }),
    })
  })

  it("does not write an activity row when stage is unchanged", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue({ id: "p1", stage: "sent" } as any)
    vi.mocked(db.proposal.update).mockResolvedValue({ id: "p1", stage: "sent", notes: "updated" } as any)

    await PATCH(jsonReq({ stage: "sent", notes: "updated" }), ctx("p1"))

    expect(db.proposalActivity.create).not.toHaveBeenCalled()
  })

  it("404s when the proposal doesn't exist", async () => {
    vi.mocked(db.proposal.findUnique).mockResolvedValue(null)

    const res = await PATCH(jsonReq({ stage: "sent" }), ctx("missing"))

    expect(res.status).toBe(404)
  })
})
