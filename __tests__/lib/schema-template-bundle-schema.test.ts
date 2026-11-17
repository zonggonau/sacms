import { describe, it, expect } from "vitest"
import { schemaTemplateBundleSchema, schemaTemplateFieldSchema, schemaTemplateModelSchema } from "@/lib/validations/schema-template"

// Fourth external audit, ERR-4: `type`/model `slug` were briefly tightened
// to a strict z.enum/regex directly on this zod shape — confirmed live
// this broke error quality for the MCP server specifically. This shape is
// embedded in every affected tool's OWN `inputSchema`, and the MCP SDK's
// validateToolInput parses the FULL inputSchema (including this nested
// shape) BEFORE the handler ever runs: a zod-level rejection here never
// reaches the handler's own validateBundleReferences pass at all, so the
// caller got the SDK's generic, stop-at-first-issue McpError instead of a
// real structuredContent.code with every issue itemized. Kept loose here
// on purpose — see __tests__/lib/schema-template-validation.test.ts for
// where `type`/slug format are actually enforced now (past the SDK's own
// pre-handler gate).
describe("schemaTemplateFieldSchema's type (deliberately loose)", () => {
  it("accepts every real field type", () => {
    for (const type of ["text", "richText", "relation", "component", "repeater", "document_template"]) {
      expect(schemaTemplateFieldSchema.safeParse({ name: "X", slug: "x", type }).success).toBe(true)
    }
  })

  it("does NOT reject a fictional/typo'd field type at this layer — see validateBundleReferences instead", () => {
    const result = schemaTemplateFieldSchema.safeParse({ name: "X", slug: "x", type: "nonsense" })
    expect(result.success).toBe(true)
  })
})

describe("schemaTemplateModelSchema's slug (deliberately loose)", () => {
  it("accepts a kebab-case slug", () => {
    expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug: "blog-posts", fields: [] }).success).toBe(true)
  })

  it("does NOT reject a malformed slug (spaces/uppercase/punctuation) at this layer — see validateBundleReferences instead", () => {
    for (const slug of ["blog posts", "BlogPosts", "blog-posts!"]) {
      expect(schemaTemplateModelSchema.safeParse({ name: "Posts", slug, fields: [] }).success).toBe(true)
    }
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

  it("still rejects a bundle with a genuinely malformed shape (missing required fields)", () => {
    const bundle = { contentTypes: [{ slug: "articles" }] } // missing `name`, `fields`
    expect(schemaTemplateBundleSchema.safeParse(bundle).success).toBe(false)
  })
})
