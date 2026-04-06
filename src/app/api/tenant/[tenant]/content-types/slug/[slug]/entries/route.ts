import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { createEntrySchema } from "@/lib/validations"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateContentEntry } from "@/lib/content-validations"
import { invalidatePattern } from "@/lib/cache"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries
 * Get all entries for a content type with filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Use dynamic DB client (shared or dedicated)
    const tenantDb = await getTenantDb(tenant)

    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")))
    const status = searchParams.get("status")
    const locale = searchParams.get("locale")
    const search = searchParams.get("search")

    // Build where clause
    const where: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: access.tenantId,
    }
    if (status) where.status = status
    if (locale) where.locale = locale

    let entries: any[]
    let total: number

    if (search) {
      // Use raw query for full-text search using pg_tsvector
      const whereParts: string[] = [
        `"contentTypeId" = $1`,
        `"tenantId" = $2`,
      ]
      const queryParams: unknown[] = [contentType.id, access.tenantId]
      let paramIdx = 3

      if (status) {
        whereParts.push(`"status" = $${paramIdx}`)
        queryParams.push(status)
        paramIdx++
      }

      if (locale) {
        whereParts.push(`"locale" = $${paramIdx}`)
        queryParams.push(locale)
        paramIdx++
      }

      // Sanitize search input
      const safeSearch = search.replace(/[&|!():*<>'"\\]/g, " ").trim().slice(0, 200)
      if (safeSearch) {
        whereParts.push(`("searchVector" @@ plainto_tsquery('simple', $${paramIdx}) OR "data"::text ILIKE $${paramIdx + 1})`)
        queryParams.push(safeSearch, `%${safeSearch}%`)
        paramIdx += 2
      }

      const whereClause = whereParts.join(" AND ")

      const countResult = await tenantDb.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "content_entries" WHERE ${whereClause}`,
        ...queryParams
      )
      total = Number(countResult[0].count)

      entries = await tenantDb.$queryRawUnsafe(
        `SELECT * FROM "content_entries" WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...queryParams,
        pageSize,
        (page - 1) * pageSize
      )
    } else {
      // Simple query
      const [rawEntries, count] = await Promise.all([
        tenantDb.contentEntry.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tenantDb.contentEntry.count({ where }),
      ])
      entries = rawEntries
      total = count
    }

    return NextResponse.json({
      entries,
      meta: {
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    })
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries
 * Create a new entry with Zod validation and workflow status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Validate body
    const result = await validateBody(request, createEntrySchema)
    if ("error" in result) return result.error

    const { data, status, locale, scheduledAt } = result.data

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await tenantDb.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      },
      include: { fields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // --- Dynamic Schema Validation ---
    const validation = await validateContentEntry(contentType.fields as any, data)
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: validation.errors 
      }, { status: 400 })
    }
    const finalValidatedData = validation.data
    // --------------------------------

    // Execute sync hooks (beforeCreate)
    const hookResult = await executeSyncHooks(
      access.tenantId,
      WebhookEvents.BEFORE_CREATE,
      finalValidatedData as Record<string, unknown>
    )
    if (!hookResult.allowed) {
      return NextResponse.json(
        { error: hookResult.rejectMessage || "Rejected by hook" },
        { status: 403 }
      )
    }

    const finalData = hookResult.modifiedData || finalValidatedData

    // Create entry with workflow status
    const entry = await tenantDb.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId: access.tenantId,
        locale,
        data: finalData as any,
        status: status as any,
        scheduledAt: status === "SCHEDULED" ? scheduledAt : null,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    })

    // Create initial version
    await tenantDb.contentVersion.create({
      data: {
        contentEntryId: entry.id,
        version: 1,
        data: finalData as any,
        changeType: "created",
        changedBy: session.user.id,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    })

    // Fire async webhook
    triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_CREATED, {
      entry: { id: entry.id, contentType: slug, status: entry.status },
    })

    // Invalidate public API cache for this content type
    invalidatePattern(`public_api:${tenant}:${slug}:*`).catch(() => {})

    // Audit log
    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_CREATED,
      entity: "content_entry",
      entityId: entry.id,
      data: { contentType: slug, status: entry.status, locale },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error("Error creating entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}