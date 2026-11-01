import { describe, it, expect } from "vitest"
import { materializeSchemaIntoTenant, serializeTenantSchema } from "@/lib/schema-template-sync"

// Minimal in-memory fake standing in for a tenant's Prisma client — just
// enough of contentTypeGroup/contentType/singleType/component to exercise
// the group-resolution logic added to materializeSchemaIntoTenant (JSON ->
// real rows) and serializeTenantSchema (real rows -> JSON) without a real
// database. State is shared between "transaction" (tx) calls and the
// top-level findMany calls serializeTenantSchema makes directly.
function makeFakeTenantDb() {
  const groups: { id: string; tenantId: string; name: string; parentId: string | null; order: number }[] = []
  const contentTypes: any[] = []
  let groupSeq = 0
  let ctSeq = 0

  const contentTypeGroupApi = {
    findFirst: async ({ where }: any) =>
      groups.find((g) => g.tenantId === where.tenantId && g.name === where.name && g.parentId === (where.parentId ?? null)) ?? null,
    create: async ({ data }: any) => {
      const g = { id: `g${++groupSeq}`, tenantId: data.tenantId, name: data.name, parentId: data.parentId ?? null, order: data.order }
      groups.push(g)
      return g
    },
    count: async ({ where }: any) =>
      groups.filter((g) => g.tenantId === where.tenantId && g.parentId === (where.parentId ?? null)).length,
    findMany: async ({ where }: any) => groups.filter((g) => g.tenantId === where.tenantId),
  }

  const contentTypeApi = {
    findFirst: async ({ where }: any) => contentTypes.find((ct) => ct.tenantId === where.tenantId && ct.slug === where.slug) ?? null,
    create: async ({ data }: any) => {
      const { schemaFields, tenants, ...rest } = data
      const ct = { id: `ct${++ctSeq}`, schemaFields: (schemaFields?.create ?? []).map((f: any, i: number) => ({ id: `f${i}`, ...f })), ...rest }
      contentTypes.push(ct)
      return ct
    },
    count: async ({ where }: any) => contentTypes.filter((ct) => ct.groupId === where.groupId).length,
    findMany: async ({ where }: any) => contentTypes.filter((ct) => ct.tenantId === where.tenantId),
  }

  const noopModel = {
    findFirst: async () => null,
    create: async ({ data }: any) => ({ id: "noop1", schemaFields: [], ...data }),
    findMany: async () => [],
  }

  const tx = { contentTypeGroup: contentTypeGroupApi, contentType: contentTypeApi, singleType: noopModel, component: noopModel }
  const tenantDb: any = {
    $transaction: async (fn: any) => fn(tx),
    contentTypeGroup: contentTypeGroupApi,
    contentType: contentTypeApi,
    singleType: noopModel,
    component: noopModel,
  }
  return { tenantDb, groups, contentTypes }
}

describe("materializeSchemaIntoTenant — groups", () => {
  it("creates groups in array order and resolves a contentType's `group` slug to the real groupId", async () => {
    const { tenantDb, groups, contentTypes } = makeFakeTenantDb()

    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      groups: [{ slug: "biz", name: "Business" }],
      contentTypes: [{ name: "Products", slug: "products", fields: [], group: "biz" }],
    })

    expect(groups).toHaveLength(1)
    expect(contentTypes[0].groupId).toBe(groups[0].id)
    expect(contentTypes[0].groupOrder).toBe(0)
  })

  it("nests a child group under its already-created parent via parentSlug", async () => {
    const { tenantDb, groups } = makeFakeTenantDb()

    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      groups: [
        { slug: "biz", name: "Business" },
        { slug: "retail", name: "Retail", parentSlug: "biz" },
      ],
      contentTypes: [],
    })

    const biz = groups.find((g) => g.name === "Business")!
    const retail = groups.find((g) => g.name === "Retail")!
    expect(retail.parentId).toBe(biz.id)
  })

  it("flattens a group to top-level instead of failing when nesting would exceed the 3-level cap", async () => {
    const { tenantDb, groups } = makeFakeTenantDb()

    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      groups: [
        { slug: "l1", name: "Level 1" },
        { slug: "l2", name: "Level 2", parentSlug: "l1" },
        { slug: "l3", name: "Level 3", parentSlug: "l2" },
        { slug: "l4", name: "Level 4 (too deep)", parentSlug: "l3" },
      ],
      contentTypes: [],
    })

    const l4 = groups.find((g) => g.name === "Level 4 (too deep)")!
    expect(l4.parentId).toBeNull()
  })

  it("reuses an existing group with the same name+parent instead of creating a duplicate", async () => {
    const { tenantDb, groups } = makeFakeTenantDb()
    const schema = { groups: [{ slug: "biz", name: "Business" }], contentTypes: [] }

    await materializeSchemaIntoTenant(tenantDb, "tenant1", schema)
    await materializeSchemaIntoTenant(tenantDb, "tenant1", schema)

    expect(groups).toHaveLength(1)
  })

  it("ignores `group` for a contentType whose slug points at nothing (unknown group slug)", async () => {
    const { tenantDb, contentTypes } = makeFakeTenantDb()

    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      contentTypes: [{ name: "Products", slug: "products", fields: [], group: "does-not-exist" }],
    })

    expect(contentTypes[0].groupId).toBeNull()
  })
})

describe("serializeTenantSchema — groups", () => {
  it("round-trips a flat group assignment back into groups[]/group", async () => {
    const { tenantDb } = makeFakeTenantDb()
    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      groups: [{ slug: "biz", name: "Business" }],
      contentTypes: [{ name: "Products", slug: "products", fields: [], group: "biz" }],
    })

    const result = await serializeTenantSchema(tenantDb, { tenantId: "tenant1" } as any)

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].name).toBe("Business")
    expect(result.contentTypes[0].group).toBe(result.groups[0].slug)
  })

  it("includes an ancestor group even though it has no content types directly in it, to preserve nesting", async () => {
    const { tenantDb } = makeFakeTenantDb()
    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      groups: [
        { slug: "biz", name: "Business" },
        { slug: "retail", name: "Retail", parentSlug: "biz" },
      ],
      contentTypes: [{ name: "Products", slug: "products", fields: [], group: "retail" }],
    })

    const result = await serializeTenantSchema(tenantDb, { tenantId: "tenant1" } as any)

    expect(result.groups.map((g) => g.name)).toEqual(["Business", "Retail"])
    const retailOut = result.groups.find((g) => g.name === "Retail")!
    const bizOut = result.groups.find((g) => g.name === "Business")!
    expect(retailOut.parentSlug).toBe(bizOut.slug)
  })

  it("omits groups entirely when no content type uses one", async () => {
    const { tenantDb } = makeFakeTenantDb()
    await materializeSchemaIntoTenant(tenantDb, "tenant1", {
      contentTypes: [{ name: "Products", slug: "products", fields: [] }],
    })

    const result = await serializeTenantSchema(tenantDb, { tenantId: "tenant1" } as any)
    expect(result.groups).toEqual([])
    expect(result.contentTypes[0].group).toBeUndefined()
  })
})
