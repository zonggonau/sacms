import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getCache, setCache } from "@/lib/cache"
import { createHash } from "crypto"
import { SYSTEM_TENANT_SLUG } from "@/lib/constants"
import {
  parseFilters,
  buildFilterSQL,
  parseFieldSelection,
  parsePopulate,
  parseSort,
  applyFieldSelection,
} from "@/lib/filters"

/**
 * Public API for Global Content Types (Managed by Super Admin)
 * Endpoint: /api/public/content/[contentType]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentType: string }> }
) {
  try {
    const { contentType: contentTypeSlug } = await params
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
    const rateLimitResult = await rateLimit(`public_global:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      )
    }

    // CHECK CACHE
    const cacheKey = `public_api_global:${contentTypeSlug}:${fullUrl}`
    const cachedResponse = await getCache(cacheKey)
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, {
        headers: { "X-Cache": "HIT" }
      })
    }

    // Hash the token for database lookup (SHA-256)
    const hashedToken = createHash("sha256").update(token).digest("hex")

    // 1. Find the API token in ApiToken table
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
      include: { tenant: true },
    })

    // 2. If not found, check if it matches the global systemApiKey in settings
    if (!apiToken) {
      const systemApiKeySetting = await db.setting.findUnique({
        where: { key: "systemApiKey" }
      })

      if (!systemApiKeySetting || systemApiKeySetting.value !== token) {
        return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
      }
    }

    // Check if token is expired (only for ApiToken table entries)
    if (apiToken && apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "API token expired" }, { status: 401 })
    }

    // Get content type
    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        tenantId: null 
      },
      include: { schemaFields: { orderBy: { order: "asc" } },
        tenants: {
          include: {
            tenant: {
              select: { slug: true }
            }
          }
        }
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Verify it is a global content type (or explicitly allowed for global access)
    // We'll allow access if it's explicitly published and exists in the global/system context
    // or if it's explicitly assigned to the system tenant
    const isGlobal = contentType.tenantId === null || contentType.tenants.some(t => t.tenant?.slug === SYSTEM_TENANT_SLUG || t.tenant?.slug === "system")
    
    // For now, let's just ensure it exists and is published
    if (!contentType.isPublished) {
      return NextResponse.json(
        { error: "Content type is not published" },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")))
    const status = (searchParams.get("status") || "PUBLISHED").toUpperCase()
    const { field: sortField, order: sortOrder } = parseSort(searchParams)
    const allowedFieldNames = new Set(contentType.schemaFields.map((f) => f.slug))
    const selectedFields = parseFieldSelection(searchParams, allowedFieldNames)
    const populate = parsePopulate(searchParams)

    // Advanced Filtering via SQL
    const { conditions, orGroups } = parseFilters(searchParams, allowedFieldNames)
    const { fragments, params: sqlParams } = buildFilterSQL(conditions, orGroups, 3) // Start from $3 because $1=$contentTypeId, $2=$status

    let whereClause = `WHERE "contentTypeId" = $1 AND "status"::text = $2 AND "tenantId" IS NULL`
    if (fragments.length > 0) {
      whereClause += ` AND ${fragments.join(" AND ")}`
    }

    // Execute Raw Query for IDs and Pagination
    const queryParams = [contentType.id, status, ...sqlParams]
    
    // Sort logic for raw SQL
    let sanitizedSortField = `"${sortField}"`
    if (allowedFieldNames.has(sortField)) {
      if (["price", "order", "step"].includes(sortField)) {
        sanitizedSortField = `NULLIF("data"->>'${sortField}', '')::numeric`
      } else {
        sanitizedSortField = `"data"->>'${sortField}'`
      }
    }
    
    const entriesRaw = await db.$queryRawUnsafe<any[]>(
      `SELECT id FROM "content_entries" 
       ${whereClause} 
       ORDER BY ${sanitizedSortField} ${sortOrder.toUpperCase()} 
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      ...queryParams,
      pageSize,
      (page - 1) * pageSize
    )

    const totalRaw = await db.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as count FROM "content_entries" ${whereClause}`,
      ...queryParams
    )
    const total = totalRaw[0]?.count || 0

    // Fetch full data for selected IDs to include relations if needed
    const entryIds = entriesRaw.map(e => e.id)
    
    // Fallback if no entries
    if (entryIds.length === 0) {
      return NextResponse.json({
        data: [],
        meta: { pagination: { page, pageSize, total: 0, totalPages: 0 } }
      })
    }

    const unsortedEntries = await db.contentEntry.findMany({
      where: { id: { in: entryIds } },
    })
    
    // Preserve the original raw query sort order
    const entries = entryIds
      .map(id => unsortedEntries.find(e => e.id === id))
      .filter(Boolean)

    // Data Shaping & Populate Logic
    const parsedEntries = await Promise.all(entries.map(async (entry: any) => {
      let parsedData: any
      try {
        parsedData = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data
      } catch {
        parsedData = {}
      }

      // Populate logic (simple implementation)
      if (populate) {
        const fieldsToPopulate = contentType.schemaFields.filter(f => 
          f.type === "relation" && (populate === "*" || populate.includes(f.slug))
        )

        for (const field of fieldsToPopulate) {
          const relationValue = parsedData[field.slug]
          if (relationValue) {
            // If it's an ID or array of IDs, fetch from target content type
            const targetIds = Array.isArray(relationValue) ? relationValue : [relationValue]
            const relatedEntries = await db.contentEntry.findMany({
              where: { id: { in: targetIds } },
              select: { id: true, data: true, createdAt: true }
            })
            
            parsedData[field.slug] = Array.isArray(relationValue) 
              ? relatedEntries.map(re => ({ id: re.id, ...(typeof re.data === 'string' ? JSON.parse(re.data) : re.data) }))
              : relatedEntries[0] ? { id: relatedEntries[0].id, ...(typeof relatedEntries[0].data === 'string' ? JSON.parse(relatedEntries[0].data) : relatedEntries[0].data) } : null
          }
        }
      }

      const shaped = applyFieldSelection(parsedData, selectedFields)

      return {
        id: entry.id,
        ...shaped,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
    }))

    const responsePayload = {
      data: parsedEntries,
      meta: {
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      },
    }

    await setCache(cacheKey, responsePayload, 300)

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error("Global Public API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
