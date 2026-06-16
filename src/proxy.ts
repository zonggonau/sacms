import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getRedis } from "@/lib/redis"

// The canonical hostname of this app (without https://)
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  .replace(/^https?:\/\//, "")
  .split(":")[0] // strip port

/**
 * Security middleware: adds security headers, CORS, API versioning,
 * rate limiting, and custom domain routing for white-label tenants.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host")?.split(":")[0] || ""

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


  // ==================== SUBDOMAIN & CUSTOM DOMAIN ROUTING ====================
  let tenantSlug: string | null = null
  let version = "v1"

  if (host && host !== APP_HOST) {
    if (host.endsWith(`.${APP_HOST}`)) {
      // Subdomain (e.g. acme.sacms.com or acme.localhost)
      tenantSlug = host.replace(`.${APP_HOST}`, "")
    } else if (!host.includes("localhost")) {
      // Custom Domain
      const redis = getRedis()
      if (redis) {
        tenantSlug = await redis.get(`domain:${host}`)
      }
    }
  }

  if (tenantSlug) {
    // Map custom domain / subdomain paths
    const isApiRequest = pathname.match(/^\/v[12]\//) || pathname === "/graphql"

    if (isApiRequest) {
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
    } else if (!pathname.startsWith("/api/")) {
      // Exclude global authentication and system paths from subdomain rewrites
      const isGlobalAuthPath = pathname.match(/^\/(login|register|forgot-password|reset-password)/)
      
      if (!isGlobalAuthPath) {
        // Subdomain UI Routing
        const rewriteUrl = request.nextUrl.clone()
        
        if (pathname.startsWith("/dashboard")) {
          // If accessing tenant.sacms.com/dashboard -> /dashboard/tenant
          // If accessing tenant.sacms.com/dashboard/settings -> /dashboard/tenant/settings
          const dashboardPath = pathname.replace(/^\/dashboard/, "")
          rewriteUrl.pathname = `/dashboard/${tenantSlug}${dashboardPath}`
        } else {
          // If accessing tenant.sacms.com/ -> /cms/tenant
          // If accessing tenant.sacms.com/posts -> /cms/tenant/posts
          rewriteUrl.pathname = `/cms/${tenantSlug}${pathname === "/" ? "" : pathname}`
        }
        
        const response = NextResponse.rewrite(rewriteUrl)
        applySecurityHeaders(response)
        return response
      }
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
