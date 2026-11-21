import { describe, it, expect, vi } from "vitest"
import { fieldsToCreateInput, formatFields, materializeSchemaIntoTenant } from "@/lib/schema-template-sync"

// Regression coverage for a real bug: a select/multiselect field's
// { choices: [...] } (or any other per-type `options` extra) used to be
// dropped silently in both directions — only `type: "component"` ever got
// an `options` value — so every select field materialized into a real
// workspace as an effectively plain text field with no choices.

describe("fieldsToCreateInput", () => {
  it("passes through options for a select field", () => {
    const [out] = fieldsToCreateInput([
      { name: "Status", slug: "status", type: "select", options: { choices: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] } },
    ])
    expect(out.options).toEqual({ choices: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] })
  })

  it("still synthesizes { componentSlug } for a component field with no explicit options (back-compat)", () => {
    const [out] = fieldsToCreateInput([
      { name: "Hero", slug: "hero", type: "component", componentSlug: "hero-block" },
    ])
    expect(out.options).toEqual({ componentSlug: "hero-block" })
  })

  it("prefers explicit options over the componentSlug convenience field when both are given", () => {
    const [out] = fieldsToCreateInput([
      { name: "Hero", slug: "hero", type: "component", componentSlug: "hero-block", options: { componentSlug: "hero-block", repeatable: true } },
    ])
    expect(out.options).toEqual({ componentSlug: "hero-block", repeatable: true })
  })

  it("leaves options undefined for a plain text field", () => {
    const [out] = fieldsToCreateInput([{ name: "Title", slug: "title", type: "text" }])
    expect(out.options).toBeUndefined()
  })
})

describe("formatFields", () => {
  it("round-trips a select field's choices back into the schema blob", () => {
    const [out] = formatFields([
      { name: "Status", slug: "status", type: "select", required: false, unique: false, relationSlug: null, options: { choices: [{ label: "Draft", value: "draft" }] } },
    ])
    expect(out.options).toEqual({ choices: [{ label: "Draft", value: "draft" }] })
  })

  it("still exposes componentSlug as a convenience alongside options", () => {
    const [out] = formatFields([
      { name: "Hero", slug: "hero", type: "component", required: false, unique: false, relationSlug: null, options: { componentSlug: "hero-block" } },
    ])
    expect(out.componentSlug).toBe("hero-block")
    expect(out.options).toEqual({ componentSlug: "hero-block" })
  })

  it("omits options entirely when there are none", () => {
    const [out] = formatFields([
      { name: "Title", slug: "title", type: "text", required: false, unique: false, relationSlug: null, options: null },
    ])
    expect(out.options).toBeUndefined()
  })
})

it("updates an existing demo Component while preserving its model and retained field IDs", async () => {
  const field = { name: "Judul Baru", slug: "title", type: "text" }
  const tx = {
    component: {
      findFirst: vi.fn().mockResolvedValue({ id: "hero-1" }),
      update: vi.fn(),
      create: vi.fn(),
    },
    schemaField: {
      findMany: vi.fn().mockResolvedValue([{ id: "title-1", slug: "title" }]),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }

  await materializeSchemaIntoTenant(tx as never, "demo-1", {
    components: [{ name: "Hero", slug: "hero", fields: [field] }],
  }, {}, { updateExisting: true })

  expect(tx.component.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "hero-1" } }))
  expect(tx.component.create).not.toHaveBeenCalled()
  expect(tx.schemaField.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "title-1" }, data: expect.objectContaining(field),
  }))
  expect(tx.schemaField.deleteMany).not.toHaveBeenCalled()
})
