import { NextRequest, NextResponse } from "next/server"
import { graphql, buildSchema } from "graphql"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { buildDynamicTypeDefs, buildDynamicResolvers } from "@/lib/graphql-schema"
import { validateBody } from "@/lib/validate"
import { graphqlRequestSchema } from "@/lib/validations"

// POST /api/public/[tenant]/graphql - GraphQL endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { errors: [{ message: "Missing or invalid authorization header" }] },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    // Rate limit
    const rateLimitResult = await rateLimit(`public:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { errors: [{ message: "Rate limit exceeded" }] },
        { status: 429 }
      )
    }

    // Validate token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return NextResponse.json(
        { errors: [{ message: "Invalid API token" }] },
        { status: 401 }
      )
    }

    // Verify tenant matches (check both ID and Slug)
    const isMatchingTenant = apiToken.tenantId === tenantSlug || apiToken.tenant.slug === tenantSlug
    
    if (!isMatchingTenant) {
      return NextResponse.json(
        { errors: [{ message: "Token does not match tenant" }] },
        { status: 403 }
      )
    }

    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return NextResponse.json(
        { errors: [{ message: "API token expired" }] },
        { status: 401 }
      )
    }

    const validationResult = await validateBody(request, graphqlRequestSchema)
    if ("error" in validationResult) {
      return NextResponse.json(
        { errors: [{ message: "Invalid request body" }] },
        { status: 400 }
      )
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
      return NextResponse.json(
        { errors: [{ message: "Mutations require a full-access API token" }] },
        { status: 403 }
      )
    }

    // Execute query
    const gqlResult = await graphql({
      schema,
      source: query,
      rootValue: isMutation ? resolvers.Mutation : resolvers.Query,
      variableValues: variables,
    })

    // Update last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json(gqlResult, {
      headers: {
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    })
  } catch (error) {
    console.error("GraphQL error:", error)
    return NextResponse.json(
      { errors: [{ message: "Internal server error" }] },
      { status: 500 }
    )
  }
}

// GET for GraphQL introspection / playground info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: tenantSlug } = await params
  return NextResponse.json({
    message: `GraphQL endpoint for tenant: ${tenantSlug}`,
    usage: "POST with { query, variables } and Authorization: Bearer <token> header",
    example: {
      query: '{ articles(page: 1, limit: 10) { data { id } meta { total } } }',
    },
  })
}
