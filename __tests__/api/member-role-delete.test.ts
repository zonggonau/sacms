import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/permissions-engine", () => ({ invalidatePermissionCache: vi.fn() }))

const { tenantDb } = vi.hoisted(() => ({
  tenantDb: {
    memberRole: { findFirst: vi.fn(), delete: vi.fn() },
    member: { count: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ getTenantDbById: vi.fn(async () => tenantDb) }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { DELETE } from "@/app/api/tenant/[tenant]/member-roles/[roleId]/route"

const call = () => DELETE(new Request("https://app.test/x", { method: "DELETE" }) as never, { params: Promise.resolve({ tenant: "acme", roleId: "r1" }) } as never)

describe("DELETE member role", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never)
    vi.mocked(getTenantAccess).mockResolvedValue({ role: "owner", tenantId: "t1", userId: "u1", tenant: { id: "t1", slug: "acme", name: "Acme", plan: "pro" } } as never)
    tenantDb.memberRole.findFirst.mockResolvedValue({ id: "r1", slug: "vip", isSystem: false })
    tenantDb.memberRole.delete.mockResolvedValue({})
  })

  it("refuses to delete a role that members still use, and names the count", async () => {
    tenantDb.member.count.mockResolvedValue(3)
    const res = await call()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/3 anggota/)
    expect(tenantDb.member.count).toHaveBeenCalledWith({ where: { tenantId: "t1", role: "vip" } })
    expect(tenantDb.memberRole.delete).not.toHaveBeenCalled()
  })

  it("deletes an unused role", async () => {
    tenantDb.member.count.mockResolvedValue(0)
    expect((await call()).status).toBe(200)
    expect(tenantDb.memberRole.delete).toHaveBeenCalledWith({ where: { id: "r1" } })
  })
})
