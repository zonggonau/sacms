/**
 * CORS resolution for the headless member-auth endpoints.
 *
 * These endpoints return bearer tokens in the response body, so a wildcard
 * `Access-Control-Allow-Origin: *` is not a direct credential leak — but it lets
 * any site on the internet drive a tenant's login/registration flow from a
 * victim's browser. We instead echo the request Origin only when it is allowed:
 *
 *   1. an exact entry in `Tenant.allowedAuthOrigins`
 *   2. the tenant's own custom domain / subdomain
 *   3. any `localhost` / `127.0.0.1` origin while NODE_ENV !== "production"
 *
 * When the Origin is not allowed (or absent) no ACAO header is sent, so the
 * browser blocks the cross-origin read. Non-browser clients are unaffected.
 */

const BASE_METHODS = "GET, POST, PATCH, OPTIONS"
const BASE_ALLOW_HEADERS = "Content-Type, Authorization, x-api-key"

export interface AuthCorsTenant {
  slug: string
  customDomain?: string | null
  allowedAuthOrigins?: string[]
}

/**
 * Standard OPTIONS preflight response for an auth endpoint. There is no tenant
 * context yet, so only same-origin / localhost is auto-allowed; a real browser
 * preflight from an allowed cross-origin still succeeds because the subsequent
 * actual request carries the tenant and gets the echoed Origin.
 *
 * Pass the `[tenant]` param to look the tenant up and honour its allowlist on
 * the preflight too.
 */
export async function authCorsPreflight(request: Request, tenantParam?: string): Promise<Response> {
  let tenant: AuthCorsTenant | null = null
  if (tenantParam) {
    const { db } = await import("@/lib/database")
    const row = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantParam }, { id: tenantParam }] },
      select: { slug: true, customDomain: true, allowedAuthOrigins: true },
    })
    if (row) tenant = row
  }
  return new Response(null, { status: 204, headers: authCorsHeaders(request, tenant) })
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}

function tenantOwnOrigins(tenant: AuthCorsTenant): string[] {
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud").toLowerCase()
  const origins = [
    `https://${tenant.slug}.${root}`,
    `https://${root}`,
    `https://www.${root}`,
  ]
  if (tenant.customDomain) {
    origins.push(`https://${tenant.customDomain}`, `https://www.${tenant.customDomain}`)
  }
  return origins
}

/**
 * Build the CORS response headers for an auth endpoint request.
 *
 * `tenant` is optional so the OPTIONS preflight (which has no tenant context yet)
 * still gets a usable response; in that case only localhost is auto-allowed.
 */
export function authCorsHeaders(request: Request, tenant?: AuthCorsTenant | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": BASE_METHODS,
    "Access-Control-Allow-Headers": BASE_ALLOW_HEADERS,
    Vary: "Origin",
  }

  const origin = request.headers.get("origin")
  if (!origin) return headers

  const isDev = process.env.NODE_ENV !== "production"
  const allowed = new Set<string>(tenant ? [...(tenant.allowedAuthOrigins ?? []), ...tenantOwnOrigins(tenant)] : [])

  if (allowed.has(origin) || (isDev && isLocalhostOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Credentials"] = "true"
  }

  return headers
}
