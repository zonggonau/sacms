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

    if (existingUser) {
      if (existingUser.emailVerified) {
        return { error: "Akun dengan email ini sudah terdaftar dan terverifikasi. Silakan masuk." }
      } else {
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

        // Send email
        await sendVerificationEmail(existingUser.email, token, existingUser.name || "User")

        return { 
          success: true, 
          message: "Akun sudah terdaftar tapi belum diverifikasi. Kami telah mengirim ulang email verifikasi ke kotak masuk Anda." 
        }
      }
    }

    // Check if this is the first user
    const userCount = await db.user.count()
    const isFirstUser = userCount === 0

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user (first user is super_admin, all new registrants are account owners)
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? "super_admin" : "owner",
        plan: isFirstUser ? "enterprise" : "free",
        emailVerified: isFirstUser ? new Date() : null, // Super admin is auto-verified
      },
    })

    if (isFirstUser) {
      return { 
        success: true, 
        isFirstUser: true,
        message: "Akun Super Admin berhasil dibuat. Silakan masuk." 
      }
    }

    // Generate Verification Token
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date()
    expires.setHours(expires.getHours() + 24) // 24 hours expiry

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    })

    // Send email
    await sendVerificationEmail(user.email, token, user.name || "User")

    return { 
      success: true, 
      message: "Pendaftaran berhasil. Silakan periksa email Anda untuk verifikasi akun." 
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
