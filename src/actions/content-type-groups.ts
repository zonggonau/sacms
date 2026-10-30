"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { buildGroupTree, subtreeDepth, type FlatContentTypeGroup } from "@/lib/content-type-groups"

const MAX_DEPTH = 2 // 0-indexed — depth 0/1/2 = level 1/2/3, i.e. "up to 3 levels"
const MAX_ANCESTOR_WALK = 10 // safety belt against any data corruption causing an infinite loop

/** Ancestor ids from the immediate parent up to the root, NOT including
 *  `groupId` itself. `ancestorIds.length` is `groupId`'s own depth
 *  (0 = top-level). */
async function getAncestorIds(tenantDb: any, groupId: string): Promise<string[]> {
  const ancestors: string[] = []
  let currentId: string | null = groupId
  for (let i = 0; i < MAX_ANCESTOR_WALK; i++) {
    const current = await tenantDb.contentTypeGroup.findUnique({
      where: { id: currentId as string },
      select: { parentId: true },
    })
    if (!current?.parentId) break
    ancestors.push(current.parentId)
    currentId = current.parentId
  }
  return ancestors
}

export async function getContentTypeGroupsAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const groups = await tenantDb.contentTypeGroup.findMany({
      where: { tenantId: access.tenantId },
      select: { id: true, name: true, parentId: true, order: true },
      orderBy: { order: "asc" },
    })

    return { groups: groups as FlatContentTypeGroup[] }
  } catch (error) {
    console.error("Error fetching content type groups:", error)
    return { error: "Internal server error" }
  }
}

export async function createContentTypeGroupAction(
  tenantSlug: string,
  data: { name: string; parentId?: string | null },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_CREATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const name = data.name?.trim()
    if (!name) return { error: "Nama grup wajib diisi" }

    const tenantDb = await getTenantDb(tenantSlug)

    let parentDepth = -1
    if (data.parentId) {
      const parent = await tenantDb.contentTypeGroup.findFirst({
        where: { id: data.parentId, tenantId: access.tenantId },
      })
      if (!parent) return { error: "Grup induk tidak ditemukan" }
      parentDepth = (await getAncestorIds(tenantDb, data.parentId)).length
    }

    if (parentDepth + 1 > MAX_DEPTH) {
      return { error: "Grup tidak boleh lebih dari 3 tingkat" }
    }

    const order = await tenantDb.contentTypeGroup.count({
      where: { tenantId: access.tenantId, parentId: data.parentId ?? null },
    })

    const group = await tenantDb.contentTypeGroup.create({
      data: {
        tenantId: access.tenantId,
        name,
        parentId: data.parentId ?? null,
        order,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { group }
  } catch (error) {
    console.error("Error creating content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function renameContentTypeGroupAction(tenantSlug: string, id: string, name: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const trimmed = name?.trim()
    if (!trimmed) return { error: "Nama grup wajib diisi" }

    const tenantDb = await getTenantDb(tenantSlug)
    const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId: access.tenantId } })
    if (!existing) return { error: "Grup tidak ditemukan" }

    const group = await tenantDb.contentTypeGroup.update({ where: { id }, data: { name: trimmed } })

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { group }
  } catch (error) {
    console.error("Error renaming content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function reparentContentTypeGroupAction(
  tenantSlug: string,
  id: string,
  newParentId: string | null,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    if (newParentId === id) return { error: "Grup tidak bisa menjadi induk dirinya sendiri" }

    const tenantDb = await getTenantDb(tenantSlug)
    const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId: access.tenantId } })
    if (!existing) return { error: "Grup tidak ditemukan" }

    let newParentDepth = -1
    if (newParentId) {
      const newParent = await tenantDb.contentTypeGroup.findFirst({
        where: { id: newParentId, tenantId: access.tenantId },
      })
      if (!newParent) return { error: "Grup tujuan tidak ditemukan" }

      const ancestorsOfNewParent = await getAncestorIds(tenantDb, newParentId)
      if (ancestorsOfNewParent.includes(id)) {
        return { error: "Grup tidak bisa dipindahkan ke dalam anaknya sendiri" }
      }
      newParentDepth = ancestorsOfNewParent.length

      // How many extra levels hang below `id` today — moving it deeper
      // must not push its own deepest descendant past the 3-level cap.
      const allGroups = await tenantDb.contentTypeGroup.findMany({
        where: { tenantId: access.tenantId },
        select: { id: true, name: true, parentId: true, order: true },
      })
      const tree = buildGroupTree(allGroups as FlatContentTypeGroup[])
      const findNode = (nodes: typeof tree): (typeof tree)[number] | undefined => {
        for (const n of nodes) {
          if (n.id === id) return n
          const found = findNode(n.children)
          if (found) return found
        }
        return undefined
      }
      const movedNode = findNode(tree)
      const movedSubtreeDepth = movedNode ? subtreeDepth(movedNode) : 0

      if (newParentDepth + 1 + movedSubtreeDepth > MAX_DEPTH) {
        return { error: "Grup tidak boleh lebih dari 3 tingkat" }
      }
    }

    const order = await tenantDb.contentTypeGroup.count({
      where: { tenantId: access.tenantId, parentId: newParentId ?? null },
    })

    const group = await tenantDb.contentTypeGroup.update({
      where: { id },
      data: { parentId: newParentId, order },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { group }
  } catch (error) {
    console.error("Error reparenting content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function reorderContentTypeGroupsAction(
  tenantSlug: string,
  parentId: string | null,
  orderedIds: string[],
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const siblings = await tenantDb.contentTypeGroup.findMany({
      where: { tenantId: access.tenantId, parentId: parentId ?? null },
      select: { id: true },
    })
    const siblingIds = new Set(siblings.map((s: { id: string }) => s.id))
    if (orderedIds.some((id) => !siblingIds.has(id))) {
      return { error: "Daftar grup tidak valid" }
    }

    await tenantDb.$transaction(
      orderedIds.map((id, index) => tenantDb.contentTypeGroup.update({ where: { id }, data: { order: index } })),
    )

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { success: true }
  } catch (error) {
    console.error("Error reordering content type groups:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteContentTypeGroupAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_DELETE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId: access.tenantId } })
    if (!existing) return { error: "Grup tidak ditemukan" }

    const allGroups = await tenantDb.contentTypeGroup.findMany({
      where: { tenantId: access.tenantId },
      select: { id: true, name: true, parentId: true, order: true },
    })
    const tree = buildGroupTree(allGroups as FlatContentTypeGroup[])
    const findNode = (nodes: typeof tree): (typeof tree)[number] | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        const found = findNode(n.children)
        if (found) return found
      }
      return undefined
    }
    const collectIds = (node: (typeof tree)[number]): string[] => [
      node.id,
      ...node.children.flatMap(collectIds),
    ]
    const node = findNode(tree)
    const subtreeIds = node ? collectIds(node) : [id]

    const [orphanedContentTypeCount, descendantGroupCount] = await Promise.all([
      tenantDb.contentType.count({ where: { groupId: { in: subtreeIds } } }),
      Promise.resolve(subtreeIds.length - 1),
    ])

    await tenantDb.contentTypeGroup.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { success: true, orphanedContentTypeCount, descendantGroupCount }
  } catch (error) {
    console.error("Error deleting content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function assignContentTypeToGroupAction(
  tenantSlug: string,
  contentTypeId: string,
  groupId: string | null,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findUnique({ where: { id: contentTypeId } })
    if (!contentType) return { error: "Koleksi tidak ditemukan" }

    const isGlobal = contentType.tenantId === null
    const isOwnedByOther = contentType.tenantId !== null && contentType.tenantId !== access.tenantId
    if (isGlobal && !access.isGlobal) return { error: "Koleksi global tidak dapat diubah oleh admin tenant" }
    if (isOwnedByOther) return { error: "Koleksi milik tenant lain tidak dapat diubah" }

    if (groupId) {
      const group = await tenantDb.contentTypeGroup.findFirst({ where: { id: groupId, tenantId: access.tenantId } })
      if (!group) return { error: "Grup tidak ditemukan" }
    }

    const groupOrder = groupId
      ? await tenantDb.contentType.count({ where: { groupId } })
      : 0

    const updated = await tenantDb.contentType.update({
      where: { id: contentTypeId },
      data: { groupId, groupOrder },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { contentType: updated }
  } catch (error) {
    console.error("Error assigning content type to group:", error)
    return { error: "Internal server error" }
  }
}
