import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateBody } from "@/lib/validate"
import { createContentEntrySchema } from "@/lib/validations"

// GET /api/tenant/[tenant]/content/[contentSlug] - Get all entries for a content type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, contentSlug: contentTypeSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get content type by slug
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
    const isAssigned = contentType.tenants.some(t => t.tenantId === tenant.id && t.enabled)

    if (!isGlobal && !isAssigned) {
      return NextResponse.json({ error: "Content type not available for this tenant" }, { status: 403 })
    }

    // Get entries for this tenant and content type
    const entries = await db.contentEntry.findMany({
      where: {
        contentTypeId: contentType.id,
        tenantId: tenant.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json({ entries, contentType })
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/tenant/[tenant]/content/[contentSlug] - Create a new entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; contentSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, contentSlug: contentTypeSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get content type
    const contentType = await db.contentType.findUnique({
      where: { slug: contentTypeSlug },
      include: {
        tenants: true,
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const isGlobal = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some(t => t.tenantId === tenant.id && t.enabled)

    if (!isGlobal && !isAssigned) {
      return NextResponse.json({ error: "Content type not available for this tenant" }, { status: 403 })
    }

    const result = await validateBody(request, createContentEntrySchema)
    if ("error" in result) return result.error
    const { data, publish } = result.data

    // Dynamic validation based on content type fields
    const { validateDynamicContent } = await import("@/lib/validations/dynamic-validator")
    const dynamicValidation = await validateDynamicContent(
      contentType.id,
      tenant.id,
      data
    )

    if (!dynamicValidation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: dynamicValidation.errors },
        { status: 400 }
      )
    }

    // Create entry with tenant isolation and initial version
    const entry = await db.$transaction(async (tx) => {
      const newEntry = await tx.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId: tenant.id,
          data: data as any,
          publishedAt: publish ? new Date() : null,
          createdBy: session.user.id,
        },
      })

      // Create initial version
      await tx.contentVersion.create({
        data: {
          contentEntryId: newEntry.id,
          version: 1,
          data: data as any,
          publishedAt: publish ? new Date() : null,
          changeType: "created",
          changedBy: session.user.id,
        },
      })

      return newEntry
    })

    // Invalidate Public API Cache for this content type
    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentTypeSlug}:*`)

    logAudit({
      tenantId: tenant.id,
      userId: session.user.id,
      action: AuditAction.CONTENT_CREATED,
      entity: "ContentEntry",
      entityId: entry.id,
      data: { contentType: contentType.slug },
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error creating entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
