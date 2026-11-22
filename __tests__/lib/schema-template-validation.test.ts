import { describe, it, expect } from "vitest"
import { formatZodPath, validateBundleReferences, splitIssuesBySeverity, remapIssuePathsToInput } from "@/lib/schema-template-validation"

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
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "component", slug: "hero", options: { componentSlug: "hero-banner" } }] }], components: [{ slug: "cta-block" }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.componentSlug", message: expect.stringContaining("hero-banner") }])
  })

  it("passes a component field whose componentSlug DOES exist", () => {
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "component", slug: "hero", options: { componentSlug: "hero-banner" } }] }], components: [{ slug: "hero-banner" }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags each invalid entry in a repeater's allowedComponents array, by its own index", () => {
    const bundle = {
      contentTypes: [{ slug: "pages", fields: [{ type: "repeater", slug: "sections", options: { allowedComponents: ["hero-banner", "ghost-component", "cta-block"] } }] }],
      components: [{ slug: "hero-banner" }, { slug: "cta-block" }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.allowedComponents[1]", message: expect.stringContaining("ghost-component") }])
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

  // chatgpt.md P1: a fictional field type (e.g. "nonsense") used to pass
  // straight through — schemaTemplateFieldSchema's own `type` is a bare
  // z.string(), and the real content-entry validator's switch statement
  // falls back to z.any() for an unrecognized type too, so nothing
  // anywhere ever rejected it.

  it("flags a field whose type isn't one of the real 36 field types", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "nonsense", slug: "whatever" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].type", message: expect.stringContaining("nonsense") }])
  })

  it("does not flag any of the real field types", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "richText", slug: "body" }, { type: "dateRange", slug: "window" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  // chatgpt.md P1: dummyData was never validated at all — a select value
  // outside its own options.choices passed silently, even though that
  // exact value would be rejected by real content creation's own
  // generateContentSchema. Reusing that same validator here instead of
  // inventing new, possibly-stricter rules.

  it("flags a dummyData select value outside its own options.choices", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "select", slug: "status", options: { choices: [{ label: "Live", value: "live" }] } }],
        dummyData: [{ status: "not-a-real-choice" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].dummyData[0].status")).toBe(true)
  })

  it("passes a dummyData value that IS one of its field's options.choices", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "select", slug: "status", options: { choices: [{ label: "Live", value: "live" }] } }],
        dummyData: [{ status: "live" }],
      }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("does NOT flag a number in a text field's dummyData — real content creation coerces it to a string too, by design", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "text", slug: "title" }],
        dummyData: [{ title: 42 }],
      }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags an invalid email in a dummyData entry", () => {
    const bundle = {
      contentTypes: [{
        slug: "contacts",
        fields: [{ type: "email", slug: "contactEmail" }],
        dummyData: [{ contactEmail: "not-an-email" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].dummyData[0].contactEmail")).toBe(true)
  })

  it("skips dummyData validation entirely when a model has none", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "title" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  // Report P1 (gap #1): each of contentTypes/singleTypes/components backs
  // a real `@@unique([tenantId, slug])` table — two entries sharing a
  // slug in the same array used to pass validation fine and only fail
  // much later, as a raw Prisma P2002 thrown mid-materialize.

  it("flags two contentTypes sharing the same slug", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [] }, { slug: "authors", fields: [] }, { slug: "posts", fields: [] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[2].slug", message: expect.stringContaining("posts") }])
  })

  it("does not flag the same slug reused across DIFFERENT arrays (separate tables)", () => {
    const bundle = { contentTypes: [{ slug: "settings", fields: [] }], singleTypes: [{ slug: "settings", fields: [] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags two components sharing the same slug", () => {
    const bundle = { components: [{ slug: "hero", fields: [] }, { slug: "hero", fields: [] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "components[1].slug", message: expect.stringContaining("hero") }])
  })

  it("flags two groups sharing the same slug", () => {
    const bundle = { groups: [{ slug: "marketing", name: "Marketing" }, { slug: "marketing", name: "Marketing 2" }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "groups[1].slug", message: expect.stringContaining("marketing") }])
  })

  it("flags two fields sharing the same slug within the same model", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "title" }, { type: "textarea", slug: "title" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[1].slug", message: expect.stringContaining("title") }])
  })

  it("does not flag the same field slug reused across DIFFERENT models", () => {
    const bundle = {
      contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "title" }] }],
      singleTypes: [{ slug: "home", fields: [{ type: "text", slug: "title" }] }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  // Report P1 (gap #4): `componentSlugs` is a documented-dead typo for
  // repeater's real `allowedComponents` key (see list_field_types'
  // own note) — until now nothing actually checked for it, so it
  // silently fell through to "every component is allowed".

  it("flags a repeater field using the wrong key 'componentSlugs' instead of 'allowedComponents', as a warning (not blocking — 'every component allowed' is still valid)", () => {
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "repeater", slug: "sections", options: { componentSlugs: ["hero-banner"] } }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[0].options.componentSlugs", message: expect.stringContaining("allowedComponents"), severity: "warning" }])
  })

  it("does not flag a repeater field with neither key (every component allowed, by design)", () => {
    const bundle = { contentTypes: [{ slug: "pages", fields: [{ type: "repeater", slug: "sections" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  // Third external audit round (sacms-mcp-audit.mjs VAL-6..17)

  it("flags a 'slug'-type field with no title/judul/name sibling and no matching options.sourceField, as a warning", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "headline" }, { type: "slug", slug: "permalink" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].fields[1]", message: expect.stringContaining("title"), severity: "warning" }])
  })

  it("does not flag a 'slug'-type field with a 'title' sibling", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "title" }, { type: "slug", slug: "permalink" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("does not flag a 'slug'-type field whose options.sourceField matches a real sibling field", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "headline" }, { type: "slug", slug: "permalink", options: { sourceField: "headline" } }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("rejects a model slug with spaces, uppercase, or punctuation (materializes straight into a real ContentType/SingleType/Component row with no format check of its own)", () => {
    for (const slug of ["Blog Posts", "BlogPosts", "blog-posts!"]) {
      const bundle = { contentTypes: [{ slug, fields: [] }] }
      const issues = validateBundleReferences(bundle)
      expect(issues.some((i) => i.path === "contentTypes[0].slug"), `'${slug}' should be flagged`).toBe(true)
    }
  })

  it("accepts a kebab-case model slug", () => {
    const bundle = { contentTypes: [{ slug: "blog-posts", fields: [] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("rejects a malformed groups[].slug the same way", () => {
    const bundle = { groups: [{ slug: "Marketing Team", name: "Marketing" }] }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "groups[0].slug")).toBe(true)
  })

  it("rejects a field slug with spaces or punctuation", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "Judul Besar" }] }] }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].fields[0].slug")).toBe(true)
  })

  it("accepts camelCase and snake_case field slugs", () => {
    const bundle = { contentTypes: [{ slug: "posts", fields: [{ type: "text", slug: "coverImage" }, { type: "text", slug: "cover_image" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("exempts document_template fields from the field-slug format check (verbatim .docx placeholder keys)", () => {
    const bundle = { contentTypes: [{ slug: "letters", fields: [{ type: "document_template", slug: "Nama Lengkap!!" }] }] }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags an invalid hex color in dummyData", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "color", slug: "accent" }],
        dummyData: [{ accent: "bukan-warna" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].dummyData[0].accent")).toBe(true)
  })

  it("passes a valid hex color in dummyData", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "color", slug: "accent" }],
        dummyData: [{ accent: "#1a2b3c" }],
      }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags an unparseable date in dummyData", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "date", slug: "publishedAt" }],
        dummyData: [{ publishedAt: "kemarin" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].dummyData[0].publishedAt")).toBe(true)
  })

  it("flags a non-boolean value in a boolean dummyData field, even a truthy-coercible string", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "boolean", slug: "breaking" }],
        dummyData: [{ breaking: "ya" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues.some((i) => i.path === "contentTypes[0].dummyData[0].breaking")).toBe(true)
  })

  it("passes a real boolean literal in dummyData", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "boolean", slug: "breaking" }],
        dummyData: [{ breaking: true }],
      }],
    }
    expect(validateBundleReferences(bundle)).toEqual([])
  })

  it("flags a dummyData key with no matching field slug in the model, as a warning", () => {
    const bundle = {
      contentTypes: [{
        slug: "posts",
        fields: [{ type: "text", slug: "title" }],
        dummyData: [{ title: "Judul", fieldAsing: "typo" }],
      }],
    }
    const issues = validateBundleReferences(bundle)
    expect(issues).toEqual([{ path: "contentTypes[0].dummyData[0].fieldAsing", message: expect.stringContaining("fieldAsing"), severity: "warning" }])
  })
})

describe("splitIssuesBySeverity", () => {
  it("separates warning-severity issues from everything else (absent severity defaults to blocking)", () => {
    const { blocking, warnings } = splitIssuesBySeverity([
      { path: "a", message: "blocking, no severity set" },
      { path: "b", message: "explicit error", severity: "error" },
      { path: "c", message: "a warning", severity: "warning" },
    ])
    expect(blocking.map((i) => i.path)).toEqual(["a", "b"])
    expect(warnings.map((i) => i.path)).toEqual(["c"])
  })
})

describe("remapIssuePathsToInput", () => {
  const merged = {
    contentTypes: [{ slug: "kategori" }, { slug: "posts" }, { slug: "pages" }, { slug: "produk" }],
  }
  const input = { contentTypes: [{ slug: "produk" }] }

  it("rewrites a merged index back to the caller's own index by slug", () => {
    const [issue] = remapIssuePathsToInput([{ path: "contentTypes[3].fields[0].type", message: "bad type" }], merged, input)
    expect(issue.path).toBe("contentTypes[0].fields[0].type")
  })

  it("labels a model that came only from the starter instead of pointing at input the caller never sent", () => {
    const [issue] = remapIssuePathsToInput([{ path: "contentTypes[1].fields[2].relationSlug", message: "missing target" }], merged, input)
    expect(issue.path).toBe("starter.contentTypes(posts).fields[2].relationSlug")
    expect(issue.message).toMatch(/platform starter/)
  })

  it("maps a duplicated slug to the matching duplicate, not the first occurrence", () => {
    const dupMerged = { contentTypes: [{ slug: "pages" }, { slug: "x" }, { slug: "x" }] }
    const dupInput = { contentTypes: [{ slug: "x" }, { slug: "x" }] }
    const [issue] = remapIssuePathsToInput([{ path: "contentTypes[2].slug", message: "duplicate" }], dupMerged, dupInput)
    expect(issue.path).toBe("contentTypes[1].slug")
  })

  it("leaves non-model paths untouched", () => {
    const [issue] = remapIssuePathsToInput([{ path: "excludeDefaultContentTypes[0]", message: "x" }], merged, input)
    expect(issue.path).toBe("excludeDefaultContentTypes[0]")
  })
})

describe("dummyData required-field warning", () => {
  it("warns (never blocks) when a dummyData row omits a required field the demo seeder would placeholder-fill", () => {
    const issues = validateBundleReferences({
      contentTypes: [{
        slug: "produk",
        fields: [
          { name: "Judul", slug: "title", type: "text" },
          { name: "Harga", slug: "harga", type: "number", required: true },
          { name: "Gambar", slug: "gambar", type: "media", required: true },
        ],
        dummyData: [{ title: "Kopi" }],
      }],
      singleTypes: [],
      components: [],
    } as any)
    const warning = issues.find((i) => i.path === "contentTypes[0].dummyData[0].harga")
    expect(warning?.severity).toBe("warning")
    // media has no placeholder — it would just stay empty, so no warning
    expect(issues.find((i) => i.path === "contentTypes[0].dummyData[0].gambar")).toBeUndefined()
  })
})
