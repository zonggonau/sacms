import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveContentData } from "@/lib/content-resolver"
import { logApiRequest } from "@/lib/monitoring"
import { getCache, setCache } from "@/lib/cache"

// Public API - Get single type content
// Requires API token in header: Authorization: Bearer <token>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; singleType: string }> }
) {
  try {
    const startTime = Date.now()
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params
    let resolvedTenantId: string | null = tenantSlug

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

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return logResponse(NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      ))
    }

    const token = authHeader.replace("Bearer ", "")

    // Rate limit by token
    const rateLimitResult = await rateLimit(`public:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return logResponse(NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      ))
    }

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return logResponse(NextResponse.json({ error: "Invalid API token" }, { status: 401 }))
    }

    // Update resolved tenant ID once token is verified
    resolvedTenantId = apiToken.tenantId

    // Verify tenant matches (check both ID and Slug)
    const isMatchingTenant = apiToken.tenantId === tenantSlug || apiToken.tenant.slug === tenantSlug
    
    if (!isMatchingTenant) {
      return logResponse(NextResponse.json({ error: "Token does not match tenant" }, { status: 403 }))
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return logResponse(NextResponse.json({ error: "API token expired" }, { status: 401 }))
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || "en"

    // CACHE CHECK
    const cacheKey = `single:${apiToken.tenantId}:${singleTypeSlug}:${locale}`
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

    // Get the correct DB client (Shared or Dedicated)
    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(apiToken.tenantId)

    // Get single type (prefer tenant-specific over global)
    const singleType = await tenantDb.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        OR: [
          { tenantId: apiToken.tenantId },
          { tenantId: null }
        ]
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
      include: {
        fields: { orderBy: { order: "asc" } },
      },
    })

    if (!singleType) {
      return logResponse(NextResponse.json({ error: "Single type not found" }, { status: 404 }))
    }

    // Check if single type is assigned to tenant
    const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: apiToken.tenantId,
          singleTypeId: singleType.id,
          locale,
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return logResponse(NextResponse.json(
        { error: "Single type not available for this tenant" },
        { status: 404 }
      ))
    }

    // Update last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    // Return content
    let rawData: any = {}
    if (assignment.data) {
      rawData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
    }
    
    // Resolve dynamic data (Relations and Components)
    const resolvedData = await resolveContentData(
      apiToken.tenantId,
      rawData,
      singleType.fields
    )

    const responsePayload = {
      data: {
        ...resolvedData,
        publishedAt: assignment.publishedAt,
        updatedAt: assignment.updatedAt,
      },
      meta: {
        singleType: {
          name: singleType.name,
          slug: singleType.slug,
        },
      },
    }

    await setCache(cacheKey, responsePayload, 300)

    return logResponse(NextResponse.json(responsePayload, {
      headers: {
        "X-RateLimit-Limit": String(rateLimitResult.limit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-Cache": "MISS",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      }
    }))
  } catch (error) {
    console.error("Error fetching single type:", error)
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: 500,
      duration,
    }).catch(() => {})

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT - Update single type content (requires write permission)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; singleType: string }> }
) {
  try {
    const startTime = Date.now()
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params
    let resolvedTenantId: string | null = tenantSlug

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

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return logResponse(NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      ))
    }

    const token = authHeader.replace("Bearer ", "")

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return logResponse(NextResponse.json({ error: "Invalid API token" }, { status: 401 }))
    }

    // Update resolved tenant ID once token is verified
    resolvedTenantId = apiToken.tenantId

    // Check if token has write access
    if (apiToken.type === "read-only") {
      return logResponse(NextResponse.json({ error: "Token does not have write permission" }, { status: 403 }))
    }

    // Verify tenant matches (check both ID and Slug)
    const isMatchingTenant = apiToken.tenantId === tenantSlug || apiToken.tenant.slug === tenantSlug
    
    if (!isMatchingTenant) {
      return logResponse(NextResponse.json({ error: "Token does not match tenant" }, { status: 403 }))
    }

    // Get single type (prefer tenant-specific over global)
    const singleType = await db.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        OR: [
          { tenantId: apiToken.tenantId },
          { tenantId: null }
        ]
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
    })

    if (!singleType) {
      return logResponse(NextResponse.json({ error: "Single type not found" }, { status: 404 }))
    }

    // Check assignment
    const assignment = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: apiToken.tenantId,
          singleTypeId: singleType.id,
          locale: "en", // Default to en for PUT, or we could pass it in body
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return logResponse(NextResponse.json(
        { error: "Single type not available for this tenant" },
        { status: 404 }
      ))
    }

    // Get request body
    const body = await request.json()
    const { data, publish } = body

    // Update assignment
    const updated = await db.tenantSingleTypeAssignment.update({
      where: { id: assignment.id },
      data: {
        data: JSON.stringify(data),
        publishedAt: publish ? new Date() : assignment.publishedAt,
        updatedAt: new Date(),
      },
    })

    // Update token last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    return logResponse(NextResponse.json({
      data: {
        ...data,
        publishedAt: updated.publishedAt,
        updatedAt: updated.updatedAt,
      },
    }))
  } catch (error) {
    console.error("Error updating single type:", error)
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: 500,
      duration,
    }).catch(() => {})

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
