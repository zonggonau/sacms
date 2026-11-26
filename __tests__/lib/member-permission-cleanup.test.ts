import { beforeEach, describe, expect, it, vi } from "vitest"

const { invalidatePermissionCache } = vi.hoisted(() => ({ invalidatePermissionCache: vi.fn(async () => {}) }))
vi.mock("@/lib/permissions-engine", () => ({ invalidatePermissionCache }))

import { removeMemberGrantsForContentTypes } from "@/lib/member-permission-cleanup"

describe("removeMemberGrantsForContentTypes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes only grants for the given slugs, inside this tenant, and clears each role's cache", async () => {
    const tenantDb: any = {
      memberRole: { findMany: vi.fn(async () => [{ slug: "public" }, { slug: "vip" }]) },
      memberRolePermission: { deleteMany: vi.fn(async () => ({ count: 4 })) },
    }
    const n = await removeMemberGrantsForContentTypes(tenantDb, "t1", ["posts", "posts", ""])
    expect(n).toBe(4)
    expect(tenantDb.memberRolePermission.deleteMany).toHaveBeenCalledWith({
      where: { contentTypeSlug: { in: ["posts"] }, memberRole: { tenantId: "t1" } },
    })
    expect(invalidatePermissionCache).toHaveBeenCalledWith("t1", "public")
    expect(invalidatePermissionCache).toHaveBeenCalledWith("t1", "vip")
  })

  it("does nothing when there are no slugs", async () => {
    const tenantDb: any = { memberRole: { findMany: vi.fn() }, memberRolePermission: { deleteMany: vi.fn() } }
    expect(await removeMemberGrantsForContentTypes(tenantDb, "t1", [])).toBe(0)
    expect(tenantDb.memberRolePermission.deleteMany).not.toHaveBeenCalled()
  })
})
