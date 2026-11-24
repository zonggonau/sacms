import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerUser, forgotPassword, resetPassword } from "@/actions/auth"
import { db } from "@/lib/database"
import { sendPasswordResetEmail } from "@/lib/mail"
import { captureException } from "@sentry/nextjs"

vi.mock("@/lib/database", () => ({
  db: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

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

    it("revokes undelivered tokens, reports the failure, and keeps the account response generic", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null)
      const absent = await forgotPassword("missing@example.test")
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-123", email: "member@example.test" } as never)
      vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error("mail unavailable"))
      vi.mocked(db.verificationToken.deleteMany).mockResolvedValueOnce({ count: 1 })

      expect(await forgotPassword("member@example.test")).toEqual(absent)
      expect(db.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { token: expect.any(String) } })
      await vi.waitFor(() =>
        expect(captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { action: "forgot-password" } }),
      )
    })

    it("keeps the account response generic when the reset token cannot be stored", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null)
      const absent = await forgotPassword("missing@example.test")
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-123", email: "member@example.test" } as never)
      vi.mocked(db.verificationToken.create).mockRejectedValueOnce(new Error("db write failed"))
      vi.mocked(db.verificationToken.deleteMany).mockResolvedValueOnce({ count: 0 })

      expect(await forgotPassword("member@example.test")).toEqual(absent)
      expect(sendPasswordResetEmail).not.toHaveBeenCalled()
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

    it("allows the inbox holder to activate an invited account with a single-use reset link", async () => {
      const email = "invitee@example.test"
      const identifier = `reset:${email}`
      vi.mocked(db.verificationToken.findUnique).mockResolvedValueOnce({
        identifier, token: "invite-token", expires: new Date(Date.now() + 60_000),
      })
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "invitee", email } as never)
      const update = vi.fn()
      const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
      vi.mocked(db.$transaction).mockImplementationOnce(async (callback: any) => callback({
        $queryRaw: vi.fn().mockResolvedValue([{ emailVerified: null }]),
        user: { update },
        verificationToken: { deleteMany },
      }))

      const result = await resetPassword({ token: "invite-token", password: "Example-Password-123!" })
      expect(result.success).toBe(true)
      expect(deleteMany).toHaveBeenCalledWith({
        where: { identifier, token: "invite-token", expires: { gt: expect.any(Date) } },
      })
      expect(update).toHaveBeenCalledWith({
        where: { id: "invitee" },
        data: { password: "hashed_password_123", emailVerified: expect.any(Date) },
      })
      expect(deleteMany).toHaveBeenCalledWith({ where: { identifier } })
    })
  })
})
