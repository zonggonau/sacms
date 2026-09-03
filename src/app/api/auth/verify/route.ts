import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { resolveTrustedOrigin } from "@/lib/trusted-host"

export async function GET(req: NextRequest) {
  // Trusted origin only — never build the redirect from a raw X-Forwarded-Host
  // (host-header injection → the verification link lands on an attacker host).
  const origin = await resolveTrustedOrigin(req)
  const redirectTo = (pathWithQuery: string) =>
    NextResponse.redirect(new URL(pathWithQuery, origin))

  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")?.trim()

    if (!token) {
      return redirectTo("/login?error=MissingToken")
    }

    // 1. Find the verification token in database
    const verificationToken = await db.verificationToken.findFirst({
      where: { token },
    })

    if (!verificationToken) {
      return redirectTo("/login?error=InvalidToken")
    }

    // 2. Check token expiration
    if (new Date() > verificationToken.expires) {
      // Token expired, delete it
      await db.verificationToken.deleteMany({ where: { token } }).catch(() => {})
      return redirectTo("/login?error=TokenExpired")
    }

    // 3. Find target user
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier.toLowerCase() },
    })

    if (!user) {
      return redirectTo("/login?error=UserNotFound")
    }

    // 4. Update user's emailVerified field
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    })

    // 5. Clean up all pending verification tokens for this user
    await db.verificationToken.deleteMany({
      where: { identifier: verificationToken.identifier },
    }).catch(() => {})

    // 6. Redirect to login with success message
    const emailParam = encodeURIComponent(user.email)
    return redirectTo(`/login?verified=true&email=${emailParam}`)
  } catch (error) {
    console.error("Verification Error:", error)
    return redirectTo("/login?error=InternalError")
  }
}
