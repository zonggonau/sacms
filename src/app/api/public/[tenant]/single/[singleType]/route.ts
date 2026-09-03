import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveContentData } from "@/lib/content-resolver"
import { logApiRequest } from "@/lib/monitoring"
import { getCache, setCache, invalidatePattern } from "@/lib/cache"
import { createHash } from "crypto"

interface ResolvedAuth {
  tenantId: string
  tenantSlug: string
  apiTokenType: string
  apiTokenId: string
  isApiKey: boolean
  hasWriteAccess: boolean
}

async function resolvePublicToken(request: NextRequest, tenantSlug: string): Promise<{ auth?: ResolvedAuth; error?: string; status?: number }> {
  const authHeader = request.headers.get("authorization")
  const xApiKey = request.headers.get("x-api-key") || request.headers.get("X-API-Key")

  let rawToken = ""
  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.replace("Bearer ", "").trim()
  } else if (xApiKey) {
    rawToken = xApiKey.trim()
  }

  // The `?token=` query param is deliberately NOT accepted — it leaks into
  // access logs, Referer headers, and CDN caches.
  if (!rawToken) {
    return { error: "Missing or invalid authorization header (Expected: Authorization: Bearer <TOKEN>)", status: 401 }
  }

  const cleanToken = rawToken
  const hashedToken = createHash("sha256").update(cleanToken).digest("hex")

  // 1. Check in ApiKey (plain key)
  const apiKey = await db.apiKey.findUnique({
    where: { key: cleanToken },
    include: { tenant: true },
  })

  if (apiKey?.tenant) {
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { error: "API token expired", status: 401 }
    }
    const isMatching = apiKey.tenantId === tenantSlug || apiKey.tenant.slug === tenantSlug
    if (!isMatching) {
      return { error: "Token does not match workspace", status: 403 }
    }

    // Update lastUsed async
    db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } }).catch(() => {})

    return {
      auth: {
        tenantId: apiKey.tenantId,
        tenantSlug: apiKey.tenant.slug,
        apiTokenType: "full-access",
        apiTokenId: apiKey.id,
        isApiKey: true,
        hasWriteAccess: true,
      }
    }
  }

  // 2. Check in ApiToken (hashed only — plaintext tokens are never stored)
  const apiToken = await db.apiToken.findFirst({
    where: { token: hashedToken },
    include: { tenant: true },
  })

  if (apiToken?.tenant) {
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return { error: "API token expired", status: 401 }
    }
    const isMatching = apiToken.tenantId === tenantSlug || apiToken.tenant.slug === tenantSlug
    if (!isMatching) {
      return { error: "Token does not match workspace", status: 403 }
    }

    // Permissions check
    let perms: string[] = []
    if (Array.isArray(apiToken.permissions)) {
      perms = apiToken.permissions as string[]
    } else if (typeof apiToken.permissions === "string") {
      try { perms = JSON.parse(apiToken.permissions) } catch { perms = [] }
    }

    const isFullAccess = apiToken.type === "full-access" || perms.includes("write") || perms.includes("all") || perms.includes("*")

    // Update lastUsedAt async
    db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

    return {
      auth: {
        tenantId: apiToken.tenantId,
        tenantSlug: apiToken.tenant.slug,
        apiTokenType: apiToken.type,
        apiTokenId: apiToken.id,
        isApiKey: false,
        hasWriteAccess: isFullAccess,
      }
    }
  }

  return { error: "Invalid API token", status: 401 }
}

// Public API - Get single type content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; singleType: string }> }
) {
  const startTime = Date.now()
  let resolvedTenantId: string | null = null
  try {
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params
    resolvedTenantId = tenantSlug

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

    const { auth, error: authError, status: authStatus } = await resolvePublicToken(request, tenantSlug)
    if (!auth || authError) {
      return logResponse(NextResponse.json({ error: authError || "Unauthorized" }, { status: authStatus || 401 }))
    }

    resolvedTenantId = auth.tenantId

    // Rate limit
    const hashedKey = createHash("sha256").update(auth.apiTokenId).digest("hex")
    const rateLimitResult = await rateLimit(`public:${hashedKey}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return logResponse(NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      ))
    }

    const { searchParams } = new URL(request.url)
    const defaultLocale = (await db.tenantLocale.findFirst({
      where: { tenantId: auth.tenantId, isDefault: true },
      select: { locale: true },
    }))?.locale || "id"
    const locale = searchParams.get("locale") || defaultLocale

    // CACHE CHECK
    const cacheKey = `single:${auth.tenantId}:${singleTypeSlug}:${locale}:${auth.apiTokenType}`
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

    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(auth.tenantId)

    // Get single type definition (prefer workspace-specific over global)
    const singleType = await tenantDb.singleType.findFirst({
      where: {
        slug: singleTypeSlug,
        OR: [
          { tenantId: auth.tenantId },
          { tenantId: null }
        ],
      },
      include: {
        schemaFields: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
    })

    if (!singleType) {
      return logResponse(NextResponse.json({ error: `Single type '${singleTypeSlug}' not found` }, { status: 404 }))
    }

    // Check if single type is assigned to tenant
    const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: auth.tenantId,
          singleTypeId: singleType.id,
          locale,
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return logResponse(NextResponse.json(
        { error: `Single type '${singleTypeSlug}' not available or not published for this workspace` },
        { status: 404 }
      ))
    }

    if (auth.apiTokenType !== "full-access" && !assignment.publishedAt) {
      return logResponse(NextResponse.json(
        { error: `Single type '${singleTypeSlug}' is not published` },
        { status: 404 }
      ))
    }

    // Return content
    let rawData: any = {}
    if (assignment.data) {
      rawData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
    }
    
    // Resolve dynamic data (Relations and Components)
    const resolvedData = await resolveContentData(
      auth.tenantId,
      rawData,
      singleType.schemaFields
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
        locale,
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
  const startTime = Date.now()
  let resolvedTenantId: string | null = null
  try {
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params
    resolvedTenantId = tenantSlug

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

    const { auth, error: authError, status: authStatus } = await resolvePublicToken(request, tenantSlug)
    if (!auth || authError) {
      return logResponse(NextResponse.json({ error: authError || "Unauthorized" }, { status: authStatus || 401 }))
    }

    if (!auth.hasWriteAccess) {
      return logResponse(NextResponse.json({ error: "Token does not have write permission" }, { status: 403 }))
    }

    resolvedTenantId = auth.tenantId

    const { searchParams } = new URL(request.url)
    const defaultLocale = (await db.tenantLocale.findFirst({
      where: { tenantId: auth.tenantId, isDefault: true },
      select: { locale: true },
    }))?.locale || "id"
    const locale = searchParams.get("locale") || defaultLocale

    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(auth.tenantId)

    // Get single type (prefer workspace-specific over global)
    const singleType = await tenantDb.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        OR: [
          { tenantId: auth.tenantId },
          { tenantId: null }
        ]
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
    })

    if (!singleType) {
      return logResponse(NextResponse.json({ error: `Single type '${singleTypeSlug}' not found` }, { status: 404 }))
    }

    // Check assignment
    const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: auth.tenantId,
          singleTypeId: singleType.id,
          locale,
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return logResponse(NextResponse.json(
        { error: "Single type not available for this workspace" },
        { status: 404 }
      ))
    }

    // Get request body
    const body = await request.json()
    const { data, publish } = body

    // Update assignment
    const updated = await tenantDb.tenantSingleTypeAssignment.update({
      where: { id: assignment.id },
      data: {
        data: typeof data === 'object' ? data : JSON.parse(data || "{}"),
        publishedAt: publish ? new Date() : assignment.publishedAt,
        updatedAt: new Date(),
      },
    })

    await invalidatePattern(`single:${auth.tenantId}:${singleTypeSlug}:${locale}:*`)

    return logResponse(NextResponse.json({
      data: {
        ...data,
        publishedAt: updated.publishedAt,
        updatedAt: updated.updatedAt,
      },
      meta: {
        singleType: {
          name: singleType.name,
          slug: singleType.slug,
        },
        locale,
      }
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
