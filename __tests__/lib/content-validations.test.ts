import { describe, it, expect } from "vitest"
import { validateContentEntry } from "@/lib/content-validations"

describe("Dynamic Content Validations", () => {
  const mockFields = [
    { slug: "title", type: "text", required: true, name: "Title" },
    { slug: "email", type: "email", required: true, name: "Email" },
    { slug: "age", type: "number", required: false, name: "Age" },
    { slug: "is_active", type: "boolean", required: true, name: "Active" }
  ]

  it("should pass with valid data", async () => {
    const validData = {
      title: "Hello World",
      email: "test@example.com",
      age: 25,
      is_active: true
    }
    const result = await validateContentEntry(mockFields, validData)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(validData)
  })

  it("should fail when required fields are missing", async () => {
    const invalidData = {
      email: "test@example.com",
      is_active: true
    }
    const result = await validateContentEntry(mockFields, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors).toHaveProperty("title")
    expect(result.errors?.title).toBeDefined()
  })

  it("should fail with invalid email format", async () => {
    const invalidData = {
      title: "Hello",
      email: "not-an-email",
      is_active: true
    }
    const result = await validateContentEntry(mockFields, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors).toHaveProperty("email")
    expect(result.errors?.email).toContain("Invalid email")
  })

  it("should fail when number field receives a string", async () => {
    const invalidData = {
      title: "Hello",
      email: "test@example.com",
      age: "twenty",
      is_active: true
    }
    const result = await validateContentEntry(mockFields, invalidData)
    expect(result.success).toBe(false)
    expect(result.errors).toHaveProperty("age")
  })
})

// A real, confirmed bug (chatgpt6.md): `select` used to share the generic
// "any non-empty string" branch, so a value outside the field's own
// declared options.choices silently passed — including on a direct
// create straight to PUBLISHED. `multiselect` had the identical gap via
// the generic any-value fallback.
describe("select/multiselect — value must match the field's own declared choices", () => {
  const selectField = [
    { slug: "status", type: "select", required: true, name: "Status", options: { choices: [{ label: "Draft", value: "draft" }, { label: "Published", value: "published" }] } },
  ]
  const multiselectField = [
    { slug: "tags", type: "multiselect", required: true, name: "Tags", options: { choices: [{ label: "Red", value: "red" }, { label: "Blue", value: "blue" }] } },
  ]

  it("accepts a select value that IS one of the declared choices", async () => {
    const result = await validateContentEntry(selectField, { status: "draft" })
    expect(result.success).toBe(true)
  })

  it("rejects a select value outside the declared choices, even though it's a non-empty string", async () => {
    const result = await validateContentEntry(selectField, { status: "banana" })
    expect(result.success).toBe(false)
    expect(result.errors?.status).toMatch(/must be one of/)
  })

  it("still enforces required on an empty select, same as before", async () => {
    const result = await validateContentEntry(selectField, {})
    expect(result.success).toBe(false)
    expect(result.errors?.status).toMatch(/required/)
  })

  it("does not validate membership when the field has no choices configured at all (nothing to check against)", async () => {
    const noChoicesField = [{ slug: "status", type: "select", required: false, name: "Status" }]
    const result = await validateContentEntry(noChoicesField, { status: "whatever" })
    expect(result.success).toBe(true)
  })

  it("accepts a multiselect array where every item is a declared choice", async () => {
    const result = await validateContentEntry(multiselectField, { tags: ["red", "blue"] })
    expect(result.success).toBe(true)
  })

  it("rejects a multiselect array containing a value outside the declared choices", async () => {
    const result = await validateContentEntry(multiselectField, { tags: ["red", "green"] })
    expect(result.success).toBe(false)
    expect(result.errors?.tags).toMatch(/must only contain/)
  })

  it("rejects an empty multiselect array when required", async () => {
    const result = await validateContentEntry(multiselectField, { tags: [] })
    expect(result.success).toBe(false)
  })
})
