import { describe, it, expect, vi, beforeEach } from "vitest"
import { validateBody, validateQuery } from "@/lib/validate"
import { z } from "zod/v4"

// We need to mock NextResponse for validate tests
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })

  it("returns parsed data for valid input", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@test.com" }),
    })

    const result = await validateBody(request, schema)
    expect(result).toHaveProperty("data")
    if ("data" in result) {
      expect(result.data.name).toBe("John")
      expect(result.data.email).toBe("john@test.com")
    }
  })

  it("returns error for invalid JSON", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    })

    const result = await validateBody(request, schema)
    expect(result).toHaveProperty("error")
  })

  it("returns error for invalid schema data", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "invalid" }),
    })

    const result = await validateBody(request, schema)
    expect(result).toHaveProperty("error")
  })

  it("returns error when required fields are missing", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const result = await validateBody(request, schema)
    expect(result).toHaveProperty("error")
  })
})

describe("validateQuery", () => {
  const schema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  })

  it("returns parsed data for valid query", () => {
    const params = new URLSearchParams("page=1&limit=10")
    const result = validateQuery(params, schema)
    expect(result).toHaveProperty("data")
    if ("data" in result) {
      expect(result.data.page).toBe("1")
      expect(result.data.limit).toBe("10")
    }
  })

  it("returns data for empty query params", () => {
    const params = new URLSearchParams("")
    const result = validateQuery(params, schema)
    expect(result).toHaveProperty("data")
  })
})
