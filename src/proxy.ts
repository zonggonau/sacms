import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// The canonical hostname of this app (without https://)
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  .replace(/^https?:\/\//, "")
  .split(":")[0] // strip port

/**
 * Security proxy: adds security headers, CORS, API versioning,
 * and custom domain routing for white-label tenants.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host")?.split(":")[0] || ""

  // ==================== CUSTOM DOMAIN ROUTING ====================
  // If the incoming host is not our main app host, treat it as a white-label
  // custom domain. Rewrite all requests to /api/domain/[...path] which will
  // resolve the tenant slug from the database and serve the public API.
  const isCustomDomain =
    host !== APP_HOST &&
    host !== "localhost" &&
    !host.endsWith(".localhost") &&
    !host.startsWith("127.") &&
    !host.startsWith("192.168.")

  if (isCustomDomain) {
    const rewriteUrl = request.nextUrl.clone()
    // Strip leading /api/ prefix if present (normalise paths)
    const cleanPath = pathname.replace(/^\/api\//, "/")
    rewriteUrl.pathname = `/api/domain${cleanPath}`

    const response = NextResponse.rewrite(rewriteUrl)
    applySecurityHeaders(response)
    applyCorsHeaders(response)
    // Pass the original custom domain to the route handler
    response.headers.set("X-Custom-Domain", host)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  // ==================== API VERSIONING ====================
  // Rewrite /api/v1/<tenant>/... → /api/public/<tenant>/...
  // Rewrite /api/v2/<tenant>/... → /api/public/<tenant>/... (future)
  const versionMatch = pathname.match(/^\/api\/(v[12])\/(.+)$/)
  if (versionMatch) {
    const version = versionMatch[1]
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
    "max-age=31536000; includeSubDomains"
  )
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
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
