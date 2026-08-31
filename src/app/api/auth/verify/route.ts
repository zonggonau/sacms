import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

function getSafeRedirectUrl(req: NextRequest, pathWithQuery: string): URL {
  // Read forwarded headers from Caddy / Reverse Proxy
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  
  // If host is a valid public host (e.g. sacms.cloud or custom domain), use it
  if (host && !host.includes("0.0.0.0") && !host.startsWith("127.0.0.1") && !host.startsWith("app:")) {
    return new URL(pathWithQuery, `${proto}://${host}`)
  }

  // Fallback to NEXT_PUBLIC_APP_URL, NEXTAUTH_URL, or production domain
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http")) {
    return new URL(pathWithQuery, process.env.NEXT_PUBLIC_APP_URL)
  }
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith("http") && !process.env.NEXTAUTH_URL.includes("localhost")) {
    return new URL(pathWithQuery, process.env.NEXTAUTH_URL)
  }
  if (process.env.NODE_ENV === "production") {
    return new URL(pathWithQuery, "https://sacms.cloud")
  }
  return new URL(pathWithQuery, "http://localhost:3000")
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")?.trim()

    if (!token) {
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=MissingToken"))
    }

    // 1. Find the verification token in database
    const verificationToken = await db.verificationToken.findFirst({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=InvalidToken"))
    }

    // 2. Check token expiration
    if (new Date() > verificationToken.expires) {
      // Token expired, delete it
      await db.verificationToken.deleteMany({ where: { token } }).catch(() => {})
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=TokenExpired"))
    }

    // 3. Find target user
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier.toLowerCase() },
    })

    if (!user) {
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=UserNotFound"))
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
    return NextResponse.redirect(getSafeRedirectUrl(req, `/login?verified=true&email=${emailParam}`))
  } catch (error) {
    console.error("Verification Error:", error)
    return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=InternalError"))
  }
}
