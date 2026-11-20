import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { db } from "@/lib/database"
import { GET, POST } from "@/app/api/admin/rbac/roles/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

const context = { params: Promise.resolve({}) }

function request(body?: unknown) {
  return new Request("https://test.local/api/admin/rbac/roles", body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never
}

describe("Platform RBAC catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "1", role: "super_admin" } })
  })

  it("lists effective staff roles and applies explicit catalogue assignment overrides", async () => {
    vi.mocked(db.permission.findMany).mockResolvedValueOnce([
      { id: "perm-1", name: "workspaces.create", category: "workspaces" },
    ] as never)
    vi.mocked(db.rolePermission.findMany).mockResolvedValueOnce([
      { roleId: "owner", permissionId: "perm-1", granted: false },
    ] as never)

    const result = await (await GET(request(), context)).json()
    expect(result.roles.map((role: { id: string }) => role.id)).toEqual([
      "super_admin", "developer", "employee", "finance", "owner", "user",
    ])
    expect(result.roles.find((role: { id: string }) => role.id === "super_admin").permissions).toHaveLength(1)
    expect(result.roles.find((role: { id: string }) => role.id === "owner").permissions).toHaveLength(0)
  })

  it("updates the selected catalogue assignments in one transaction", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const lock = vi.fn().mockResolvedValue(0)
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
      $executeRaw: lock,
      permission: { findMany: vi.fn().mockResolvedValue([{ id: "perm-1" }, { id: "perm-2" }]) },
      rolePermission: { updateMany, findMany: vi.fn().mockResolvedValue([]) },
    }))

    const response = await POST(request({ roleId: "employee", permissionIds: ["perm-1", "perm-2"], granted: true }), context)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ updated: 2 })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(lock).toHaveBeenCalledOnce()
    expect(updateMany).toHaveBeenCalledWith({
      where: { roleId: "employee", permissionId: "perm-2", tenantId: null },
      data: { granted: true },
    })
  })

  it("keeps Super Admin locked and excludes non-admin staff from edits", async () => {
    const body = { roleId: "super_admin", permissionId: "perm-1", granted: false }
    expect((await POST(request(body), context)).status).toBe(400)
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "2", role: "employee" } })
    expect((await POST(request({ ...body, roleId: "owner" }), context)).status).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
