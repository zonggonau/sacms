import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { hashPassword } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 })
    }

    const hasNumber = /\d/.test(password)
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!hasNumber || !hasSymbol) {
      return NextResponse.json({ error: "Password must contain at least one number and one symbol" }, { status: 400 })
    }

    // Find the token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken || !verificationToken.identifier.startsWith("reset:")) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
    }

    if (new Date() > verificationToken.expires) {
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.json({ error: "Token has expired" }, { status: 400 })
    }

    const email = verificationToken.identifier.replace("reset:", "")

    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
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

    return NextResponse.json({ 
      success: true, 
      message: "Password reset successfully. You can now log in with your new password." 
    })
  } catch (error) {
    console.error("Reset Password Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
