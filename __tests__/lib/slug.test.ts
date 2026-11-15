import { describe, it, expect, vi } from "vitest"
import { processAutoSlugs, slugify } from "@/lib/slug"

// processAutoSlugs backs both createContentEntry/updateContentEntry (dashboard
// AND MCP's create_content_entry/update_content_entry go through the same
// entry-service.ts). The dashboard's own create/edit entry form fills a slug
// field CLIENT-SIDE as the user types, by reading a sibling field literally
// named title/judul/name (see field-type-guide.ts's note on this field type)
// — so by the time it submits, data[field.slug] is already non-empty and
// this function has nothing to do. A direct MCP write skips that browser
// step entirely, so this function must do the same lookup server-side, or a
// slug field is left empty forever unless the caller fills it manually via
// a follow-up update_content_entry call (a real finding — confirmed six
// MCP-created entries all needed exactly that extra round-trip).

const slugField = { type: "slug", slug: "slug", options: {} }

function mockPrisma(existingSlugs: string[] = []) {
  return {
    contentEntry: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = existingSlugs.includes(where.data.equals)
        return Promise.resolve(found ? { id: "other" } : null)
      }),
    },
  } as any
}

describe("processAutoSlugs — by-sibling-name fallback (no options.autoGenerate/sourceField configured)", () => {
  it("fills an empty slug from a sibling 'title' field", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { title: "Hello World", slug: "" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("hello-world")
  })

  it("falls back to 'judul' when there's no 'title'", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { judul: "Berita Hari Ini" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("berita-hari-ini")
  })

  it("falls back to 'name' when there's neither 'title' nor 'judul'", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { name: "Acme Corp" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("acme-corp")
  })

  it("prefers 'title' over 'judul'/'name' when more than one is present, matching the dashboard's own formData.title || formData.judul || formData.name order", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { title: "English Title", judul: "Judul Indonesia", name: "Another Name" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("english-title")
  })

  it("never overwrites a slug the caller already provided", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { title: "Hello World", slug: "custom-slug" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("custom-slug")
  })

  it("leaves the slug untouched when no title/judul/name sibling exists at all", async () => {
    const result = await processAutoSlugs(
      "t1", "ct1", [slugField], { content: "some body text" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBeUndefined()
  })

  it("still honors an explicitly configured options.sourceField over the title/judul/name fallback", async () => {
    const customField = { type: "slug", slug: "slug", options: { autoGenerate: true, sourceField: "headline" } }
    const result = await processAutoSlugs(
      "t1", "ct1", [customField], { headline: "Custom Source", title: "Should Be Ignored" }, undefined, "content", mockPrisma(),
    )
    expect(result.slug).toBe("custom-source")
  })
})

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("  Hello World!  ")).toBe("hello-world")
  })
})
