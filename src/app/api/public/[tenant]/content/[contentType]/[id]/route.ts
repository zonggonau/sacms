import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { db, getTenantDb } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getCache, setCache, invalidatePattern } from "@/lib/cache"
import { logApiRequest } from "@/lib/monitoring"
import {
  parseFieldSelection,
  parsePopulate,
  applyFieldSelection,
} from "@/lib/filters"
import {
  resolvePublicApiActor,
  authorizeActor,
  type PublicApiActor,
} from "@/lib/public-api-actor"

/** Ownership check for member actors: `conditions.owner === true` on the granted
 * permission restricts the action to entries the member created. */
async function assertOwnershipIfRequired(
  actor: PublicApiActor,
  tenantId: string,
  contentTypeSlug: string,
  action: "update" | "delete",
  entry: { createdBy: string | null },
): Promise<boolean> {
  if (actor.kind !== "member") return true
  const perm = await db.memberRolePermission.findFirst({
    where: {
      memberRole: { tenantId, slug: actor.roleSlug },
      OR: [{ contentTypeSlug }, { contentTypeSlug: "*" }],
      action,
      granted: true,
    },
    orderBy: { contentTypeSlug: "desc" }, // specific ("posts") before wildcard ("*")
  })
  const conditions = (perm?.conditions ?? null) as { owner?: boolean } | null
  if (!conditions?.owner) return true
  return entry.createdBy === actor.memberId
}

async function writeHandler(
  request: NextRequest,
  params: Promise<{ tenant: string; contentType: string; id: string }>,
  action: "update" | "delete",
) {
  const startTime = Date.now()
  const { tenant: tenantParam, contentType: contentTypeSlug, id: entryIdOrDocId } = await params

  const log = (res: NextResponse, tenantId: string | null) => {
    logApiRequest({
      tenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: res.status,
      duration: Date.now() - startTime,
    }).catch(() => {})
    return res
  }

  try {
    const resolution = await resolvePublicApiActor(request, tenantParam)
    if (!resolution.ok) {
      return log(NextResponse.json({ error: resolution.error }, { status: resolution.status }), null)
    }
    const actor = resolution.actor

    const denial = await authorizeActor(actor, contentTypeSlug, action)
    if (denial) {
      return log(NextResponse.json({ error: denial.error }, { status: denial.status }), actor.tenantId)
    }

    const rlKey =
      actor.kind === "member"
        ? `public:write:member:${actor.memberId}`
        : actor.kind === "api-token"
          ? `public:write:token:${actor.tokenId}`
          : `public:write:public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`
    const rl = await rateLimit(rlKey, { limit: 10, windowSeconds: 10 })
    if (!rl.success) {
      return log(NextResponse.json({ error: "Write rate limit exceeded. Slow down." }, { status: 429 }), actor.tenantId)
    }

    const tenantDb = await getTenantDb(actor.tenantId)

    const contentType = await tenantDb.contentType.findFirst({
      where: { slug: contentTypeSlug, OR: [{ tenantId: actor.tenantId }, { tenantId: null }] },
      include: { schemaFields: { orderBy: { order: "asc" } }, tenants: true },
    })
    if (!contentType) {
      return log(NextResponse.json({ error: "Content type not found" }, { status: 404 }), actor.tenantId)
    }
    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some((t) => t.tenantId === actor.tenantId && t.enabled)
    if (!isGlobal && !isAssigned) {
      return log(NextResponse.json({ error: "Content type not available for this tenant" }, { status: 403 }), actor.tenantId)
    }

    const entry = await tenantDb.contentEntry.findFirst({
      where: {
        contentTypeId: contentType.id,
        tenantId: actor.tenantId,
        OR: [{ id: entryIdOrDocId }, { documentId: entryIdOrDocId }],
      },
    })
    if (!entry) {
      return log(NextResponse.json({ error: "Entry not found" }, { status: 404 }), actor.tenantId)
    }

    const owns = await assertOwnershipIfRequired(actor, actor.tenantId, contentTypeSlug, action, entry)
    if (!owns) {
      return log(NextResponse.json({ error: "You can only modify entries you created" }, { status: 403 }), actor.tenantId)
    }

    if (action === "delete") {
      await tenantDb.contentEntry.delete({ where: { id: entry.id } })
      await invalidatePattern(`public_api*:${actor.tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
      return log(NextResponse.json({ data: { id: entry.id, deleted: true } }, { status: 200 }), actor.tenantId)
    }

    // ---- update ----
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || typeof body.data !== "object" || body.data === null) {
      return log(NextResponse.json({ error: "Request body must be { data: { ...fields } }" }, { status: 400 }), actor.tenantId)
    }

    const allowedFieldNames = new Set(contentType.schemaFields.map((f) => f.slug))
    let currentData: Record<string, unknown> = {}
    try {
      currentData = typeof entry.data === "string" ? JSON.parse(entry.data) : ((entry.data as Record<string, unknown>) || {})
    } catch {
      currentData = {}
    }
    const merged = { ...currentData }
    for (const [k, v] of Object.entries(body.data as Record<string, unknown>)) {
      if (allowedFieldNames.has(k)) merged[k] = v
    }

    const updated = await tenantDb.contentEntry.update({
      where: { id: entry.id },
      data: {
        data: merged as any,
        updatedBy: actor.kind === "member" ? actor.memberId : null,
      },
    })

    await invalidatePattern(`public_api*:${actor.tenantSlug}:${contentTypeSlug}:*`).catch(() => {})

    return log(
      NextResponse.json(
        {
          data: {
            id: updated.id,
            documentId: updated.documentId,
            ...merged,
            locale: updated.locale,
            status: updated.status,
            updatedAt: updated.updatedAt,
          },
        },
        { status: 200 }
      ),
      actor.tenantId
    )
  } catch (error) {
    console.error(`Error on content ${action}:`, error)
    return log(
      NextResponse.json(
        { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      ),
      null
    )
  }
}

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
    const defaultLocale = tenantDefaultLocale?.locale ?? "id"
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

/** Public API — update an entry (RBAC `update`, honours `conditions.owner`). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentType: string; id: string }> }
) {
  return writeHandler(request, params, "update")
}

/** Public API — delete an entry (RBAC `delete`, honours `conditions.owner`). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentType: string; id: string }> }
) {
  return writeHandler(request, params, "delete")
}
