import { describe, it, expect } from "vitest"
import { schemaTemplateBundleSchema, schemaTemplateFieldSchema, schemaTemplateModelSchema } from "@/lib/validations/schema-template"

// Report P1 (gap #3, weak field-type definitions): `type` used to be a bare
// z.string() — a typo'd/fictional type passed zod untouched and was only
// caught later by validateBundleReferences' own separate check. Now a
// strict enum of the real 36 types, rejected at the zod layer directly.
describe("schemaTemplateFieldSchema's type", () => {
  it("accepts every real field type", () => {
    for (const type of ["text", "richText", "relation", "component", "repeater", "document_template"]) {
      expect(schemaTemplateFieldSchema.safeParse({ name: "X", slug: "x", type }).success).toBe(true)
    }
  })

  it("rejects a fictional/typo'd field type", () => {
    const result = schemaTemplateFieldSchema.safeParse({ name: "X", slug: "x", type: "nonsense" })
    expect(result.success).toBe(false)
  })
})

// Report P1 (gap #1, malformed slugs): schema-template-sync.ts's materialize
// step writes a model's slug straight into the real ContentType/SingleType/
// Component row with no format check of its own — a template slug with
// spaces/uppercase/punctuation would silently create a real DB row no
// human-driven creation route would ever allow.
describe("schemaTemplateModelSchema's slug", () => {
  it("accepts a kebab-case slug", () => {
    expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug: "blog-posts", fields: [] }).success).toBe(true)
  })

  it("rejects a slug with spaces", () => {
    expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug: "blog posts", fields: [] }).success).toBe(false)
  })

  it("rejects a slug with uppercase letters", () => {
    expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug: "BlogPosts", fields: [] }).success).toBe(false)
  })

  it("rejects a slug with punctuation", () => {
    expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug: "blog-posts!", fields: [] }).success).toBe(false)
  })
})

describe("schemaTemplateBundleSchema end-to-end", () => {
  it("accepts a well-formed bundle", () => {
    const bundle = {
      contentTypes: [{
        name: "Articles",
        slug: "articles",
        fields: [{ name: "Title", slug: "title", type: "text" }],
      }],
    }
    expect(schemaTemplateBundleSchema.safeParse(bundle).success).toBe(true)
  })

  it("rejects a bundle with a fictional field type nested inside a model", () => {
    const bundle = {
      contentTypes: [{
        name: "Articles",
        slug: "articles",
        fields: [{ name: "Title", slug: "title", type: "made-up-type" }],
      }],
    }
    expect(schemaTemplateBundleSchema.safeParse(bundle).success).toBe(false)
  })
})
