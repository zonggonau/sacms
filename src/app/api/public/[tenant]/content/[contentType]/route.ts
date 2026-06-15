import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getCache, setCache } from "@/lib/cache"
import { logApiRequest } from "@/lib/monitoring"
import { createHash } from "crypto"
import {
  parseFilters,
  buildFilterSQL,
  parseFieldSelection,
  parsePopulate,
  parseSort,
  applyFieldSelection,
} from "@/lib/filters"

/**
 * Public API - Get entries with advanced filtering, field selection, and locale support.
 *
 * Query params:
 *   ?filters[field][$op]=value   — Strapi-style filtering
 *   ?fields=title,slug           — Field selection
 *   ?populate=author,tags        — Relation expansion
 *   ?locale=id                   — Locale filter
 *   ?sort=createdAt:desc         — Sorting
 *   ?pagination[page]=1&pagination[pageSize]=25
 *   ?search=keyword              — Full-text search (basic)
 *   ?status=PUBLISHED            — Status filter (default: PUBLISHED only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentType: string }> }
) {
  const startTime = Date.now()
  let resolvedTenantId: string | null = null
  try {
    const { tenant: tenantSlug, contentType: contentTypeSlug } = await params
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

    // CHECK CACHE
    const cacheKey = `public_api:${tenantSlug}:${contentTypeSlug}:${fullUrl}`
    const cachedResponse = await getCache(cacheKey)
    if (cachedResponse) {
      return logResponse(NextResponse.json(cachedResponse, {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
          "X-Cache": "HIT",
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }))
    }

    // Hash the token for database lookup (SHA-256)
    const hashedToken = createHash("sha256").update(token).digest("hex")

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
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

    // Get the correct DB client (Shared or Dedicated)
    const { getTenantDb } = await import("@/lib/database")
    const tenantDb = await getTenantDb(apiToken.tenantId)

    // Get content type with fields (must belong to this tenant or be global and assigned to this tenant)
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: apiToken.tenantId },
          { tenantId: null, tenants: { some: { tenantId: apiToken.tenantId, enabled: true } } }
        ]
      },
      include: {
        fields: { orderBy: { order: "asc" } },
        tenants: true,
      },
    })

    if (!contentType) {
      return logResponse(NextResponse.json({ error: "Content type not found" }, { status: 404 }))
    }

    // A content type is available if:
    // 1. It is global (has no tenant assignments)
    // 2. It is explicitly assigned to this tenant
    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === apiToken.tenantId && t.enabled)

    if (!isGlobal && !isAssigned) {
      return logResponse(NextResponse.json(
        { error: "Content type not available for this tenant" },
        { status: 403 }
      ))
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("pagination[page]") || searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pagination[pageSize]") || searchParams.get("pageSize") || "25")))

    // Locale + fallback logic
    const requestedLocale = searchParams.get("locale")
    
    // Resolve the tenant's default locale (used for fallback)
    const tenantDefaultLocale = await tenantDb.tenantLocale.findFirst({
      where: { tenantId: apiToken.tenantId, isDefault: true },
      select: { locale: true },
    })
    const defaultLocale = tenantDefaultLocale?.locale ?? "en"
    const locale = requestedLocale ?? defaultLocale

    // Status (default: only PUBLISHED for public API)
    const statusParam = searchParams.get("status")
    const status = statusParam || "PUBLISHED"

    // Sort
    const { field: sortField, order: sortOrder } = parseSort(searchParams)

    // Field selection
    const allowedFieldNames = new Set(contentType.fields.map((f) => f.slug))
    const selectedFields = parseFieldSelection(searchParams, allowedFieldNames)

    // Search
    const search = searchParams.get("search")

    // Build base WHERE conditions using Prisma
    const baseWhere: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: apiToken.tenantId,
      status,
    }
    if (locale) baseWhere.locale = locale

    // Parse advanced filters
    const { conditions, orGroups } = parseFilters(searchParams, allowedFieldNames)

    let entries: Array<Record<string, unknown>>
    let total: number

    // Check if sortField is a dynamic field inside JSON data
    const validSystemColumns = new Set(["createdAt", "updatedAt", "publishedAt", "id", "status", "locale"])
    const isDynamicSort = allowedFieldNames.has(sortField) && !validSystemColumns.has(sortField)

    if (conditions.length > 0 || orGroups.length > 0 || search || isDynamicSort) {
      // Use raw query for advanced filtering or dynamic sorting on JSON data field
      const whereParts: string[] = [
        `"contentTypeId" = $1`,
        `"tenantId" = $2`,
        `"status"::text = $3`,
      ]
      const queryParams: unknown[] = [contentType.id, apiToken.tenantId, status]
      let paramIdx = 4

      if (locale) {
        whereParts.push(`"locale" = $${paramIdx}`)
        queryParams.push(locale)
        paramIdx++
      }

      // Apply advanced filters
      const filterResult = buildFilterSQL(conditions, orGroups, paramIdx)
      whereParts.push(...filterResult.fragments)
      queryParams.push(...filterResult.params)
      paramIdx = filterResult.nextParam

      // Full-text search using PostgreSQL tsvector (High Performance)
      if (search) {
        // Sanitize search input — strip characters that could disrupt tsquery
        const safeSearch = search.replace(/[&|!():*<>'"\\]/g, " ").trim().slice(0, 200)
        if (safeSearch) {
          // Priority 1: Search using optimized tsvector with GIN index (@@ operator)
          // Priority 2: Fallback to basic ILIKE search for non-indexed fields
          whereParts.push(`("searchVector" @@ plainto_tsquery('english', $${paramIdx}) OR "data"::text ILIKE $${paramIdx + 1})`)
          queryParams.push(safeSearch, `%${safeSearch}%`)
          paramIdx += 2
        }
      }

      const whereClause = whereParts.join(" AND ")

      // Dynamic sorting for raw SQL
      let sanitizedSortField = validSystemColumns.has(sortField) ? `"${sortField}"` : `"createdAt"`
      if (isDynamicSort) {
        if (["price", "order", "step"].includes(sortField)) {
          sanitizedSortField = `NULLIF("data"->>'${sortField}', '')::numeric`
        } else {
          sanitizedSortField = `"data"->>'${sortField}'`
        }
      }

      const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC"

      // Count query
      const countResult = await tenantDb.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "content_entries" WHERE ${whereClause}`,
        ...queryParams
      )
      total = Number(countResult[0].count)

      // Data query with sorting and pagination
      entries = await tenantDb.$queryRawUnsafe(
        `SELECT 
          "id", "documentId", "contentTypeId", "tenantId", "locale", 
          "data", "status", "reviewComment", "publishedAt", 
          "scheduledAt", "archivedAt", "createdBy", "updatedBy", 
          "createdAt", "updatedAt"
         FROM "content_entries" 
         WHERE ${whereClause} 
         ORDER BY ${sanitizedSortField} ${safeSortOrder} 
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...queryParams,
        pageSize,
        (page - 1) * pageSize
      )

    } else {
      // Simple query without advanced filters
      const [rawEntries, count] = await Promise.all([
        tenantDb.contentEntry.findMany({
          where: baseWhere,
          orderBy: { [sortField]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tenantDb.contentEntry.count({ where: baseWhere }),
      ])
      entries = rawEntries
      total = count
    }

    // --- Optimized Relation Population (Fix N+1) ---
    const populateParam = parsePopulate(searchParams)
    const relationFields = contentType.fields.filter(f => f.type === "relation")
    
    // Determine which fields to populate (defaults to NONE if not specified, follows Strapi)
    let fieldsToPopulate: string[] = []
    if (populateParam === "*") {
      fieldsToPopulate = relationFields.map(f => f.slug)
    } else if (Array.isArray(populateParam)) {
      fieldsToPopulate = populateParam.filter(p => relationFields.some(rf => rf.slug === p))
    }

    // 1. Collect all unique relation IDs from all entries
    const allRelatedIds = new Set<string>()
    if (fieldsToPopulate.length > 0) {
      entries.forEach((entry: any) => {
        let parsedData: Record<string, unknown> = {}
        try {
          parsedData = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data
        } catch { return }

        for (const fieldSlug of fieldsToPopulate) {
          const val = parsedData[fieldSlug]
          if (typeof val === 'string' && val.length > 10) {
            allRelatedIds.add(val)
          } else if (Array.isArray(val)) {
            val.forEach(id => {
              if (typeof id === 'string') allRelatedIds.add(id)
            })
          }
        }
      })
    }

    // 2. Batch fetch all related entries in ONE query
    const relatedEntriesMap = new Map<string, any>()
    if (allRelatedIds.size > 0) {
      const relatedEntries = await tenantDb.contentEntry.findMany({
        where: { id: { in: Array.from(allRelatedIds) } },
        select: { id: true, data: true, locale: true, status: true }
      })
      
      relatedEntries.forEach(re => {
        let rd: any = {}
        try {
          rd = typeof re.data === 'string' ? JSON.parse(re.data as string) : re.data
        } catch { rd = {} }
        
        relatedEntriesMap.set(re.id, {
          id: re.id,
          ...rd,
          locale: re.locale,
          status: re.status
        })
      })
    }

    // 3. Map relations back to entries + availableLocales (Synchronously)
    // Collect documentIds to batch-fetch available locales
    const documentIds = entries
      .map((e: any) => e.documentId as string | null)
      .filter((id): id is string => !!id)

    // Batch fetch all locale variants for the documentIds in this result set
    const localeVariants = documentIds.length > 0
      ? await tenantDb.contentEntry.findMany({
          where: {
            documentId: { in: documentIds },
            contentTypeId: contentType.id,
            tenantId: apiToken.tenantId,
          },
          select: { documentId: true, locale: true, status: true },
        })
      : []

    // Build a map: documentId → available locales
    const localesByDoc = new Map<string, string[]>()
    for (const v of localeVariants) {
      if (!v.documentId) continue
      if (!localesByDoc.has(v.documentId)) localesByDoc.set(v.documentId, [])
      localesByDoc.get(v.documentId)!.push(v.locale)
    }

    // Locale fallback: if locale was requested and entry has no data in that
    // locale, attempt to fall back to the tenant's default locale
    let finalEntries = entries
    if (requestedLocale && requestedLocale !== defaultLocale) {
      const entryIds = new Set(entries.map((e: any) => e.id as string))
      // Find document IDs for entries that may have a default-locale equivalent
      const docIdsNeedingFallback = entries
        .filter((e: any) => {
          const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data
          return !data || Object.keys(data).length === 0
        })
        .map((e: any) => e.documentId as string | null)
        .filter((id): id is string => !!id)

      if (docIdsNeedingFallback.length > 0) {
        const fallbacks = await tenantDb.contentEntry.findMany({
          where: {
            documentId: { in: docIdsNeedingFallback },
            locale: defaultLocale,
            contentTypeId: contentType.id,
            tenantId: apiToken.tenantId,
          },
        })
        const fallbackMap = new Map(fallbacks.map((f) => [f.documentId, f]))
        finalEntries = entries.map((e: any) =>
          !entryIds.has(e.id) && e.documentId && fallbackMap.has(e.documentId)
            ? fallbackMap.get(e.documentId)!
            : e
        )
      }
    } else {
      finalEntries = entries
    }

    const parsedEntries = finalEntries.map((entry: any) => {
      let parsedData: Record<string, unknown>
      try {
        parsedData = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data
      } catch {
        parsedData = {}
      }

      const populatedData = { ...parsedData }
      for (const fieldSlug of fieldsToPopulate) {
        const val = parsedData[fieldSlug]
        if (typeof val === 'string') {
          populatedData[fieldSlug] = relatedEntriesMap.get(val) || val
        } else if (Array.isArray(val)) {
          populatedData[fieldSlug] = val.map(id => 
            typeof id === 'string' ? (relatedEntriesMap.get(id) || id) : id
          )
        }
      }

      const shaped = applyFieldSelection(populatedData, selectedFields)

      return {
        id: entry.id,
        ...shaped,
        locale: entry.locale,
        availableLocales: entry.documentId ? (localesByDoc.get(entry.documentId) ?? [entry.locale]) : [entry.locale],
        status: entry.status,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
    })
    // ----------------------------------------------

    // Update last used (fire and forget)
    db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {})

    const headers = new Headers({
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
      "X-Cache": "MISS",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    })

    const responsePayload = {
      data: parsedEntries,
      meta: {
        contentType: {
          name: contentType.name,
          slug: contentType.slug,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }

    // SET CACHE (ttl 5 mins)
    await setCache(cacheKey, responsePayload, 300)

    return logResponse(NextResponse.json(responsePayload, { headers }))
  } catch (error) {
    console.error("Error fetching content:", error)
    // Handle error logging
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
