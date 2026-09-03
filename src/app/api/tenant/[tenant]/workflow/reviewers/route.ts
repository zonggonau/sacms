import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { checkPermission, hasPermission, PERMISSIONS } from "@/lib/rbac"
import { assignReviewers, getReviewAssignments, submitReview } from "@/lib/content-workflow"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

async function findTenantEntry(tenantSlug: string, tenantId: string, entryId: string) {
  const tenantDb = await getTenantDb(tenantSlug)
  const entry = await tenantDb.contentEntry.findFirst({
    where: { id: entryId, tenantId },
    select: { id: true, status: true },
  })
  return { tenantDb, entry }
}

/** GET ?entryId=… — reviewers assigned to an entry. */
export const GET = withStaffAuth(async (request, context, { access }) => {
  const { tenant: tenantSlug } = await context.params
  const entryId = new URL(request.url).searchParams.get("entryId")
  if (!entryId) return apiError("validation", { message: "entryId is required" })

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
  if (!rbac.allowed) return apiError("forbidden", { message: "Missing content.read permission" })

  const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
  if (!entry) return apiError("not_found", { message: "Entry not found" })

  return NextResponse.json({ reviewers: await getReviewAssignments(entryId, tenantDb) })
})

/** POST — assign reviewers to an entry (admin/owner). */
export const POST = withStaffAuth(
  async (request, context, { access, session }) => {
    const { tenant: tenantSlug } = await context.params
    const { entryId, reviewers } = await request.json()

    if (
      !entryId ||
      !Array.isArray(reviewers) ||
      reviewers.length > 20 ||
      reviewers.some((r) => !r || typeof r.userId !== "string" || !r.userId)
    ) {
      return apiError("validation", { message: "Invalid payload" })
    }

    const normalizedReviewers = reviewers.map((r) => ({
      userId: r.userId,
      name: typeof r.name === "string" ? r.name.trim().slice(0, 200) : undefined,
    }))

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return apiError("forbidden", { message: "Missing content.update permission" })

    const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
    if (!entry) return apiError("not_found", { message: "Entry not found" })
    if (!["DRAFT", "IN_REVIEW"].includes(entry.status)) {
      return apiError("conflict", {
        message: "Reviewers can only be changed while content is Draft or In Review",
      })
    }

    const reviewerIds = [...new Set(normalizedReviewers.map((r) => r.userId))]
    if (reviewerIds.length !== normalizedReviewers.length) {
      return apiError("validation", { message: "A reviewer can only be assigned once" })
    }

    const validReviewerCount = await db.tenantMember.count({
      where: { tenantId: access.tenantId, userId: { in: reviewerIds }, role: { not: "viewer" } },
    })
    if (validReviewerCount !== reviewerIds.length) {
      return apiError("validation", {
        message: "Every reviewer must be an active, non-viewer member of this workspace",
      })
    }

    const reviewerAccess = await Promise.all(
      reviewerIds.map((userId) => hasPermission(userId, access.tenantId, PERMISSIONS.CONTENT_READ)),
    )
    if (reviewerAccess.some((allowed) => !allowed)) {
      return apiError("validation", { message: "Every reviewer must have content.read permission" })
    }

    await assignReviewers(entry.id, normalizedReviewers, session.user.id, tenantDb)
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)

/** PATCH — submit the current reviewer's decision. */
export const PATCH = withStaffAuth(async (request, context, { access, session }) => {
  const { tenant: tenantSlug } = await context.params

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
  if (!rbac.allowed) return apiError("forbidden", { message: "Missing content.read permission" })

  const body = await request.json()
  const entryId = typeof body.entryId === "string" ? body.entryId : ""
  const decision = body.decision
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : undefined
  if (!entryId || !["approved", "rejected"].includes(decision)) {
    return apiError("validation", { message: "Invalid review decision" })
  }

  const { tenantDb, entry } = await findTenantEntry(tenantSlug, access.tenantId, entryId)
  if (!entry) return apiError("not_found", { message: "Entry not found" })
  if (entry.status !== "IN_REVIEW") {
    return apiError("conflict", {
      message: "Review decisions are only accepted while content is In Review",
    })
  }

  try {
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
    // submitReview throws domain errors ("not your turn", "already decided") — surface as 409.
    const message = error instanceof Error ? error.message : "Review failed"
    if (
      message.includes("turn") ||
      message.includes("pending review") ||
      message.includes("already been decided")
    ) {
      return apiError("conflict", { message })
    }
    throw error
  }
})
