import { buildGroupTree, subtreeDepth, type FlatContentTypeGroup } from "@/lib/content-type-groups"

/**
 * Business logic for ContentTypeGroup CRUD — extracted out of
 * src/actions/content-type-groups.ts so the per-workspace MCP server's
 * group tools can call the EXACT same depth-cap/cycle-prevention rules
 * instead of a second, independently-maintained copy (that's how the
 * list_field_types documentation drifted stale earlier this session).
 *
 * Every function here takes an already-resolved `tenantDb` + `tenantId` —
 * no session/RBAC. Callers (the Server Actions, and the MCP tools) are
 * responsible for their own auth before calling in.
 */

const MAX_DEPTH = 2 // 0-indexed — depth 0/1/2 = level 1/2/3, i.e. "up to 3 levels"
const MAX_ANCESTOR_WALK = 10 // safety belt against any data corruption causing an infinite loop

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

function findNode(tree: ReturnType<typeof buildGroupTree>, id: string): ReturnType<typeof buildGroupTree>[number] | undefined {
  for (const n of tree) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return undefined
}

export async function listContentTypeGroups(tenantDb: any, tenantId: string) {
  const groups = await tenantDb.contentTypeGroup.findMany({
    where: { tenantId },
    select: { id: true, name: true, parentId: true, order: true },
    orderBy: { order: "asc" },
  })
  return { groups: groups as FlatContentTypeGroup[] }
}

export async function createContentTypeGroup(
  tenantDb: any,
  tenantId: string,
  data: { name: string; parentId?: string | null },
) {
  const name = data.name?.trim()
  if (!name) return { error: "Nama grup wajib diisi" }

  let parentDepth = -1
  if (data.parentId) {
    const parent = await tenantDb.contentTypeGroup.findFirst({ where: { id: data.parentId, tenantId } })
    if (!parent) return { error: "Grup induk tidak ditemukan" }
    parentDepth = (await getAncestorIds(tenantDb, data.parentId)).length
  }

  if (parentDepth + 1 > MAX_DEPTH) return { error: "Grup tidak boleh lebih dari 3 tingkat" }

  const order = await tenantDb.contentTypeGroup.count({ where: { tenantId, parentId: data.parentId ?? null } })

  const group = await tenantDb.contentTypeGroup.create({
    data: { tenantId, name, parentId: data.parentId ?? null, order },
  })
  return { group }
}

export async function renameContentTypeGroup(tenantDb: any, tenantId: string, id: string, name: string) {
  const trimmed = name?.trim()
  if (!trimmed) return { error: "Nama grup wajib diisi" }

  const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId } })
  if (!existing) return { error: "Grup tidak ditemukan" }

  const group = await tenantDb.contentTypeGroup.update({ where: { id }, data: { name: trimmed } })
  return { group }
}

export async function reparentContentTypeGroup(
  tenantDb: any,
  tenantId: string,
  id: string,
  newParentId: string | null,
) {
  if (newParentId === id) return { error: "Grup tidak bisa menjadi induk dirinya sendiri" }

  const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId } })
  if (!existing) return { error: "Grup tidak ditemukan" }

  let newParentDepth = -1
  if (newParentId) {
    const newParent = await tenantDb.contentTypeGroup.findFirst({ where: { id: newParentId, tenantId } })
    if (!newParent) return { error: "Grup tujuan tidak ditemukan" }

    const ancestorsOfNewParent = await getAncestorIds(tenantDb, newParentId)
    if (ancestorsOfNewParent.includes(id)) {
      return { error: "Grup tidak bisa dipindahkan ke dalam anaknya sendiri" }
    }
    newParentDepth = ancestorsOfNewParent.length

    const allGroups = await tenantDb.contentTypeGroup.findMany({
      where: { tenantId },
      select: { id: true, name: true, parentId: true, order: true },
    })
    const tree = buildGroupTree(allGroups as FlatContentTypeGroup[])
    const movedNode = findNode(tree, id)
    const movedSubtreeDepth = movedNode ? subtreeDepth(movedNode) : 0

    if (newParentDepth + 1 + movedSubtreeDepth > MAX_DEPTH) {
      return { error: "Grup tidak boleh lebih dari 3 tingkat" }
    }
  }

  const order = await tenantDb.contentTypeGroup.count({ where: { tenantId, parentId: newParentId ?? null } })

  const group = await tenantDb.contentTypeGroup.update({
    where: { id },
    data: { parentId: newParentId, order },
  })
  return { group }
}

export async function reorderContentTypeGroups(
  tenantDb: any,
  tenantId: string,
  parentId: string | null,
  orderedIds: string[],
) {
  const siblings = await tenantDb.contentTypeGroup.findMany({
    where: { tenantId, parentId: parentId ?? null },
    select: { id: true },
  })
  const siblingIds = new Set(siblings.map((s: { id: string }) => s.id))
  if (orderedIds.some((id) => !siblingIds.has(id))) return { error: "Daftar grup tidak valid" }

  await tenantDb.$transaction(
    orderedIds.map((id, index) => tenantDb.contentTypeGroup.update({ where: { id }, data: { order: index } })),
  )
  return { success: true }
}

export async function deleteContentTypeGroup(tenantDb: any, tenantId: string, id: string) {
  const existing = await tenantDb.contentTypeGroup.findFirst({ where: { id, tenantId } })
  if (!existing) return { error: "Grup tidak ditemukan" }

  const allGroups = await tenantDb.contentTypeGroup.findMany({
    where: { tenantId },
    select: { id: true, name: true, parentId: true, order: true },
  })
  const tree = buildGroupTree(allGroups as FlatContentTypeGroup[])
  const collectIds = (node: ReturnType<typeof buildGroupTree>[number]): string[] => [
    node.id,
    ...node.children.flatMap(collectIds),
  ]
  const node = findNode(tree, id)
  const subtreeIds = node ? collectIds(node) : [id]

  const orphanedContentTypeCount = await tenantDb.contentType.count({ where: { groupId: { in: subtreeIds } } })
  const descendantGroupCount = subtreeIds.length - 1

  await tenantDb.contentTypeGroup.delete({ where: { id } })

  return { success: true, orphanedContentTypeCount, descendantGroupCount }
}

export async function assignContentTypeToGroup(
  tenantDb: any,
  tenantId: string,
  contentTypeId: string,
  groupId: string | null,
  isGlobalActor: boolean,
) {
  const contentType = await tenantDb.contentType.findUnique({ where: { id: contentTypeId } })
  if (!contentType) return { error: "Koleksi tidak ditemukan" }

  const isGlobal = contentType.tenantId === null
  const isOwnedByOther = contentType.tenantId !== null && contentType.tenantId !== tenantId
  if (isGlobal && !isGlobalActor) return { error: "Koleksi global tidak dapat diubah oleh admin tenant" }
  if (isOwnedByOther) return { error: "Koleksi milik tenant lain tidak dapat diubah" }

  if (groupId) {
    const group = await tenantDb.contentTypeGroup.findFirst({ where: { id: groupId, tenantId } })
    if (!group) return { error: "Grup tidak ditemukan" }
  }

  const groupOrder = groupId ? await tenantDb.contentType.count({ where: { groupId } }) : 0

  const updated = await tenantDb.contentType.update({
    where: { id: contentTypeId },
    data: { groupId, groupOrder },
  })
  return { contentType: updated }
}
