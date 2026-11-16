import { describe, it, expect } from "vitest"
import {
  websiteTemplateFileSchema,
  websiteTemplateFilesSchema,
  createWebsiteTemplateSchema,
  updateWebsiteTemplateSchema,
} from "@/lib/validations/website-template"

describe("websiteTemplateFileSchema", () => {
  it("accepts a plain text file", () => {
    const result = websiteTemplateFileSchema.safeParse({ path: "app/page.tsx", content: "export default function Page() {}" })
    expect(result.success).toBe(true)
  })

  it("rejects an empty path", () => {
    expect(websiteTemplateFileSchema.safeParse({ path: "", content: "x" }).success).toBe(false)
  })

  it("rejects content over the ~200KB cap", () => {
    const huge = "x".repeat(200_001)
    expect(websiteTemplateFileSchema.safeParse({ path: "app/page.tsx", content: huge }).success).toBe(false)
  })

  // chatgpt8.md P1: these paths used to reach deployToVercel unchecked.
  it("rejects a path with a '..' traversal segment", () => {
    expect(websiteTemplateFileSchema.safeParse({ path: "../../.env", content: "x" }).success).toBe(false)
    expect(websiteTemplateFileSchema.safeParse({ path: "app/../../.env", content: "x" }).success).toBe(false)
    expect(websiteTemplateFileSchema.safeParse({ path: "..", content: "x" }).success).toBe(false)
  })

  it("rejects an absolute path", () => {
    expect(websiteTemplateFileSchema.safeParse({ path: "/etc/passwd", content: "x" }).success).toBe(false)
  })

  it("accepts an ordinary filename that merely contains two dots", () => {
    expect(websiteTemplateFileSchema.safeParse({ path: "app/..weird-file.ts", content: "x" }).success).toBe(true)
    expect(websiteTemplateFileSchema.safeParse({ path: ".env.example", content: "x" }).success).toBe(true)
  })
})

describe("websiteTemplateFilesSchema", () => {
  it("requires at least one file", () => {
    expect(websiteTemplateFilesSchema.safeParse([]).success).toBe(false)
  })

  it("rejects more than 200 files", () => {
    const files = Array.from({ length: 201 }, (_, i) => ({ path: `file-${i}.ts`, content: "x" }))
    expect(websiteTemplateFilesSchema.safeParse(files).success).toBe(false)
  })

  it("accepts a normal small bundle", () => {
    const files = [
      { path: "package.json", content: "{}" },
      { path: "app/page.tsx", content: "export default function Page() { return null }" },
    ]
    expect(websiteTemplateFilesSchema.safeParse(files).success).toBe(true)
  })

  it("rejects two files sharing the same path", () => {
    const files = [
      { path: "app/page.tsx", content: "a" },
      { path: "app/page.tsx", content: "b" },
    ]
    const result = websiteTemplateFilesSchema.safeParse(files)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Duplicate file path/)
    }
  })
})

describe("createWebsiteTemplateSchema", () => {
  const base = {
    schemaTemplateId: "tmpl_1",
    name: "Company Profile — Modern Dark",
    files: [{ path: "app/page.tsx", content: "export default function Page() { return null }" }],
  }

  it("accepts the minimal valid shape", () => {
    expect(createWebsiteTemplateSchema.safeParse(base).success).toBe(true)
  })

  it("requires schemaTemplateId", () => {
    const { schemaTemplateId, ...rest } = base
    expect(createWebsiteTemplateSchema.safeParse(rest).success).toBe(false)
  })

  it("requires a non-empty name", () => {
    expect(createWebsiteTemplateSchema.safeParse({ ...base, name: "" }).success).toBe(false)
  })

  it("requires at least one file", () => {
    expect(createWebsiteTemplateSchema.safeParse({ ...base, files: [] }).success).toBe(false)
  })

  it("accepts optional icon/description/published", () => {
    const result = createWebsiteTemplateSchema.safeParse({ ...base, icon: "🖥️", description: "desc", published: true })
    expect(result.success).toBe(true)
  })
})

describe("updateWebsiteTemplateSchema", () => {
  it("accepts an empty patch (no-op update)", () => {
    expect(updateWebsiteTemplateSchema.safeParse({}).success).toBe(true)
  })

  it("accepts a published-only patch", () => {
    expect(updateWebsiteTemplateSchema.safeParse({ published: true }).success).toBe(true)
  })

  it("rejects an invalid files replacement", () => {
    expect(updateWebsiteTemplateSchema.safeParse({ files: [{ path: "", content: "x" }] }).success).toBe(false)
  })
})
