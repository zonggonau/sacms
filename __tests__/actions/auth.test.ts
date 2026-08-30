import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerUser, forgotPassword, resetPassword } from "@/actions/auth"
import { db } from "@/lib/database"

vi.mock("@/lib/database", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/mail", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password_123"),
}))

describe("Auth Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("registerUser", () => {
    it("should return error when required fields are missing", async () => {
      const result = await registerUser({ name: "", email: "", password: "" })
      expect(result.error).toBe("Semua kolom wajib diisi")
    })

    it("should reject weak password", async () => {
      const result = await registerUser({
        name: "John Doe",
        email: "john@example.com",
        password: "123",
      })
      expect(result.error).toBe("Kata sandi terlalu lemah. Pastikan minimal berstatus 'Kuat'.")
    })

    it("should successfully register first user as super_admin", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)
      vi.mocked(db.user.count).mockResolvedValue(0)
      vi.mocked(db.user.create).mockResolvedValue({
        id: "user-1",
        name: "Admin User",
        email: "admin@example.com",
        role: "super_admin",
        plan: "enterprise",
      } as any)

      const result = await registerUser({
        name: "Admin User",
        email: "admin@example.com",
        password: "StrongPassword123!",
      })

      expect(result.success).toBe(true)
      expect(result.isFirstUser).toBe(true)
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "super_admin",
            plan: "enterprise",
          }),
        })
      )
    })
  })

  describe("forgotPassword", () => {
    it("should return error if email is missing", async () => {
      const result = await forgotPassword("")
      expect(result.error).toBe("Email wajib diisi")
    })

    it("should return success even if user does not exist (prevent enumeration)", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      const result = await forgotPassword("nonexistent@example.com")
      expect(result.success).toBe(true)
    })

    it("should create verification token and send reset email if user exists", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: "user-123",
        email: "user@example.com",
      } as any)

      const result = await forgotPassword("user@example.com")
      expect(result.success).toBe(true)
      expect(db.verificationToken.create).toHaveBeenCalled()
    })
  })

  describe("resetPassword", () => {
    it("should return error when token or password is missing", async () => {
      const result = await resetPassword({ token: "", password: "" })
      expect(result.error).toBe("Token dan kata sandi baru wajib diisi")
    })

    it("should return error for invalid or expired token", async () => {
      vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null)

      const result = await resetPassword({
        token: "invalid-token",
        password: "NewPassword123!",
      })
      expect(result.error).toBe("Tautan tidak valid atau sudah kadaluarsa")
    })
  })
})
