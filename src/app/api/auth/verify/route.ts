import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=MissingToken", req.url))
    }

    // Find the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url))
    }

    if (new Date() > verificationToken.expires) {
      // Token expired, delete it
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL("/login?error=TokenExpired", req.url))
    }

    // Update user's emailVerified field
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier },
    })

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=UserNotFound", req.url))
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    })

    // Clean up the token
    await db.verificationToken.delete({
      where: { token },
    })

    // Redirect to login with success message
    return NextResponse.redirect(new URL("/login?verified=true", req.url))
  } catch (error) {
    console.error("Verification Error:", error)
    return NextResponse.redirect(new URL("/login?error=InternalError", req.url))
  }
}
