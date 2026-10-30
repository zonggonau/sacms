import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/database", () => {
  const mockDb = {
    contentTypeGroup: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contentType: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
  return { getTenantDb: vi.fn().mockResolvedValue(mockDb), __mockDb: mockDb }
})
vi.mock("@/lib/rbac", () => ({
  checkPermission: vi.fn(),
  PERMISSIONS: {
    CONTENT_TYPE_READ: "content-type.read",
    CONTENT_TYPE_CREATE: "content-type.create",
    CONTENT_TYPE_UPDATE: "content-type.update",
    CONTENT_TYPE_DELETE: "content-type.delete",
    CONTENT_READ: "content.read",
  },
}))

import { getServerSession } from "next-auth/next"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission } from "@/lib/rbac"
import * as mockedDatabase from "@/lib/database"

const mockDb = (mockedDatabase as any).__mockDb as {
  contentTypeGroup: Record<string, ReturnType<typeof vi.fn>>
  contentType: Record<string, ReturnType<typeof vi.fn>>
}

import {
  createContentTypeGroupAction,
  renameContentTypeGroupAction,
  reparentContentTypeGroupAction,
  reorderContentTypeGroupsAction,
  deleteContentTypeGroupAction,
  assignContentTypeToGroupAction,
} from "@/actions/content-type-groups"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const mockCheckPermission = vi.mocked(checkPermission)

// g1 -> g2 -> g3 (3 levels, g3 is at the depth cap)
// g4 top-level leaf; g5 -> g6 (g5 has one child)
const chain: Record<string, string | null> = {
  g1: null, g2: "g1", g3: "g2", g4: null, g5: null, g6: "g5",
}
const allGroups = Object.entries(chain).map(([id, parentId]) => ({
  id, name: id.toUpperCase(), parentId, order: 0,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
  mockAccess.mockResolvedValue({ role: "owner", tenantId: "tenant1", userId: "user1", isGlobal: false } as any)
  mockCheckPermission.mockResolvedValue({ allowed: true } as any)

  mockDb.contentTypeGroup.findUnique.mockImplementation(({ where: { id } }: any) =>
    Promise.resolve(id in chain ? { parentId: chain[id] } : null),
  )
  mockDb.contentTypeGroup.findFirst.mockImplementation(({ where: { id } }: any) =>
    Promise.resolve(id in chain ? { id, tenantId: "tenant1", parentId: chain[id] } : null),
  )
  mockDb.contentTypeGroup.findMany.mockResolvedValue(allGroups)
  mockDb.contentTypeGroup.count.mockResolvedValue(0)
})

describe("RBAC — non-admin rejection", () => {
  it("rejects every mutation when the caller lacks permission", async () => {
    mockCheckPermission.mockResolvedValue({ allowed: false } as any)

    expect(await createContentTypeGroupAction("tenant1", { name: "X" })).toEqual({ error: "Forbidden" })
    expect(await renameContentTypeGroupAction("tenant1", "g1", "New")).toEqual({ error: "Forbidden" })
    expect(await reparentContentTypeGroupAction("tenant1", "g1", null)).toEqual({ error: "Forbidden" })
    expect(await reorderContentTypeGroupsAction("tenant1", null, ["g1"])).toEqual({ error: "Forbidden" })
    expect(await deleteContentTypeGroupAction("tenant1", "g1")).toEqual({ error: "Forbidden" })
    expect(await assignContentTypeToGroupAction("tenant1", "ct1", "g1")).toEqual({ error: "Forbidden" })

    expect(mockDb.contentTypeGroup.create).not.toHaveBeenCalled()
    expect(mockDb.contentTypeGroup.update).not.toHaveBeenCalled()
    expect(mockDb.contentTypeGroup.delete).not.toHaveBeenCalled()
  })
})

describe("createContentTypeGroupAction — depth validation", () => {
  it("rejects a 4th level (parent already at level 3)", async () => {
    const res = await createContentTypeGroupAction("tenant1", { name: "Too Deep", parentId: "g3" })
    expect(res).toEqual({ error: "Grup tidak boleh lebih dari 3 tingkat" })
    expect(mockDb.contentTypeGroup.create).not.toHaveBeenCalled()
  })

  it("accepts exactly a 3rd level (parent at level 2)", async () => {
    mockDb.contentTypeGroup.create.mockResolvedValue({ id: "new", name: "OK", parentId: "g2", order: 0 })
    const res = await createContentTypeGroupAction("tenant1", { name: "OK", parentId: "g2" })
    expect("error" in res).toBe(false)
    expect(mockDb.contentTypeGroup.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant1", name: "OK", parentId: "g2", order: 0 },
    })
  })

  it("accepts a top-level group with no parent", async () => {
    mockDb.contentTypeGroup.create.mockResolvedValue({ id: "new", name: "Top", parentId: null, order: 0 })
    const res = await createContentTypeGroupAction("tenant1", { name: "Top" })
    expect("error" in res).toBe(false)
    expect(mockDb.contentTypeGroup.create).toHaveBeenCalled()
  })
})

describe("reparentContentTypeGroupAction — cycle + depth validation", () => {
  it("rejects a group becoming its own parent", async () => {
    const res = await reparentContentTypeGroupAction("tenant1", "g1", "g1")
    expect(res).toEqual({ error: "Grup tidak bisa menjadi induk dirinya sendiri" })
  })

  it("rejects moving an ancestor into its own descendant", async () => {
    // g3 is a descendant of g1 — moving g1 under g3 would create a cycle
    const res = await reparentContentTypeGroupAction("tenant1", "g1", "g3")
    expect(res).toEqual({ error: "Grup tidak bisa dipindahkan ke dalam anaknya sendiri" })
    expect(mockDb.contentTypeGroup.update).not.toHaveBeenCalled()
  })

  it("rejects when the combined depth (target depth + moved subtree depth) exceeds 3 levels", async () => {
    // g5 has one child (g6) -> subtree depth 1. g2 sits at depth 1.
    // 1 (g2 depth) + 1 (g5's own new depth) + 1 (g5's subtree) = 3 > cap(2)
    const res = await reparentContentTypeGroupAction("tenant1", "g5", "g2")
    expect(res).toEqual({ error: "Grup tidak boleh lebih dari 3 tingkat" })
    expect(mockDb.contentTypeGroup.update).not.toHaveBeenCalled()
  })

  it("accepts moving the same subtree to top-level (always shallower)", async () => {
    mockDb.contentTypeGroup.update.mockResolvedValue({ id: "g5", parentId: null })
    const res = await reparentContentTypeGroupAction("tenant1", "g5", null)
    expect("error" in res).toBe(false)
    expect(mockDb.contentTypeGroup.update).toHaveBeenCalledWith({
      where: { id: "g5" },
      data: { parentId: null, order: 0 },
    })
  })

  it("accepts a leaf group (g4) moving under a shallow group", async () => {
    mockDb.contentTypeGroup.update.mockResolvedValue({ id: "g4", parentId: "g1" })
    const res = await reparentContentTypeGroupAction("tenant1", "g4", "g1")
    expect("error" in res).toBe(false)
  })
})

describe("deleteContentTypeGroupAction — relies on schema cascade/SetNull", () => {
  it("only calls contentTypeGroup.delete, never touches ContentType rows directly", async () => {
    mockDb.contentType.count.mockResolvedValue(3)

    const res = await deleteContentTypeGroupAction("tenant1", "g1")

    expect(res).toMatchObject({ success: true, orphanedContentTypeCount: 3 })
    expect(mockDb.contentTypeGroup.delete).toHaveBeenCalledWith({ where: { id: "g1" } })
    expect(mockDb.contentType.update).not.toHaveBeenCalled()
  })

  it("counts descendant groups that will cascade-delete", async () => {
    mockDb.contentType.count.mockResolvedValue(0)
    const res: any = await deleteContentTypeGroupAction("tenant1", "g1")
    // g1's subtree is g1, g2, g3 -> 2 descendants
    expect(res.descendantGroupCount).toBe(2)
  })
})

describe("assignContentTypeToGroupAction", () => {
  it("rejects a content type owned by another tenant", async () => {
    mockDb.contentType.findUnique.mockResolvedValue({ id: "ct1", tenantId: "other-tenant" })
    const res = await assignContentTypeToGroupAction("tenant1", "ct1", "g1")
    expect(res).toEqual({ error: "Koleksi milik tenant lain tidak dapat diubah" })
    expect(mockDb.contentType.update).not.toHaveBeenCalled()
  })

  it("assigns a content type to a group, appending to the end", async () => {
    mockDb.contentType.findUnique.mockResolvedValue({ id: "ct1", tenantId: "tenant1" })
    mockDb.contentType.count.mockResolvedValue(2)
    mockDb.contentType.update.mockResolvedValue({ id: "ct1", groupId: "g1", groupOrder: 2 })

    const res = await assignContentTypeToGroupAction("tenant1", "ct1", "g1")

    expect("error" in res).toBe(false)
    expect(mockDb.contentType.update).toHaveBeenCalledWith({
      where: { id: "ct1" },
      data: { groupId: "g1", groupOrder: 2 },
    })
  })

  it("unassigns a content type back to ungrouped", async () => {
    mockDb.contentType.findUnique.mockResolvedValue({ id: "ct1", tenantId: "tenant1" })
    mockDb.contentType.update.mockResolvedValue({ id: "ct1", groupId: null, groupOrder: 0 })

    const res = await assignContentTypeToGroupAction("tenant1", "ct1", null)

    expect("error" in res).toBe(false)
    expect(mockDb.contentType.update).toHaveBeenCalledWith({
      where: { id: "ct1" },
      data: { groupId: null, groupOrder: 0 },
    })
  })
})

describe("reorderContentTypeGroupsAction", () => {
  it("rejects an id that isn't actually a sibling under the given parent", async () => {
    mockDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }])
    const res = await reorderContentTypeGroupsAction("tenant1", null, ["g1", "intruder"])
    expect(res).toEqual({ error: "Daftar grup tidak valid" })
  })

  it("re-sequences order for valid siblings", async () => {
    mockDb.contentTypeGroup.findMany.mockResolvedValue([{ id: "g1" }, { id: "g4" }])
    const tx = vi.fn().mockResolvedValue(undefined)
    ;(mockDb as any).$transaction = vi.fn(async (ops: any[]) => Promise.all(ops))
    mockDb.contentTypeGroup.update.mockResolvedValue({})

    const res = await reorderContentTypeGroupsAction("tenant1", null, ["g4", "g1"])

    expect("error" in res).toBe(false)
    expect(mockDb.contentTypeGroup.update).toHaveBeenCalledWith({ where: { id: "g4" }, data: { order: 0 } })
    expect(mockDb.contentTypeGroup.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { order: 1 } })
  })
})
