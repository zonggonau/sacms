import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getCache, setCache } from "@/lib/cache"
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
  try {
    const { tenant: tenantSlug, contentType: contentTypeSlug } = await params
    const fullUrl = request.url

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    // Rate limit by token
    const rateLimitResult = await rateLimit(`public:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return NextResponse.json(
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
      )
    }

    // CHECK CACHE
    const cacheKey = `public_api:${tenantSlug}:${contentTypeSlug}:${fullUrl}`
    const cachedResponse = await getCache(cacheKey)
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.resetAt / 1000)),
          "X-Cache": "HIT",
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      })
    }

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
    }

    // Verify tenant matches
    if (apiToken.tenant.slug !== tenantSlug) {
      return NextResponse.json({ error: "Token does not match tenant" }, { status: 403 })
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "API token expired" }, { status: 401 })
    }

    // Get content type with fields
    const contentType = await db.contentType.findUnique({
      where: { slug: contentTypeSlug },
      include: {
        fields: { orderBy: { order: "asc" } },
        tenants: true, // Include assignments to check if it's global or tenant-specific
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // A content type is available if:
    // 1. It is global (has no tenant assignments)
    // 2. It is explicitly assigned to this tenant
    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === apiToken.tenantId && t.enabled)

    if (!isGlobal && !isAssigned) {
      return NextResponse.json(
        { error: "Content type not available for this tenant" },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("pagination[page]") || searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pagination[pageSize]") || searchParams.get("pageSize") || "25")))

    // Locale
    const locale = searchParams.get("locale")

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

    if (conditions.length > 0 || orGroups.length > 0 || search) {
      // Use raw query for advanced filtering on JSON data field
      const whereParts: string[] = [
        `"contentTypeId" = $1`,
        `"tenantId" = $2`,
        `"status" = $3`,
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

      // Full-text search using pg_tsvector (with ILIKE fallback for safety)
      if (search) {
        // Sanitize search input — strip characters that could disrupt tsquery
        const safeSearch = search.replace(/[&|!():*<>'"\\]/g, " ").trim().slice(0, 200)
        if (safeSearch) {
          whereParts.push(`("searchVector" @@ plainto_tsquery('simple', $${paramIdx}) OR "data"::text ILIKE $${paramIdx + 1})`)
          queryParams.push(safeSearch, `%${safeSearch}%`)
          paramIdx += 2
        }
      }

      const whereClause = whereParts.join(" AND ")

      // Count query
      const countResult = await db.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "content_entries" WHERE ${whereClause}`,
        ...queryParams
      )
      total = Number(countResult[0].count)

      // Data query with sorting and pagination
      const validSortColumns = new Set(["createdAt", "updatedAt", "publishedAt"])
      const safeSortField = validSortColumns.has(sortField) ? `"${sortField}"` : `"createdAt"`
      const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC"

      entries = await db.$queryRawUnsafe(
        `SELECT * FROM "content_entries" WHERE ${whereClause} ORDER BY ${safeSortField} ${safeSortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...queryParams,
        pageSize,
        (page - 1) * pageSize
      )
    } else {
      // Simple query without advanced filters
      const [rawEntries, count] = await Promise.all([
        db.contentEntry.findMany({
          where: baseWhere,
          orderBy: { [sortField]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.contentEntry.count({ where: baseWhere }),
      ])
      entries = rawEntries
      total = count
    }

    // Parse & shape response data
    const parsedEntries = entries.map((entry: any) => {
      let parsedData: Record<string, unknown>
      try {
        parsedData = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data
      } catch {
        parsedData = {}
      }

      const shaped = applyFieldSelection(parsedData, selectedFields)

      return {
        id: entry.id,
        ...shaped,
        locale: entry.locale,
        status: entry.status,
        publishedAt: entry.publishedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
    })

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

    return NextResponse.json(responsePayload, { headers })
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
