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
