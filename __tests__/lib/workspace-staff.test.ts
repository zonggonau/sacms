import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/database"
import { addWorkspaceStaff, addWorkspaceStaffSchema, removeWorkspaceStaff } from "@/lib/workspace-staff"
import { isMailConfigured } from "@/lib/settings"

vi.mock("@/lib/settings", () => ({ isMailConfigured: vi.fn() }))
vi.mock("@/lib/plan-enforcement", () => ({ enforcePlanLimit: vi.fn(async () => ({ allowed: true })) }))

const actor = { id: "workspace-owner", role: "user" }
const tenantId = "workspace"

describe("Workspace staff service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isMailConfigured).mockResolvedValue(true)
  })

  it("creates new accounts without a workspace-controlled password or verified inbox", async () => {
    const provisionUser = vi.fn().mockResolvedValue({
      id: "invitee", email: "invitee@example.test", name: "invitee", image: null,
      role: "user", emailVerified: null, password: null,
    })
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ ownerId: actor.id }]),
      user: { findFirst: vi.fn().mockResolvedValue(null), upsert: provisionUser },
      tenantMember: {
        findUnique: vi.fn().mockResolvedValueOnce({ role: "owner" }).mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({ id: "membership", tenantId, userId: "invitee" }),
      },
    }))
    const input = addWorkspaceStaffSchema.parse({ email: "Invitee@example.test" })

    const result = await addWorkspaceStaff(tenantId, actor, input)
    expect(result.activationRequired).toBe(true)
    expect(provisionUser).toHaveBeenCalledWith(expect.objectContaining({
      create: { email: "invitee@example.test", name: "invitee", role: "user" },
    }))
  })

  it("blocks a new account invitation when there is no inbox verification service", async () => {
    vi.mocked(isMailConfigured).mockResolvedValueOnce(false)
    const provisionUser = vi.fn()
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ ownerId: actor.id }]),
      user: { findFirst: vi.fn().mockResolvedValue(null), upsert: provisionUser },
      tenantMember: { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) },
    }))

    await expect(addWorkspaceStaff(tenantId, actor, { email: "invitee@example.test", role: "viewer" }))
      .rejects.toMatchObject({ code: "validation" })
    expect(provisionUser).not.toHaveBeenCalled()
  })

  it("refuses to remove the primary owner even with a second owner present", async () => {
    const deleteMember = vi.fn()
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ ownerId: "primary-owner" }]),
      tenantMember: {
        findUnique: vi.fn().mockResolvedValue({ role: "owner" }),
        findFirst: vi.fn().mockResolvedValue({ id: "member-owner", userId: "primary-owner", role: "owner" }),
        count: vi.fn().mockResolvedValue(2),
        delete: deleteMember,
      },
    }))

    await expect(removeWorkspaceStaff(tenantId, actor, "member-owner")).rejects.toMatchObject({ code: "forbidden" })
    expect(deleteMember).not.toHaveBeenCalled()
  })
})
