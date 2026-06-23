import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission, hasPermission, PERMISSIONS } from "@/lib/rbac"
import { assignReviewers, getReviewAssignments, submitReview } from "@/lib/content-workflow"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"

async function findTenantEntry(tenantSlug: string, tenantId: string, entryId: string) {
  const tenantDb = await getTenantDb(tenantSlug)
  const entry = await tenantDb.contentEntry.findFirst({
    where: { id: entryId, tenantId },
    select: { id: true, status: true },
  })
  return { tenantDb, entry }
}

/**
 * GET /api/tenant/[tenant]/workflow/reviewers?entryId=...
 * Get assigned reviewers for an entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get("entryId")

    if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 })

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const reviewers = await getReviewAssignments(entryId, tenantDb)

    return NextResponse.json({ reviewers })
  } catch (error) {
    console.error("Error fetching reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/workflow/reviewers
 * Assign reviewers to an entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const body = await request.json()
    const { entryId, reviewers } = body // reviewers: Array<{ userId, name }>

    if (
      !entryId ||
      !Array.isArray(reviewers) ||
      reviewers.length > 20 ||
      reviewers.some((reviewer) => !reviewer || typeof reviewer.userId !== "string" || !reviewer.userId)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const normalizedReviewers = reviewers.map((reviewer) => ({
      userId: reviewer.userId,
      name: typeof reviewer.name === "string" ? reviewer.name.trim().slice(0, 200) : undefined,
    }))

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (!["owner", "admin"].includes(access.role)) {
      return NextResponse.json(
        { error: "Only workspace owners and admins can assign reviewers" },
        { status: 403 }
      )
    }

    // Require CONTENT_UPDATE permission to assign reviewers
    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    if (!["DRAFT", "IN_REVIEW"].includes(entry.status)) {
      return NextResponse.json(
        { error: "Reviewers can only be changed while content is Draft or In Review" },
        { status: 409 }
      )
    }

    const reviewerIds = [...new Set(normalizedReviewers.map((reviewer) => reviewer.userId))]
    if (reviewerIds.length !== normalizedReviewers.length) {
      return NextResponse.json({ error: "A reviewer can only be assigned once" }, { status: 400 })
    }

    const validReviewerCount = await db.tenantMember.count({
      where: {
        tenantId: access.tenantId,
        userId: { in: reviewerIds },
        role: { not: "viewer" },
      },
    })
    if (validReviewerCount !== reviewerIds.length) {
      return NextResponse.json(
        { error: "Every reviewer must be an active, non-viewer member of this workspace" },
        { status: 400 }
      )
    }

    const reviewerAccess = await Promise.all(
      reviewerIds.map((userId) => hasPermission(userId, access.tenantId, PERMISSIONS.CONTENT_READ))
    )
    if (reviewerAccess.some((allowed) => !allowed)) {
      return NextResponse.json(
        { error: "Every reviewer must have content.read permission" },
        { status: 400 }
      )
    }

    await assignReviewers(entry.id, normalizedReviewers, session.user.id, tenantDb)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error assigning reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/[tenant]/workflow/reviewers
 * Submit the current reviewer's decision.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const entryId = typeof body.entryId === "string" ? body.entryId : ""
    const decision = body.decision
    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : undefined
    if (!entryId || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Invalid review decision" }, { status: 400 })
    }

    const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    if (entry.status !== "IN_REVIEW") {
      return NextResponse.json(
        { error: "Review decisions are only accepted while content is In Review" },
        { status: 409 }
      )
    }

    const result = await submitReview(entry.id, session.user.id, decision, comment, tenantDb)
    let nextStatus: any = entry.status
    if (result.allApproved || result.rejected) {
      nextStatus = result.allApproved ? "APPROVED" : "REJECTED"
      const updated = await tenantDb.contentEntry.update({
        where: { id: entry.id },
        data: { status: nextStatus, reviewComment: comment || null },
      })
      triggerWebhooks(access.tenantId, WebhookEvents.CONTENT_UPDATED, { entry: updated })
    }

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_review",
      entityId: entry.id,
      data: { decision, nextStatus, comment: comment || null },
    })

    return NextResponse.json({ success: true, ...result, status: nextStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status =
      message.includes("turn") ||
      message.includes("pending review") ||
      message.includes("already been decided")
        ? 409
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
