import { NextRequest, NextResponse } from "next/server"
import { resolvePublicApiActor } from "@/lib/public-api-actor"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { buildOpenApiSpec, CORS_HEADERS } from "@/lib/openapi-generator"
import { EXCLUDE_PLATFORM_CONTENT_TYPES } from "@/lib/platform-content-types"
import { db, getTenantDb } from "@/lib/database"

/**
 * A real OpenAPI 3.1 document generated live from this tenant's CMS schema —
 * so any OpenAPI-aware tool (v0.app, ChatGPT Custom GPTs, Postman, a codegen
 * CLI) can discover the whole public REST API surface by fetching one URL,
 * instead of an AI agent having to read get_full_schema/get_api_info and
 * translate it by hand. Same generator (buildOpenApiSpec) the dashboard's
 * Swagger tab and the MCP server's get_openapi_spec tool both use — see
 * src/lib/openapi-generator.ts for the full history of why this exists as
 * one shared function instead of three.
 *
 * CORS is open (mirrors the pre-existing behavior this route already had in
 * production) since the whole point is letting a browser-side tool fetch
 * this cross-origin with zero setup. Structure only, no real content — same
 * "anonymous GET is public-read" posture as the rest of /api/public/[tenant]/*.
 * Content Type visibility matches the real public content route exactly: a
 * tenant's own types plus global ones, minus SaCMS's internal platform types.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantParam } = await params

  const resolution = await resolvePublicApiActor(request, tenantParam)
  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.error }, { status: resolution.status, headers: CORS_HEADERS })
  }
  const actor = resolution.actor

  const rateLimitKey = `public:openapi:${actor.tenantId}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`
  const rateLimitResult = await rateLimit(rateLimitKey, RATE_LIMITS.publicApi)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429, headers: CORS_HEADERS })
  }

  const [tenant, tenantDb] = await Promise.all([
    db.tenant.findUnique({ where: { id: actor.tenantId }, select: { name: true } }),
    getTenantDb(actor.tenantId),
  ])

  const [contentTypesRaw, singleTypesRaw] = await Promise.all([
    tenantDb.contentType.findMany({
      where: { OR: [{ tenantId: actor.tenantId }, { tenantId: null, ...EXCLUDE_PLATFORM_CONTENT_TYPES }] },
      include: { schemaFields: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    tenantDb.singleType.findMany({
      where: { tenantId: actor.tenantId },
      include: { schemaFields: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ])

  // The actual host this request came in on (reflects a tenant's verified
  // custom domain correctly) — more accurate for this specific endpoint
  // than the static platform-default resolver, since it's bound to a real
  // incoming request. Matches this route's pre-existing behavior.
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
  const apiOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "https://sacms.cloud"

  const spec = buildOpenApiSpec({
    tenantName: tenant?.name || actor.tenantSlug,
    tenantSlug: actor.tenantSlug,
    apiOrigin,
    contentTypes: contentTypesRaw.map((ct) => ({ slug: ct.slug, name: ct.name, fields: ct.schemaFields })),
    singleTypes: singleTypesRaw.map((st) => ({ slug: st.slug, name: st.name, fields: st.schemaFields })),
  })

  return NextResponse.json(spec, {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  })
}
