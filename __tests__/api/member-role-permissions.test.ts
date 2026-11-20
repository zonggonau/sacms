import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { invalidatePermissionCache } from "@/lib/permissions-engine"
import { GET, PUT } from "@/app/api/tenant/[tenant]/member-roles/[roleId]/permissions/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/permissions-engine", () => ({ invalidatePermissionCache: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

const context = { params: Promise.resolve({ tenant: "workspace", roleId: "r-1" }) }
const permissions = [{ contentTypeSlug: "news", action: "find", conditions: { owner: true } }]

function request(body?: unknown) {
  return new Request("https://test.local/api/tenant/workspace/member-roles/r-1/permissions", body === undefined ? {} : {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never
}

describe("Workspace end-user role permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role: "user" } })
    vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "w-1", role: "admin" } as never)
  })

  it("reads assignments only for a role belonging to the current workspace", async () => {
    vi.mocked(db.memberRole.findFirst).mockResolvedValueOnce(null)
    expect((await GET(request(), context)).status).toBe(404)
    expect(db.memberRole.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "r-1", tenantId: "w-1" } }))
  })

  it("replaces assignments within one transaction and invalidates the cache after commit", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => {
      const role = await callback({
        $queryRaw: vi.fn().mockResolvedValue([{ slug: "guest" }]),
        memberRolePermission: { deleteMany, createMany },
      })
      expect(invalidatePermissionCache).not.toHaveBeenCalled()
      return role
    })

    expect((await PUT(request({ permissions }), context)).status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { memberRoleId: "r-1" } })
    expect(createMany).toHaveBeenCalledWith({ data: [{ ...permissions[0], memberRoleId: "r-1", granted: true }] })
    expect(invalidatePermissionCache).toHaveBeenCalledWith("w-1", "guest")
  })

  it("does not invalidate permissions when a transactional replacement fails", async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ slug: "guest" }]),
      memberRolePermission: { deleteMany: vi.fn(), createMany: vi.fn().mockRejectedValue(new Error("insert failed")) },
    }))
    expect((await PUT(request({ permissions }), context)).status).toBe(500)
    expect(invalidatePermissionCache).not.toHaveBeenCalled()
  })
})
