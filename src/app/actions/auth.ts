"use server"

import { db } from "@/lib/database"
import { hashPassword } from "@/lib/auth"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mail"
import crypto from "crypto"

export async function registerUser(formData: any) {
  try {
    const { name, email, password } = formData

    if (!email || !password || !name) {
      return { error: "Missing required fields" }
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
      return { error: "Password is too weak. Please ensure it is at least 'Kuat'." }
    }

    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      if (existingUser.emailVerified) {
        return { error: "An account with this email already exists and is verified. Please log in." }
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

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: isFirstUser ? "super_admin" : "admin",
        plan: isFirstUser ? "enterprise" : "free",
        emailVerified: isFirstUser ? new Date() : null, // Super admin is auto-verified
      },
    })

    if (isFirstUser) {
      return { 
        success: true, 
        isFirstUser: true,
        message: "Super Admin account created. You can now log in." 
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
      message: "Registration successful. Please check your email to verify your account." 
    }
  } catch (error) {
    console.error("Registration Error:", error)
    return { error: "Internal server error" }
  }
}

export async function forgotPassword(email: string) {
  try {
    if (!email) {
      return { error: "Email is required" }
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // If user doesn't exist, we still return success to prevent email enumeration
    if (!user) {
      return { 
        success: true, 
        message: "If an account with that email exists, we sent a password reset link." 
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
      message: "If an account with that email exists, we sent a password reset link." 
    }
  } catch (error) {
    console.error("Forgot Password Error:", error)
    return { error: "Internal server error" }
  }
}

export async function resetPassword(formData: any) {
  try {
    const { token, password } = formData

    if (!token || !password) {
      return { error: "Token and password are required" }
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
      return { error: "Password is too weak. Please ensure it is at least 'Kuat'." }
    }

    // Find the token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken || !verificationToken.identifier.startsWith("reset:")) {
      return { error: "Invalid or expired token" }
    }

    if (new Date() > verificationToken.expires) {
      await db.verificationToken.delete({ where: { token } })
      return { error: "Token has expired" }
    }

    const email = verificationToken.identifier.replace("reset:", "")

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return { error: "User not found" }
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
      message: "Password reset successfully. You can now log in with your new password." 
    }
  } catch (error) {
    console.error("Reset Password Error:", error)
    return { error: "Internal server error" }
  }
}
