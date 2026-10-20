import { NextRequest, NextResponse } from "next/server"
import { resolvePublicApiActor } from "@/lib/public-api-actor"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { buildOpenApiSpec } from "@/lib/openapi-generator"
import { resolveApiOrigin } from "@/lib/infrastructure/frontend-env"
import { EXCLUDE_PLATFORM_CONTENT_TYPES } from "@/lib/platform-content-types"
import { db, getTenantDb } from "@/lib/database"

/**
 * A real OpenAPI 3.0 document generated live from this tenant's CMS schema —
 * so any OpenAPI-aware tool (v0.app, Postman, Swagger UI, a codegen CLI) can
 * discover the whole public REST API surface by fetching one URL, instead
 * of an AI agent having to read get_full_schema/get_api_info and translate
 * it by hand. Same generator (buildOpenApiSpec) the dashboard's Swagger tab
 * and the MCP server's get_openapi_spec tool both use — see
 * src/lib/openapi-generator.ts.
 *
 * Structure only, no real content — same "anonymous GET is public-read"
 * posture as the rest of /api/public/[tenant]/*, since the whole point is
 * letting an external tool discover the shape with as little friction as
 * possible. Content Type visibility matches the real public content route
 * exactly: a tenant's own types plus global ones, minus SaCMS's internal
 * platform types.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantParam } = await params

  const resolution = await resolvePublicApiActor(request, tenantParam)
  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.error }, { status: resolution.status })
  }
  const actor = resolution.actor

  const rateLimitKey = `public:openapi:${actor.tenantId}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`
  const rateLimitResult = await rateLimit(rateLimitKey, RATE_LIMITS.publicApi)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const [tenant, tenantDb] = await Promise.all([
    db.tenant.findUnique({ where: { id: actor.tenantId }, select: { name: true } }),
    getTenantDb(actor.tenantId),
  ])

  const [contentTypesRaw, singleTypesRaw] = await Promise.all([
    tenantDb.contentType.findMany({
      where: { OR: [{ tenantId: actor.tenantId }, { tenantId: null, ...EXCLUDE_PLATFORM_CONTENT_TYPES }] },
      include: { schemaFields: true },
    }),
    tenantDb.singleType.findMany({
      where: { tenantId: actor.tenantId },
      include: { schemaFields: true },
    }),
  ])

  const spec = buildOpenApiSpec({
    tenantName: tenant?.name || actor.tenantSlug,
    tenantSlug: actor.tenantSlug,
    apiOrigin: resolveApiOrigin(),
    contentTypes: contentTypesRaw.map((ct) => ({ slug: ct.slug, name: ct.name, fields: ct.schemaFields })),
    singleTypes: singleTypesRaw.map((st) => ({ slug: st.slug, name: st.name, fields: st.schemaFields })),
  })

  return NextResponse.json(spec, { headers: { "Cache-Control": "private, max-age=60" } })
}
