import { describe, it, expect } from "vitest"
import {
  attachGlobalReferences,
  summarizeGlobalCatalog,
  type GlobalSchemaCatalog,
} from "@/lib/ai/global-schema-reuse"
import { validateBundleReferences, splitIssuesBySeverity } from "@/lib/schema-template-validation"

const catalog: GlobalSchemaCatalog = {
  components: [
    { name: "Link Navigasi", slug: "nav-link", fields: [{ name: "Label", slug: "label", type: "text" }, { name: "URL", slug: "url", type: "url" }] },
    { name: "Kartu", slug: "card", fields: [{ name: "Ikon", slug: "icon", type: "relation", relationSlug: "authors" }] },
    { name: "Tidak dipakai", slug: "unused", fields: [] },
  ],
  singleTypes: [
    { name: "Site Settings", slug: "site-settings", fields: [{ name: "Logo", slug: "logo", type: "media" }], group: "grp" },
    { name: "Homepage", slug: "homepage", fields: [{ name: "Judul", slug: "judul", type: "text" }] },
  ],
  contentTypes: [
    { name: "Penulis", slug: "authors", fields: [{ name: "Nama", slug: "nama", type: "text" }], group: "grp" },
  ],
}

const emptySchema = () => ({ contentTypes: [] as any[], singleTypes: [] as any[], components: [] as any[] })

describe("summarizeGlobalCatalog", () => {
  it("is empty when Global has no models", () => {
    expect(summarizeGlobalCatalog({ contentTypes: [], singleTypes: [], components: [] })).toBe("")
  })

  it("lists each model with its field types and reference targets", () => {
    const text = summarizeGlobalCatalog(catalog)
    expect(text).toContain("- nav-link (Link Navigasi): label:text, url:url")
    expect(text).toContain("icon:relation->authors")
    expect(text).toContain("- site-settings")
  })

  it("caps the list so a large Global schema cannot blow up the prompt", () => {
    const big: GlobalSchemaCatalog = {
      ...catalog,
      components: Array.from({ length: 100 }, (_, i) => ({ name: `C${i}`, slug: `c-${i}`, fields: [] })),
    }
    const text = summarizeGlobalCatalog(big, 10)
    expect(text).toContain("lagi tidak ditampilkan")
    expect(text.split("\n").filter((l) => l.startsWith("- ")).length).toBeLessThanOrEqual(10)
  })
})

describe("attachGlobalReferences", () => {
  it("copies a Global component the generated schema references by slug", () => {
    const schema = emptySchema()
    schema.singleTypes.push({ name: "Home", slug: "homepage", fields: [{ name: "Nav", slug: "nav", type: "component", options: { componentSlug: "nav-link", repeatable: true } }] })
    const out = attachGlobalReferences(schema, catalog)
    expect(out.components.map((c: any) => c.slug)).toContain("nav-link")
  })

  it("copies a referenced Global model's own references transitively", () => {
    const schema = emptySchema()
    schema.contentTypes.push({ name: "Artikel", slug: "articles", fields: [{ name: "Kartu", slug: "kartu", type: "component", componentSlug: "card" }] })
    const out = attachGlobalReferences(schema, catalog)
    expect(out.components.map((c: any) => c.slug)).toEqual(expect.arrayContaining(["card"]))
    expect(out.contentTypes.map((c: any) => c.slug)).toContain("authors")
  })

  it("copies a Global content type used as a relation target, without its group", () => {
    const schema = emptySchema()
    schema.contentTypes.push({ name: "Buku", slug: "books", fields: [{ name: "Penulis", slug: "penulis", type: "relation", relationSlug: "authors" }] })
    const out = attachGlobalReferences(schema, catalog)
    const authors = out.contentTypes.find((c: any) => c.slug === "authors")
    expect(authors).toBeDefined()
    expect(authors.group).toBeUndefined()
  })

  it("never replaces a model the generated schema already defines", () => {
    const schema = emptySchema()
    schema.components.push({ name: "Versi AI", slug: "nav-link", fields: [{ name: "X", slug: "x", type: "text" }] })
    schema.contentTypes.push({ name: "Buku", slug: "books", fields: [{ name: "Nav", slug: "nav", type: "component", componentSlug: "nav-link" }] })
    const out = attachGlobalReferences(schema, catalog)
    const navs = out.components.filter((c: any) => c.slug === "nav-link")
    expect(navs).toHaveLength(1)
    expect(navs[0].name).toBe("Versi AI")
  })

  it("adds Global's core Single Types when the model left them out", () => {
    const out = attachGlobalReferences(emptySchema(), catalog)
    expect(out.singleTypes.map((s: any) => s.slug)).toEqual(expect.arrayContaining(["site-settings", "homepage"]))
  })

  it("treats an aliased Site Settings or homepage as present and does not add a second one", () => {
    const schema = emptySchema()
    schema.singleTypes.push({ name: "Settings", slug: "settings", fields: [] }, { name: "Landing", slug: "landing", fields: [] })
    const out = attachGlobalReferences(schema, catalog)
    expect(out.singleTypes.map((s: any) => s.slug).sort()).toEqual(["landing", "settings"])
  })

  it("adds nothing when the generated schema references nothing in Global", () => {
    const out = attachGlobalReferences(emptySchema(), { contentTypes: [], singleTypes: [], components: [] })
    expect(out).toEqual(emptySchema())
  })

  it("the result passes the save-time reference check (blocking issues are none)", () => {
    const schema = emptySchema()
    schema.singleTypes.push({ name: "Home", slug: "homepage", fields: [{ name: "Nav", slug: "nav", type: "component", options: { componentSlug: "nav-link", repeatable: true } }] })
    const out = attachGlobalReferences(schema, catalog)
    const { blocking } = splitIssuesBySeverity(validateBundleReferences(out as any))
    expect(blocking).toEqual([])
  })
})
