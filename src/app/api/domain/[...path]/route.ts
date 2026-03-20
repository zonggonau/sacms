import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

/**
 * Custom Domain Proxy — /api/domain/[...path]
 *
 * Intercepts requests arriving on verified custom domains.
 * Resolves the tenant from the domain, then re-routes to the
 * appropriate public API endpoint.
 *
 * Custom domain routing:
 *   /content/{contentType}          → /api/public/{tenant}/content/{contentType}
 *   /single/{singleType}            → /api/public/{tenant}/single/{singleType}
 *   /graphql                        → /api/public/{tenant}/graphql
 *   /brand                          → /api/public/{tenant}/brand
 *   /content/{contentType}/{id}     → /api/public/{tenant}/content/{contentType}/{id}
 */

type Context = { params: Promise<{ path: string[] }> }

async function handler(request: NextRequest, context: Context) {
  const { path: pathSegments } = await context.params
  const path = pathSegments?.join("/") || ""

  // Read the X-Custom-Domain header injected by middleware
  const customDomain = request.headers.get("x-custom-domain")

  if (!customDomain) {
    return NextResponse.json({ error: "Custom domain header missing" }, { status: 400 })
  }

  // Rate-limit by domain
  const rl = await rateLimit(`domain:${customDomain}`, RATE_LIMITS.publicApi)
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  // Resolve tenant from verified custom domain
  const tenant = await db.tenant.findFirst({
    where: {
      customDomain,
      customDomainStatus: "verified",
    },
    select: { slug: true, status: true },
  })

  if (!tenant) {
    return NextResponse.json(
      { error: "Domain not found or not verified" },
      { status: 404 }
    )
  }

  if (tenant.status !== "active") {
    return NextResponse.json(
      { error: "Tenant is not active" },
      { status: 403 }
    )
  }

  // Build the internal URL to rewrite to
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const targetPath = `/api/public/${tenant.slug}/${path}`

  // Reconstruct URL with original search params
  const targetUrl = new URL(targetPath, appUrl)
  targetUrl.search = request.nextUrl.search

  // Proxy the request to the resolved public API URL
  const proxyResponse = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      // Override host so Next.js routing isn't confused
      host: new URL(appUrl).host,
      "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
      "x-custom-domain": customDomain,
      "x-resolved-tenant": tenant.slug,
    },
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.blob()
        : undefined,
    signal: AbortSignal.timeout(30000),
  })

  // Forward response with CORS headers
  const responseHeaders = new Headers(proxyResponse.headers)
  responseHeaders.set("Access-Control-Allow-Origin", "*")
  responseHeaders.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  )
  responseHeaders.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  )
  responseHeaders.set("X-Served-By", "ContentFlow")
  responseHeaders.set("X-Tenant", tenant.slug)

  const body = await proxyResponse.arrayBuffer()

  return new NextResponse(body, {
    status: proxyResponse.status,
    headers: responseHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  })
}
