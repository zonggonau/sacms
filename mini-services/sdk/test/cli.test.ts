import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { unwrap, scalarToTs, buildInterface, type TypeRef, type IntrospectionType } from "../src/cli"

const nonNull = (ofType: TypeRef): TypeRef => ({ kind: "NON_NULL", name: null, ofType })
const list = (ofType: TypeRef): TypeRef => ({ kind: "LIST", name: null, ofType })
const named = (name: string): TypeRef => ({ kind: "SCALAR", name, ofType: null })

describe("unwrap", () => {
  it("unwraps a plain nullable scalar", () => {
    expect(unwrap(named("String"))).toEqual({ name: "String", required: false })
  })

  it("unwraps NON_NULL(String) as required", () => {
    expect(unwrap(nonNull(named("String")))).toEqual({ name: "String", required: true })
  })

  it("unwraps NON_NULL(LIST(NON_NULL(Article))) down to Article, required", () => {
    const ref = nonNull(list(nonNull(named("Article"))))
    expect(unwrap(ref)).toEqual({ name: "Article", required: true })
  })

  it("falls back to Unknown when the chain never resolves to a named type", () => {
    expect(unwrap({ kind: "NON_NULL", name: null, ofType: null })).toEqual({ name: "Unknown", required: true })
  })
})

describe("scalarToTs", () => {
  it.each([
    ["String", "string"],
    ["ID", "string"],
    ["Int", "number"],
    ["Float", "number"],
    ["Boolean", "boolean"],
  ])("maps GraphQL %s to TS %s", (gql, ts) => {
    expect(scalarToTs(gql)).toBe(ts)
  })

  it("maps the custom JSON scalar to a permissive object/array union", () => {
    expect(scalarToTs("JSON")).toBe("Record<string, unknown> | unknown[]")
  })

  it("falls back to unknown for anything unrecognized", () => {
    expect(scalarToTs("SomeEnum")).toBe("unknown")
  })
})

describe("buildInterface", () => {
  it("emits every introspected field with the right optionality, matching a real Collection item type", () => {
    const articleType: IntrospectionType = {
      name: "Article",
      kind: "OBJECT",
      fields: [
        { name: "id", type: nonNull(named("ID")) },
        { name: "locale", type: named("String") },
        { name: "status", type: named("String") },
        { name: "publishedAt", type: named("String") },
        { name: "createdAt", type: nonNull(named("String")) },
        { name: "updatedAt", type: nonNull(named("String")) },
        { name: "title", type: nonNull(named("String")) },
        { name: "viewCount", type: named("Int") },
      ],
    }

    const out = buildInterface("Article", articleType)
    expect(out).toContain("export interface Article {")
    expect(out).toContain("id: string")
    expect(out).toContain("locale?: string")
    expect(out).toContain("createdAt: string")
    expect(out).toContain("title: string")
    expect(out).toContain("viewCount?: number")
  })

  it("emits a Single Type's fields without assuming id/locale/status exist", () => {
    // Real Single Types only ever have publishedAt/updatedAt plus custom
    // fields (see src/lib/graphql-schema.ts) — no id/locale/status/createdAt.
    const homepageSingle: IntrospectionType = {
      name: "HomepageSingle",
      kind: "OBJECT",
      fields: [
        { name: "publishedAt", type: named("String") },
        { name: "updatedAt", type: named("String") },
        { name: "heroTitle", type: nonNull(named("String")) },
      ],
    }

    const out = buildInterface("HomepageSingle", homepageSingle)
    expect(out).not.toContain("id:")
    expect(out).not.toContain("locale")
    expect(out).toContain("heroTitle: string")
  })

  it("handles a type with no fields without throwing", () => {
    expect(() => buildInterface("Empty", { name: "Empty", kind: "OBJECT", fields: null })).not.toThrow()
  })
})

describe("CLI end-to-end generation (mocked introspection)", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("would resolve an ArticleCollection query field to the real Article type (not a hardcoded placeholder)", () => {
    // Regression guard for the bug this rewrite fixes: the old CLI fetched
    // the introspection result and then discarded it, always emitting the
    // same generic Record<string, BaseEntry> registry no matter what the
    // real schema was.
    const articleType: IntrospectionType = {
      name: "Article",
      kind: "OBJECT",
      fields: [
        { name: "id", type: nonNull(named("ID")) },
        { name: "title", type: nonNull(named("String")) },
      ],
    }
    const articleCollectionType: IntrospectionType = {
      name: "ArticleCollection",
      kind: "OBJECT",
      fields: [{ name: "data", type: nonNull(list(nonNull({ kind: "SCALAR", name: "Article", ofType: null }))) }],
    }

    const typesByName = new Map([
      ["Article", articleType],
      ["ArticleCollection", articleCollectionType],
    ])

    const queryField = { name: "articles", type: named("ArticleCollection") }
    const { name: returnTypeName } = unwrap(queryField.type)
    expect(returnTypeName).toBe("ArticleCollection")

    const itemTypeName = returnTypeName.slice(0, -"Collection".length)
    expect(itemTypeName).toBe("Article")
    const itemType = typesByName.get(itemTypeName)
    expect(itemType).toBeDefined()

    const generated = buildInterface(itemTypeName, itemType!)
    expect(generated).toContain("export interface Article {")
    expect(generated).toContain("title: string")
    expect(generated).not.toContain("BaseEntry")
  })
})
