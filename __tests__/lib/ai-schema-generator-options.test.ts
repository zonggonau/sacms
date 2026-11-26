import { describe, it, expect, vi } from "vitest"

vi.mock("ai", () => ({ generateObject: vi.fn() }))

import { aiSystemSchema, SYSTEM_PROMPT } from "@/lib/ai-schema-generator"

const wrap = (field: Record<string, unknown>) => ({
  contentTypes: [{ name: "Menu", slug: "menu", fields: [{ name: "F", slug: "f", ...field }] }],
  singleTypes: [],
  components: [],
})

describe("AI schema output accepts per-type options", () => {
  it("keeps select choices", () => {
    const parsed = aiSystemSchema.parse(wrap({
      type: "select",
      options: { choices: [{ label: "Draft", value: "draft" }, { label: "Terbit", value: "published" }] },
    }))
    expect(parsed.contentTypes[0].fields[0].options?.choices).toHaveLength(2)
  })

  it("keeps relation targetModel and relationType", () => {
    const parsed = aiSystemSchema.parse(wrap({
      type: "relation", relationSlug: "authors", options: { relationType: "manyToOne", targetModel: "content-type" },
    }))
    expect(parsed.contentTypes[0].fields[0].options).toEqual({ relationType: "manyToOne", targetModel: "content-type" })
  })

  it("rejects an unknown relationType or targetModel rather than saving it", () => {
    expect(() => aiSystemSchema.parse(wrap({ type: "relation", options: { relationType: "many" } }))).toThrow()
    expect(() => aiSystemSchema.parse(wrap({ type: "relation", options: { targetModel: "user" } }))).toThrow()
  })

  it("still accepts a field with no options at all", () => {
    expect(() => aiSystemSchema.parse(wrap({ type: "text" }))).not.toThrow()
  })
})

describe("system prompt reflects the audited field guide", () => {
  it("tells the model select must carry choices", () => {
    expect(SYSTEM_PROMPT).toContain("options.choices")
  })

  it("says location holds no address and currency is always IDR", () => {
    expect(SYSTEM_PROMPT).toContain("lat/lng only")
    expect(SYSTEM_PROMPT).toContain("Currency is always IDR")
  })

  it("keeps member relations opt-in and profiles as content types", () => {
    expect(SYSTEM_PROMPT).toContain("Do NOT use options.targetModel 'member'")
    expect(SYSTEM_PROMPT).toContain("ONLY when the user explicitly asks")
  })

  it("tells the model how to express repeatable components and repeaters", () => {
    expect(SYSTEM_PROMPT).toContain("options.repeatable: true")
    expect(SYSTEM_PROMPT).toContain("options.allowedComponents")
  })

  it("does not describe currency as configurable in USD", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/Rp, USD/)
  })
})

describe("a component field keeps its componentSlug and its options", () => {
  it("merges a top-level componentSlug with repeatable", async () => {
    const { fieldsToCreateInput } = await import("@/lib/schema-template-sync")
    const [out] = fieldsToCreateInput([
      { name: "Kartu", slug: "kartu", type: "component", componentSlug: "feature-card", options: { repeatable: true } },
    ] as any)
    expect(out.options).toEqual({ repeatable: true, componentSlug: "feature-card" })
  })
})

describe("core blueprint links are repeatable components", () => {
  it("adds nav and social link components and points Site Settings at them", async () => {
    const { ensureCoreSingleTypes } = await import("@/lib/ai-schema-generator")
    const out = ensureCoreSingleTypes({ contentTypes: [], singleTypes: [], components: [] })
    const settings = out.singleTypes.find((s) => s.slug === "site-settings")!
    expect(settings.fields.find((f) => f.slug === "link-navigasi")).toMatchObject({
      type: "component", componentSlug: "nav-link", options: { repeatable: true },
    })
    expect(settings.fields.find((f) => f.slug === "link-sosial-media")).toMatchObject({
      type: "component", componentSlug: "social-link", options: { repeatable: true },
    })
    expect(out.components.map((c) => c.slug)).toEqual(expect.arrayContaining(["nav-link", "social-link"]))
  })

  it("the core blueprint passes the save-time reference check", async () => {
    const { ensureCoreSingleTypes } = await import("@/lib/ai-schema-generator")
    const { validateBundleReferences, splitIssuesBySeverity } = await import("@/lib/schema-template-validation")
    const out = ensureCoreSingleTypes({ contentTypes: [], singleTypes: [], components: [] })
    const { blocking } = splitIssuesBySeverity(validateBundleReferences(out as any))
    expect(blocking).toEqual([])
  })

  it("does not duplicate a nav-link component the model already defined", async () => {
    const { ensureCoreSingleTypes } = await import("@/lib/ai-schema-generator")
    const out = ensureCoreSingleTypes({
      contentTypes: [], singleTypes: [],
      components: [{ name: "Menu", slug: "nav-link", fields: [] }],
    })
    expect(out.components.filter((c) => c.slug === "nav-link")).toHaveLength(1)
  })

  it("leaves a model that already has Site Settings alone", async () => {
    const { ensureCoreSingleTypes } = await import("@/lib/ai-schema-generator")
    const input = {
      contentTypes: [], components: [],
      singleTypes: [{ name: "Site", slug: "site-settings", fields: [] }, { name: "Home", slug: "homepage", fields: [] }],
    }
    expect(ensureCoreSingleTypes(input)).toEqual(input)
  })
})
