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
    expect(result.errors?.title).toContain("required")
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
