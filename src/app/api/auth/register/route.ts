import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { hashPassword } from "@/lib/auth"
import { sendVerificationEmail } from "@/lib/mail"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 })
    }

    const hasNumber = /\d/.test(password)
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!hasNumber || !hasSymbol) {
      return NextResponse.json({ error: "Password must contain at least one number and one symbol" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 })
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
        role: isFirstUser ? "super_admin" : "user",
        plan: isFirstUser ? "enterprise" : "free",
        emailVerified: isFirstUser ? new Date() : null, // Super admin is auto-verified
      },
    })

    if (isFirstUser) {
      return NextResponse.json({ 
        success: true, 
        isFirstUser: true,
        message: "Super Admin account created. You can now log in." 
      })
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

    return NextResponse.json({ 
      success: true, 
      message: "Registration successful. Please check your email to verify your account." 
    })
  } catch (error) {
    console.error("Registration Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
