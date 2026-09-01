import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getRedis } from "@/lib/redis"

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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"

  // ==================== PLATFORM SETTINGS & MAINTENANCE CHECK ====================
  const redis = getRedis()
  if (redis) {
    try {
      const platformSettings = await redis.get<any>("system:platform-settings")
      if (platformSettings) {
        // 1. IP Blacklist check
        if (platformSettings.ipBlacklist) {
          const blacklistedIps = platformSettings.ipBlacklist.split(",").map((s: string) => s.trim()).filter(Boolean)
          if (blacklistedIps.includes(ip)) {
            return new NextResponse(
              JSON.stringify({ error: "Forbidden", message: "Your IP address has been blacklisted from accessing this service." }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            )
          }
        }

        // 2. Maintenance Mode check (only affects non-superadmin and non-whitelisted IPs)
        if (platformSettings.maintenanceMode === "true" && !pathname.startsWith("/admin") && !pathname.startsWith("/api/auth")) {
          const whitelist = (platformSettings.maintenanceIpWhitelist || "127.0.0.1").split(",").map((s: string) => s.trim())
          if (!whitelist.includes(ip) && !whitelist.includes("::1")) {
            return new NextResponse(
              JSON.stringify({
                error: "Service Unavailable",
                maintenance: true,
                message: platformSettings.maintenanceMessage || "Platform SaCMS sedang dalam pemeliharaan terjadwal.",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            )
          }
        }
      }
    } catch {
      // Redis failover - allow request
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

  // ==================== V0 PREVIEW IFRAME INTERCEPT ====================
  // If the request originates from the V0 preview iframe (via Referer) and is not already a proxy route,
  // rewrite it so that API calls from the V0 frontend (e.g. /chat/api/...) go through our proxy.
  const referer = request.headers.get("referer") || ""
  const v0ProxyMatch = referer.match(/\/api\/tenant\/([^\/]+)\/ai-builder\/preview\/([^\/?#]+)/)
  if (v0ProxyMatch && !pathname.startsWith("/api/tenant/") && !pathname.startsWith("/_next/")) {
    const tenantSlug = v0ProxyMatch[1]
    const chatId = v0ProxyMatch[2]
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}${pathname}`
    
    // We rewrite the request to the proxy route
    return NextResponse.rewrite(rewriteUrl)
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


  // ==================== PLATFORM SUBDOMAIN & CUSTOM DOMAIN ROUTING ====================
  const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud").toLowerCase()
  const cleanHost = (host.split(":")[0] || "").toLowerCase()

  let platformSubdomain: "api" | "cms" | "admin" | null = null
  let dynamicSubdomain: string | null = null

  if (cleanHost === `api.${ROOT_DOMAIN}` || cleanHost === "api.localhost") {
    platformSubdomain = "api"
  } else if (cleanHost === `cms.${ROOT_DOMAIN}` || cleanHost === "cms.localhost") {
    platformSubdomain = "cms"
  } else if (cleanHost === `admin.${ROOT_DOMAIN}` || cleanHost === "admin.localhost") {
    platformSubdomain = "admin"
  } else if (cleanHost.endsWith(`.${ROOT_DOMAIN}`) && cleanHost !== `www.${ROOT_DOMAIN}` && cleanHost !== ROOT_DOMAIN) {
    dynamicSubdomain = cleanHost.replace(`.${ROOT_DOMAIN}`, "")
  } else if (cleanHost.endsWith(".localhost") && cleanHost !== "localhost") {
    dynamicSubdomain = cleanHost.replace(".localhost", "")
  }

  // 1. Dedicated API Subdomain (api.sacms.cloud)
  if (platformSubdomain === "api") {
    // Static assets & internal Next.js paths
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/sitemap")
    ) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      return response
    }

    // Health check
    if (pathname === "/health" || pathname === "/api/health") {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = "/api/health"
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      applyCorsHeaders(response, request)
      return response
    }

    // Interactive Docs on root or /docs
    if (pathname === "/" || pathname === "" || pathname === "/docs" || pathname === "/api-docs") {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = "/api-docs"
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      applyCorsHeaders(response, request)
      response.headers.set("X-Subdomain-Portal", "api")
      return response
    }

    // Passthrough for standard API paths (/api/auth/..., /api/public/..., /api/tenant/...)
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      applyCorsHeaders(response, request)
      response.headers.set("X-Subdomain-Portal", "api")
      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers })
      }
      return response
    }

    // Versioned Route (e.g., /v1/tenant/content/posts -> /api/public/tenant/content/posts)
    const vMatch = pathname.match(/^\/(v[12])\/([^/]+)\/(.+)$/)
    if (vMatch) {
      const ver = vMatch[1]
      const tenant = vMatch[2]
      const rest = vMatch[3]
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/api/public/${tenant}/${rest}`
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      applyCorsHeaders(response, request)
      response.headers.set("X-API-Version", ver)
      response.headers.set("X-Subdomain-Portal", "api")
      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers })
      }
      return response
    }

    // Direct Tenant REST API (e.g. api.sacms.cloud/delvia/content/posts -> /api/public/delvia/content/posts)
    const tenantContentMatch = pathname.match(/^\/([^/]+)\/(content|single-types|graphql|brand)(.*)$/)
    if (tenantContentMatch) {
      const tenant = tenantContentMatch[1]
      const action = tenantContentMatch[2]
      const rest = tenantContentMatch[3] || ""
      const rewriteUrl = request.nextUrl.clone()
      if (action === "single-types") {
        rewriteUrl.pathname = `/api/public/${tenant}/content${rest}`
      } else {
        rewriteUrl.pathname = `/api/public/${tenant}/${action}${rest}`
      }
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      applyCorsHeaders(response, request)
      response.headers.set("X-Subdomain-Portal", "api")
      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers })
      }
      return response
    }

    // Fallback pass-through with CORS
    const response = NextResponse.next()
    applySecurityHeaders(response, pathname)
    applyCorsHeaders(response, request)
    response.headers.set("X-Subdomain-Portal", "api")
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  // 2. Dedicated CMS Subdomain (cms.sacms.cloud)
  if (platformSubdomain === "cms") {
    // Static assets & Auth
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register")
    ) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      return response
    }

    // Root CMS access -> rewrite to workspace selector / dashboard
    if (pathname === "/" || pathname === "") {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = "/dashboard"
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "cms")
      return response
    }

    // Passthrough if already dashboard path
    if (pathname.startsWith("/dashboard/") || pathname.startsWith("/api/")) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "cms")
      return response
    }

    // Map cms.sacms.cloud/tenant/content/... -> /dashboard/tenant/cms/content/...
    const cmsMatch = pathname.match(/^\/([^/]+)(.*)$/)
    if (cmsMatch) {
      const tenant = cmsMatch[1]
      const rest = cmsMatch[2] || ""
      const rewriteUrl = request.nextUrl.clone()

      if (rest.startsWith("/cms")) {
        rewriteUrl.pathname = `/dashboard/${tenant}${rest}`
      } else if (rest.startsWith("/content")) {
        rewriteUrl.pathname = `/dashboard/${tenant}/cms${rest}`
      } else if (rest.startsWith("/single-types") || rest.startsWith("/media") || rest.startsWith("/graphql")) {
        rewriteUrl.pathname = `/dashboard/${tenant}/cms${rest}`
      } else if (rest === "" || rest === "/") {
        rewriteUrl.pathname = `/dashboard/${tenant}/cms`
      } else {
        // Fallback to dashboard route group
        rewriteUrl.pathname = `/dashboard/${tenant}${rest}`
      }

      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "cms")
      return response
    }
  }

  // 3. Dedicated Admin Subdomain (admin.sacms.cloud)
  if (platformSubdomain === "admin") {
    // Static assets & Auth
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register")
    ) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      return response
    }

    // Superadmin route passthrough
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "admin")
      return response
    }

    // Root admin access -> workspace hub
    if (pathname === "/" || pathname === "") {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = "/dashboard"
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "admin")
      return response
    }

    // Already dashboard or API path
    if (pathname.startsWith("/dashboard/") || pathname.startsWith("/api/")) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "admin")
      return response
    }

    // Map admin.sacms.cloud/tenant/... -> /dashboard/tenant/...
    const adminMatch = pathname.match(/^\/([^/]+)(.*)$/)
    if (adminMatch) {
      const tenant = adminMatch[1]
      const rest = adminMatch[2] || ""
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/dashboard/${tenant}${rest}`
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "admin")
      return response
    }
  }

  // 4. Dynamic Owner / Workspace Subdomain Routing (*.sacms.cloud)
  if (dynamicSubdomain) {
    // Static assets & Auth passthrough
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register")
    ) {
      const response = NextResponse.next()
      applySecurityHeaders(response, pathname)
      return response
    }

    // A. Owner Account Subdomain (e.g. u8f9c1d2e3b4a5f6.sacms.cloud)
    const isOwnerFormat = dynamicSubdomain.startsWith("u") && dynamicSubdomain.length >= 8
    if (isOwnerFormat) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/owner/${dynamicSubdomain}${pathname === "/" ? "" : pathname}`
      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response, pathname)
      response.headers.set("X-Subdomain-Portal", "owner")
      response.headers.set("X-Owner-Slug", dynamicSubdomain)
      return response
    }

    // B. Direct Workspace Subdomain (e.g. klinik-intan.sacms.cloud)
    const rewriteUrl = request.nextUrl.clone()

    if (pathname === "/" || pathname === "") {
      // Default entry: CMS Studio for this workspace
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}/cms`
    } else if (pathname.startsWith("/admin")) {
      // /admin -> Workspace Settings & Schemas
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}${pathname.replace(/^\/admin/, "")}`
    } else if (pathname.startsWith("/content")) {
      // /content/posts -> /dashboard/[slug]/cms/content/posts
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}/cms${pathname}`
    } else if (pathname.startsWith("/media") || pathname.startsWith("/single-types")) {
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}/cms${pathname}`
    } else if (pathname.startsWith("/api/public/") || pathname.startsWith("/api/tenant/")) {
      rewriteUrl.pathname = pathname
    } else if (pathname.startsWith("/api/")) {
      rewriteUrl.pathname = `/api/public/${dynamicSubdomain}${pathname.replace(/^\/api/, "")}`
    } else if (pathname === "/graphql") {
      rewriteUrl.pathname = `/api/public/${dynamicSubdomain}/graphql`
    } else if (pathname.startsWith("/cms")) {
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}${pathname}`
    } else if (pathname.startsWith("/dashboard")) {
      rewriteUrl.pathname = pathname
    } else {
      // Default: CMS route group
      rewriteUrl.pathname = `/dashboard/${dynamicSubdomain}/cms${pathname}`
    }

    const response = NextResponse.rewrite(rewriteUrl)
    applySecurityHeaders(response, pathname)
    applyCorsHeaders(response, request)
    response.headers.set("X-Subdomain-Portal", "workspace")
    response.headers.set("X-Tenant-Slug", dynamicSubdomain)
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  // ==================== CUSTOM DOMAIN ROUTING ====================
  let tenantSlug: string | null = null
  let domainTarget: string = "cms"
  let version = "v1"

  if (host && host !== APP_HOST && !host.includes("localhost")) {
    const redis = getRedis()
    if (redis) {
      const rawValue = await redis.get<string>(`domain:${host}`)
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue)
          tenantSlug = parsed.slug || null
          domainTarget = parsed.target || "cms"
        } catch {
          // Legacy plain string value
          tenantSlug = rawValue
          domainTarget = "cms"
        }
      }
    }

    if (tenantSlug) {
      // ---- API passthrough: always rewrite /api/* to public API ----
      if (pathname.startsWith("/api/") || pathname.startsWith("/graphql")) {
        let restPath = pathname
        const vMatch = pathname.match(/^\/(v[12])\/(.+)$/)
        if (vMatch) {
          version = vMatch[1]
          restPath = `/${vMatch[2]}`
        }
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = `/api/public/${tenantSlug}${restPath.replace(/^\/api/, "")}`
        const response = NextResponse.rewrite(rewriteUrl)
        applySecurityHeaders(response)
        applyCorsHeaders(response, request)
        response.headers.set("X-API-Version", version)
        response.headers.set("X-Tenant-Domain", host)
        if (request.method === "OPTIONS") {
          return new NextResponse(null, { status: 204, headers: response.headers })
        }
        return response
      }

      // ---- Static/Next.js internal assets: pass through unchanged ----
      if (
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/robots") ||
        pathname.startsWith("/sitemap")
      ) {
        const response = NextResponse.next()
        applySecurityHeaders(response)
        response.headers.set("X-Tenant-Domain", host)
        return response
      }

      // ---- Portal routing: redirect root "/" based on domain target ----
      if (pathname === "/" || pathname === "") {
        const rewriteUrl = request.nextUrl.clone()
        switch (domainTarget) {
          case "workspace":
            rewriteUrl.pathname = `/dashboard/${tenantSlug}`
            break
          case "site":
            rewriteUrl.pathname = `/site/${tenantSlug}`
            break
          case "api":
            rewriteUrl.pathname = `/api/public/${tenantSlug}/content`
            break
          case "cms":
          default:
            rewriteUrl.pathname = `/dashboard/${tenantSlug}/cms`
            break
        }
        const response = NextResponse.rewrite(rewriteUrl)
        applySecurityHeaders(response)
        response.headers.set("X-Tenant-Domain", host)
        response.headers.set("X-Domain-Target", domainTarget)
        return response
      }

      // ---- For all other paths under a custom domain, rewrite transparently ----
      const rewriteUrl = request.nextUrl.clone()
      if (pathname.startsWith("/cms")) {
        rewriteUrl.pathname = `/dashboard/${tenantSlug}${pathname}`
      } else if (pathname.startsWith("/dashboard")) {
        rewriteUrl.pathname = pathname
      } else {
        const response = NextResponse.next()
        applySecurityHeaders(response)
        response.headers.set("X-Tenant-Domain", host)
        response.headers.set("X-Domain-Target", domainTarget)
        return response
      }

      const response = NextResponse.rewrite(rewriteUrl)
      applySecurityHeaders(response)
      applyCorsHeaders(response, request)
      response.headers.set("X-API-Version", version)
      response.headers.set("X-Tenant-Domain", host)
      response.headers.set("X-Domain-Target", domainTarget)

      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers })
      }
      return response
    }
  }

  // ==================== API VERSIONING (APP_HOST) ====================
  const versionMatch = pathname.match(/^\/api\/(v[12])\/(.+)$/)
  if (versionMatch) {
    version = versionMatch[1]
    const rest = versionMatch[2]
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/api/public/${rest}`

    const response = NextResponse.rewrite(rewriteUrl)
    applySecurityHeaders(response, pathname)
    applyCorsHeaders(response, request)
    response.headers.set("X-API-Version", version)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  const response = NextResponse.next()
  applySecurityHeaders(response, pathname)

  // CORS for public API routes
  if (pathname.startsWith("/api/public/")) {
    applyCorsHeaders(response, request)

    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  return response
}

function applySecurityHeaders(response: NextResponse, pathname?: string) {
  response.headers.set("X-Content-Type-Options", "nosniff")

  const isPreview = pathname && (pathname.includes("/preview") || pathname.includes("/frontend"))

  if (isPreview) {
    response.headers.delete("X-Frame-Options")
  } else {
    response.headers.set("X-Frame-Options", "SAMEORIGIN")
  }

  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  const isDev = process.env.NODE_ENV !== "production"

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self' 'unsafe-inline' https:",
      `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}https://app.midtrans.com https://app.sandbox.midtrans.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://esm.sh https://embeddable-sandbox.cdn.apollographql.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://embeddable-sandbox.cdn.apollographql.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' data: blob: https:",
      isPreview ? "frame-ancestors *" : "frame-ancestors 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ")
  )
}

function applyCorsHeaders(response: NextResponse, request?: NextRequest) {
  const origin = request?.headers.get("origin")
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud").toLowerCase()

  if (origin && (origin.includes(rootDomain) || origin.includes("localhost"))) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*")
  }

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, x-api-key, X-API-Key, X-Tenant-Domain, X-API-Version"
  )
}

export const config = {
  matcher: [
    // Match all API routes and pages, skip static files
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
}
