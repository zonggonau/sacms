import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

function getSafeRedirectUrl(req: NextRequest, pathWithQuery: string): URL {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  
  if (host && !host.includes("0.0.0.0") && !host.startsWith("127.0.0.1") && !host.startsWith("app:")) {
    return new URL(pathWithQuery, `${proto}://${host}`)
  }

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

    const verificationToken = await db.verificationToken.findFirst({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=InvalidToken"))
    }

    if (new Date() > verificationToken.expires) {
      await db.verificationToken.deleteMany({ where: { token } }).catch(() => {})
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=TokenExpired"))
    }

    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier.toLowerCase() },
    })

    if (!user) {
      return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=UserNotFound"))
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
      },
    })

    await db.verificationToken.deleteMany({
      where: { identifier: verificationToken.identifier },
    }).catch(() => {})

    const emailParam = encodeURIComponent(user.email)
    return NextResponse.redirect(getSafeRedirectUrl(req, `/login?verified=true&email=${emailParam}`))
  } catch (error) {
    console.error("Verification Error:", error)
    return NextResponse.redirect(getSafeRedirectUrl(req, "/login?error=InternalError"))
  }
}
