import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getCache, setCache } from "@/lib/cache"
import { logApiRequest } from "@/lib/monitoring"
import { createHash } from "crypto"
import {
  parseFieldSelection,
  parsePopulate,
  applyFieldSelection,
} from "@/lib/filters"

/**
 * Public API - Get single entry by ID or documentId with relation population and locale fallback.
 *
 * Route: GET /api/public/[tenant]/content/[contentType]/[id]
 *
 * Query params:
 *   ?fields=title,slug       — Field selection
 *   ?populate=author,tags    — Relation expansion
 *   ?locale=id               — Locale request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentType: string; id: string }> }
) {
  const startTime = Date.now()
  let resolvedTenantId: string | null = null

  try {
    const { tenant: tenantSlug, contentType: contentTypeSlug, id: entryIdOrDocId } = await params
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

    const fullUrl = request.url

    // 1. Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return logResponse(NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      ))
    }

    const token = authHeader.replace("Bearer ", "")

    let tenantId: string | null = null
    let tenantSlugFromDb: string | null = null
    let expiresAt: Date | null = null
    let apiTokenType = "read-only"
    let apiTokenId = ""
    let isApiKey = false

    const apiKey = await db.apiKey.findUnique({
      where: { key: token },
      include: { tenant: true },
    })

    if (apiKey) {
      tenantId = apiKey.tenantId
      tenantSlugFromDb = apiKey.tenant.slug
      expiresAt = apiKey.expiresAt
      apiTokenType = "full-access"
      apiTokenId = apiKey.id
      isApiKey = true
    } else {
      const hashedToken = createHash("sha256").update(token).digest("hex")
      const apiToken = await db.apiToken.findUnique({
        where: { token: hashedToken },
        include: { tenant: true },
      })

      if (!apiToken) {
        return logResponse(NextResponse.json({ error: "Invalid API token" }, { status: 401 }))
      }

      tenantId = apiToken.tenantId
      tenantSlugFromDb = apiToken.tenant.slug
      expiresAt = apiToken.expiresAt
      apiTokenType = apiToken.type
      apiTokenId = apiToken.id
    }

    resolvedTenantId = tenantId

    // 2. Verify tenant match
    const isMatchingTenant = tenantId === tenantSlug || tenantSlugFromDb === tenantSlug
    if (!isMatchingTenant) {
      return logResponse(NextResponse.json({ error: "Token does not match tenant" }, { status: 403 }))
    }

    // 3. Expiry check
    if (expiresAt && expiresAt < new Date()) {
      return logResponse(NextResponse.json({ error: "API token expired" }, { status: 401 }))
    }

    // 4. Rate-limit check
    const hashedTokenForRateLimit = createHash("sha256").update(token).digest("hex")
    const rateLimitResult = await rateLimit(`public:${hashedTokenForRateLimit}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return logResponse(NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        }
      ))
    }

    // 5. Get DB client
    const { getTenantDb } = await import("@/lib/database")
    if (!tenantId) {
      return logResponse(NextResponse.json({ error: "Invalid tenant ID" }, { status: 401 }))
    }
    const tenantDb = await getTenantDb(tenantId)

    // 6. Resolve content type
    const contentType = await tenantDb.contentType.findFirst({
      where: {
        slug: contentTypeSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      },
      include: {
        schemaFields: { orderBy: { order: "asc" } },
        tenants: true,
      },
    })

    if (!contentType) {
      return logResponse(NextResponse.json({ error: "Content type not found" }, { status: 404 }))
    }

    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === tenantId && t.enabled)

    if (!isGlobal && !isAssigned) {
      return logResponse(NextResponse.json(
        { error: "Content type not available for this tenant" },
        { status: 403 }
      ))
    }

    // 7. Parse parameters
    const { searchParams } = new URL(request.url)
    const requestedLocale = searchParams.get("locale")

    const tenantDefaultLocale = await tenantDb.tenantLocale.findFirst({
      where: { tenantId: tenantId, isDefault: true },
      select: { locale: true },
    })
    const defaultLocale = tenantDefaultLocale?.locale ?? "en"
    const locale = requestedLocale ?? defaultLocale

    // 8. Cache check
    const cacheKey = `public_api_single:${tenantSlug}:${contentTypeSlug}:${entryIdOrDocId}:${apiTokenId}:${fullUrl}`
    const cachedResponse = await getCache(cacheKey)
    if (cachedResponse) {
      return logResponse(NextResponse.json(cachedResponse, {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
          "X-Cache": "HIT",
          "Cache-Control": "private, max-age=0, s-maxage=60, stale-while-revalidate=300",
        },
      }))
    }

    // 9. Query entry by id or documentId
    let entry = await tenantDb.contentEntry.findFirst({
      where: {
        contentTypeId: contentType.id,
        tenantId: tenantId,
        locale: locale,
        OR: [
          { id: entryIdOrDocId },
          { documentId: entryIdOrDocId },
        ],
        ...(apiTokenType === "full-access" ? {} : { status: "PUBLISHED" as const }),
      },
    })

    // Locale fallback if requested locale is missing data for documentId
    if (!entry && requestedLocale && requestedLocale !== defaultLocale) {
      entry = await tenantDb.contentEntry.findFirst({
        where: {
          contentTypeId: contentType.id,
          tenantId: tenantId,
          locale: defaultLocale,
          documentId: entryIdOrDocId,
          ...(apiTokenType === "full-access" ? {} : { status: "PUBLISHED" as const }),
        },
      })
    }

    if (!entry) {
      return logResponse(NextResponse.json({ error: "Entry not found" }, { status: 404 }))
    }

    // 10. Available locales for documentId
    const documentId = entry.documentId
    const localeVariants = documentId
      ? await tenantDb.contentEntry.findMany({
          where: {
            documentId: documentId,
            contentTypeId: contentType.id,
            tenantId: tenantId,
            ...(apiTokenType === "full-access" ? {} : { status: "PUBLISHED" as const }),
          },
          select: { locale: true },
        })
      : []
    const availableLocales = localeVariants.map(v => v.locale)

    // 11. Relation population & Field selection
    const allowedFieldNames = new Set(contentType.schemaFields.map((f) => f.slug))
    const selectedFields = parseFieldSelection(searchParams, allowedFieldNames)
    const populateParam = parsePopulate(searchParams)
    const relationFields = contentType.schemaFields.filter(f => f.type === "relation")

    let fieldsToPopulate: string[] = []
    if (populateParam === "*") {
      fieldsToPopulate = relationFields.map(f => f.slug)
    } else if (Array.isArray(populateParam)) {
      fieldsToPopulate = populateParam.filter(p => relationFields.some(rf => rf.slug === p))
    }

    let parsedData: Record<string, unknown> = {}
    try {
      parsedData = typeof entry.data === "string" ? JSON.parse(entry.data) : (entry.data as Record<string, unknown> || {})
    } catch {
      parsedData = {}
    }

    const populatedData = { ...parsedData }

    if (fieldsToPopulate.length > 0) {
      const relatedIds = new Set<string>()
      for (const fieldSlug of fieldsToPopulate) {
        const val = parsedData[fieldSlug]
        if (typeof val === "string" && val.length > 10) {
          relatedIds.add(val)
        } else if (Array.isArray(val)) {
          val.forEach(id => { if (typeof id === "string") relatedIds.add(id) })
        }
      }

      if (relatedIds.size > 0) {
        const relatedEntries = await tenantDb.contentEntry.findMany({
          where: {
            id: { in: Array.from(relatedIds) },
            tenantId: tenantId,
            ...(apiTokenType === "full-access" ? {} : { status: "PUBLISHED" as const }),
          },
          select: { id: true, data: true, locale: true, status: true },
        })

        const relatedEntriesMap = new Map<string, any>()
        relatedEntries.forEach(re => {
          let rd: any = {}
          try {
            rd = typeof re.data === "string" ? JSON.parse(re.data) : re.data
          } catch { rd = {} }

          relatedEntriesMap.set(re.id, {
            id: re.id,
            ...rd,
            locale: re.locale,
            status: re.status,
          })
        })

        for (const fieldSlug of fieldsToPopulate) {
          const val = parsedData[fieldSlug]
          if (typeof val === "string") {
            populatedData[fieldSlug] = relatedEntriesMap.get(val) || val
          } else if (Array.isArray(val)) {
            populatedData[fieldSlug] = val.map(id =>
              typeof id === "string" ? (relatedEntriesMap.get(id) || id) : id
            )
          }
        }
      }
    }

    const shapedData = applyFieldSelection(populatedData, selectedFields)

    // 12. Update token last used
    if (isApiKey) {
      db.apiKey.update({ where: { id: apiTokenId }, data: { lastUsed: new Date() } }).catch(() => {})
    } else {
      db.apiToken.update({ where: { id: apiTokenId }, data: { lastUsedAt: new Date() } }).catch(() => {})
    }

    const responsePayload = {
      data: {
        id: entry.id,
        documentId: entry.documentId,
        ...shapedData,
        locale: entry.locale,
        availableLocales: availableLocales.length > 0 ? availableLocales : [entry.locale],
        status: entry.status,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
      meta: {
        contentType: {
          name: contentType.name,
          slug: contentType.slug,
        },
      },
    }

    await setCache(cacheKey, responsePayload, 300)

    const headers = new Headers({
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
      "X-Cache": "MISS",
      "Cache-Control": "private, max-age=0, s-maxage=60, stale-while-revalidate=300",
    })

    return logResponse(NextResponse.json(responsePayload, { headers }))
  } catch (error) {
    console.error("Error fetching single content entry:", error)
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: 500,
      duration,
    }).catch(() => {})

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
