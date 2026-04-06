import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import {
  assignReviewers,
  getReviewAssignments,
  submitReview,
  isCurrentReviewer,
} from "@/lib/content-workflow"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"

const assignReviewersSchema = z.object({
  reviewers: z
    .array(
      z.object({
        userId: z.string().min(1),
        name: z.string().optional(),
      })
    )
    .min(1)
    .max(10),
})

const submitReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().max(2000).optional(),
})

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/reviewers
 * Get all reviewers assigned to a content entry
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify entry exists
    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await db.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const entry = await db.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const assignments = await getReviewAssignments(id)
    const currentReviewer = assignments.find((a) => a.status === "pending")

    return NextResponse.json({
      reviewers: assignments,
      currentReviewerId: currentReviewer?.reviewerId || null,
      isCurrentReviewer: await isCurrentReviewer(id, session.user.id),
    })
  } catch (error) {
    console.error("Error getting reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/reviewers
 * Assign reviewers to a content entry (owner/admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!["owner", "admin"].includes(access.role)) {
      return NextResponse.json(
        { error: "Only owner or admin can assign reviewers" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, assignReviewersSchema)
    if ("error" in result) return result.error

    // Verify entry exists
    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await db.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const entry = await db.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Verify all reviewers are members of the tenant
    const memberIds = await db.tenantMember.findMany({
      where: {
        tenantId: access.tenantId,
        userId: { in: result.data.reviewers.map((r) => r.userId) },
      },
      select: { userId: true },
    })
    const validIds = new Set(memberIds.map((m) => m.userId))
    const invalidReviewers = result.data.reviewers.filter((r) => !validIds.has(r.userId))
    if (invalidReviewers.length > 0) {
      return NextResponse.json(
        { error: "Some reviewers are not members of this tenant" },
        { status: 400 }
      )
    }

    await assignReviewers(id, result.data.reviewers, session.user.id)

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_review_assignment",
      entityId: id,
      data: {
        contentType: slug,
        reviewers: result.data.reviewers.map((r) => r.userId),
      },
    })

    const assignments = await getReviewAssignments(id)

    return NextResponse.json({ reviewers: assignments })
  } catch (error) {
    console.error("Error assigning reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/reviewers
 * Submit a review decision (current reviewer only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, submitReviewSchema)
    if ("error" in result) return result.error

    // Verify entry exists and is IN_REVIEW
    // Get content type by slug that belongs to this tenant or is global and assigned to this tenant
    const contentType = await db.contentType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
        ]
      }
    })
    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    const entry = await db.contentEntry.findFirst({
      where: { id, contentTypeId: contentType.id, tenantId: access.tenantId },
    })
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }
    if (entry.status !== "IN_REVIEW") {
      return NextResponse.json(
        { error: "Entry is not in review" },
        { status: 400 }
      )
    }

    const { decision, comment } = result.data
    const reviewResult = await submitReview(id, session.user.id, decision, comment)

    // If rejected → move entry to REJECTED
    if (reviewResult.rejected) {
      await db.contentEntry.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewComment: comment || "Rejected by reviewer",
          updatedBy: session.user.id,
        },
      })

      triggerWebhooks(access.tenantId, "content.rejected", {
        entry: { id, contentType: slug },
        reviewer: session.user.id,
        comment,
      })
    }

    // If all approved → auto-approve the entry
    if (reviewResult.allApproved) {
      await db.contentEntry.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewComment: "Approved by all reviewers",
          updatedBy: session.user.id,
        },
      })

      triggerWebhooks(access.tenantId, "content.approved", {
        entry: { id, contentType: slug },
      })
    }

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_review",
      entityId: id,
      data: { contentType: slug, decision, comment },
    })

    const assignments = await getReviewAssignments(id)

    return NextResponse.json({
      decision,
      allApproved: reviewResult.allApproved,
      rejected: reviewResult.rejected,
      reviewers: assignments,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("not your turn") || message.includes("No pending") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
