import { describe, it, expect } from "vitest"
import { sanitizeHtml } from "@/lib/sanitize-html"

// Regression test: a real blog post's rich-text content came back from
// Quill with every space converted to a non-breaking space (`&nbsp;`,
// commonly happens with text pasted from Word/WhatsApp/PDFs) — one long,
// unbreakable run of words that overflowed its container on /blog/[slug]
// instead of wrapping normally, even though dangerouslySetInnerHTML +
// sanitizeHtml were both already wired up correctly.

describe("sanitizeHtml", () => {
  it("collapses &nbsp; entities back into normal, wrappable spaces", () => {
    const input = "<p>Ingin&nbsp;meminta&nbsp;ChatGPT&nbsp;membaca&nbsp;data?</p>"
    expect(sanitizeHtml(input)).toBe("<p>Ingin meminta ChatGPT membaca data?</p>")
  })

  it("collapses a literal U+00A0 non-breaking space the same way", () => {
    const input = `<p>Satu dua tiga</p>`
    expect(sanitizeHtml(input)).toBe("<p>Satu dua tiga</p>")
  })

  it("still strips a <script> tag (defense-in-depth XSS guard stays intact)", () => {
    const input = "<p>Hello</p><script>alert(1)</script>"
    expect(sanitizeHtml(input)).toBe("<p>Hello</p>")
  })

  it("returns an empty string for null/undefined/empty input", () => {
    expect(sanitizeHtml(null)).toBe("")
    expect(sanitizeHtml(undefined)).toBe("")
    expect(sanitizeHtml("")).toBe("")
  })
})
