import { describe, it, expect } from "vitest"
import {
  buildGroupTree,
  subtreeDepth,
  pruneEmptyGroups,
  flattenGroupTreeForSelect,
  type FlatContentTypeGroup,
} from "@/lib/content-type-groups"

describe("buildGroupTree", () => {
  it("assembles a flat adjacency list into a nested tree", () => {
    const flat: FlatContentTypeGroup[] = [
      { id: "g1", name: "Artikel", parentId: null, order: 0 },
      { id: "g2", name: "Kategori Artikel", parentId: "g1", order: 0 },
      { id: "g3", name: "Komoditas", parentId: null, order: 1 },
    ]
    const tree = buildGroupTree(flat)
    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe("g1")
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe("g2")
    expect(tree[1].id).toBe("g3")
  })

  it("builds a full 3-level nested chain", () => {
    const flat: FlatContentTypeGroup[] = [
      { id: "g1", name: "L1", parentId: null, order: 0 },
      { id: "g2", name: "L2", parentId: "g1", order: 0 },
      { id: "g3", name: "L3", parentId: "g2", order: 0 },
    ]
    const tree = buildGroupTree(flat)
    expect(tree[0].children[0].children[0].id).toBe("g3")
  })

  it("treats an orphan/foreign-tenant parentId as top-level instead of crashing", () => {
    const flat: FlatContentTypeGroup[] = [
      { id: "g1", name: "Orphan", parentId: "does-not-exist", order: 0 },
    ]
    const tree = buildGroupTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe("g1")
  })

  it("sorts siblings by order at every level", () => {
    const flat: FlatContentTypeGroup[] = [
      { id: "g2", name: "Second", parentId: null, order: 1 },
      { id: "g1", name: "First", parentId: null, order: 0 },
    ]
    const tree = buildGroupTree(flat)
    expect(tree.map((n) => n.id)).toEqual(["g1", "g2"])
  })
})

describe("subtreeDepth", () => {
  it("is 0 for a leaf", () => {
    const [node] = buildGroupTree([{ id: "g1", name: "L", parentId: null, order: 0 }])
    expect(subtreeDepth(node)).toBe(0)
  })

  it("is 2 for a node with grandchildren", () => {
    const tree = buildGroupTree([
      { id: "g1", name: "L1", parentId: null, order: 0 },
      { id: "g2", name: "L2", parentId: "g1", order: 0 },
      { id: "g3", name: "L3", parentId: "g2", order: 0 },
    ])
    expect(subtreeDepth(tree[0])).toBe(2)
  })
})

describe("pruneEmptyGroups", () => {
  it("drops a branch with no content types anywhere in it", () => {
    const tree = buildGroupTree([
      { id: "g1", name: "Has content", parentId: null, order: 0 },
      { id: "g2", name: "Empty", parentId: null, order: 1 },
    ])
    const pruned = pruneEmptyGroups(tree, (id) => id === "g1")
    expect(pruned.map((n) => n.id)).toEqual(["g1"])
  })

  it("keeps a parent whose own list is empty but a descendant has content", () => {
    const tree = buildGroupTree([
      { id: "g1", name: "Parent (empty itself)", parentId: null, order: 0 },
      { id: "g2", name: "Child (has content)", parentId: "g1", order: 0 },
    ])
    const pruned = pruneEmptyGroups(tree, (id) => id === "g2")
    expect(pruned).toHaveLength(1)
    expect(pruned[0].id).toBe("g1")
    expect(pruned[0].children).toHaveLength(1)
  })
})

describe("flattenGroupTreeForSelect", () => {
  it("indents by depth and excludes a node plus its whole subtree", () => {
    const tree = buildGroupTree([
      { id: "g1", name: "L1", parentId: null, order: 0 },
      { id: "g2", name: "L2", parentId: "g1", order: 0 },
      { id: "g3", name: "L3", parentId: "g2", order: 0 },
      { id: "g4", name: "Other", parentId: null, order: 1 },
    ])
    const flat = flattenGroupTreeForSelect(tree, "g2")
    const ids = flat.map((f) => f.id)
    expect(ids).toContain("g1")
    expect(ids).toContain("g4")
    expect(ids).not.toContain("g2")
    expect(ids).not.toContain("g3")
  })
})
