import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getRedis } from "@/lib/redis"
import { isSelfHosted, isRouteAllowed } from "@/lib/selfhost"

// The canonical hostname of this app (without https://)
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  .replace(/^https?:\/\//, "")
  .split(":")[0] // strip port

/**
 * Security proxy: adds security headers, CORS, API versioning,
 * rate limiting, custom domain routing, and self-hosted mode enforcement.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host")?.split(":")[0] || ""

  // ==================== SELF-HOSTED MODE GUARD ====================
  if (isSelfHosted()) {
    // Root path → redirect to dashboard
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Block disallowed routes (SaaS billing, admin panel, etc.)
    if (!isRouteAllowed(pathname)) {
      // For API routes, return JSON 404
      if (pathname.startsWith("/api/")) {
        return new NextResponse(
          JSON.stringify({
            error: "Not Found",
            message: "This endpoint is not available in self-hosted mode.",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      }
      // For page routes, redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // ==================== FIRST USER REDIRECT ====================
  // If no users exist, redirect /login and / to /register
  const firstUserPaths = ["/login", "/"]
  if (firstUserPaths.includes(pathname) && !pathname.startsWith("/api/")) {
    try {
      const checkUrl = new URL("/api/auth/check-first-user", request.url).toString()
      const res = await fetch(checkUrl, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        if (data.isFirstUser) {
          return NextResponse.redirect(new URL("/register", request.url))
        }
      }
    } catch {
      // Fail silently — let the page render normally
    }
  }

  // ==================== RATE LIMITING ====================
  // Apply rate limiting to all API routes with appropriate configs
  if (pathname.startsWith("/api/public/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
    const rl = await rateLimit(`ip:${ip}`, RATE_LIMITS.publicApi)

    if (!rl.success) {
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          resetAt: new Date(rl.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": rl.remaining.toString(),
            "X-RateLimit-Reset": rl.resetAt.toString(),
          },
        }
      )
    }
  }

  // B6 Fix: Rate limit auth endpoints (30 req/min per IP)
  if (pathname.startsWith("/api/auth/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
    const rl = await rateLimit(`auth:${ip}`, RATE_LIMITS.auth)

    if (!rl.success) {
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Authentication rate limit exceeded.",
          resetAt: new Date(rl.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": rl.remaining.toString(),
            "X-RateLimit-Reset": rl.resetAt.toString(),
          },
        }
      )
    }
  }

  // B6 Fix: Rate limit tenant management API (300 req/min per IP)
  if (pathname.startsWith("/api/tenant/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
    const rl = await rateLimit(`api:${ip}`, RATE_LIMITS.api)

    if (!rl.success) {
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "API rate limit exceeded.",
          resetAt: new Date(rl.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": rl.remaining.toString(),
            "X-RateLimit-Reset": rl.resetAt.toString(),
          },
        }
      )
    }
  }


  // ==================== CUSTOM DOMAIN ROUTING ====================
  let tenantSlug: string | null = null
  let version = "v1"

  if (host && host !== APP_HOST && !host.includes("localhost")) {
    const redis = getRedis()
    if (redis) {
      tenantSlug = await redis.get(`domain:${host}`)
    }
    
    if (tenantSlug) {
      // Map custom domain paths. Supports /v1/content or /content (defaults to v1)
      let restPath = pathname
      const vMatch = pathname.match(/^\/(v[12])\/(.+)$/)
      if (vMatch) {
        version = vMatch[1]
        restPath = `/${vMatch[2]}`
      }

      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/api/public/${tenantSlug}${restPath}`
      
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response)
      applyCorsHeaders(response)
      response.headers.set("X-API-Version", version)
      response.headers.set("X-Tenant-Domain", host)

      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers })
      }
      return response
    }
  }

  // ==================== API VERSIONING (APP_HOST) ====================
  // Rewrite /api/v1/<tenant>/... → /api/public/<tenant>/...
  // Rewrite /api/v2/<tenant>/... → /api/public/<tenant>/... (future)
  const versionMatch = pathname.match(/^\/api\/(v[12])\/(.+)$/)
  if (versionMatch) {
    version = versionMatch[1]
    const rest = versionMatch[2]
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/api/public/${rest}`

    const response = NextResponse.rewrite(rewriteUrl)
    applySecurityHeaders(response)
    applyCorsHeaders(response)
    response.headers.set("X-API-Version", version)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  const response = NextResponse.next()
  applySecurityHeaders(response)

  // CORS for public API routes
  if (pathname.startsWith("/api/public/")) {
    applyCorsHeaders(response)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  return response
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  // Content-Security-Policy: allow same-origin + trusted CDNs only
  // 'unsafe-inline' is kept for Next.js SSR styles; script-src relies on nonces
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com https://cdn.jsdelivr.net https://unpkg.com https://embeddable-sandbox.cdn.apollographql.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://embeddable-sandbox.cdn.apollographql.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "connect-src 'self' https:",
      "frame-src 'self' data: blob: https://app.midtrans.com https://app.sandbox.midtrans.com https://sandbox.embed.apollographql.com https://embeddable-sandbox.cdn.apollographql.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  )
}

function applyCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type")
}

export const config = {
  matcher: [
    // Match all API routes and pages, skip static files
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
}
