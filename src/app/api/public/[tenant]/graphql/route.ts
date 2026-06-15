import { NextRequest, NextResponse } from "next/server"
import { graphql, buildSchema } from "graphql"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { buildDynamicTypeDefs, buildDynamicResolvers } from "@/lib/graphql-schema"
import { validateBody } from "@/lib/validate"
import { graphqlRequestSchema } from "@/lib/validations"
import { logApiRequest } from "@/lib/monitoring"
import DataLoader from "dataloader"
import { getCache, setCache } from "@/lib/cache"
import { createHash } from "crypto"

// POST /api/public/[tenant]/graphql - GraphQL endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const startTime = Date.now()
  let resolvedTenantId: string | null = null

  const logResponse = (res: NextResponse) => {
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: res.status,
      duration,
    }).catch(() => {})
    return res
  }

  try {
    const { tenant: tenantSlug } = await params
    resolvedTenantId = tenantSlug

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Missing or invalid authorization header" }] },
        { status: 401 }
      ))
    }

    const token = authHeader.replace("Bearer ", "")

    // Rate limit
    const rateLimitResult = await rateLimit(`public:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Rate limit exceeded" }] },
        { status: 429 }
      ))
    }

    // Hash the token for database lookup (SHA-256)
    const hashedToken = createHash("sha256").update(token).digest("hex")

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
      include: { tenant: true },
    })

    if (!apiToken) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Invalid API token" }] },
        { status: 401 }
      ))
    }

    resolvedTenantId = apiToken.tenantId

    // Verify tenant matches (check both ID and Slug)
    const isMatchingTenant = apiToken.tenantId === tenantSlug || apiToken.tenant.slug === tenantSlug
    
    if (!isMatchingTenant) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Token does not match tenant" }] },
        { status: 403 }
      ))
    }

    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "API token expired" }] },
        { status: 401 }
      ))
    }

    const validationResult = await validateBody(request, graphqlRequestSchema)
    if ("error" in validationResult) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Invalid request body" }] },
        { status: 400 }
      ))
    }
    const { query, variables } = validationResult.data

    // Build dynamic schema for this tenant using the correct DB client
    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(apiToken.tenantId)

    // Mutations require full-access token
    const allowMutations = apiToken.type === "full-access"
    const typeDefs = await buildDynamicTypeDefs(apiToken.tenantId, allowMutations, tenantDb)
    const schema = buildSchema(typeDefs)
    const resolvers = buildDynamicResolvers(apiToken.tenantId, tenantDb)

    // Check if query contains mutation and token doesn't allow it
    const isMutation = /^\s*(mutation\b|mutation\s*\{)/i.test(query) || query.trim().startsWith("mutation")
    if (isMutation && !allowMutations) {
      return logResponse(NextResponse.json(
        { errors: [{ message: "Mutations require a full-access API token" }] },
        { status: 403 }
      ))
    }

    // Execute query
    let gqlResult: any
    const cacheKey = `graphql:${apiToken.tenantId}:${Buffer.from(query).toString("base64")}:${JSON.stringify(variables || {})}`

    if (!isMutation) {
      const cached = await getCache(cacheKey)
      if (cached) {
        return logResponse(NextResponse.json(cached, {
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-Cache": "HIT",
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          }
        }))
      }
    }

    const entryLoader = new DataLoader(async (keys: readonly string[]) => {
      const entries = await tenantDb.contentEntry.findMany({
        where: { id: { in: keys as string[] }, tenantId: apiToken.tenantId }
      })
      const entryMap = new Map(entries.map((e: any) => [e.id, e]))
      return keys.map(k => entryMap.get(k) || null)
    })

    gqlResult = await graphql({
      schema,
      source: query,
      rootValue: isMutation ? resolvers.Mutation : resolvers.Query,
      contextValue: { tenantId: apiToken.tenantId, tenantDb, loaders: { entryLoader } },
      variableValues: variables,
    })

    if (!isMutation && !gqlResult.errors) {
      await setCache(cacheKey, gqlResult, 300)
    }

    // Update last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    return logResponse(NextResponse.json(gqlResult, {
      headers: {
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-Cache": "MISS",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }))
  } catch (error) {
    console.error("GraphQL error:", error)
    return logResponse(NextResponse.json(
      { errors: [{ message: "Internal server error" }] },
      { status: 500 }
    ))
  }
}

// GET for GraphQL introspection / playground info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const startTime = Date.now()
  const { tenant: tenantSlug } = await params

  const logResponse = (res: NextResponse) => {
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: tenantSlug,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: res.status,
      duration,
    }).catch(() => {})
    return res
  }

  return logResponse(NextResponse.json({
    message: `GraphQL endpoint for tenant: ${tenantSlug}`,
    usage: "POST with { query, variables } and Authorization: Bearer <token> header",
    example: {
      query: '{ articles(page: 1, limit: 10) { data { id } meta { total } } }',
    },
  }))
}
