import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
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

    // Get content type by slug
    const contentType = await db.contentType.findUnique({
      where: { slug },
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

    // Build where clause
    const where: Record<string, unknown> = {
      contentTypeId: contentType.id,
      tenantId: access.tenantId,
    }
    if (status) where.status = status
    if (locale) where.locale = locale

    const [entries, total] = await Promise.all([
      db.contentEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.contentEntry.count({ where }),
    ])

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

    // Get content type by slug
    const contentType = await db.contentType.findUnique({
      where: { slug },
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
    const entry = await db.contentEntry.create({
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
    await db.contentVersion.create({
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
    await logAudit({
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