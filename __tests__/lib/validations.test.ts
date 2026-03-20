import { describe, it, expect } from "vitest"
import { z } from "zod/v4"
import { registerSchema } from "@/lib/validations/auth"

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const valid = {
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      tenantName: "My Workspace",
      tenantSlug: "my-workspace",
    }
    const result = registerSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("accepts registration without tenant (super_admin)", () => {
    const valid = {
      name: "Admin",
      email: "admin@example.com",
      password: "securepassword",
    }
    const result = registerSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("rejects empty name", () => {
    const invalid = {
      name: "",
      email: "john@example.com",
      password: "password123",
    }
    const result = registerSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const invalid = {
      name: "John",
      email: "not-an-email",
      password: "password123",
    }
    const result = registerSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("rejects short password (< 8 chars)", () => {
    const invalid = {
      name: "John",
      email: "john@example.com",
      password: "short",
    }
    const result = registerSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("rejects invalid tenant slug format", () => {
    const invalid = {
      name: "John",
      email: "john@example.com",
      password: "password123",
      tenantSlug: "INVALID SLUG!",
    }
    const result = registerSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("rejects tenant slug with uppercase", () => {
    const invalid = {
      name: "John",
      email: "john@example.com",
      password: "password123",
      tenantSlug: "MySlug",
    }
    const result = registerSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("accepts valid kebab-case tenant slug", () => {
    const valid = {
      name: "John",
      email: "john@example.com",
      password: "password123",
      tenantSlug: "my-workspace-123",
    }
    const result = registerSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})
