import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateBody } from "@/lib/validate"
import { createContentEntrySchema } from "@/lib/validations"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { processAutoSlugs } from "@/lib/slug"

// GET /api/tenant/[tenant]/content/[contentSlug] - Get all entries for a content type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug: contentTypeSlug } = await params
    
    // Resolve access and tenant ID from Master DB
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    
    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden: Missing content.read permission" }, { status: 403 })

    const tenantId = access.tenantId
    // Resolve the correct DB client (Shared or Isolated)
    const tenantDb = await getTenantDb(tenantSlug)

    // Get content type definition from Master DB
    // We look for types owned by this tenant OR global templates (tenantId: null)
    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      },
      include: {
        fields: { orderBy: { order: "asc" } },
        tenants: { where: { tenantId } }, // Check assignment for this tenant
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Access check for the content type
    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === tenantId && t.enabled)

    if (!isGlobal && !isAssigned && contentType.tenantId !== tenantId) {
      return NextResponse.json({ error: "Content type not available for this tenant" }, { status: 403 })
    }

    // Get entries from the tenant-specific database
    const entries = await tenantDb.contentEntry.findMany({
      where: {
        contentTypeId: contentType.id,
        tenantId: tenantId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json({ entries, contentType })
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/content/[contentSlug] - Create a new entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug: contentTypeSlug } = await params

    // Resolve access and tenant ID from Master DB
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_CREATE)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden: Missing content.create permission" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Get content type from Master DB
    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentTypeSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      },
      include: { tenants: { where: { tenantId } }, fields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === tenantId && t.enabled)

    if (!isGlobal && !isAssigned && contentType.tenantId !== tenantId) {
      return NextResponse.json({ error: "Content type not available for this tenant" }, { status: 403 })
    }

    const result = await validateBody(request, createContentEntrySchema)
    if ("error" in result) return result.error
    const { data, publish } = result.data

    // Enforce content entry limit based on workspace plan
    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "content_entries")
    if (!enforcement.allowed) {
      return NextResponse.json({ 
        error: enforcement.message,
        current: enforcement.current,
        max: enforcement.max,
        plan: enforcement.planSlug,
      }, { status: 403 })
    }

    // Dynamic validation
    const { validateDynamicContent } = await import("@/lib/validations/dynamic-validator")
    const dynamicValidation = await validateDynamicContent(contentType.id, tenantId, data)

    if (!dynamicValidation.success) {
      return NextResponse.json({ error: "Validation failed", details: dynamicValidation.errors }, { status: 400 })
    }

    // Process auto-generated slugs
    const dataWithSlugs = await processAutoSlugs(
      tenantId,
      contentType.id,
      contentType.fields,
      data as Record<string, any>,
      undefined,
      'content',
      tenantDb
    )

    // Execute sync hooks (beforeCreate)
    const hookResult = await executeSyncHooks(
      tenantId,
      WebhookEvents.BEFORE_CREATE,
      dataWithSlugs as Record<string, unknown>
    )
    if (!hookResult.allowed) {
      return NextResponse.json({ error: hookResult.rejectMessage || "Rejected by hook" }, { status: 403 })
    }

    const finalData = hookResult.modifiedData || dataWithSlugs

    const entryStatus = publish ? "PUBLISHED" : "DRAFT"

    // Create entry in the tenant-specific database
    const entry = await tenantDb.$transaction(async (tx) => {
      const newEntry = await tx.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId: tenantId,
          data: finalData as any,
          locale: (result.data as any).locale || "en",
          status: entryStatus,
          publishedAt: publish ? new Date() : null,
          createdBy: session.user.id,
        },
      })

      // Set documentId to the same as id for the first locale version
      const updatedEntry = await tx.contentEntry.update({
        where: { id: newEntry.id },
        data: { documentId: newEntry.id }
      })

      // Create initial version in the tenant DB
      await tx.contentVersion.create({
        data: {
          contentEntryId: newEntry.id,
          version: 1,
          data: finalData as any,
          publishedAt: publish ? new Date() : null,
          changeType: "created",
          changedBy: session.user.id,
        },
      })

      return updatedEntry
    })
    
    // Fire async webhook
    triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, {
      entry: { id: entry.id, contentType: contentType.slug, status: entry.status },
    })

    // Invalidate Public API Cache
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({
      tenantId: tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_CREATED,
      entity: "ContentEntry",
      entityId: entry.id,
      data: { contentType: contentType.slug, status: entryStatus },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error creating entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
