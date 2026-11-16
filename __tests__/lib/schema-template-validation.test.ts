import { describe, it, expect } from "vitest"
import { formatZodPath, validateBundleReferences } from "@/lib/schema-template-validation"

describe("formatZodPath", () => {
  it("renders a numeric segment as a bracket index, not a dotted segment", () => {
    expect(formatZodPath(["contentTypes", 2, "fields", 4, "options", "choices"])).toBe(
      "contentTypes[2].fields[4].options.choices",
    )
  })

  it("renders a single string path with no leading dot", () => {
    expect(formatZodPath(["name"])).toBe("name")
  })

  it("renders an empty path as an empty string", () => {
    expect(formatZodPath([])).toBe("")
  })

  it("coerces a symbol segment to a string instead of throwing", () => {
    const sym = Symbol("weird")
    expect(formatZodPath(["a", sym])).toBe(`a.${String(sym)}`)
  })
})

describe("validateBundleReferences", () => {
  // chatgpt7.md P0: "validate before saving" — these are the exact cross-
  // reference and option checks a zod shape check alone never caught, so
  // a typo'd relationSlug/componentSlug, an allowedComponents entry for a
  // component that doesn't exist in the same bundle, or a select/
  // multiselect with no choices at all could be saved and only fail
  // silently later, at content-entry time in a real workspace.

  it("passes a bundle with no relation/component/select fields at all", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "title" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("passes a relation field whose relationSlug matches a contentType in the same bundle", () => {
    const bundle = {
      contentTypes: [
        { slug: "posts", fields: [{ type: "relation", slug: "author", relationSlug: "authors" }] },
        { slug: "authors", fields: [] },
      ],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("passes a relation field whose relationSlug matches a singleType in the same bundle", () => {
    const bundle = {
      contentTypes: [{ slug: "posts", fields: [{ type: "relation", slug: "settings", relationSlug: "site-settings" }] }],
      singleTypes: [{ slug: "site-settings", fields: [] }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags a relation field whose relationSlug matches nothing in the bundle", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "relation", slug: "author", relationSlug: "ghost-model" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].relationSlug", message: expect.stringContaining("ghost-model") }])
  })

  it("never flags a relation field targeting 'member' — that table never appears in a template bundle", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "relation", slug: "owner", relationSlug: "whatever", options: { targetModel: "member" } }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags a component field whose options.componentSlug doesn't exist in components[]", () => {
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "component", slug: "hero", options: { componentSlug: "hero_banner" } }] }], components: [{ slug: "cta_block" }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.componentSlug", message: expect.stringContaining("hero_banner") }])
  })

  it("passes a component field whose componentSlug DOES exist", () => {
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "component", slug: "hero", options: { componentSlug: "hero_banner" } }] }], components: [{ slug: "hero_banner" }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags each invalid entry in a repeater's allowedComponents array, by its own index", () => {
    const bundle = {
      contentTypes: [{ slug: "pages", fields: [{ type: "repeater", slug: "sections", options: { allowedComponents: ["hero_banner", "ghost_component", "cta_block"] } }] }],
      components: [{ slug: "hero_banner" }, { slug: "cta_block" }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.allowedComponents[1]", message: expect.stringContaining("ghost_component") }])
  })

  it("flags a select field with no options.choices at all", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "select", slug: "status" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.choices", message: expect.stringContaining("non-empty") }])
  })

  it("flags a select field with an EMPTY options.choices array", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "select", slug: "status", options: { choices: [] } }] }] }
    expect(validateBundleReferences(bundle)).toHaveLength(1)
  })

  it("passes a select field with at least one choice", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "select", slug: "status", options: { choices: [{ label: "Draft", value: "draft" }] } }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("applies the same choices check to multiselect", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "multiselect", slug: "tags" }] }] }
    expect(validateBundleReferences(bundle)).toHaveLength(1)
  })

  it("checks fields inside singleTypes and components too, not just contentTypes", () => {
    const bundleSingle = { singleTypes: [{ slug: "home", fields: [{ type: "select", slug: "theme" }] }] }
    expect(validateBundleReferences(bundleSingle)[0].path).toBe("singleTypes[0].fields[0].options.choices")

    const bundleComponent = { components: [{ slug: "hero", fields: [{ type: "select", slug: "variant" }] }] }
    expect(validateBundleReferences(bundleComponent)[0].path).toBe("components[0].fields[0].options.choices")
  })

  it("collects every issue across multiple models/fields in one pass, not just the first", () => {
    const bundle = {
      contentTypes: [
        { slug: "posts", fields: [{ type: "select", slug: "status" }, { type: "relation", slug: "author", relationSlug: "ghost" }] },
      ],
    }
    expect(validateBundleReferences(bundle)).toHaveLength(2)
  })

  it("returns no issues for a completely empty bundle", () => {
    expect(validateBundleReferences({})).toEqual([])
  })

  // chatgpt8.md P1: a contentTypes[].group or groups[].parentSlug typo used
  // to be silently dropped at materialize time instead of reported here.

  it("passes a contentType whose group matches a declared groups[] slug", () => {
    const bundle = { groups: [{ slug: "marketing", name: "Marketing" }], contentTypes: [{ slug: "posts", group: "marketing", fields: [] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags a contentType whose group doesn't match any declared groups[] slug", () => {
    const bundle = { groups: [{ slug: "marketing", name: "Marketing" }], contentTypes: [{ slug: "posts", group: "markting-typo", fields: [] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].group", message: expect.stringContaining("markting-typo") }])
  })

  it("flags a groups[].parentSlug that doesn't match any other groups[] slug", () => {
    const bundle = { groups: [{ slug: "child", name: "Child", parentSlug: "ghost-parent" }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "groups[0].parentSlug", message: expect.stringContaining("ghost-parent") }])
  })

  it("passes a groups[].parentSlug that matches a sibling group", () => {
    const bundle = { groups: [{ slug: "parent", name: "Parent" }, { slug: "child", name: "Child", parentSlug: "parent" }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })
})
