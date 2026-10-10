import { describe, it, expect } from "vitest"
import { extractFiles, extractMockEntities } from "@/lib/static-site-generator"

// extractFiles/extractMockEntities parse raw AI-model output (untrusted,
// sometimes malformed text) into the HTML/JS that gets written to a live
// preview and, eventually, a deployed static site — a parsing bug here
// either breaks the AI Website Builder pipeline or silently produces the
// wrong output. Zero coverage existed before this (AUD-013).

describe("extractFiles", () => {
  it("extracts both files when the model used the exact delimiter format", () => {
    const raw = `<<<INDEX_HTML>>>\n<html><body>Hi</body></html>\n<<<END_INDEX_HTML>>>\n<<<APP_JS>>>\nconsole.log('hi')\n<<<END_APP_JS>>>`
    const { html, js } = extractFiles(raw)
    expect(html).toBe("<html><body>Hi</body></html>")
    expect(js).toBe("console.log('hi')")
  })

  it("recovers the HTML block when its end delimiter is missing but APP_JS follows", () => {
    const raw = `<<<INDEX_HTML>>>\n<html><body>Hi</body></html>\n<<<APP_JS>>>\nconsole.log('hi')\n<<<END_APP_JS>>>`
    const { html, js } = extractFiles(raw)
    expect(html).toBe("<html><body>Hi</body></html>")
    expect(js).toBe("console.log('hi')")
  })

  it("falls back to a fenced ```html/```js code block when no delimiters are present", () => {
    const raw = "Here you go:\n```html\n<html><body>Hi</body></html>\n```\n```javascript\nconsole.log('hi')\n```"
    const { html, js } = extractFiles(raw)
    expect(html).toBe("<html><body>Hi</body></html>")
    expect(js).toBe("console.log('hi')")
  })

  it("falls back to a bare <!DOCTYPE html> ... </html> span and a bare createApp()...mount() span with no fences or delimiters", () => {
    const raw = "Sure, here's the page:\n<!DOCTYPE html>\n<html><body>Hi</body></html>\nAnd the script:\nconst app = createApp({});\napp.mount('#app');\nHope that helps!"
    const { html, js } = extractFiles(raw)
    expect(html).toBe("<!DOCTYPE html>\n<html><body>Hi</body></html>")
    expect(js).toBe("const app = createApp({});\napp.mount('#app');")
  })

  it("strips a leftover markdown fence around an otherwise-delimited block", () => {
    const raw = `<<<INDEX_HTML>>>\n<html></html>\n<<<END_INDEX_HTML>>>\n<<<APP_JS>>>\n\`\`\`js\nconsole.log('hi')\n\`\`\`\n<<<END_APP_JS>>>`
    const { js } = extractFiles(raw)
    expect(js).toBe("console.log('hi')")
  })

  it("throws a clear, actionable error instead of silently returning an unrelated template when nothing matches", () => {
    expect(() => extractFiles("Sorry, I can't help with that.")).toThrow(/format index\.html\/app\.js/)
  })

  it("throws when only one of the two files could be recovered", () => {
    const raw = `<<<INDEX_HTML>>>\n<html></html>\n<<<END_INDEX_HTML>>>`
    expect(() => extractFiles(raw)).toThrow()
  })
})

describe("extractMockEntities", () => {
  it("extracts a content-list entity (array sample) from a // MOCK: block", () => {
    const js = `
// MOCK:articles
const articles = ref([
  { title: "Hello", slug: "hello" }
]);
// /MOCK:articles
`
    const entities = extractMockEntities(js)
    expect(entities).toHaveLength(1)
    expect(entities[0]).toMatchObject({ slug: "articles", varName: "articles", kind: "content" })
  })

  it("extracts a single-type entity (object sample) from a // MOCK: block", () => {
    const js = `
// MOCK:homepage
const homepage = reactive({ title: "Welcome" });
// /MOCK:homepage
`
    const entities = extractMockEntities(js)
    expect(entities).toHaveLength(1)
    expect(entities[0]).toMatchObject({ slug: "homepage", varName: "homepage", kind: "single" })
  })

  it("extracts multiple independent MOCK blocks in one file", () => {
    const js = `
// MOCK:articles
const articles = ref([{ title: "A" }]);
// /MOCK:articles

// MOCK:homepage
const homepage = reactive({ title: "Welcome" });
// /MOCK:homepage
`
    const entities = extractMockEntities(js)
    expect(entities.map((e) => e.slug)).toEqual(["articles", "homepage"])
  })

  it("skips a MOCK block with no matching closing marker instead of throwing", () => {
    const js = `
// MOCK:articles
const articles = ref([{ title: "A" }]);
`
    expect(() => extractMockEntities(js)).not.toThrow()
    expect(extractMockEntities(js)).toEqual([])
  })

  it("skips a MOCK block whose body never declares a ref()/reactive() variable", () => {
    const js = `
// MOCK:articles
someOtherCode();
// /MOCK:articles
`
    expect(extractMockEntities(js)).toEqual([])
  })

  it("returns an empty array for JS with no MOCK markers at all", () => {
    expect(extractMockEntities("const x = 1;")).toEqual([])
  })
})
