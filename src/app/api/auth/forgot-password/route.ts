import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { sendPasswordResetEmail } from "@/lib/mail"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // If user doesn't exist, we still return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ 
        success: true, 
        message: "If an account with that email exists, we sent a password reset link." 
      })
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

    return NextResponse.json({ 
      success: true, 
      message: "If an account with that email exists, we sent a password reset link." 
    })
  } catch (error) {
    console.error("Forgot Password Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
