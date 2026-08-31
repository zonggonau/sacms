"use server"

import { db } from "@/lib/database"
import { hashPassword } from "@/lib/auth"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mail"
import crypto from "crypto"

export async function registerUser(formData: any) {
  try {
    const { name, email, password } = formData

    if (!email || !password || !name) {
      return { error: "Semua kolom wajib diisi" }
    }

    const getPasswordStrength = (p: string) => {
      let score = 0
      if (p.length >= 8) score += 1
      if (/\d/.test(p)) score += 1
      if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score += 1
      if (/[A-Z]/.test(p)) score += 1
      return score
    }

    if (getPasswordStrength(password) < 3) {
      return { error: "Kata sandi terlalu lemah. Pastikan minimal berstatus 'Kuat'." }
    }

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    const { isMailConfigured } = await import("@/lib/settings")
    const hasMailService = await isMailConfigured()

    if (existingUser) {
      if (existingUser.emailVerified) {
        return { error: "Akun dengan email ini sudah terdaftar dan terverifikasi. Silakan masuk." }
      } else {
        if (!hasMailService) {
          // Auto-verify existing unverified user if mail service is not active
          await db.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() }
          })
          return {
            success: true,
            autoVerified: true,
            message: "Akun Anda telah diaktifkan secara otomatis. Silakan masuk."
          }
        }

        // Generate Verification Token
        const token = crypto.randomBytes(32).toString("hex")
        const expires = new Date()
        expires.setHours(expires.getHours() + 24)

        // Remove old unverified tokens
        await db.verificationToken.deleteMany({
          where: { identifier: existingUser.email },
        })

        await db.verificationToken.create({
          data: {
            identifier: existingUser.email,
            token,
            expires,
          },
        })

        // Send email safely
        try {
          await sendVerificationEmail(existingUser.email, token, existingUser.name || "User")
          return { 
            success: true, 
            message: "Akun sudah terdaftar. Kami telah mengirim ulang email verifikasi ke kotak masuk Anda." 
          }
        } catch (mailErr) {
          console.error("Failed to resend verification email:", mailErr)
          await db.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() }
          })
          return {
            success: true,
            autoVerified: true,
            message: "Akun Anda telah diaktifkan secara otomatis. Silakan masuk."
          }
        }
      }
    }

    // Check if Super Admin already exists in the system
    let isFirstUser = false
    if (typeof db.user?.findFirst === "function") {
      const superAdmin = await db.user.findFirst({
        where: { role: "super_admin" },
      })
      isFirstUser = !superAdmin
    } else if (typeof db.user?.count === "function") {
      const count = await db.user.count().catch(() => 0)
      isFirstUser = count === 0
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user:
    // - If no Super Admin exists: this user is Super Admin (auto-verified).
    // - If Super Admin exists: all subsequent users require email activation (emailVerified: null).
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? "super_admin" : "owner",
        plan: isFirstUser ? "enterprise" : "free",
        emailVerified: isFirstUser ? new Date() : null,
      },
    })

    if (isFirstUser) {
      return { 
        success: true, 
        isFirstUser: true,
        autoVerified: true,
        message: "Akun Super Admin berhasil dibuat. Silakan masuk." 
      }
    }

    // For all subsequent users: Generate Verification Token (24 hours validity)
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date()
    expires.setHours(expires.getHours() + 24)

    await db.verificationToken.deleteMany({
      where: { identifier: user.email },
    })

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    })

    // Send activation email
    try {
      await sendVerificationEmail(user.email, token, user.name || "User")
      return { 
        success: true, 
        isFirstUser: false,
        autoVerified: false,
        message: "Pendaftaran berhasil! Kami telah mengirimkan tautan aktivasi ke email Anda." 
      }
    } catch (mailErr) {
      console.error("Failed to send verification email during signup:", mailErr)
      return {
        success: true,
        isFirstUser: false,
        autoVerified: false,
        message: "Pendaftaran berhasil dibuat! Silakan periksa email Anda untuk tautan aktivasi."
      }
    }
  } catch (error) {
    console.error("Registration Error:", error)
    return { error: "Terjadi kesalahan pada server" }
  }
}

export async function forgotPassword(email: string) {
  try {
    if (!email) {
      return { error: "Email wajib diisi" }
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // If user doesn't exist, we still return success to prevent email enumeration
    if (!user) {
      return { 
        success: true, 
        message: "Jika akun dengan email tersebut terdaftar, kami telah mengirimkan tautan reset kata sandi." 
      }
    }

    // Generate Verification Token
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date()
    expires.setHours(expires.getHours() + 1) // 1 hour expiry for reset link

    // Use "reset:" prefix for identifier to distinguish from email verification
    await db.verificationToken.create({
      data: {
        identifier: `reset:${user.email}`,
        token,
        expires,
      },
    })

    // Send email
    await sendPasswordResetEmail(user.email, token)

    return { 
      success: true, 
      message: "Jika akun dengan email tersebut terdaftar, kami telah mengirimkan tautan reset kata sandi." 
    }
  } catch (error) {
    console.error("Forgot Password Error:", error)
    return { error: "Terjadi kesalahan pada server" }
  }
}

export async function resetPassword(formData: any) {
  try {
    const { token, password } = formData

    if (!token || !password) {
      return { error: "Token dan kata sandi baru wajib diisi" }
    }

    const getPasswordStrength = (p: string) => {
      let score = 0
      if (p.length >= 8) score += 1
      if (/\d/.test(p)) score += 1
      if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score += 1
      if (/[A-Z]/.test(p)) score += 1
      return score
    }

    if (getPasswordStrength(password) < 3) {
      return { error: "Kata sandi terlalu lemah. Pastikan minimal berstatus 'Kuat'." }
    }

    // Find the token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken || !verificationToken.identifier.startsWith("reset:")) {
      return { error: "Tautan tidak valid atau sudah kadaluarsa" }
    }

    if (new Date() > verificationToken.expires) {
      await db.verificationToken.delete({ where: { token } })
      return { error: "Tautan verifikasi telah kadaluarsa" }
    }

    const email = verificationToken.identifier.replace("reset:", "")

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return { error: "Pengguna tidak ditemukan" }
    }

    // Hash new password
    const hashedPassword = await hashPassword(password)

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    })

    // Clean up token
    await db.verificationToken.delete({
      where: { token },
    })

    return { 
      success: true, 
      message: "Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru Anda." 
    }
  } catch (error) {
    console.error("Reset Password Error:", error)
    return { error: "Terjadi kesalahan pada server" }
  }
}
