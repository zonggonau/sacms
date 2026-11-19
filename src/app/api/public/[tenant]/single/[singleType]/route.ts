import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveContentData } from "@/lib/content-resolver"
import { rewritePublicMediaUrls } from "@/lib/public-media-url"
import { logApiRequest } from "@/lib/monitoring"
import { getCache, setCache } from "@/lib/cache"
import {
  getSingleTypeLocales,
  invalidateSingleTypePublication,
  readSingleTypeAssignment,
  singleTypeContentWrite,
} from "@/lib/single-type-publication"
import { createHash } from "crypto"
import { checkApiCallQuota } from "@/lib/plan-enforcement"

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

  if (!rawToken) {
    if (request.method === "GET") {
      const tenant = await db.tenant.findFirst({
        where: { OR: [{ id: tenantSlug }, { slug: tenantSlug }] },
        select: { id: true, slug: true },
      })
      if (!tenant) {
        return { error: "Tenant not found", status: 404 }
      }
      return {
        auth: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          apiTokenType: "public-read",
          apiTokenId: "public_anon",
          isApiKey: false,
          hasWriteAccess: false,
        }
      }
    }
    return { error: "Missing or invalid authorization header (Expected: Authorization: Bearer <TOKEN>)", status: 401 }
  }

  const cleanToken = rawToken
  const hashedToken = createHash("sha256").update(cleanToken).digest("hex")

  // 1. Check in ApiKey — key stores a SHA-256 hash, never the raw value.
  const apiKey = await db.apiKey.findUnique({
    where: { key: hashedToken },
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
        // apiToken.tenant is already confirmed non-null above (the `if
        // (apiToken?.tenant)` guard), so .tenant.id is the same value as
        // .tenantId without the nullable type ApiToken.tenantId now carries.
        tenantId: apiToken.tenant.id,
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

    const quota = await checkApiCallQuota(auth.tenantId)
    if (!quota.allowed) {
      return logResponse(NextResponse.json(
        { error: quota.message, code: "PLAN_LIMIT_REACHED" },
        { status: 429, headers: { "Retry-After": "3600" } },
      ))
    }

    const { searchParams } = new URL(request.url)
    const [{ locale: defaultLocale }] = await getSingleTypeLocales(auth.tenantId)
    const locale = searchParams.get("locale") || defaultLocale
    const readDraft = searchParams.get("draft") === "true"
    if (readDraft && !auth.hasWriteAccess) {
      return logResponse(NextResponse.json({ error: "Draft preview requires write access" }, {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      }))
    }

    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(auth.tenantId)

    // Get single type definition (prefer workspace-specific over global)
    const singleType = await tenantDb.singleType.findFirst({
      where: {
        slug: singleTypeSlug,
        draftTemplateId: null,
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

    if (!readDraft && !assignment.publishedAt) {
      return logResponse(NextResponse.json(
        { error: `Single type '${singleTypeSlug}' is not published` },
        { status: 404 }
      ))
    }

    const cacheKey = !readDraft && assignment.publishedAt
      ? `single:${auth.tenantId}:${singleTypeSlug}:${locale}:published:${assignment.publishedAt.getTime()}`
      : null
    const responseHeaders = {
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      "Cache-Control": readDraft ? "private, no-store" : "public, max-age=0, must-revalidate",
      Vary: "Authorization, X-API-Key",
    }
    const cached = cacheKey ? await getCache(cacheKey) : null
    if (cached) {
      return logResponse(NextResponse.json(cached, { headers: { ...responseHeaders, "X-Cache": "HIT" } }))
    }

    const snapshot = readSingleTypeAssignment(assignment, readDraft)
    const resolvedData = await resolveContentData(
      auth.tenantId,
      snapshot.data,
      singleType.schemaFields,
      { client: tenantDb, includeUnpublished: readDraft, includeSingleTypeDraft: readDraft, locale },
    )
    const responseData = readDraft ? resolvedData : rewritePublicMediaUrls(resolvedData)

    const responsePayload = {
      data: {
        ...responseData,
        publishedAt: assignment.publishedAt,
        updatedAt: snapshot.updatedAt,
      },
      meta: {
        singleType: {
          name: singleType.name,
          slug: singleType.slug,
        },
        locale,
      },
    }

    if (cacheKey) await setCache(cacheKey, responsePayload, 300)

    return logResponse(NextResponse.json(responsePayload, {
      headers: { ...responseHeaders, "X-Cache": readDraft ? "BYPASS" : "MISS" },
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

    const quota = await checkApiCallQuota(auth.tenantId)
    if (!quota.allowed) {
      return logResponse(NextResponse.json(
        { error: quota.message, code: "PLAN_LIMIT_REACHED" },
        { status: 429, headers: { "Retry-After": "3600" } },
      ))
    }

    const { searchParams } = new URL(request.url)
    const [{ locale: defaultLocale }] = await getSingleTypeLocales(auth.tenantId)
    const locale = searchParams.get("locale") || defaultLocale

    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(auth.tenantId)

    // Get single type (prefer workspace-specific over global)
    const singleType = await tenantDb.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        draftTemplateId: null,
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
    let content: Record<string, unknown>
    let publish: boolean
    try {
      const body = await request.json()
      const data = typeof body.data === "string" ? JSON.parse(body.data) : body.data
      if (!data || typeof data !== "object" || Array.isArray(data) || (body.publish !== undefined && typeof body.publish !== "boolean")) {
        throw new Error("Invalid Single Type payload")
      }
      content = data
      publish = body.publish === true
    } catch {
      return logResponse(NextResponse.json({ error: "Expected a data object and an optional publish boolean" }, { status: 400 }))
    }

    // Update assignment
    const updated = await tenantDb.tenantSingleTypeAssignment.update({
      where: { id: assignment.id },
      data: singleTypeContentWrite(content, publish),
    })

    if (publish) await invalidateSingleTypePublication(auth.tenantId, singleType.slug, locale)

    return logResponse(NextResponse.json({
      data: {
        ...content,
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
