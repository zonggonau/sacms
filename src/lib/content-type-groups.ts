/** Pure tree-assembly helpers for ContentTypeGroup — shared by the
 *  owner/admin group-manager dialog (developer/content-types) and the
 *  read-only CMS sidebar rendering. No Prisma/server imports here so it
 *  stays unit-testable and safe to use from client components. */

export interface FlatContentTypeGroup {
  id: string
  name: string
  parentId: string | null
  order: number
}

export interface ContentTypeGroupNode extends FlatContentTypeGroup {
  children: ContentTypeGroupNode[]
}

/** Flat adjacency list -> nested tree. A `parentId` that doesn't resolve to
 *  another group in the same list (deleted, or pointing at a different
 *  tenant) is treated as top-level rather than dropped or throwing. */
export function buildGroupTree(flat: FlatContentTypeGroup[]): ContentTypeGroupNode[] {
  const byId = new Map<string, ContentTypeGroupNode>()
  for (const g of flat) byId.set(g.id, { ...g, children: [] })

  const roots: ContentTypeGroupNode[] = []
  for (const g of flat) {
    const node = byId.get(g.id)!
    const parent = g.parentId ? byId.get(g.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortTree = (nodes: ContentTypeGroupNode[]) => {
    nodes.sort((a, b) => a.order - b.order)
    nodes.forEach((n) => sortTree(n.children))
  }
  sortTree(roots)
  return roots
}

/** Max number of extra levels hanging below `node` — 0 for a leaf group,
 *  1 if it has children, 2 if it has grandchildren. Used to validate the
 *  3-level depth cap when reparenting a group that itself has subgroups. */
export function subtreeDepth(node: ContentTypeGroupNode): number {
  if (node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(subtreeDepth))
}

/** Removes any branch that has no content types anywhere in it (itself or
 *  any descendant) — used only for the CMS sidebar, so a freshly-created,
 *  still-empty group doesn't show up as a confusing empty dropdown. The
 *  group-manager dialog should NOT use this (admins need to see empty
 *  groups to populate them). */
export function pruneEmptyGroups(
  tree: ContentTypeGroupNode[],
  groupHasContentTypes: (groupId: string) => boolean,
): ContentTypeGroupNode[] {
  const result: ContentTypeGroupNode[] = []
  for (const node of tree) {
    const prunedChildren = pruneEmptyGroups(node.children, groupHasContentTypes)
    if (prunedChildren.length > 0 || groupHasContentTypes(node.id)) {
      result.push({ ...node, children: prunedChildren })
    }
  }
  return result
}

/** Flattens a tree into a depth-indented list for a simple <Select> picker
 *  (no tree-selector widget exists in this codebase, and depth is capped
 *  at 3, so a short indented flat list stays legible). `excludeId`, when
 *  given, drops that node AND its whole subtree — used so a group can't be
 *  reparented into itself or one of its own descendants. */
export function flattenGroupTreeForSelect(
  tree: ContentTypeGroupNode[],
  excludeId?: string,
  depth = 0,
): { id: string; label: string; depth: number }[] {
  const out: { id: string; label: string; depth: number }[] = []
  for (const node of tree) {
    if (node.id === excludeId) continue
    out.push({ id: node.id, label: depth > 0 ? `${"— ".repeat(depth)}${node.name}` : node.name, depth })
    out.push(...flattenGroupTreeForSelect(node.children, excludeId, depth + 1))
  }
  return out
}
