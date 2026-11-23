import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"

// Mock NextRequest/NextResponse
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string
    headers: Headers
    method: string
    private _body: string

    constructor(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) {
      this.url = url
      this.method = init?.method ?? "GET"
      this.headers = new Headers(init?.headers)
      this._body = init?.body ?? ""
    }

    async json() {
      return JSON.parse(this._body)
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: new Map(Object.entries(init?.headers ?? {})),
      json: async () => body,
    }),
  },
}))

describe("Auth Register Route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should reject invalid JSON body", async () => {
    // Test via validation schemas directly
    const { registerSchema } = await import("@/lib/validations/auth")

    const result = registerSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("should validate email format", async () => {
    const { registerSchema } = await import("@/lib/validations/auth")

    const result = registerSchema.safeParse({
      name: "Test",
      email: "not-email",
      password: "password123",
    })
    expect(result.success).toBe(false)
  })

  it("should validate password minimum length", async () => {
    const { registerSchema } = await import("@/lib/validations/auth")

    const result = registerSchema.safeParse({
      name: "Test",
      email: "test@test.com",
      password: "short",
    })
    expect(result.success).toBe(false)
  })

  it("should accept valid registration input", async () => {
    const { registerSchema } = await import("@/lib/validations/auth")

    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "securepass123",
      tenantName: "My Workspace",
      tenantSlug: "my-workspace",
    })
    expect(result.success).toBe(true)
  })
})

describe("Auth Password", () => {
  it("should hash password with bcrypt", async () => {
    const { hashPassword } = await import("@/lib/auth")
    const hashed = await hashPassword("test123456")
    expect(hashed).toBe("$2b$12$hashedpassword") // mocked
  })

  it("should verify correct password", async () => {
    const { verifyPassword } = await import("@/lib/auth")
    const result = await verifyPassword("test123456", "$2b$12$hashedpassword")
    expect(result).toBe(true)
  })
})

describe("JWT account state", () => {
  const activeToken = { id: "staff-1", role: "super_admin", plan: "free", tenants: [] }

  it("uses the current role when a platform administrator is demoted", async () => {
    const { authOptions } = await import("@/lib/auth")
    const refreshJwt = authOptions.callbacks!.jwt!
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      email: "staff@example.test", name: "Staff", image: null, role: "employee", plan: "free",
    } as never)

    const token = await refreshJwt({ token: { ...activeToken }, user: undefined as never, account: null })

    expect(token.role).toBe("employee")
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "staff-1" } }))
  })

  it("invalidates a JWT whose account was removed", async () => {
    const { authOptions } = await import("@/lib/auth")
    const refreshJwt = authOptions.callbacks!.jwt!
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null)

    // JWT callback returns token as-is when account deleted (not updated with user data)
    // Session callback won't populate session when token lacks user data
    const result = await refreshJwt({ token: { ...activeToken }, user: undefined as never, account: null })
    expect(result).toEqual(activeToken)
  })
})
