import { describe, it, expect } from "vitest"
import { FIELD_TYPE_GUIDE } from "@/lib/field-type-guide"

// A real finding: a manually-edited richText entry (real HTML from the
// dashboard's own Quill editor) showed its literal <p>/<strong>/<ul> tags on
// the public-facing frontend instead of rendering as formatted text. The
// frontend was built by an MCP-connected agent that had no documented
// contract telling it richText/markdown values need HTML-aware rendering —
// it only "worked" by accident because AI-authored test content happened to
// be unwrapped plain prose with no real markup in it. These two entries are
// the fix: list_field_types (both MCP servers share this file) now tells
// any agent exactly what to render and how.

describe("FIELD_TYPE_GUIDE — richText/markdown rendering contract", () => {
  it("documents richText's value as real HTML needing a sanitized HTML sink, not plain text", () => {
    const guide = FIELD_TYPE_GUIDE.richText
    expect(guide).toBeDefined()
    expect(guide.entryValue).toMatch(/HTML/i)
    expect(guide.note).toMatch(/dangerouslySetInnerHTML/)
    expect(guide.note).toMatch(/plain text/i)
  })

  it("documents markdown's value as raw Markdown source needing a Markdown renderer, not HTML", () => {
    const guide = FIELD_TYPE_GUIDE.markdown
    expect(guide).toBeDefined()
    expect(guide.entryValue).toMatch(/Markdown/i)
    expect(guide.entryValue).toMatch(/NOT HTML/)
    expect(guide.note).toMatch(/react-markdown|remark|Markdown renderer/i)
  })
})
